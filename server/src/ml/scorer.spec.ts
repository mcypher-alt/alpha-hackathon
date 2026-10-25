import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { INTENT_MODEL, INTENT_MODEL_SHA256, RISK_GOLDEN, RISK_MODEL, RISK_MODEL_SHA256 } from './model-data.js';
import { classifyIntent, riskFeatures, scoreRisk } from './scorer.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

describe('Bundled offline models', () => {
  it('retains exact exported parameter identities', () => {
    expect(createHash('sha256').update(canonical(RISK_MODEL)).digest('hex')).toBe(RISK_MODEL_SHA256);
    expect(createHash('sha256').update(canonical(INTENT_MODEL)).digest('hex')).toBe(INTENT_MODEL_SHA256);
  });

  it('matches Python risk predictions on independent golden inputs', () => {
    for (const row of RISK_GOLDEN) {
      const result = scoreRisk(row.input, new Date(row.asOf));
      expect(result.probability).toBeCloseTo(row.probability, 9);
      expect(result.dataSource).toBe('synthetic');
      expect(result.factors).toHaveLength(RISK_MODEL.featureNames.length);
    }
  });

  it('treats debt load as monthly RUB and preserves train feature order', () => {
    const row = RISK_GOLDEN[0];
    const x = riskFeatures(row.input, new Date(row.asOf));
    expect(x[2]).toBeCloseTo(150000 / 4500000, 12);
    expect(x[4]).toBeCloseTo((3000000 / 36) / (4500000 - 3100000), 12);
    expect(x.every(Number.isFinite)).toBe(true);
  });

  it('raises synthetic risk when existing payments and overdue days increase', () => {
    const { input, asOf } = RISK_GOLDEN[0];
    const baseline = scoreRisk(input, new Date(asOf)).probability;
    const stressed = scoreRisk({ ...input, currentDebtLoad: 1_500_000, overdueDays: 60 }, new Date(asOf)).probability;
    expect(stressed).toBeGreaterThan(baseline);
  });

  it('rejects missing, future and non-finite financial inputs', () => {
    const { input, asOf } = RISK_GOLDEN[0];
    for (const change of [{ monthlyRevenue: 0 }, { monthlyRevenue: Number.NaN }, { requestedAmount: -1 }, { requestedTermMonths: 0 }, { requestedTermMonths: 2.2 }, { registrationDate: 'invalid' }, { registrationDate: '2099-01-01' }, { overdueDays: -1 }]) {
      expect(() => scoreRisk({ ...input, ...change }, new Date(asOf))).toThrow();
    }
  });

  it('uses learned word/char weights for representative purposes', () => {
    expect(classifyIntent('Нужны деньги на оборудование').intent).toBe('equipment');
    expect(classifyIntent('Хочу рефинансировать действующий кредит').intent).toBe('refi');
    expect(classifyIntent('Нужен грузовик для перевозок').intent).toBe('auto');
    expect(classifyIntent('Финансирование закупок для Ozon').intent).toBe('market');
  });

  it('abstains on empty, vague and out-of-domain requests', () => {
    for (const text of ['', 'Привет', 'Мне нужны деньги', 'Хочу узнать погоду', 'abcdefghijk xyz']) {
      const result = classifyIntent(text);
      expect(result.intent).toBe('other');
      expect(result.needsClarification).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('keeps all trained likelihood rows aligned with the vocabulary', () => {
    expect(new Set(INTENT_MODEL.vocabulary).size).toBe(INTENT_MODEL.vocabulary.length);
    for (const row of INTENT_MODEL.logLikelihood) {
      expect(row).toHaveLength(INTENT_MODEL.vocabulary.length);
      expect(row.every(Number.isFinite)).toBe(true);
    }
    expect(classifyIntent('оборудование '.repeat(10000))).toEqual(classifyIntent('оборудование '.repeat(10000).slice(0, 1000)));
  });
});
