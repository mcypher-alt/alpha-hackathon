"use client";
export type User = {
  id: string;
  fullName: string;
  phone: string;
  role: "CLIENT" | "UNDERWRITER" | "ADMIN";
};
export type Session = { accessToken: string; user: User };
export function stored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Browser storage may be disabled. */
  }
}
export function session(): Session | null {
  return stored<Session | null>("alfa.session", null);
}
export function setSession(value: Session | null) {
  if (value) save("alfa.session", value);
  else localStorage.removeItem("alfa.session");
  window.dispatchEvent(new Event("alfa-auth"));
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = session()?.accessToken;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(
      "Не удалось связаться с сервером. Проверьте запуск сервиса и повторите действие.",
      0,
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) setSession(null);
    throw new ApiError(
      Array.isArray(data.message)
        ? data.message.join(". ")
        : data.message || `Ошибка запроса (${response.status})`,
      response.status,
    );
  }
  return data as T;
}
export const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 }) +
  " ₽";
export const date = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function payment(amount: number, rate: number, months: number) {
  if (!months) return 0;
  const r = rate / 1200;
  return r ? (amount * r) / (1 - Math.pow(1 + r, -months)) : amount / months;
}
