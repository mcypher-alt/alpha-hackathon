"use client";
import Link from "next/link";
import { AlertCircle, LoaderCircle, LockKeyhole } from "lucide-react";
import { STATUS } from "@/lib/types";
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <p>Загружаем данные…</p>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      {STATUS[value] || value}
    </span>
  );
}
export function LoginRequired({ bank = false }: { bank?: boolean }) {
  return (
    <div className="panel empty-state">
      <LockKeyhole size={32} />
      <h2>{bank ? "Вход для сотрудника банка" : "Войдите в личный кабинет"}</h2>
      <p>
        {bank
          ? "Очередь заявок доступна кредитному аналитику. Используйте демонстрационный вход сотрудника."
          : "В кабинете сохраняются заявки, документы и история решений."}
      </p>
      <Link
        className="button primary"
        href={`/login?redirect=${bank ? "/bank" : "/my-applications"}`}
      >
        Перейти ко входу
      </Link>
    </div>
  );
}
