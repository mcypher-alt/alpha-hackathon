"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Newspaper, Sparkles, X } from "lucide-react";
import { api, session } from "@/lib/api";
import { type Article, type Application, STATUS } from "@/lib/types";
import { ErrorBox, Loading, LoginRequired } from "@/components/common";
export default function NewsPage() {
  const [okved, setOkved] = useState("47.91"),
    [status, setStatus] = useState("MANUAL_REVIEW"),
    [articles, setArticles] = useState<Article[]>([]),
    [selected, setSelected] = useState<Article | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [logged, setLogged] = useState(false),
    [initialized, setInitialized] = useState(false);
  useEffect(() => {
    const auth = session();
    setLogged(!!auth);
    if (!auth) {
      setLoading(false);
      setInitialized(true);
      return;
    }
    api<Application[]>(
      `/applications/${auth.user.role === "CLIENT" ? "my" : "bank/all"}`,
    )
      .then((rows) => {
        if (rows[0]) {
          setOkved(rows[0].company.okved);
          setStatus(rows[0].status);
        }
      })
      .catch(() => {})
      .finally(() => setInitialized(true));
  }, []);
  const load = useCallback(async () => {
    if (!initialized || !session()) return;
    setLoading(true);
    setError("");
    try {
      setArticles(
        await api<Article[]>(
          `/news?okved=${encodeURIComponent(okved)}&status=${encodeURIComponent(status)}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [initialized, okved, status]);
  useEffect(() => {
    void load();
  }, [load]);
  async function open(id: string) {
    setError("");
    try {
      setSelected(await api<Article>(`/news/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="page">
      <div className="eyebrow">ПОЛЕЗНОЕ ДЛЯ БИЗНЕСА</div>
      <div className="page-heading compact">
        <h1>Знания для следующего шага</h1>
        <p>Материалы учитывают вашу отрасль и этап кредитной заявки.</p>
      </div>
      <ErrorBox message={error} />
      {!initialized || loading ? (
        <Loading />
      ) : !logged ? (
        <LoginRequired />
      ) : (
        <>
          <div className="news-context panel">
            <div>
              <Sparkles size={22} />
              <span>
                <b>Подобрано под ваш бизнес</b>
                <small>
                  Профиль последней заявки. Измените параметры, чтобы проверить
                  персонализацию.
                </small>
              </span>
            </div>
            <div className="context-selects">
              <label>
                Отрасль
                <select
                  value={okved}
                  onChange={(e) => setOkved(e.target.value)}
                >
                  <option value="47.91">Маркетплейсы · 47.91</option>
                  <option value="25.62">Производство · 25.62</option>
                  <option value="49.41">Транспорт · 49.41</option>
                  {!["47.91", "25.62", "49.41"].includes(okved) && (
                    <option value={okved}>ОКВЭД {okved}</option>
                  )}
                </select>
              </label>
              <label>
                Этап заявки
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {Object.entries(STATUS).map(([key, value]) => (
                    <option value={key} key={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="news-grid">
            {articles.length ? (
              articles.map((a, i) => (
                <article
                  className={`news-card panel news-tone-${i % 3}`}
                  key={a.id}
                >
                  <div className="news-cover">
                    <span className="news-category">{a.category}</span>
                    <Newspaper size={58} strokeWidth={1} />
                    <span className="news-number">0{i + 1}</span>
                  </div>
                  <div className="news-card-body">
                    <span className="small muted">
                      {a.targetStage
                        ? `Ваш этап: ${STATUS[a.targetStage] || a.targetStage}`
                        : a.targetOkved
                          ? `Ваша отрасль: ${a.targetOkved}`
                          : "Для предпринимателей"}
                    </span>
                    <h2>{a.title}</h2>
                    <p>{a.summary}</p>
                    <button
                      className="text-button"
                      onClick={() => void open(a.id)}
                    >
                      Читать материал
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="panel empty-state">
                <Newspaper size={30} />
                <h2>Материалы ещё готовятся</h2>
                <p>Попробуйте выбрать другую отрасль или этап.</p>
              </div>
            )}
          </div>
          <p className="small muted news-disclaimer">
            Редакционные учебные материалы для демонстрации персонализации. Не
            новостная сводка, не юридическая или финансовая консультация.
          </p>
        </>
      )}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <article
            className="modal article-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="article-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row">
              <span className="eyebrow">{selected.category}</span>
              <button
                className="icon-button"
                aria-label="Закрыть статью"
                onClick={() => setSelected(null)}
              >
                <X size={20} />
              </button>
            </div>
            <h1 id="article-title">{selected.title}</h1>
            <p className="article-summary">{selected.summary}</p>
            <div className="article-content">
              {selected.content
                .split("\n")
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
            </div>
            <p className="small muted">
              {selected.source || "Редакционный учебный материал"}. Данные и
              примеры синтетические.
            </p>
          </article>
        </div>
      )}
    </div>
  );
}
