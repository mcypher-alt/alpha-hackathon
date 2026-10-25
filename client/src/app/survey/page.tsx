"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { PRODUCTS, GOALS, AGES, type Answers } from "@/lib/catalog";
import { matches } from "@/lib/recommendations";
import {
  financingGuidance,
  financialDraft,
  monthlyCash,
  monthlyValue,
  MAX_MONTHLY_VALUE,
} from "@/lib/financing-guidance";
import { api, stored, save, money } from "@/lib/api";
import { ErrorBox } from "@/components/common";

type Question = {
  id: string;
  title: string;
  help?: string;
  options?: string[][];
  type?: "amount" | "text" | "finances";
};
const PURPOSES = GOALS.map(([id, text]) => [
  id,
  id === "gap"
    ? "Оплатить расходы, пока не пришли деньги от клиентов"
    : id === "refi"
      ? "Заменить существующие кредиты"
      : text,
]);
const FINANCIAL_FIELDS = [
  "monthlyRevenue",
  "monthlyExpenses",
  "currentDebtLoad",
] as const;

function questions(a: Answers): Question[] {
  const goal =
    a.purpose === "other" ? a.confirmedPurpose || "other" : a.purpose;
  const q: Question[] = [
    {
      id: "purpose",
      title: "На что нужны деньги?",
      help: "Расскажите о задаче бизнеса — выбирать кредитный продукт пока не нужно.",
      options: PURPOSES,
    },
  ];
  if (a.purpose === "other") {
    q.push({
      id: "other",
      title: "Расскажите о своей задаче",
      type: "text",
      help: "Например: купить станок, закупить товар перед сезоном или дождаться оплаты крупного заказа.",
    });
    const suggested = GOALS.find(([id]) => id === a.inferredPurpose)?.[1];
    q.push({
      id: "confirmedPurpose",
      title: "Правильно поняли вашу задачу?",
      help:
        a.inferredPurpose && a.inferredPurpose !== "other"
          ? `Предположили: ${suggested}. Подтвердите это направление или выберите другое.`
          : "Не удалось определить направление. Выберите ближайшее или оставьте «Другая задача» — тогда цель потребуется уточнить.",
      options: PURPOSES,
    });
  }
  q.push({
    id: "amount",
    title: "Сколько примерно нужно?",
    type: "amount",
    help: "Стоимость покупки или сумма, которой не хватает на расходы. Это потребность бизнеса, а не одобренный лимит.",
  });
  if (["operations", "gap", "market", "other"].includes(goal || "")) {
    q.push({
      id: "frequency",
      title: "Как часто нужны эти деньги?",
      help: "Это поможет сравнить разовый кредит и варианты для повторных расходов.",
      options: [
        ["once", "На одну покупку или оплату"],
        ["repeat", "На закупки и расходы, которые повторяются"],
        ["unknown", "Пока не знаю — хочу сравнить"],
      ],
    });
    if (a.frequency === "repeat" || goal === "gap")
      q.push({
        id: "cashCycle",
        title: "Через сколько эти расходы вернутся деньгами?",
        help: "Например, сколько проходит от закупки товара до оплаты покупателем. По этому сроку проверим варианты для повторных закупок. Для разового кредита срок рассчитаем отдельно.",
        options: [
          ["1", "Примерно за месяц"],
          ["2", "За два месяца"],
          ["3", "За три месяца"],
          ["6", "За полгода"],
          ["12", "Примерно за год"],
          ["unknown", "Пока не могу оценить"],
        ],
      });
  }
  q.push({
    id: "finances",
    title: "Сколько бизнес получает и тратит за месяц?",
    type: "finances",
    help: "Можно указать приблизительно или пропустить. По остатку денег покажем пример платежа и срока — без обещания одобрения.",
  });
  q.push({ id: "age", title: "Когда зарегистрировали бизнес?", options: AGES });
  if (goal === "refi")
    q.push({
      id: "refi_type",
      title: "Как устроен долг, который хотите заменить?",
      options: [
        ["single", "Получили одну сумму и выплачиваете по графику"],
        ["line", "Берёте деньги частями в пределах лимита"],
        ["od", "Банк покрывает нехватку денег на расчётном счёте"],
        ["card", "Долг по кредитной карте бизнеса"],
        ["other", "Не знаю — нужно посмотреть договор"],
      ],
    });
  if (["auto", "property"].includes(goal || ""))
    q.push({
      id: "asset",
      title: "Можно ли оформить саму покупку в залог?",
      help: "При таком варианте залогом станет покупаемый автомобиль или помещение. Другое своё имущество для этого не требуется.",
      options: [
        ["yes", "Да, готов рассмотреть"],
        ["no", "Нет, покупка не должна быть в залоге"],
        ["unknown", "Сначала хочу разобраться в условиях"],
      ],
    });
  const needsOwnedCollateral = matches({ ...a, collateral: "compare" }).some(
    (result) =>
      result.product.pledge === "owned" && result.excluded.length === 0,
  );
  if (needsOwnedCollateral)
    q.push({
      id: "collateral",
      title: "Есть ли другое имущество для залога?",
      help: "Например, помещение или оборудование бизнеса. Речь не о том автомобиле или помещении, которое планируете купить.",
      options: [
        ["yes", "Да, готов обсудить имущество в залог"],
        ["no", "Нет, рассматриваю без своего имущества"],
        ["compare", "Хочу сначала сравнить условия"],
      ],
    });
  return q;
}

function Survey() {
  const params = useSearchParams();
  const [a, setA] = useState<Answers>({}),
    [step, setStep] = useState(0),
    [ready, setReady] = useState(false),
    [input, setInput] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const saved = stored<{ schema?: number; answers: Answers; step: number }>(
      "alfa.survey",
      { answers: {}, step: 0 },
    );
    const goal = params.get("goal");
    if (goal && GOALS.some(([id]) => id === goal)) {
      setA({ purpose: goal });
      setStep(1);
    } else if (
      saved.schema === 2 &&
      saved.answers &&
      typeof saved.answers === "object"
    ) {
      const restored = Object.fromEntries(
        Object.entries(saved.answers).filter(
          ([, value]) => typeof value === "string" && value.length <= 2000,
        ),
      );
      const savedStep =
        Number.isInteger(saved.step) && saved.step >= 0 ? saved.step : 0;
      setA(restored);
      setStep(Math.min(savedStep, questions(restored).length));
    }
    setReady(true);
  }, [params]);
  useEffect(() => {
    if (ready) save("alfa.survey", { schema: 2, answers: a, step });
  }, [a, step, ready]);
  const qs = questions(a),
    q = qs[step],
    done = step >= qs.length;
  const rows = matches(a),
    remaining = rows.filter((r) => !r.excluded.length),
    excluded = rows.filter((r) => r.excluded.length);
  const cash = monthlyCash(a);
  function nextAnswers(values: Answers) {
    const clean = { ...a };
    for (const after of questions(a).slice(step + 1)) {
      delete clean[after.id];
      if (after.type === "finances")
        for (const field of [...FINANCIAL_FIELDS, "financeAccuracy"])
          delete clean[field];
      if (after.id === "other") {
        delete clean.inferredPurpose;
        delete clean.intentConfidence;
      }
    }
    setA({ ...clean, ...values });
    setStep(step + 1);
    setInput(null);
    setError("");
  }
  async function advance(value: string) {
    setError("");
    if (
      q.id === "amount" &&
      value !== "" &&
      (!Number.isFinite(Number(value)) ||
        Number(value) <= 0 ||
        Number(value) > 1e11)
    ) {
      setError("Введите сумму от 1 до 100 млрд ₽ или выберите «Пока не знаю».");
      return;
    }
    if (q.id === "other") {
      if (value.trim().length < 5) {
        setError("Добавьте немного подробностей о задаче.");
        return;
      }
      setBusy(true);
      try {
        const result = await api<{
          label: string;
          confidence: number;
          abstained: boolean;
        }>("/applications/intent", {
          method: "POST",
          body: JSON.stringify({ text: value }),
        });
        nextAnswers({
          other: value,
          inferredPurpose: result.abstained ? "other" : result.label,
          intentConfidence: String(result.confidence),
        });
      } catch {
        // Manual confirmation lets the user continue if classification is unavailable.
        nextAnswers({ other: value, inferredPurpose: "other" });
      } finally {
        setBusy(false);
      }
      return;
    }
    nextAnswers({ [q.id]: value });
  }
  function advanceFinances(skip = false) {
    if (skip) {
      nextAnswers({
        monthlyRevenue: "",
        monthlyExpenses: "",
        currentDebtLoad: "",
        financeAccuracy: "unknown",
      });
      return;
    }
    for (const key of FINANCIAL_FIELDS) {
      if (a[key]?.trim() && monthlyValue(a[key]) === null) {
        setError(
          "Укажите неотрицательные суммы до 1 трлн ₽. Неизвестные показатели можно оставить пустыми.",
        );
        return;
      }
    }
    nextAnswers({
      monthlyRevenue: a.monthlyRevenue || "",
      monthlyExpenses: a.monthlyExpenses || "",
      currentDebtLoad: a.currentDebtLoad || "",
      financeAccuracy: FINANCIAL_FIELDS.some((key) => a[key]?.trim())
        ? a.financeAccuracy || "estimate"
        : "unknown",
    });
  }
  function apply(id: string) {
    const product = PRODUCTS.find((p) => p.id === id)!;
    const guidance = financingGuidance(product, Number(a.amount), a);
    localStorage.removeItem("alfa.apply");
    save("alfa.draft", {
      productCode: id,
      amount: a.amount || "",
      term: guidance.suggestedTermMonths
        ? String(guidance.suggestedTermMonths)
        : "",
      purpose:
        a.other ||
        GOALS.find(([key]) => key === a.purpose)?.[1] ||
        "Финансирование бизнеса",
      ...financialDraft(a),
      answers: a,
    });
  }
  function back() {
    setStep(Math.max(0, step - 1));
    setInput(null);
    setError("");
  }
  function reset() {
    setA({});
    setStep(0);
    setInput(null);
    setError("");
  }
  if (!ready) return <div className="page">Загружаем сохранённые ответы…</div>;
  return (
    <div className="page">
      <div className="eyebrow">ПОДБОР ФИНАНСИРОВАНИЯ</div>
      <div className="page-heading compact">
        <h1>
          {done ? "Варианты для вашей задачи" : "Что нужно вашему бизнесу?"}
        </h1>
        <p>
          {done
            ? "Сравните условия. Если данных пока нет, отметим, что потребуется уточнить."
            : "Ответьте на вопросы о бизнесе. Срок и способ кредитования заранее выбирать не нужно."}
        </p>
      </div>
      <div className="survey-layout">
        <section className="panel survey-panel">
          <div className="survey-top">
            <span>Подбор кредита</span>
            <span className="small muted">
              {done ? "Ответы сохранены" : `Вопрос ${step + 1} из ${qs.length}`}
            </span>
          </div>
          <div className="progress">
            <span
              style={{ width: `${done ? 100 : (step / qs.length) * 100}%` }}
            />
          </div>
          <ErrorBox message={error} />
          {!done ? (
            <>
              <h2>{q.title}</h2>
              {q.help && <p className="muted question-help">{q.help}</p>}
              {q.type === "amount" ? (
                <>
                  <div className="chips">
                    {[100000, 500000, 1000000, 3000000, 10000000].map((n) => (
                      <button
                        key={n}
                        className="chip"
                        onClick={() => setInput(String(n))}
                      >
                        {n >= 1e6 ? n / 1e6 + " млн" : n / 1000 + " тыс."} ₽
                      </button>
                    ))}
                  </div>
                  <label>
                    Сумма, ₽
                    <input
                      className="amount-input"
                      type="number"
                      min="1"
                      max="100000000000"
                      value={input ?? a.amount ?? ""}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Например, 1 000 000"
                    />
                  </label>
                  <div className="finance-controls">
                    <button
                      className="button primary"
                      onClick={() => {
                        const value = input ?? a.amount ?? "";
                        if (!value) {
                          setError(
                            "Введите сумму или выберите «Пока не знаю».",
                          );
                          return;
                        }
                        void advance(value);
                      }}
                    >
                      Продолжить <ArrowRight size={17} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => void advance("")}
                    >
                      Пока не знаю
                    </button>
                  </div>
                </>
              ) : q.type === "text" ? (
                <>
                  <label className="sr-only" htmlFor="purpose-text">
                    Ваша бизнес-задача
                  </label>
                  <textarea
                    id="purpose-text"
                    maxLength={1500}
                    rows={4}
                    value={input ?? a.other ?? ""}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Например: купить фрезерный станок для цеха"
                  />
                  <button
                    disabled={busy}
                    className="button primary"
                    onClick={() => void advance(input ?? a.other ?? "")}
                  >
                    {busy ? "Продолжаем…" : "Продолжить"}
                    <ArrowRight size={17} />
                  </button>
                </>
              ) : q.type === "finances" ? (
                <>
                  <div className="finance-grid">
                    {[
                      [
                        "monthlyRevenue",
                        "Выручка за месяц, ₽",
                        "Сколько бизнес получает от продаж",
                      ],
                      [
                        "monthlyExpenses",
                        "Расходы за месяц, ₽",
                        "Аренда, закупки, зарплаты и налоги — без кредитных платежей",
                      ],
                      [
                        "currentDebtLoad",
                        "Платежи по действующим кредитам, ₽",
                        "Если их нет, укажите 0",
                      ],
                    ].map(([key, label, help]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="number"
                          min="0"
                          max={MAX_MONTHLY_VALUE}
                          value={a[key] ?? ""}
                          placeholder="Можно не указывать"
                          onChange={(e) =>
                            setA((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          aria-describedby={`${key}-help`}
                        />
                        <span id={`${key}-help`} className="small muted">
                          {help}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="finance-controls">
                    <label>
                      Насколько точны суммы?
                      <select
                        value={
                          a.financeAccuracy === "exact" ? "exact" : "estimate"
                        }
                        onChange={(e) =>
                          setA((prev) => ({
                            ...prev,
                            financeAccuracy: e.target.value,
                          }))
                        }
                      >
                        <option value="estimate">Приблизительная оценка</option>
                        <option value="exact">По данным учёта</option>
                      </select>
                    </label>
                  </div>
                  {cash.complete && (
                    <div className="guidance-note">
                      <b>
                        Остаётся после расходов и кредитов:{" "}
                        {money(cash.freeCashFlow)}
                      </b>
                      <p>
                        Это ориентир по введённым суммам. Сезонность, разовые
                        расходы и даты поступлений могут изменить остаток.
                      </p>
                    </div>
                  )}
                  <div className="finance-controls">
                    <button
                      className="button primary"
                      onClick={() => advanceFinances()}
                    >
                      Продолжить
                      <ArrowRight size={17} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => advanceFinances(true)}
                    >
                      Пока не знаю — пропустить
                    </button>
                  </div>
                </>
              ) : (
                <div className="option-grid">
                  {q.options?.map(([value, label], index) => (
                    <button
                      className={`option ${a[q.id] === value ? "selected" : ""}`}
                      key={value}
                      onClick={() => void advance(value)}
                    >
                      <span className="option-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{label}</span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              )}
              <div className="survey-actions">
                {step > 0 && (
                  <button className="text-button" onClick={back}>
                    <ArrowLeft size={16} />
                    Назад
                  </button>
                )}
                <button className="text-button muted" onClick={reset}>
                  Начать заново
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="results">
                {remaining.length ? (
                  remaining.slice(0, 3).map((r) => {
                    const guidance = financingGuidance(
                      r.product,
                      Number(a.amount),
                      a,
                    );
                    return (
                      <article className="product-result" key={r.product.id}>
                        <span className="status">
                          {r.alternatives.length
                            ? "Другой способ финансирования"
                            : "Соответствует задаче"}
                        </span>
                        <h2>{r.product.short}</h2>
                        <div className="product-facts">
                          <span>
                            Сумма до<b>{money(r.product.max)}</b>
                          </span>
                          <span>
                            Условия срока<b>{r.product.term}</b>
                          </span>
                        </div>
                        <p className="small">
                          {r.product.pledge === "owned"
                            ? "Нужен залог имеющегося имущества"
                            : r.product.pledge === "purchase"
                              ? "Залогом станет покупаемый объект"
                              : "Без залога имеющегося имущества"}
                        </p>
                        {r.alternatives.map((text) => (
                          <p className="warning-text small" key={text}>
                            {text}
                          </p>
                        ))}
                        <div className="guidance-note">
                          {guidance.monthlyPayment !== null &&
                            guidance.suggestedTermMonths !== null && (
                              <b>
                                Пример: {guidance.suggestedTermMonths} мес. и
                                около {money(guidance.monthlyPayment)} в месяц
                              </b>
                            )}
                          <p>{guidance.note}</p>
                        </div>
                        {r.pending.length > 0 && (
                          <details>
                            <summary>
                              Что нужно уточнить ({r.pending.length})
                            </summary>
                            <ul>
                              {r.pending.map((text) => (
                                <li key={text}>{text}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <div className="row product-bottom">
                          <Link
                            className="button primary"
                            onClick={() => apply(r.product.id)}
                            href="/apply"
                          >
                            Перейти к заявке
                            <ArrowRight size={16} />
                          </Link>
                          <a
                            href={r.product.url}
                            target="_blank"
                            rel="noreferrer"
                            className="small muted"
                          >
                            Условия продукта ↗
                          </a>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <SlidersHorizontal size={30} />
                    <h2>Совпадений по условиям нет</h2>
                    <p>
                      Посмотрите причины ниже. Можно изменить сумму или обсудить
                      залог. Это результат подбора продукта, а не кредитный
                      отказ.
                    </p>
                  </div>
                )}
              </div>
              <div className="survey-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    setStep(qs.length - 1);
                    setInput(null);
                  }}
                >
                  <ArrowLeft size={16} />
                  Изменить ответы
                </button>
                <button className="text-button" onClick={reset}>
                  Новый подбор
                </button>
              </div>
            </>
          )}
        </section>
        <aside className="survey-aside">
          <div className="panel live-panel">
            <span className="eyebrow">ПРЕДВАРИТЕЛЬНЫЕ ВАРИАНТЫ</span>
            <div className="live-count">
              {remaining.length}
              <span>/ {PRODUCTS.length}</span>
            </div>
            <p className="muted small">осталось по известным условиям</p>
            <div className="live-list">
              {remaining.slice(0, 7).map((r) => (
                <div key={r.product.id}>
                  <Check size={15} />
                  <span>{r.product.short}</span>
                </div>
              ))}
            </div>
            <div className="live-note">
              Здесь сравниваем продукты. Финансовые оценки помогают рассчитать
              пример платежа и не используются для отказа в подборе.
            </div>
          </div>
          <div className="aside-note">
            Каталог для прототипа — на 21.10.2026. Индивидуальный лимит и
            условия определяются после рассмотрения заявки.
          </div>
        </aside>
      </div>
      {done && excluded.length > 0 && (
        <section className="panel exclusions">
          <h2>Почему не показали другие продукты</h2>
          <p className="muted">
            Только ограничения продукта: цель, сумма, срок оборота, возраст
            бизнеса и залог.
          </p>
          {excluded.map((r) => (
            <details key={r.product.id}>
              <summary>{r.product.short}</summary>
              <ul>
                {r.excluded.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
export default function SurveyPage() {
  return (
    <Suspense>
      <Survey />
    </Suspense>
  );
}
