import { INTENT_MODEL, INTENT_MODEL_SHA256, RISK_MODEL, RISK_MODEL_SHA256 } from './model-data.js';

/** Existing debt load is the sum of existing monthly payments in RUB. */
export interface CreditFeatures {
  monthlyRevenue: number;
  monthlyExpenses: number;
  currentDebtLoad: number;
  registrationDate: string | Date;
  requestedAmount: number;
  requestedTermMonths: number;
  productCode: string;
  overdueDays?: number;
  taxDebt?: number;
}

export interface RiskFactor {
  feature: string;
  label: string;
  direction: 'raises' | 'reduces';
  contribution: number;
  value: number;
}

export interface RiskPrediction {
  probability: number;
  riskBand: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  modelVersion: string;
  modelSha256: string;
  dataSource: 'synthetic';
  disclaimer: string;
}

export type Purpose = 'operations' | 'gap' | 'equipment' | 'auto' | 'property' | 'refi' | 'market' | 'other';
export interface IntentPrediction {
  intent: Purpose;
  confidence: number;
  needsClarification: boolean;
  modelVersion: string;
  source: 'local-trained-classifier';
  candidates: { intent: Purpose; confidence: number }[];
  disclaimer: string;
}

const DAY = 86_400_000;
const labels = [
  'Месячная выручка',
  'Операционная рентабельность',
  'Текущие платежи относительно выручки',
  'Сумма запроса относительно годовой выручки',
  'Основной долг относительно свободного потока',
  'Возраст бизнеса',
  'Дни просрочки',
  'Налоговая задолженность относительно выручки',
  'Срок финансирования',
];
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
const logistic = (value: number) => 1 / (1 + Math.exp(-clamp(value, -35, 35)));

function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
  return value;
}

/** Shared contract with ml/train.py::features. No external data enrichment. */
export function riskFeatures(input: CreditFeatures, asOf = new Date()): number[] {
  const revenue = nonnegative(input.monthlyRevenue, 'monthlyRevenue');
  const expenses = nonnegative(input.monthlyExpenses, 'monthlyExpenses');
  const debt = nonnegative(input.currentDebtLoad, 'currentDebtLoad');
  const amount = nonnegative(input.requestedAmount, 'requestedAmount');
  const overdue = nonnegative(input.overdueDays ?? 0, 'overdueDays');
  const taxDebt = nonnegative(input.taxDebt ?? 0, 'taxDebt');
  if (revenue === 0 || amount === 0) throw new RangeError('Revenue and requested amount must be positive');
  if (!Number.isInteger(input.requestedTermMonths) || input.requestedTermMonths < 1 || input.requestedTermMonths > 240) {
    throw new RangeError('requestedTermMonths must be an integer between 1 and 240');
  }
  const registration = new Date(input.registrationDate);
  if (!Number.isFinite(registration.getTime()) || !Number.isFinite(asOf.getTime()) || registration > asOf) {
    throw new RangeError('registrationDate must be a valid past date');
  }
  const surplus = revenue - expenses;
  return [
    Math.log1p(revenue),
    clamp(surplus / revenue, -2, 1),
    Math.min(debt / revenue, 5),
    Math.min(amount / (revenue * 12), 10),
    Math.min((amount / input.requestedTermMonths) / Math.max(surplus, revenue * 0.05), 20),
    Math.min((asOf.getTime() - registration.getTime()) / DAY / 365.25, 20),
    Math.min(overdue / 30, 6),
    Math.min(taxDebt / revenue, 5),
    input.requestedTermMonths / 12,
  ];
}

/** Probability is calibrated on synthetic outcomes only. Bank decisions belong to the policy service. */
export function scoreRisk(input: CreditFeatures, asOf = new Date()): RiskPrediction {
  const values = riskFeatures(input, asOf);
  const standardized = values.map((value, i) => (value - RISK_MODEL.mean[i]) / RISK_MODEL.scale[i]);
  const contributions = standardized.map((value, i) => value * RISK_MODEL.coefficients[i]);
  const logit = RISK_MODEL.intercept + contributions.reduce((sum, value) => sum + value, 0);
  const probability = logistic(RISK_MODEL.calibration.intercept + RISK_MODEL.calibration.slope * logit);
  const factors: RiskFactor[] = contributions.map((value, i) => ({
    feature: RISK_MODEL.featureNames[i],
    label: labels[i],
    direction: value >= 0 ? 'raises' : 'reduces',
    contribution: Number((value * RISK_MODEL.calibration.slope).toFixed(6)),
    value: Number(values[i].toFixed(6)),
  }));
  factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return {
    probability,
    // UI bands are illustrative, not validated bank policy thresholds.
    riskBand: probability < 0.1 ? 'low' : probability < 0.25 ? 'medium' : 'high',
    factors,
    modelVersion: RISK_MODEL.version,
    modelSha256: RISK_MODEL_SHA256,
    dataSource: 'synthetic',
    disclaimer: 'Учебная оценка на синтетических данных. Не является банковской вероятностью дефолта, решением или проверкой ФНС/БКИ. Вклады признаков объясняют модель, а не причины дефолта.',
  };
}

const vocabularyIndex = new Map(INTENT_MODEL.vocabulary.map((value, i) => [value, i]));

/** Word and character feature extraction matches the Python training implementation. */
export function purposeFeatures(text: string): Map<string, number> {
  const result = new Map<string, number>();
  const words = text.toLowerCase().replaceAll('ё', 'е').slice(0, 1000).match(/[a-zа-я0-9]{2,}/g) ?? [];
  const add = (feature: string, amount: number) => result.set(feature, (result.get(feature) ?? 0) + amount);
  for (const word of words) {
    add(`w:${word}`, 1);
    if (word.length >= 3) {
      const padded = `^${word}$`;
      for (let i = 0; i < padded.length - 2; i++) add(`c:${padded.slice(i, i + 3)}`, 0.3);
    }
  }
  return result;
}

/** Trained multinomial NB, not a keyword routing rule. Unknown requests abstain. */
export function classifyIntent(text: string): IntentPrediction {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const extracted = purposeFeatures(text);
  const logits = [...INTENT_MODEL.logPrior];
  let wordHits = 0;
  let charHits = 0;
  let charTotal = 0;
  for (const [feature, count] of extracted) {
    const index = vocabularyIndex.get(feature);
    if (feature.startsWith('c:')) {
      charTotal++;
      if (index !== undefined) charHits++;
    } else if (index !== undefined) wordHits++;
    if (index !== undefined) {
      for (let label = 0; label < logits.length; label++) logits[label] += Math.min(count, 3) * INTENT_MODEL.logLikelihood[label][index];
    }
  }
  const scores = logits.map((value) => value / INTENT_MODEL.temperature);
  const maxScore = Math.max(...scores);
  const exp = scores.map((value) => Math.exp(value - maxScore));
  const sum = exp.reduce((total, value) => total + value, 0);
  const candidates = exp.map((value, i) => ({ intent: INTENT_MODEL.labels[i] as Purpose, confidence: value / sum })).sort((a, b) => b.confidence - a.confidence);
  const first = candidates[0];
  const accepted = first.confidence >= INTENT_MODEL.confidenceThreshold
    && first.confidence - candidates[1].confidence >= INTENT_MODEL.marginThreshold
    && wordHits >= 1 && charHits / Math.max(charTotal, 1) >= INTENT_MODEL.minKnownCharFraction;
  return {
    intent: accepted ? first.intent : 'other',
    confidence: first.confidence,
    needsClarification: !accepted,
    modelVersion: INTENT_MODEL.version,
    source: 'local-trained-classifier',
    candidates: candidates.slice(0, 2),
    disclaimer: 'Локальный учебный классификатор на небольшом авторском корпусе. Уверенность относительная, не измеренная вероятность правильного ответа. Подтвердите предложенную цель.',
  };
}

export const classifyPurpose = classifyIntent;
export const ML_MODEL_INFO = {
  risk: { version: RISK_MODEL.version, sha256: RISK_MODEL_SHA256, dataSource: 'synthetic', trainingRows: 24000, independentTestRows: 6000, validatedOnBankData: false },
  intent: { version: INTENT_MODEL.version, sha256: INTENT_MODEL_SHA256, dataSource: 'authored-demo-corpus', trainingRows: 98, testRows: 28, requiresPurposeConfirmation: true },
};
