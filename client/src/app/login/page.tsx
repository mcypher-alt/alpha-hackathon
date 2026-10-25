"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { api, setSession, type Session } from "@/lib/api";
import { ErrorBox } from "@/components/common";
function Login() {
  const router = useRouter(),
    params = useSearchParams();
  const [phone, setPhone] = useState("+79990000001"),
    [password, setPassword] = useState("AlfaDemo2026!");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function login(p = phone, pass = password, demoRole?: string) {
    setBusy(true);
    setError("");
    try {
      const auth = await api<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone: p, password: pass }),
      });
      setSession(auth);
      const redirect = params.get("redirect");
      router.push(
        demoRole === "bank"
          ? "/bank"
          : redirect?.startsWith("/") &&
              !redirect.startsWith("//") &&
              redirect !== "/bank"
            ? redirect
            : auth.user.role === "CLIENT"
              ? "/my-applications"
              : "/bank",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page login-page">
      <div className="login-intro">
        <div className="eyebrow">КРЕДИТНЫЙ КАБИНЕТ</div>
        <h1>Кредитный кабинет</h1>
        <p>
          Войдите, чтобы отправить заявку или посмотреть решение. Ваши ответы из
          подбора сохранятся.
        </p>
        <div className="login-proof">
          <ShieldCheck size={26} />
          <span>
            Без SMS и внешних сервисов.
            <br />
            <b>Всё для проверки прототипа — внутри.</b>
          </span>
        </div>
      </div>
      <section className="panel login-panel">
        <h2>Вход в кабинет</h2>
        <p className="muted">Используйте тестовую учётную запись</p>
        <ErrorBox message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <label>
            Телефон
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button disabled={busy} className="button primary full">
            {busy ? "Входим…" : "Войти"}
            <ArrowRight size={17} />
          </button>
        </form>
        <div className="separator">БЫСТРЫЙ ДЕМО-ВХОД</div>
        <button
          disabled={busy}
          className="demo-login"
          onClick={() => void login("+79990000001", "AlfaDemo2026!", "client")}
        >
          <Building2 size={21} />
          <span>
            <b>Предприниматель</b>
            <small>Подать заявку и пройти кредитный путь</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <button
          disabled={busy}
          className="demo-login"
          onClick={() => void login("+79990000002", "AlfaDemo2026!", "bank")}
        >
          <ShieldCheck size={21} />
          <span>
            <b>Сотрудник банка</b>
            <small>Рассмотреть заявку и принять решение</small>
          </span>
          <ArrowRight size={17} />
        </button>
        <p className="small muted">
          Все профили и операции в демонстрации синтетические.
        </p>
      </section>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
