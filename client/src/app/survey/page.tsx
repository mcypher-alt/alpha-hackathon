"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import {
  PRODUCTS,
  GOALS,
  USAGES,
  TERMS,
  AGES,
  COLL,
  ASSET,
  REFI,
  REPAY,
  type Answers,
} from "@/lib/catalog";
import { matches } from "@/lib/recommendations";
import { api, stored, save, money } from "@/lib/api";
import { ErrorBox } from "@/components/common";
type Question = {
  id: string;
  title: string;
  help?: string;
  options?: string[][];
  type?: string;
};
function questions(a: Answers): Question[] {
  const goal =
    a.purpose === "other" ? a.confirmedPurpose || "other" : a.purpose;
  const q: Question[] = [
    {
      id: "purpose",
      title: "На что нужны деньги?",
      help: "Выберите задачу вашего бизнеса. Банковский продукт подберём сами.",
      options: GOALS,
    },
  ];
  if (a.purpose === "other") {
    q.push({
      id: "other",
      title: "Расскажите о своей задаче",
      type: "text",
      help: "Локальный обученный классификатор предложит направление. Решение подтвердите вы.",
    });
    const suggested = GOALS.find(([code]) => code === a.inferredPurpose)?.[1];
    q.push({
      id: "confirmedPurpose",
      title: "Проверьте направление финансирования",
      help:
        a.inferredPurpose && a.inferredPurpose !== "other"
          ? `Предварительно: ${suggested}. Подтвердите подходящую цель или выберите другую. Модель может ошибаться.`
          : "Не удалось уверенно определить цель. Выберите направление самостоятельно; другая задача останется на уточнение.",
      options: GOALS,
    });
  }
  if (!["auto", "property", "refi"].includes(goal || ""))
    q.push({
      id: "usage",
      title: "Как будете пользоваться деньгами?",
      help: "Способ выдачи — предпочтение, а не повод для отказа.",
      options: USAGES,
    });
  q.push(
    {
      id: "amount",
      title: "Сколько денег нужно?",
      type: "number",
      help: "Планируемая сумма финансирования или кредитный лимит.",
    },
    {
      id: "term",
      title: "Когда сможете вернуть деньги?",
      help: "Для кредитной линии — срок возврата каждого транша, а не срок действия лимита.",
      options: TERMS,
    },
    { id: "age", title: "Как давно работает бизнес?", options: AGES },
  );
  if (goal === "refi")
    q.push({
      id: "refi_type",
      title: "Какой долг хотите заменить?",
      options: REFI,
    });
  if (["auto", "property"].includes(goal || ""))
    q.push({
      id: "asset",
      title: "Готовы оформить покупку в залог?",
      help: "Речь о покупаемом автомобиле или недвижимости. Другое имущество для этого не требуется.",
      options: ASSET,
    });
  if (Number(a.amount) >= 500000)
    q.push({
      id: "collateral",
      title: "Есть ли другое имущество для залога?",
      help: "Ответ не влияет на залог покупаемого автомобиля или недвижимости.",
      options: COLL,
    });
  q.push({
    id: "repay",
    title: "Как удобнее платить?",
    help: "Учтём пожелание. Допустимый график банк подтвердит при рассмотрении.",
    options: REPAY,
  });
  return q;
}
function Survey() {
  const params = useSearchParams();
  const [a, setA] = useState<Answers>({}),
    [step, setStep] = useState(0),
    [ready, setReady] = useState(false),
    [input, setInput] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const saved = stored<{ answers: Answers; step: number }>("alfa.survey", {
      answers: {},
      step: 0,
    });
    const goal = params.get("goal");
    if (goal && GOALS.some((x) => x[0] === goal)) {
      setA({ purpose: goal });
      setStep(1);
    } else {
      setA(saved.answers);
      setStep(saved.step);
    }
    setReady(true);
  }, [params]);
  useEffect(() => {
    if (ready) save("alfa.survey", { answers: a, step });
  }, [a, step, ready]);
  const qs = questions(a),
    q = qs[step],
    done = step >= qs.length;
  const rows = matches(a),
    remaining = rows.filter((r) => !r.excluded.length),
    excluded = rows.filter((r) => r.excluded.length);
  async function advance(value: string) {
    setError("");
    const clean = { ...a };
    const old = questions(a);
    for (const after of old.slice(step + 1)) delete clean[after.id];
    if (
      q.id === "amount" &&
      (!Number.isFinite(Number(value)) ||
        Number(value) <= 0 ||
        Number(value) > 100000000000)
    ) {
      setError("Введите сумму от 1 до 100 млрд ₽");
      return;
    }
    if (q.id === "other") {
      if (value.trim().length < 5) {
        setError("Добавьте немного подробностей о бизнес-задаче");
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
        clean.inferredPurpose = result.abstained ? "other" : result.label;
        clean.intentConfidence = String(result.confidence);
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    clean[q.id] = value;
    setA(clean);
    setStep(step + 1);
    setInput("");
  }
  function apply(id: string) {
    localStorage.removeItem("alfa.apply");
    save("alfa.draft", {
      productCode: id,
      amount: a.amount,
      term: a.term === "0" ? "12" : a.term,
      purpose:
        a.other ||
        GOALS.find((x) => x[0] === a.purpose)?.[1] ||
        "Финансирование бизнеса",
      answers: a,
    });
  }
  if (!ready) return <div className="page">Загружаем ваш подбор…</div>;
  return (
    <div className="page">
      <div className="eyebrow">ПОДБОР ФИНАНСИРОВАНИЯ</div>
      <div className="page-heading compact">
        <h1>{done ? "Варианты для вашей задачи" : "Начнём с ваших планов"}</h1>
        <p>
          {done
            ? "Подбор по условиям продукта. Решение по кредиту — после заявки и проверки."
            : "Несколько вопросов. Только то, что влияет на выбор."}
        </p>
      </div>
      <div className="survey-layout">
        <section className="panel survey-panel">
          <div className="survey-top">
            <span>
              <Sparkles size={16} />
              Кредитный помощник
            </span>
            <span className="small muted">
              {done ? "Подбор завершён" : `Вопрос ${step + 1} из ${qs.length}`}
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
              <h2 key={q.id}>{q.title}</h2>
              {q.help && <p className="muted question-help">{q.help}</p>}
              {q.type === "number" ? (
                <>
                  <div className="chips">
                    {[100000, 500000, 1000000, 3000000, 10000000, 50000000].map(
                      (n) => (
                        <button
                          key={n}
                          className="chip"
                          onClick={() => setInput(String(n))}
                        >
                          {n >= 1000000
                            ? n / 1000000 + " млн"
                            : n / 1000 + " тыс."}{" "}
                          ₽
                        </button>
                      ),
                    )}
                  </div>
                  <label>
                    Сумма, ₽
                    <input
                      className="amount-input"
                      type="number"
                      min="1"
                      max="100000000000"
                      value={input || a.amount || ""}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="3 000 000"
                    />
                  </label>
                  <button
                    className="button primary"
                    onClick={() => void advance(input || a.amount || "")}
                  >
                    Продолжить <ArrowRight size={17} />
                  </button>
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
                    value={input || a.other || ""}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Например: хочу купить фрезерный станок для цеха"
                  />
                  <button
                    disabled={busy}
                    className="button primary"
                    onClick={() => void advance(input || a.other || "")}
                  >
                    {busy ? "Определяем задачу…" : "Продолжить"}
                    <ArrowRight size={17} />
                  </button>
                </>
              ) : (
                <div className="option-grid">
                  {q.options?.map(([v, label], i) => (
                    <button
                      className={`option ${a[q.id] === v ? "selected" : ""}`}
                      key={v}
                      onClick={() => void advance(v)}
                    >
                      <span className="option-index">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{label}</span>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
              )}
              <div className="survey-actions">
                {step > 0 && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setStep(step - 1);
                      setInput("");
                      setError("");
                    }}
                  >
                    <ArrowLeft size={16} />
                    Назад
                  </button>
                )}
                <button
                  className="text-button muted"
                  onClick={() => {
                    setA({});
                    setStep(0);
                    setInput("");
                  }}
                >
                  Начать заново
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="results">
                {remaining.length ? (
                  remaining.slice(0, 3).map((r, i) => (
                    <article className="product-result" key={r.product.id}>
                      <div className="row">
                        <span className="product-code">{r.product.id}</span>
                        <span
                          className={
                            r.alternatives.length
                              ? "status"
                              : "status status-approved"
                          }
                        >
                          {r.alternatives.length
                            ? "Альтернатива"
                            : i === 0
                              ? "Лучшее совпадение"
                              : "Подходит по параметрам"}
                        </span>
                      </div>
                      <h2>{r.product.short}</h2>
                      <div className="product-facts">
                        <span>
                          Сумма до<b>{money(r.product.max)}</b>
                        </span>
                        <span>
                          Срок<b>{r.product.term}</b>
                        </span>
                      </div>
                      <p className="small">
                        {r.product.pledge === "owned"
                          ? "Нужен залог имеющегося имущества"
                          : r.product.pledge === "purchase"
                            ? "Залог — покупаемый объект"
                            : "Без залога имеющегося имущества"}
                      </p>
                      {r.alternatives.map((x) => (
                        <p className="warning-text small" key={x}>
                          {x}
                        </p>
                      ))}
                      {r.pending.length > 0 && (
                        <details>
                          <summary>Нужно уточнить ({r.pending.length})</summary>
                          <ul>
                            {r.pending.map((x) => (
                              <li key={x}>{x}</li>
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
                          Оформить заявку
                          <ArrowRight size={16} />
                        </Link>
                        <a
                          href={r.product.url}
                          target="_blank"
                          rel="noreferrer"
                          className="small muted"
                        >
                          Источник условий ↗
                        </a>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <SlidersHorizontal size={30} />
                    <h2>Точных совпадений нет</h2>
                    <p>
                      Измените сумму, срок или ограничения по залогу. Условия
                      программы не позволяют предложить подходящий продукт.
                    </p>
                  </div>
                )}
              </div>
              <div className="survey-actions">
                <button
                  className="text-button"
                  onClick={() => setStep(qs.length - 1)}
                >
                  <ArrowLeft size={16} />
                  Изменить ответы
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setA({});
                    setStep(0);
                  }}
                >
                  Новый подбор
                </button>
              </div>
            </>
          )}
        </section>
        <aside className="survey-aside">
          <div className="panel live-panel">
            <span className="eyebrow">ОТБОР В РЕАЛЬНОМ ВРЕМЕНИ</span>
            <div className="live-count">
              {remaining.length}
              <span>/ {PRODUCTS.length}</span>
            </div>
            <p className="muted small">продуктов предварительно подходят</p>
            <div className="live-list">
              {remaining.slice(0, 7).map((r) => (
                <div key={r.product.id}>
                  <Check size={15} />
                  <span>{r.product.short}</span>
                  <small>{r.product.id}</small>
                </div>
              ))}
            </div>
            <div className="live-note">
              Числовые ограничения проверяются правилами. Оценка риска и
              кредитное решение выполняются отдельно.
            </div>
          </div>
          <div className="aside-note">
            Условия каталога — учебный снимок на 21.10.2026. Индивидуальные
            ставки и допуски подтверждает банк.
          </div>
        </aside>
      </div>
      {done && excluded.length > 0 && (
        <section className="panel exclusions">
          <h2>Почему исключены другие варианты</h2>
          <p className="muted">Можно проследить каждое правило подбора.</p>
          {excluded.map((r) => (
            <details key={r.product.id}>
              <summary>
                {r.product.short}
                <span className="small muted">{r.product.id}</span>
              </summary>
              <ul>
                {r.excluded.map((x) => (
                  <li key={x}>{x}</li>
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
