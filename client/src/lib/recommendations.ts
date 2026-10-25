import { PRODUCTS, type Product, type Answers } from "./catalog";
export type Match = {
  product: Product;
  excluded: string[];
  pending: string[];
  alternatives: string[];
};
export function evaluate(product: Product, a: Answers): Match {
  const excluded: string[] = [],
    pending: string[] = [],
    alternatives: string[] = [];
  const goal =
    a.purpose === "other" ? a.confirmedPurpose || "other" : a.purpose;
  const amount = Number(a.amount);
  // A purchase-to-cash cycle concerns each borrowing under a revolving product.
  // It is never the requested term of an investment / one-off loan.
  const cycleProduct =
    product.kind === "tranche" || product.kind === "overdraft";
  const period = a.term || (cycleProduct ? a.cashCycle : "");
  const months = Number(period);
  if (goal && goal !== "other" && !product.goals.includes(goal))
    excluded.push("Продукт предназначен для другой цели");
  if (goal === "other") pending.push("Уточнить назначение финансирования");
  if (a.usage && a.usage !== "unsure" && !product.usage.includes(a.usage))
    alternatives.push("Другой способ выдачи — возможен компромисс");
  if (
    !a.usage &&
    a.frequency === "repeat" &&
    !product.usage.some((usage) =>
      ["revolving", "balance", "card"].includes(usage),
    )
  )
    alternatives.push(
      "Этот вариант рассчитан на одну выдачу; для повторных закупок может потребоваться отдельное оформление",
    );
  if (
    !a.usage &&
    a.frequency === "once" &&
    !product.usage.some((usage) => ["single", "stages"].includes(usage))
  )
    alternatives.push(
      "Этот вариант предполагает повторное использование лимита; условия стоит сравнить с разовым кредитом",
    );
  if (amount > 0) {
    if (product.min != null && amount < product.min)
      excluded.push(
        `Минимальная сумма ${product.min.toLocaleString("ru-RU")} ₽`,
      );
    if (amount > product.max)
      excluded.push(
        `Максимальная сумма ${product.max.toLocaleString("ru-RU")} ₽`,
      );
    if (product.min == null)
      pending.push("Минимальная сумма требует уточнения");
  } else pending.push("Нужно уточнить сумму финансирования");
  if (months > 0) {
    if (
      product.kind === "loan" &&
      product.minm != null &&
      months < product.minm
    )
      excluded.push(`Минимальный срок ${product.minm} мес.`);
    if (product.maxm != null && months > product.maxm)
      excluded.push(
        `Максимальный срок ${product.maxm} мес.${product.kind === "tranche" ? " для каждого транша" : ""}`,
      );
    if (product.kind === "overdraft" && months === 3)
      pending.push("До 90 дней — с подходящей подпиской");
    if (["L1", "A1"].includes(product.id) && months > 6)
      pending.push("Транш до 12 месяцев требует подписки");
    if (product.kind === "card" && months > 3)
      pending.push(
        "Льготный период не равен сроку кредита; уточнить погашение",
      );
  } else if (cycleProduct)
    pending.push("Нужно определить срок возврата каждой взятой суммы");
  else if (product.kind !== "card")
    pending.push("Срок кредита нужно подтвердить в заявке");
  if (a.age === "unregistered")
    excluded.push("Для заявки бизнес должен быть зарегистрирован");
  if (a.age === "new" && ["N1", "R1", "R2"].includes(product.id))
    excluded.push("Нужно минимум 9 месяцев деятельности");
  if (a.age === "new" && !["A1", "N1", "R1", "R2"].includes(product.id))
    pending.push("Доступность новому бизнесу требует проверки");
  if (a.age === "unknown") pending.push("Уточнить дату регистрации");
  if (a.collateral === "no" && product.pledge === "owned")
    excluded.push("Требуется имеющееся имущество в залог");
  else if (product.pledge === "owned" && a.collateral !== "yes")
    pending.push("Обсудить имеющееся имущество для залога");
  if (a.asset === "no" && product.pledge === "purchase")
    excluded.push("Покупаемый объект должен стать залогом");
  if (a.asset === "unknown" && product.pledge === "purchase")
    pending.push("Обсудить залог покупаемого объекта");
  else if (product.pledge === "purchase" && !a.asset)
    pending.push("Уточнить согласие на залог покупаемого объекта");
  if (goal === "refi" && ["od", "card"].includes(a.refi_type))
    excluded.push("Овердрафт и карта не рефинансируются по программе");
  if (goal === "refi" && a.refi_type === "other")
    pending.push("Уточнить вид погашаемого долга");
  if (goal === "market" && product.id === "M1")
    pending.push("Подтвердить статус селлера");
  if (a.repay && !["equal", "unknown"].includes(a.repay))
    pending.push("Согласовать удобный график платежей");
  return { product, excluded, pending, alternatives };
}
export const matches = (answers: Answers) =>
  PRODUCTS.map((p) => evaluate(p, answers)).sort(
    (a, b) =>
      a.alternatives.length - b.alternatives.length ||
      a.pending.length - b.pending.length,
  );
