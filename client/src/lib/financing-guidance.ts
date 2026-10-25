import type { Answers, Product } from "./catalog";

/** An illustration for the applicant, never a credit rule or a model feature. */
export const GUIDANCE_ANNUAL_RATE = 21.5;
export const CASH_RESERVE_SHARE = 0.5;
export const MAX_MONTHLY_VALUE = 1e12;

export function monthlyValue(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= MAX_MONTHLY_VALUE
    ? number
    : null;
}

export function monthlyCash(answers: Answers) {
  const revenue = monthlyValue(answers.monthlyRevenue);
  const expenses = monthlyValue(answers.monthlyExpenses);
  const debtPayments = monthlyValue(answers.currentDebtLoad);
  const complete =
    revenue !== null && expenses !== null && debtPayments !== null;
  const freeCashFlow = complete ? revenue - expenses - debtPayments : null;
  return {
    revenue,
    expenses,
    debtPayments,
    complete,
    freeCashFlow,
    paymentBudget:
      freeCashFlow !== null && freeCashFlow > 0
        ? freeCashFlow * CASH_RESERVE_SHARE
        : null,
  };
}

export function estimatePayment(
  amount: number,
  termMonths: number,
  annualRate = GUIDANCE_ANNUAL_RATE,
): number | null {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isInteger(termMonths) ||
    termMonths <= 0 ||
    !Number.isFinite(annualRate) ||
    annualRate < 0
  )
    return null;
  const rate = annualRate / 1200;
  return rate === 0
    ? amount / termMonths
    : (amount * rate) / (1 - Math.pow(1 + rate, -termMonths));
}

export type FinancingGuidance = {
  kind: "loan" | "cycle" | "card" | "project-line";
  suggestedTermMonths: number | null;
  monthlyPayment: number | null;
  freeCashFlow: number | null;
  paymentBudget: number | null;
  note: string;
};

export function financingGuidance(
  product: Product,
  amount: number,
  answers: Answers,
): FinancingGuidance {
  const cash = monthlyCash(answers);
  const base = {
    suggestedTermMonths: null,
    monthlyPayment: null,
    freeCashFlow: cash.freeCashFlow,
    paymentBudget: cash.paymentBudget,
  };
  if (product.kind === "card")
    return {
      ...base,
      kind: "card",
      note: "У карты отдельные правила льготного периода и погашения. Ежемесячный платёж по ней здесь не рассчитываем.",
    };
  if (product.id === "L3")
    return {
      ...base,
      kind: "project-line",
      note: "Деньги выдаются частями по проекту. Срок и график нужно согласовать по этапам работ; платёж разового кредита здесь неприменим.",
    };
  if (product.kind === "tranche" || product.kind === "overdraft") {
    const cycle = monthlyValue(answers.cashCycle);
    const usableCycle =
      cycle !== null &&
      Number.isInteger(cycle) &&
      cycle > 0 &&
      (product.maxm === null || cycle <= product.maxm);
    return {
      ...base,
      kind: "cycle",
      suggestedTermMonths: usableCycle ? cycle : null,
      note: usableCycle
        ? `Срок возврата каждой взятой суммы — ${cycle} мес., по указанному вами сроку от закупки до получения денег. Это не срок действия всей линии.`
        : "Нужно уточнить, через сколько после закупки приходят деньги. От этого зависит срок возврата каждой взятой суммы; срок всей линии может быть дольше.",
    };
  }
  if (!cash.complete)
    return {
      ...base,
      kind: "loan",
      note: "Срок пока не выбран. Если укажете выручку, расходы и текущие платежи, покажем ориентир по сроку и новому платежу.",
    };
  if (cash.paymentBudget === null)
    return {
      ...base,
      kind: "loan",
      note: "По этим оценкам свободный остаток не положительный, поэтому ориентир по новому платежу не рассчитан. Это не отказ: показатели и условия можно уточнить в заявке.",
    };
  if (!Number.isFinite(amount) || amount <= 0)
    return {
      ...base,
      kind: "loan",
      note: "Для расчёта платежа нужна сумма финансирования.",
    };
  const minimum = product.minm ?? 1;
  const maximum = product.maxm;
  if (maximum === null)
    return {
      ...base,
      kind: "loan",
      note: "Срок продукта требует уточнения; не подставляем неподтверждённые ограничения.",
    };
  const candidates = [
    ...new Set([minimum, 6, 12, 18, 24, 36, 48, 60, 84, 120, maximum]),
  ]
    .filter((term) => term >= minimum && term <= maximum)
    .sort((a, b) => a - b);
  const suggested = candidates.find(
    (term) =>
      (estimatePayment(amount, term) ?? Infinity) <= cash.paymentBudget!,
  );
  if (suggested === undefined)
    return {
      ...base,
      kind: "loan",
      note: "В пределах срока этого продукта платёж с расчётным запасом пока не найден. Это не отказ: можно уточнить показатели или сумму в заявке.",
    };
  return {
    ...base,
    kind: "loan",
    suggestedTermMonths: suggested,
    monthlyPayment: estimatePayment(amount, suggested),
    note: "Для примера оставляем половину остатка после расходов и действующих кредитов как расчётный запас. Используем учебную ставку 21,5% и равные платежи. Это ориентир, не требование или предложение банка.",
  };
}

/** Transfer only numbers actually entered by the user. Empty means unknown, not zero. */
export function financialDraft(answers: Answers) {
  return {
    monthlyRevenue:
      monthlyValue(answers.monthlyRevenue) !== null
        ? answers.monthlyRevenue
        : "",
    monthlyExpenses:
      monthlyValue(answers.monthlyExpenses) !== null
        ? answers.monthlyExpenses
        : "",
    currentDebtLoad:
      monthlyValue(answers.currentDebtLoad) !== null
        ? answers.currentDebtLoad
        : "",
  };
}
