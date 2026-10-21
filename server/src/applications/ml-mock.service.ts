import { Injectable } from '@nestjs/common';
import { ApplicationStatus, RiskGrade } from '@prisma/client';

@Injectable()
export class MlMockService {
  // 1. Мок выгрузки из Госуслуг / ЕГРЮЛ / ФНС[cite: 10, 13]
  getGosuslugiEgrulProfile(preset: 'good' | 'medium' | 'risky' = 'good') {
    const profiles = {
      good: {
        inn: '7714892011',
        ogrn: '1187746009123',
        name: 'ООО «ТехноПром Инжиниринг»',
        legalForm: 'ООО',
        okved: '25.62',
        okvedTitle: 'Обработка металлических изделий и машиностроение',
        registrationDate: '2022-03-15',
        monthlyRevenue: 4500000,
        monthlyExpenses: 3100000,
        currentDebtLoad: 150000,
        source: 'ЕСИА Госуслуги + ФНС ЕГРЮЛ (Подтверждено ЭЦП)',
      },
      medium: {
        inn: '7453091822',
        ogrn: '1257400012345',
        name: 'ИП Смирнов Алексей Викторович',
        legalForm: 'ИП',
        okved: '47.91',
        okvedTitle: 'Торговля розничная по почте или по сети Интернет (Маркетплейсы)',
        registrationDate: '2025-11-10',
        monthlyRevenue: 1200000,
        monthlyExpenses: 950000,
        currentDebtLoad: 180000,
        source: 'ЕСИА Госуслуги + ФНС ЕГРИП (Подтверждено)',
      },
      risky: {
        inn: '5024998104',
        ogrn: '1265000099881',
        name: 'ООО «АльфаСтрой Логистик»',
        legalForm: 'ООО',
        okved: '49.41',
        okvedTitle: 'Деятельность автомобильного грузового транспорта',
        registrationDate: '2026-04-01',
        monthlyRevenue: 600000,
        monthlyExpenses: 540000,
        currentDebtLoad: 140000,
        source: 'ЕСИА Госуслуги + ФНС ЕГРЮЛ',
      },
    };
    return profiles[preset] || profiles.good;
  }

  // 2. Вызов реального ML-сервиса с автоматическим фоллбэком на встроенный мок[cite: 10, 14]
  async evaluateApplication(payload: {
    productCode: string;
    requestedAmount: number;
    requestedTermMonths: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    currentDebtLoad: number;
    registrationDate: Date;
  }) {
    // Если ML-щик дал урл — пробуем стукнуться к нему
    if (process.env.ML_SERVICE_URL) {
      try {
        const res = await fetch(`${process.env.ML_SERVICE_URL}/ml/score-application`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn('Внешний ML-сервис недоступен, используем встроенную модель скоринга');
      }
    }

    // Встроенная балльная модель (0 - 1000) по правилам кейса[cite: 14, 15, 21]
    let score = 650;
    const positive: string[] = [];
    const negative: string[] = [];

    const netProfit = payload.monthlyRevenue - payload.monthlyExpenses;
    const monthlyPaymentEst = (payload.requestedAmount / payload.requestedTermMonths) * 1.18;
    const totalDebtLoad = payload.currentDebtLoad + monthlyPaymentEst;
    const dti = netProfit > 0 ? totalDebtLoad / netProfit : 9.99;

    // Возраст бизнеса в месяцах[cite: 19, 21]
    const monthsOld = Math.max(
      1,
      Math.floor((Date.now() - new Date(payload.registrationDate).getTime()) / (1000 * 60 * 60 * 24 * 30)),
    );

    if (monthsOld >= 9) {
      score += 110;
      positive.push(`Стаж бизнеса ${monthsOld} мес. (превышает порог 9 мес.)`);
    } else if (payload.productCode === 'A1') {
      score += 40;
      positive.push('Продукт «Альфа-Старт» (A1) доступен с 1-го дня регистрации');
    } else {
      score -= 120;
      negative.push(`Возраст бизнеса менее 9 мес. (${monthsOld} мес.) — требуется ручная верификация`);
    }

    if (dti <= 0.45) {
      score += 130;
      positive.push(`Низкая долговая нагрузка (DTI ${(dti * 100).toFixed(0)}%)`);
    } else if (dti <= 0.75) {
      score -= 40;
      negative.push(`Повышенная нагрузка на чистую прибыль (DTI ${(dti * 100).toFixed(0)}%)`);
    } else {
      score -= 220;
      negative.push(`Критическая долговая нагрузка (платеж превышает свободный денежный поток)`);
    }

    score = Math.max(250, Math.min(980, score));

    let riskGrade: RiskGrade = RiskGrade.LOW;
    let recommendedStatus: ApplicationStatus = ApplicationStatus.APPROVED;
    let approvedAmount = payload.requestedAmount;
    let approvedTermMonths = payload.requestedTermMonths;
    let approvedRate = 21.5;
    let decisionNote = 'ML-конвейер: Автоматическое одобрение. Все проверки ФНС и БКИ пройдены.';

    if (score >= 750) {
      riskGrade = RiskGrade.LOW;
      recommendedStatus = ApplicationStatus.APPROVED;
    } else if (score >= 580) {
      riskGrade = RiskGrade.MEDIUM;
      // Генерируем контр-оффер: снижаем сумму до безопасной или отправляем на ручной разбор[cite: 15]
      const safeAmount = Math.max(300000, Math.round((netProfit * 0.5 * payload.requestedTermMonths) / 100000) * 100000);
      if (safeAmount < payload.requestedAmount) {
        recommendedStatus = ApplicationStatus.COUNTER_OFFER;
        approvedAmount = safeAmount;
        approvedTermMonths = Math.min(60, payload.requestedTermMonths + 12);
        approvedRate = 22.9;
        decisionNote = `ML-конвейер сформировал альтернативное предложение: сумма скорректирована до ${safeAmount.toLocaleString('ru-RU')} ₽ для снижения платежной нагрузки.`;
      } else {
        recommendedStatus = ApplicationStatus.MANUAL_REVIEW;
        decisionNote = 'ML-конвейер: Пограничный скоринговый балл, требуется подтверждение андеррайтера.';
      }
    } else {
      riskGrade = RiskGrade.HIGH;
      recommendedStatus = ApplicationStatus.REJECTED;
      approvedRate = 0;
      approvedAmount = 0;
      decisionNote = 'ML-конвейер: Высокий риск дефолта (недостаточный оборот относительно суммы кредита).';
    }

    return {
      scoringScore: score,
      probabilityOfDefault: Number(((1000 - score) / 1000).toFixed(3)),
      riskGrade,
      recommendedStatus,
      approvedAmount,
      approvedTermMonths,
      approvedRate,
      decisionNote,
      enrichmentData: {
        egrul: { status: 'ДЕЙСТВУЮЩЕЕ', verifiedVia: 'Госуслуги / ФНС' },
        fns: { taxDebt: 0, blockedAccounts: false },
        bki: { overdueDays: score < 500 ? 35 : 0, creditHistoryScore: score },
      },
      scoringFactors: {
        positive,
        negative,
        dtiRatio: Number(dti.toFixed(2)),
        subscriptionOffer: {
          rateWithSub: Number((approvedRate - 3.0).toFixed(1)),
          monthlyFee: 4900,
        },
      },
    };
  }
}