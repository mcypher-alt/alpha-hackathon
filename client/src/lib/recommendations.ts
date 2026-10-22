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
  const amount = Number(a.amount),
    months = Number(a.term);
  if (goal && goal !== "other" && !product.goals.includes(goal))
    excluded.push("Продукт предназначен для другой цели");
  if (goal === "other") pending.push("Уточнить назначение финансирования");
  if (a.usage && a.usage !== "unsure" && !product.usage.includes(a.usage))
    alternatives.push("Другой способ выдачи — возможен компромисс");
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
  }
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
  } else if (a.term) pending.push("Нужно определить срок возврата");
  if (a.age === "unregistered")
    excluded.push("Для заявки бизнес должен быть зарегистрирован");
  if (a.age === "new" && ["N1", "R1", "R2"].includes(product.id))
    excluded.push("Нужно минимум 9 месяцев деятельности");
  if (a.age === "new" && !["A1", "N1", "R1", "R2"].includes(product.id))
    pending.push("Доступность новому бизнесу требует проверки");
  if (a.age === "unknown") pending.push("Уточнить дату регистрации");
  if (a.collateral === "no" && product.pledge === "owned")
    excluded.push("Требуется имеющееся имущество в залог");
  if (a.asset === "no" && product.pledge === "purchase")
    excluded.push("Покупаемый объект должен стать залогом");
  if (a.asset === "unknown" && product.pledge === "purchase")
    pending.push("Обсудить залог покупаемого объекта");
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
