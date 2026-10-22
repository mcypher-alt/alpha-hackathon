"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
  X,
} from "lucide-react";
import { api, date, money, payment } from "@/lib/api";
import { type Application, STATUS } from "@/lib/types";
import { ErrorBox, Status } from "./common";
export function ApplicationDetail({
  application: a,
  bank = false,
  refresh,
}: {
  application: Application;
  bank?: boolean;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [note, setNote] = useState(""),
    [docTitle, setDocTitle] = useState("Уточнение финансовых показателей"),
    [docContent, setDocContent] = useState(""),
    [document, setDocument] = useState<{
      title: string;
      content: string;
    } | null>(null),
    [signingConsent, setSigningConsent] = useState(false),
    [decision, setDecision] = useState(
      a.status === "NEED_INFO" ? "MANUAL_REVIEW" : "APPROVED",
    ),
    [amount, setAmount] = useState(
      String(a.approvedAmount || a.requestedAmount),
    ),
    [term, setTerm] = useState(
      String(a.approvedTermMonths || a.requestedTermMonths),
    ),
    [rate, setRate] = useState(String(a.approvedRate || 21.5));
  useEffect(() => {
    setDecision(a.status === "NEED_INFO" ? "MANUAL_REVIEW" : "APPROVED");
    setSigningConsent(false);
  }, [a.status]);
  const f = a.scoringFactors;
  const snapshot = a.financialSnapshot || f?.applicationSnapshot;
  const canReview = bank && ["MANUAL_REVIEW", "NEED_INFO"].includes(a.status);
  async function mutate(action: string, body: unknown, bankAction = false) {
    setBusy(action);
    setError("");
    try {
      await api(
        `/applications/${bankAction ? "bank/" : ""}${a.id}/${bankAction ? "intervene" : "client-action"}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      setNote("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function upload() {
    if (docContent.trim().length < 10) {
      setError("Введите содержимое учебного документа");
      return;
    }
    setBusy("upload");
    setError("");
    try {
      await api(`/applications/${a.id}/documents`, {
        method: "POST",
        body: JSON.stringify({
          type: "STATEMENT",
          title: docTitle,
          content: docContent,
        }),
      });
      setDocContent("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function openDocument(id: string) {
    setBusy(id);
    setError("");
    try {
      setDocument(
        await api<{ title: string; content: string }>(
          `/applications/${a.id}/documents/${id}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const approved = Number(a.approvedAmount || 0) > 0 && ["APPROVED", "COUNTER_OFFER", "SIGNING", "DISBURSED"].includes(a.status);
  return (
    <div className="application-detail">
      <div className="detail-header">
        <div>
          <span className="eyebrow">
            ЗАЯВКА № {a.id.slice(-8).toUpperCase()}
          </span>
          <h2>{a.product.title}</h2>
          <p className="muted small">
            {a.company.name} · ИНН {a.company.inn}
          </p>
        </div>
        <Status value={a.status} />
      </div>
      <ErrorBox message={error} />
      <div className="detail-parameters">
        <div>
          <span>Запрошенная сумма</span>
          <strong>{money(a.requestedAmount)}</strong>
        </div>
        <div>
          <span>Срок</span>
          <strong>{a.requestedTermMonths} мес.</strong>
        </div>
        <div>
          <span>Цель</span>
          <b>{a.purpose}</b>
        </div>
      </div>
      <div className="decision-note">
        <ShieldCheck size={21} />
        <div>
          <h3>{STATUS[a.status]}</h3>
          <p>
            {a.decisionNote ||
              "Заявка сохранена. Дальнейшие действия появятся после проверки."}
          </p>
        </div>
      </div>
      {approved && (
        <div className="offer-box">
          <h3>
            {a.status === "COUNTER_OFFER"
              ? "Альтернативное предложение"
              : "Условия финансирования"}
          </h3>
          <div className="offer-grid">
            <div>
              <span>Сумма</span>
              <strong>{money(a.approvedAmount)}</strong>
            </div>
            <div>
              <span>Срок</span>
              <strong>{a.approvedTermMonths} мес.</strong>
            </div>
            <div>
              <span>Демо-ставка</span>
              <strong>{a.approvedRate}%</strong>
            </div>
            <div>
              <span>Расчётный платёж*</span>
              <strong>
                {money(
                  payment(
                    Number(a.approvedAmount),
                    Number(a.approvedRate),
                    Number(a.approvedTermMonths),
                  ),
                )}
              </strong>
            </div>
          </div>
          <p className="small muted">
            * Аннуитетный ориентир для разового кредита. Для линии, карты и
            овердрафта график зависит от использования. Все условия учебные.
          </p>
        </div>
      )}
      {!bank && (
        <div className="client-actions">
          {["APPROVED", "COUNTER_OFFER"].includes(a.status) && (
            <>
              <p>
                Ознакомьтесь с условиями. После принятия предложения станет
                доступно моделирование подписания.
              </p>
              <button
                disabled={!!busy}
                className="button primary"
                onClick={() =>
                  void mutate("ACCEPT_OFFER", {
                    action: "ACCEPT_OFFER",
                    expectedVersion: a.version,
                  })
                }
              >
                Принять предложение <ArrowRight size={17} />
              </button>
            </>
          )}
          {a.status === "SIGNING" && (
            <>
              <p>
                Подписание создаст учебный договор в документах заявки и
                смоделирует зачисление средств. Реальные операции не
                выполняются.
              </p>
              <details open>
                <summary>Условия учебного договора до подписания</summary>
                <p>
                  Компания: {a.company.name}. Продукт: {a.product.title}. Сумма:{" "}
                  {money(a.approvedAmount)}. Срок: {a.approvedTermMonths} мес.
                  Демонстрационная ставка: {a.approvedRate}% годовых. Юридически
                  значимая подпись и реальные перечисления не выполняются.
                </p>
              </details>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={signingConsent}
                  onChange={(e) => setSigningConsent(e.target.checked)}
                />
                <span>Условия учебного договора просмотрены</span>
              </label>
              <button
                disabled={!!busy || !signingConsent}
                className="button primary"
                onClick={() =>
                  void mutate("SIGN_CONTRACT", {
                    action: "SIGN_CONTRACT",
                    expectedVersion: a.version,
                  })
                }
              >
                <FileText size={17} />
                Подписать учебный договор
              </button>
            </>
          )}
          {a.status === "DISBURSED" && (
            <div className="success-note">
              <CheckCircle2 size={21} />
              Выдача смоделирована. Учебный договор и история доступны ниже.
            </div>
          )}
          {a.status === "NEED_INFO" && (
            <>
              <label>
                Ответ на запрос банка
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Опишите предоставленные сведения и прикрепите учебный документ ниже"
                />
              </label>
              <button
                disabled={!!busy || note.trim().length < 10}
                className="button primary"
                onClick={() =>
                  void mutate("PROVIDE_INFO", {
                    action: "PROVIDE_INFO",
                    clientComment: note,
                    expectedVersion: a.version,
                  })
                }
              >
                Отправить уточнения
                <ArrowRight size={17} />
              </button>
            </>
          )}
        </div>
      )}
      {bank && (
        <section className="risk-section">
          <h3>Риск и финансовый контекст</h3>
          <div className="risk-grid">
            <div>
              <span>Скоринговый балл</span>
              <strong>
                {a.scoringScore ?? "—"}
                <small> / 1000</small>
              </strong>
            </div>
            <div>
              <span>PD модели, синтетика</span>
              <strong>
                {typeof f?.probabilityOfDefault === "number"
                  ? `${(f.probabilityOfDefault * 100).toFixed(1)}%`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>Долговая нагрузка</span>
              <strong>
                {typeof f?.dtiRatio === "number"
                  ? `${(f.dtiRatio * 100).toFixed(0)}%`
                  : "—"}
              </strong>
            </div>
          </div>
          <p className="small muted">
            Модель обучена на синтетических данных. PD не является
            подтверждённой вероятностью дефолта клиента банка. Версия:{" "}
            {f?.modelVersion || "учебная"}.
          </p>
          <div className="factors">
            <div>
              <h4>Что поддерживает заявку</h4>
              {f?.positive?.length ? (
                f.positive.map((t) => (
                  <p key={t}>
                    <CheckCircle2 size={15} />
                    {t}
                  </p>
                ))
              ) : (
                <p className="muted">Факторы не выделены</p>
              )}
            </div>
            <div>
              <h4>На что обратить внимание</h4>
              {f?.negative?.length ? (
                f.negative.map((t) => (
                  <p key={t}>
                    <Clock3 size={15} />
                    {t}
                  </p>
                ))
              ) : (
                <p className="muted">Критичные факторы не выделены</p>
              )}
            </div>
          </div>
          {f?.modelFactors && (
            <details>
              <summary>Вклад признаков учебной модели</summary>
              <p className="small muted">
                Вклад в логит относительно среднего обучающей выборки. Это
                объяснение модели, а не причинный эффект.
              </p>
              {[...f.modelFactors]
                .sort(
                  (x, y) => Math.abs(y.contribution) - Math.abs(x.contribution),
                )
                .slice(0, 5)
                .map((x, i) => (
                  <p key={i} className="small">
                    {x.label}: {x.contribution >= 0 ? "+" : ""}
                    {x.contribution.toFixed(3)} ·{" "}
                    {x.direction === "raises"
                      ? "повышает оценку риска"
                      : "снижает оценку риска"}
                  </p>
                ))}
            </details>
          )}
          <details>
            <summary>Финансовые показатели на момент заявки</summary>
            <div className="detail-parameters">
              <div>
                <span>Выручка / мес.</span>
                <b>
                  {money(snapshot?.monthlyRevenue ?? a.company.monthlyRevenue)}
                </b>
              </div>
              <div>
                <span>Расходы / мес.</span>
                <b>
                  {money(
                    snapshot?.monthlyExpenses ?? a.company.monthlyExpenses,
                  )}
                </b>
              </div>
              <div>
                <span>Платежи по долгам</span>
                <b>
                  {money(
                    snapshot?.currentDebtLoad ?? a.company.currentDebtLoad,
                  )}
                </b>
              </div>
            </div>
            <p className="small muted">
              Внешние проверки воспроизведены локальными симуляторами
              ФНС/ЕГРЮЛ/БКИ.
            </p>
          </details>
        </section>
      )}
      {canReview && (
        <section className="intervention">
          <h3>Решение кредитного аналитика</h3>
          <label>
            Действие
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
            >
              {a.status === "MANUAL_REVIEW" && (
                <>
                  <option value="APPROVED">Одобрить</option>
                  <option value="COUNTER_OFFER">
                    Предложить другие условия
                  </option>
                  <option value="NEED_INFO">Запросить сведения</option>
                </>
              )}
              <option value="REJECTED">Отказать</option>
              {a.status === "NEED_INFO" && (
                <option value="MANUAL_REVIEW">Вернуть на рассмотрение</option>
              )}
            </select>
          </label>
          {["APPROVED", "COUNTER_OFFER"].includes(decision) && (
            <div className="form-grid three">
              <label>
                Сумма, ₽
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Срок, мес.
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </label>
              <label>
                Демо-ставка, %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </label>
            </div>
          )}
          <label>
            Причина решения / запрос
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Объясните решение понятным языком. Комментарий увидит клиент."
            />
          </label>
          <button
            className="button primary"
            disabled={!!busy || note.trim().length < 5}
            onClick={() =>
              void mutate(
                "decision",
                {
                  toStatus: decision,
                  decisionNote: note,
                  expectedVersion: a.version,
                  ...(["APPROVED", "COUNTER_OFFER"].includes(decision)
                    ? {
                        approvedAmount: Number(amount),
                        approvedTermMonths: Number(term),
                        approvedRate: Number(rate),
                      }
                    : {}),
                },
                true,
              )
            }
          >
            Сохранить решение
            <ArrowRight size={17} />
          </button>
        </section>
      )}
      <section className="documents-section">
        <h3>Документы заявки</h3>
        {a.documents?.length ? (
          <div className="document-list">
            {a.documents.map((d) => (
              <button
                key={d.id}
                disabled={!!busy}
                onClick={() => void openDocument(d.id)}
              >
                <FileText size={19} />
                <span>
                  <b>{d.title}</b>
                  <small>
                    {d.isSigned
                      ? "Подписание смоделировано"
                      : "Учебный документ"}{" "}
                    · {date(d.createdAt)}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p className="small muted">Прикреплённых документов пока нет.</p>
        )}
        {!bank && ["NEED_INFO", "MANUAL_REVIEW"].includes(a.status) && (
          <details>
            <summary>Добавить учебный документ</summary>
            <p className="small muted">
              Поддерживается текстовый документ. Используйте только
              синтетические сведения.
            </p>
            <label>
              Название
              <input
                value={docTitle}
                maxLength={200}
                onChange={(e) => setDocTitle(e.target.value)}
              />
            </label>
            <label>
              Содержание
              <textarea
                rows={4}
                maxLength={100000}
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
              />
            </label>
            <button
              className="button"
              disabled={!!busy || docTitle.length < 3}
              onClick={() => void upload()}
            >
              Сохранить документ
            </button>
          </details>
        )}
      </section>
      <section className="timeline-section">
        <h3>История заявки</h3>
        <ol className="timeline">
          {[...a.statusHistory]
            .sort(
              (x, y) =>
                new Date(y.createdAt).getTime() -
                  new Date(x.createdAt).getTime() ||
                [
                  "SUBMITTED",
                  "VALIDATING",
                  "ENRICHING",
                  "SCORING",
                  "MANUAL_REVIEW",
                  "NEED_INFO",
                  "COUNTER_OFFER",
                  "APPROVED",
                  "REJECTED",
                  "SIGNING",
                  "DISBURSED",
                ].indexOf(y.toStatus) -
                  [
                    "SUBMITTED",
                    "VALIDATING",
                    "ENRICHING",
                    "SCORING",
                    "MANUAL_REVIEW",
                    "NEED_INFO",
                    "COUNTER_OFFER",
                    "APPROVED",
                    "REJECTED",
                    "SIGNING",
                    "DISBURSED",
                  ].indexOf(x.toStatus),
            )
            .map((h) => (
              <li key={h.id}>
                <span className="timeline-dot" />
                <div>
                  <b>{STATUS[h.toStatus] || h.toStatus}</b>
                  <time>{date(h.createdAt)}</time>
                  <p>{h.comment}</p>
                  <small className="muted">
                    {h.actorRole === "CLIENT"
                      ? "Предприниматель"
                      : h.actorRole === "UNDERWRITER"
                        ? "Кредитный аналитик"
                        : "Автоматический конвейер"}
                  </small>
                </div>
              </li>
            ))}
        </ol>
      </section>
      {document && (
        <div className="modal-backdrop" onClick={() => setDocument(null)}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label={document.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row">
              <h2>{document.title}</h2>
              <button
                className="icon-button"
                aria-label="Закрыть документ"
                onClick={() => setDocument(null)}
              >
                <X size={20} />
              </button>
            </div>
            <pre>{document.content}</pre>
            <p className="small muted">
              Учебный документ. Юридически значимое подписание не выполнялось.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
