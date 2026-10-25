import { Injectable } from '@nestjs/common';
import { ApplicationStatus as S, RiskGrade } from '@prisma/client';
import { scoreRisk } from '../ml/scorer.js';
import { annuity } from './policy.js';
import { PRODUCT_CATALOG } from './catalog.js';

@Injectable()
export class MlMockService {
  getGosuslugiEgrulProfile(preset: 'good' | 'medium' | 'risky' = 'good') {
    const profiles = {
      good: {
        inn: '7714892011',
        ogrn: '1187746009123',
        name: 'ООО «ТехноПром Инжиниринг»',
        legalForm: 'ООО',
        okved: '25.62',
        okvedTitle: 'Обработка металла и машиностроение',
        registrationDate: '2022-03-15',
        monthlyRevenue: 4500000,
        monthlyExpenses: 3100000,
        currentDebtLoad: 150000,
      },
      medium: {
        inn: '7453091822',
        ogrn: '1257400012345',
        name: 'ИП Смирнов Алексей Викторович',
        legalForm: 'ИП',
        okved: '47.91',
        okvedTitle: 'Торговля на маркетплейсах',
        registrationDate: '2025-11-10',
        monthlyRevenue: 1200000,
        monthlyExpenses: 950000,
        currentDebtLoad: 80000,
      },
      risky: {
        inn: '5024998104',
        ogrn: '1265000099881',
        name: 'ООО «Строй Логистика»',
        legalForm: 'ООО',
        okved: '49.41',
        okvedTitle: 'Грузовой транспорт',
        registrationDate: '2026-04-01',
        monthlyRevenue: 600000,
        monthlyExpenses: 540000,
        currentDebtLoad: 140000,
      },
    };
    return {
      ...profiles[preset],
      source: 'SIMULATED · синтетический профиль ФНС / ЕГРЮЛ / БКИ',
      simulated: true,
    };
  }
  evaluateApplication(
    payload: {
      productCode: string;
      requestedAmount: number;
      requestedTermMonths: number;
      monthlyRevenue: number;
      monthlyExpenses: number;
      currentDebtLoad: number;
      registrationDate: Date;
    },
    requiresManual = false,
  ) {
    const scoredAt = new Date();
    const prediction = scoreRisk(
      {
        ...payload,
        registrationDate: payload.registrationDate.toISOString(),
        overdueDays: 0,
        taxDebt: 0,
      },
      scoredAt,
    );
    const profit = payload.monthlyRevenue - payload.monthlyExpenses,
      rate = 21.5;
    const payment = annuity(
      payload.requestedAmount,
      payload.requestedTermMonths,
      rate,
    );
    const dti =
        profit > 0 ? (payload.currentDebtLoad + payment) / profit : 9.99,
      pd = prediction.probability;
    const product = PRODUCT_CATALOG.find(
      (p) => p.code === payload.productCode,
    )!;
    const positive: string[] = [],
      negative: string[] = [];
    if (profit > 0)
      positive.push('Положительный денежный поток по данным клиента');
    if (dti <= 0.65)
      positive.push(
        `Платежи составляют ${(dti * 100).toFixed(1)}% денежного потока`,
      );
    else
      negative.push(
        `Нагрузка ${(dti * 100).toFixed(1)}%: необходимо уменьшить платёж`,
      );
    for (const factor of prediction.factors.slice(0, 3)) {
      const explanation = `Учебная модель: ${factor.label} (${factor.direction === 'raises' ? 'повышает' : 'снижает'} оценку риска относительно средней обучающей заявки)`;
      (factor.direction === 'raises' ? negative : positive).push(explanation);
    }
    let status: S = S.APPROVED,
      amount = payload.requestedAmount;
    const term = payload.requestedTermMonths;
    let note =
      'Учебное автоматическое одобрение по демонстрационной кредитной политике.';
    if (profit <= 0 || payload.currentDebtLoad >= profit || pd >= 0.7) {
      status = S.REJECTED;
      amount = 0;
      note =
        'Отказ по учебной политике: недостаточный денежный поток или высокий оценочный риск. Причины доступны в факторах.';
    } else if (dti > 0.65) {
      const unit = annuity(1000000, term, rate) / 1000000;
      const safe =
        Math.floor(
          Math.max(0, (profit * 0.65 - payload.currentDebtLoad) / unit) / 10000,
        ) * 10000;
      if (safe >= (product.min ?? 1) && safe < payload.requestedAmount) {
        status = S.COUNTER_OFFER;
        amount = safe;
        note =
          'Альтернативное предложение: сумма снижена, чтобы платежи не превышали 65% денежного потока.';
      } else {
        status = S.MANUAL_REVIEW;
        note =
          'Нужен анализ сотрудника: безопасная сумма ниже лимита продукта.';
      }
    } else if (requiresManual || pd >= 0.3) {
      status = S.MANUAL_REVIEW;
      note =
        'Нужен анализ сотрудника: уточнение допуска к продукту или пограничная оценка риска.';
    }
    if (requiresManual && status !== S.REJECTED && status !== S.MANUAL_REVIEW) {
      status = S.MANUAL_REVIEW;
      note =
        'Не все условия продукта подтверждены. Заявка направлена сотруднику банка.';
    }
    return {
      scoringScore: Math.round(1000 * (1 - pd)),
      probabilityOfDefault: pd,
      riskGrade:
        pd < 0.3 ? RiskGrade.LOW : pd < 0.7 ? RiskGrade.MEDIUM : RiskGrade.HIGH,
      recommendedStatus: status,
      approvedAmount: status === S.REJECTED ? 0 : amount,
      approvedTermMonths: term,
      approvedRate: status === S.REJECTED ? 0 : rate,
      decisionNote: note,
      enrichmentData: {
        simulated: true,
        source: 'LOCAL_SIMULATOR',
        egrul: { status: 'ДЕЙСТВУЮЩЕЕ', verifiedVia: 'SIMULATED' },
        fns: { taxDebt: 0, blockedAccounts: false, simulated: true },
        bki: { overdueDays: 0, simulated: true },
      },
      scoringFactors: {
        positive,
        negative,
        dtiRatio: Math.round(dti * 10000) / 10000,
        monthlyPayment: annuity(amount, term, rate),
        probabilityOfDefault: pd,
        modelVersion: prediction.modelVersion,
        modelSha256: prediction.modelSha256,
        modelFactors: prediction.factors,
        scoredAt: scoredAt.toISOString(),
        modelAsOf: scoredAt.toISOString(),
        dataSource: 'synthetic',
        disclaimer: prediction.disclaimer,
        policyVersion: 'demo-policy-1',
        subscriptionOffer: {
          rateWithSub: 18.5,
          monthlyFee: 4900,
          simulated: true,
        },
        applicationSnapshot: payload,
      },
    };
  }
}
