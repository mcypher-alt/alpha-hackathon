'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/survey';

  const [phone, setPhone] = useState('+79991234567');
  const [password, setPassword] = useState('securepass123');
  const [loading, setLoading] = useState(false);

  // Обычный вход по телефону
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (res.ok && data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        router.push(redirectTo);
      } else {
        alert(data.message || 'Ошибка входа');
      }
    } finally {
      setLoading(false);
    }
  };

  // Мгновенный демо-вход для жюри (с авторегистрацией тестового аккаунта)
  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const regRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+79990000000',
          password: 'demopassword',
          fullName: 'Никита Предприниматель',
          position: 'Генеральный директор',
        }),
      });
      
      const regData = await regRes.json();
      if (regRes.ok && regData.accessToken) {
        localStorage.setItem('accessToken', regData.accessToken);
        router.push(redirectTo);
        return;
      }

      // Если уже зарегистрирован — просто логинимся
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+79990000000', password: 'demopassword' }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.accessToken) {
        localStorage.setItem('accessToken', loginData.accessToken);
        router.push(redirectTo);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-5">
      <div className="bg-white max-w-md w-full rounded-3xl p-8 border border-neutral-200 shadow-sm space-y-6">
        <div className="text-center">
          <div className="bg-[#EF3124] text-white w-12 h-12 rounded-2xl mx-auto flex items-center justify-center font-black text-2xl mb-3">
            А
          </div>
          <h1 className="text-2xl font-extrabold text-[#0B1F35]">Вход в личный кабинет</h1>
          <p className="text-xs text-neutral-500 mt-1">Альфа-Банк • Кредитный конвейер МСП</p>
        </div>

        {/* Кнопка быстрого демо-входа для жюри */}
        <div className="bg-[#FFF5EE] border border-orange-200 rounded-2xl p-4 text-center space-y-2">
          <div className="text-xs font-bold text-orange-900 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#EF3124]" /> Быстрый вход для проверки жюри
          </div>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-3 bg-[#EF3124] hover:bg-[#d82317] text-white font-bold rounded-xl text-sm shadow-sm"
          >
            Войти в один клик (Демо-аккаунт) →
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-400 uppercase">
          <div className="h-px bg-neutral-200 flex-1" /> или по телефону <div className="h-px bg-neutral-200 flex-1" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-neutral-600">Номер телефона</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full mt-1 p-3 border rounded-xl text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 p-3 border rounded-xl text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#0B1F35] hover:bg-black text-white font-bold rounded-xl text-sm"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}