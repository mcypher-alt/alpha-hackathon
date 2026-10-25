"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Files,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api, session, money, date } from "@/lib/api";
import { type Application, STATUS } from "@/lib/types";
import { ErrorBox, Loading, LoginRequired, Status } from "./common";
import { ApplicationDetail } from "./application-detail";
export function ApplicationsWorkspace({ bank = false }: { bank?: boolean }) {
  const [apps, setApps] = useState<Application[]>([]),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [logged, setLogged] = useState(false),
    [denied, setDenied] = useState(false),
    [filter, setFilter] = useState("ALL"),
    [search, setSearch] = useState("");
  const load = useCallback(async () => {
    const auth = session();
    setLogged(!!auth);
    setDenied(!!auth && bank && auth.user.role === "CLIENT");
    if (!auth || (bank && auth.user.role === "CLIENT")) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const rows = await api<Application[]>(
        `/applications/${bank ? "bank/all" : "my"}`,
      );
      setApps(rows);
      setSelected((prev) =>
        rows.some((x) => x.id === prev)
          ? prev
          : new URLSearchParams(window.location.search).get("id") ||
            rows[0]?.id ||
            "",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [bank]);
  useEffect(() => {
    void load();
    const update = () => void load();
    window.addEventListener("alfa-auth", update);
    return () => window.removeEventListener("alfa-auth", update);
  }, [load]);
  const visible = apps.filter(
    (a) =>
      (filter === "ALL" ||
        (filter === "ACTIVE"
          ? !["DISBURSED", "REJECTED"].includes(a.status)
          : a.status === filter)) &&
      `${a.company.name} ${a.id} ${a.company.inn}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const current = apps.find((a) => a.id === selected);
  return (
    <div className="page">
      <div className="eyebrow">
        {bank ? "РАБОЧЕЕ МЕСТО АНАЛИТИКА" : "ЛИЧНЫЙ КАБИНЕТ"}
      </div>
      <div className="page-heading compact heading-row">
        <div>
          <h1>{bank ? "Кредитный конвейер" : "Мои заявки"}</h1>
          <p>
            {bank
              ? "Данные, оценка риска и решения в единой очереди."
              : "Статусы, условия, документы и следующий шаг — всегда перед глазами."}
          </p>
        </div>
        {logged && (
          <button
            className="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw size={16} />
            Обновить
          </button>
        )}
      </div>
      <ErrorBox message={error} />
      {loading ? (
        <Loading />
      ) : !logged || denied ? (
        <LoginRequired bank={bank} />
      ) : !apps.length ? (
        <div className="panel empty-state">
          {bank ? <ShieldCheck size={36} /> : <Files size={36} />}
          <h2>
            {bank ? "Очередь пока пуста" : "Здесь будет ваша первая заявка"}
          </h2>
          <p>
            {bank
              ? "Когда предприниматель отправит заявку, её можно будет изучить в этой очереди."
              : "Начните с подбора продукта под задачу бизнеса."}
          </p>
          <Link className="button primary" href="/survey">
            Подобрать финансирование
            <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <>
          <div className="list-toolbar">
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Поиск по компании, ИНН или номеру заявки"
                placeholder="Компания, ИНН или номер заявки"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Фильтр по статусу"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">Все статусы · {apps.length}</option>
              <option value="ACTIVE">Активные</option>
              {Object.entries(STATUS)
                .filter(([k]) => apps.some((a) => a.status === k))
                .map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
            </select>
          </div>
          <div className="applications-layout">
            <aside className="application-list">
              {visible.length ? (
                visible.map((a) => (
                  <button
                    key={a.id}
                    className={`application-tile ${a.id === selected ? "selected" : ""}`}
                    onClick={() => {
                      setSelected(a.id);
                      document
                        .querySelector(".detail-panel")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    <div className="row">
                      <span className="small muted">
                        № {a.id.slice(-8).toUpperCase()}
                      </span>
                      <span className="small muted">
                        {date(a.createdAt).split(",")[0]}
                      </span>
                    </div>
                    <h3>{bank ? a.company.name : a.product.title}</h3>
                    <strong>{money(a.requestedAmount)}</strong>
                    <div className="row">
                      <Status value={a.status} />
                      <ArrowRight size={16} />
                    </div>
                  </button>
                ))
              ) : (
                <div className="panel empty-state">
                  <p>По этому фильтру заявок нет.</p>
                </div>
              )}
            </aside>
            <section className="panel detail-panel">
              {current ? (
                <ApplicationDetail
                  key={current.id}
                  application={current}
                  bank={bank}
                  refresh={load}
                />
              ) : (
                <div className="empty-state">Выберите заявку из списка</div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
