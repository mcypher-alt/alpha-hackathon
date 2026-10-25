"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { api, save, stored, session, money, payment } from "@/lib/api";
import { PRODUCTS, type Answers } from "@/lib/catalog";
import {
  financingGuidance,
  financialDraft,
  monthlyCash,
  monthlyValue,
} from "@/lib/financing-guidance";
import { ErrorBox } from "@/components/common";
type Form = {
  productCode: string;
  requestedAmount: string;
  requestedTermMonths: string;
  purpose: string;
  inn: string;
  ogrn: string;
  companyName: string;
  legalForm: string;
  okved: string;
  okvedTitle: string;
  registrationDate: string;
  monthlyRevenue: string;
  monthlyExpenses: string;
  currentDebtLoad: string;
};
const empty: Form = {
  productCode: "K1",
  requestedAmount: "",
  requestedTermMonths: "",
  purpose: "Пополнение оборотных средств",
  inn: "",
  ogrn: "",
  companyName: "",
  legalForm: "ООО",
  okved: "",
  okvedTitle: "",
  registrationDate: "",
  monthlyRevenue: "",
  monthlyExpenses: "",
  currentDebtLoad: "",
};
type Draft = {
  productCode?: string;
  amount?: string;
  term?: string;
  purpose?: string;
  monthlyRevenue?: string;
  monthlyExpenses?: string;
  currentDebtLoad?: string;
  answers?: Answers;
};
export default function ApplyPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>(empty),
    [answers, setAnswers] = useState<Answers>({}),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [showComparison, setShowComparison] = useState(false);
  useEffect(() => {
    const d = stored<Draft>("alfa.draft", {}),
      f = stored<Form | null>("alfa.apply", null);
    const finances = financialDraft(d.answers || {});
    setForm(
      f && f.productCode === (d.productCode || "K1")
        ? f
        : {
            ...empty,
            productCode: d.productCode || "K1",
            requestedAmount: d.amount || "",
            requestedTermMonths: d.term && Number(d.term) > 0 ? d.term : "",
            purpose: d.purpose || empty.purpose,
            ...finances,
          },
    );
    setAnswers(d.answers || {});
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) save("alfa.apply", form);
  }, [form, ready]);
  const product =
    PRODUCTS.find((p) => p.id === form.productCode) || PRODUCTS[0];
  const update = (key: keyof Form, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));
  const cash = monthlyCash(form);
  const guidance = financingGuidance(product, Number(form.requestedAmount), {
    ...answers,
    ...form,
  });
  async function profile(preset: string) {
    setBusy(preset);
    setError("");
    try {
      const p = await api<{
        inn: string;
        ogrn: string;
        name: string;
        legalForm: string;
        okved: string;
        okvedTitle: string;
        registrationDate: string;
        monthlyRevenue: number;
        monthlyExpenses: number;
        currentDebtLoad: number;
      }>(`/applications/gosuslugi-mock?preset=${preset}`);
      setForm((f) => ({
        ...f,
        inn: p.inn,
        ogrn: p.ogrn,
        companyName: p.name,
        legalForm: p.legalForm,
        okved: p.okved,
        okvedTitle: p.okvedTitle,
        registrationDate: p.registrationDate.slice(0, 10),
        monthlyRevenue: String(p.monthlyRevenue),
        monthlyExpenses: String(p.monthlyExpenses),
        currentDebtLoad: String(p.currentDebtLoad),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!session()) {
      router.push("/login?redirect=/apply");
      return;
    }
    if (session()?.user.role !== "CLIENT") {
      setError(
        "Подать заявку можно из кабинета предпринимателя. Войдите под соответствующей учётной записью.",
      );
      return;
    }
    if (
      !form.monthlyRevenue.trim() ||
      !form.monthlyExpenses.trim() ||
      !form.currentDebtLoad.trim() ||
      Number(form.monthlyRevenue) <= 0 ||
      [form.monthlyRevenue, form.monthlyExpenses, form.currentDebtLoad].some(
        (value) => monthlyValue(value) === null,
      )
    ) {
      setError(
        "Для отправки заявки нужны финансовые показатели: выручка, расходы и действующие платежи. Если платежей нет, укажите 0. Пропущенные ответы не заменяются нулями.",
      );
      return;
    }
    setBusy("submit");
    try {
      const result = await api<{ id: string }>("/applications", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          productName: product.name,
          requestedAmount: Number(form.requestedAmount),
          requestedTermMonths: Number(form.requestedTermMonths),
          monthlyRevenue: Number(form.monthlyRevenue),
          monthlyExpenses: Number(form.monthlyExpenses),
          currentDebtLoad: Number(form.currentDebtLoad),
          consent,
          answers: {
            ...answers,
            monthlyRevenue: form.monthlyRevenue,
            monthlyExpenses: form.monthlyExpenses,
            currentDebtLoad: form.currentDebtLoad,
            financialDataReviewed: "yes",
          },
          purposeCode:
            answers.purpose === "other"
              ? answers.confirmedPurpose
              : answers.purpose,
        }),
      });
      localStorage.removeItem("alfa.apply");
      router.push(`/my-applications?id=${result.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const amount = Number(form.requestedAmount),
    term = Number(form.requestedTermMonths),
    plain = payment(amount, 21.5, term),
    sub = payment(amount, 18.5, term),
    fee = 4900;
  return (
    <div className="page">
      <div className="eyebrow">СЛЕДУЮЩИЙ ШАГ</div>
      <div className="page-heading compact">
        <h1>Заявка на финансирование</h1>
        <p>
          Перенесли ваши ответы. Проверьте суммы, дополните сведения и укажите
          срок, на котором хотите остановиться.
        </p>
      </div>
      <ErrorBox message={error} />
      <form onSubmit={submit}>
        <div className="apply-layout">
          <div>
            <section className="panel form-section">
              <div className="section-heading">
                <h2>
                  <span className="section-number">01</span>Параметры кредита
                </h2>
                <Link href="/survey" className="small">
                  Изменить подбор ↗
                </Link>
              </div>
              <div className="chosen-product">
                <span className="product-code">{product.id}</span>
                <div>
                  <h3>{product.name}</h3>
                  <p>
                    {product.term} ·{" "}
                    {product.pledge === "none"
                      ? "Без залога имущества"
                      : product.pledge === "owned"
                        ? "Под залог имущества"
                        : "Залог покупаемого объекта"}
                  </p>
                </div>
              </div>
              <div className="guidance-note">
                <p>{guidance.note}</p>
                {guidance.kind === "loan" &&
                  guidance.monthlyPayment !== null &&
                  guidance.suggestedTermMonths !== null && (
                    <p>
                      Расчётный ориентир: {guidance.suggestedTermMonths} мес. и
                      около {money(guidance.monthlyPayment)} в месяц. Можно
                      выбрать другой срок в пределах продукта.
                    </p>
                  )}
                {!form.requestedTermMonths &&
                  guidance.suggestedTermMonths !== null && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        update(
                          "requestedTermMonths",
                          String(guidance.suggestedTermMonths),
                        )
                      }
                    >
                      Использовать {guidance.suggestedTermMonths} мес.
                    </button>
                  )}
              </div>
              <div className="form-grid">
                <label>
                  Сумма финансирования, ₽
                  <input
                    required
                    type="number"
                    min={product.min ?? 1}
                    max={product.max}
                    value={form.requestedAmount}
                    onChange={(e) => update("requestedAmount", e.target.value)}
                  />
                </label>
                <label>
                  {product.kind === "tranche" || product.kind === "overdraft"
                    ? "За сколько вернуть каждую взятую сумму, мес."
                    : "На какой срок оформить, мес."}
                  <input
                    required
                    type="number"
                    min={product.minm ?? 1}
                    max={product.maxm ?? 180}
                    value={form.requestedTermMonths}
                    placeholder={
                      product.maxm
                        ? `До ${product.maxm} мес.`
                        : "Нужно уточнить"
                    }
                    onChange={(e) =>
                      update("requestedTermMonths", e.target.value)
                    }
                  />
                </label>
                <label className="span-2">
                  Цель финансирования
                  <textarea
                    required
                    rows={2}
                    maxLength={1000}
                    value={form.purpose}
                    onChange={(e) => update("purpose", e.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="panel form-section">
              <div className="section-heading">
                <h2>
                  <span className="section-number">02</span>Данные бизнеса
                </h2>
                <Building2 size={21} />
              </div>
              <div className="profile-demo">
                <b>Заполнить учебным профилем</b>
                <p>Локальный симулятор ЕГРЮЛ и финансовых данных.</p>
                <div className="chips">
                  {[
                    ["good", "Устойчивый бизнес"],
                    ["medium", "Молодой бизнес"],
                    ["risky", "Высокая нагрузка"],
                  ].map(([key, label]) => (
                    <button
                      type="button"
                      key={key}
                      disabled={!!busy}
                      className="chip"
                      onClick={() => void profile(key)}
                    >
                      {busy === key ? "Загружаем…" : label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <label className="span-2">
                  Название компании / ФИО ИП
                  <input
                    required
                    maxLength={200}
                    value={form.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                  />
                </label>
                <label>
                  ИНН
                  <input
                    required
                    pattern="[0-9]{10}|[0-9]{12}"
                    inputMode="numeric"
                    title="ИНН из 10 или 12 цифр"
                    value={form.inn}
                    onChange={(e) => update("inn", e.target.value)}
                  />
                </label>
                <label>
                  ОГРН / ОГРНИП
                  <input
                    required
                    pattern="[0-9]{13}|[0-9]{15}"
                    title="13 или 15 цифр"
                    value={form.ogrn}
                    onChange={(e) => update("ogrn", e.target.value)}
                  />
                </label>
                <label>
                  Правовая форма
                  <select
                    value={form.legalForm}
                    onChange={(e) => update("legalForm", e.target.value)}
                  >
                    <option>ООО</option>
                    <option>ИП</option>
                  </select>
                </label>
                <label>
                  Дата регистрации
                  <input
                    required
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.registrationDate}
                    onChange={(e) => update("registrationDate", e.target.value)}
                  />
                </label>
                <label>
                  Основной ОКВЭД
                  <input
                    required
                    placeholder="47.91"
                    value={form.okved}
                    onChange={(e) => update("okved", e.target.value)}
                  />
                </label>
                <label>
                  Описание деятельности
                  <input
                    required
                    maxLength={200}
                    value={form.okvedTitle}
                    onChange={(e) => update("okvedTitle", e.target.value)}
                  />
                </label>
              </div>
            </section>
            <section className="panel form-section">
              <h2>
                <span className="section-number">03</span>Финансовые показатели
              </h2>
              <p className="muted">
                Обычные значения за месяц. Расходы включают аренду, закупки,
                зарплаты и налоги. Кредитные платежи укажите отдельно.
              </p>
              {(answers.monthlyRevenue ||
                answers.monthlyExpenses ||
                answers.currentDebtLoad) && (
                <div className="guidance-note">
                  <p>
                    Перенесли{" "}
                    {answers.financeAccuracy === "exact"
                      ? "суммы из ваших ответов"
                      : "ваши приблизительные оценки"}
                    . Перед отправкой проверьте их. Неизвестные показатели
                    оставили пустыми.
                  </p>
                </div>
              )}
              <div className="form-grid">
                <label>
                  Выручка в месяц, ₽
                  <input
                    required
                    type="number"
                    min="1"
                    max="100000000000"
                    value={form.monthlyRevenue}
                    onChange={(e) => update("monthlyRevenue", e.target.value)}
                  />
                </label>
                <label>
                  Расходы без кредитных платежей, ₽
                  <input
                    required
                    type="number"
                    min="0"
                    max="100000000000"
                    value={form.monthlyExpenses}
                    onChange={(e) => update("monthlyExpenses", e.target.value)}
                  />
                </label>
                <label>
                  Текущие платежи по кредитам, ₽
                  <input
                    required
                    type="number"
                    min="0"
                    max="100000000000"
                    value={form.currentDebtLoad}
                    onChange={(e) => update("currentDebtLoad", e.target.value)}
                  />
                </label>
                <div className="financial-hint">
                  <span>После расходов и текущих кредитов остаётся</span>
                  <strong>
                    {cash.freeCashFlow === null
                      ? "Нужно дополнить данные"
                      : money(cash.freeCashFlow)}
                  </strong>
                </div>
              </div>
            </section>
            <label className="consent">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Подтверждаю, что использую синтетические данные, и согласен на
                их обработку в учебном прототипе.
              </span>
            </label>
            <button
              disabled={!!busy}
              type="submit"
              className="button primary submit-application"
            >
              {busy === "submit"
                ? "Проверяем и сохраняем…"
                : "Отправить заявку"}
              <ArrowRight size={18} />
            </button>
          </div>
          <aside className="apply-aside">
            <div className="panel">
              <FileCheck2 size={26} />
              <h3>Все этапы в одном месте</h3>
              <div className="check-list">
                <p>
                  <Check size={15} />
                  Проверка полноты данных
                </p>
                <p>
                  <Check size={15} />
                  Моделирование ФНС и БКИ
                </p>
                <p>
                  <Check size={15} />
                  Оценка риска и решение
                </p>
                <p>
                  <Check size={15} />
                  История и документы
                </p>
              </div>
              <div className="live-note">
                Подбор не означает одобрение. После отправки покажем результат и
                следующий шаг.
              </div>
            </div>
            <div className="panel comparison">
              <ShieldCheck size={23} />
              <h3>Сравнить полные расходы</h3>
              <p className="small muted">
                Пример для разового аннуитетного кредита. Ставки и плата
                учебные, это не условия выбранного продукта.
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => setShowComparison(!showComparison)}
              >
                {showComparison ? "Скрыть расчёт" : "Открыть расчёт"}
                <ArrowRight size={15} />
              </button>
              {showComparison && amount > 0 && term > 0 && (
                <>
                  <div className="comparison-row">
                    <span>Без услуги · 21,5%</span>
                    <b>{money(plain)}/мес.</b>
                    <span>Всего выплат</span>
                    <b>{money(plain * term)}</b>
                  </div>
                  <div className="comparison-row">
                    <span>С услугой · 18,5%</span>
                    <b>{money(sub)}/мес.</b>
                    <span>Плата за услугу</span>
                    <b>{money(fee)}/мес.</b>
                    <span>Всего, включая услугу</span>
                    <b>{money((sub + fee) * term)}</b>
                  </div>
                  <p className="small">
                    {plain * term > (sub + fee) * term
                      ? `В этом примере разница ${money((plain - sub - fee) * term)} в пользу услуги.`
                      : `В этом примере услуга увеличивает расходы на ${money((sub + fee - plain) * term)}.`}
                  </p>
                  <p className="small muted">
                    Не подключает услугу. Индивидуальный график, комиссии,
                    страхование и эффективная ставка требуют отдельного расчёта.
                  </p>
                </>
              )}
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
