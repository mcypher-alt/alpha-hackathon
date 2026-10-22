"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Sparkles,
  Files,
  Newspaper,
  ShieldCheck,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { session, setSession, type Session } from "@/lib/api";
const nav = [
  ["/", "Обзор", LayoutDashboard],
  ["/survey", "Подобрать кредит", Sparkles],
  ["/my-applications", "Мои заявки", Files],
  ["/news", "Полезное для бизнеса", Newspaper],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<Session | null>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const update = () => setAuth(session());
    update();
    window.addEventListener("alfa-auth", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("alfa-auth", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setMenu(false)}>
          <span className="brand-a">
            А<span />
          </span>
          <span>
            Альфа <b>Бизнес</b>
          </span>
        </Link>
        <div className="sidebar-label">КРЕДИТНЫЙ КАБИНЕТ</div>
        <nav aria-label="Основная навигация">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "active" : ""}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
          <Link
            href="/bank"
            onClick={() => setMenu(false)}
            className={path === "/bank" ? "active" : ""}
          >
            <ShieldCheck size={19} />
            Кабинет банка
            <span className="nav-dot" />
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-mark">
            <span />
            Учебный прототип
          </div>
          <p>
            Синтетические данные.
            <br />
            Все операции моделируются.
          </p>
          <a href="/api/api/docs" target="_blank" rel="noreferrer">
            Документация API <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      {menu && (
        <button
          className="backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? "Закрыть меню" : "Открыть меню"}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Финансирование бизнеса</span>
            <span className="topbar-divider" />
            <span className="muted small">Всё в одном кабинете</span>
          </div>
          <div className="account">
            {auth ? (
              <>
                <span className="avatar">
                  {auth.user.fullName?.slice(0, 1) || "А"}
                </span>
                <span className="account-name">
                  {auth.user.fullName}
                  <small>
                    {auth.user.role === "CLIENT"
                      ? "Предприниматель"
                      : "Кредитный аналитик"}
                  </small>
                </span>
                <button
                  className="icon-button"
                  aria-label="Выйти"
                  onClick={() => {
                    setSession(null);
                    router.push("/login");
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link href="/login" className="button button-small">
                Войти в кабинет <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="page-footer">
          <span>Альфа • Бизнес / Кредитный кабинет</span>
          <span>Прототип для хакатона · Не является офертой банка</span>
        </footer>
      </div>
    </div>
  );
}
