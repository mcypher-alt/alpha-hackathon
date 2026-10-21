'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ApplyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loadingGosuslugi, setLoadingGosuslugi] = useState(false);

  const [form, setForm] = useState({
    productCode: searchParams.get('productCode') || 'K1',
    productName: searchParams.get('productName') || 'Бизнес-кредит без залога',
    requestedAmount: searchParams.get('amount') || '3000000',
    requestedTermMonths: searchParams.get('term') || '24',
    purpose: searchParams.get('purpose') || 'Приобретение оборудования и пополнение оборотных средств',
    inn: '',
    ogrn: '',
    companyName: '',
    legalForm: 'ООО',
    okved: '',
    okvedTitle: '',
    registrationDate: '2022-03-15',
    monthlyRevenue: '',
    monthlyExpenses: '',
    currentDebtLoad: '',
  });

  // Моковая подгрузка из Госуслуг / ЕГРЮЛ[cite: 10, 13]
  const handleFillFromGosuslugi = async (preset: 'good' | 'medium' | 'risky' = 'good') => {
    setLoadingGosuslugi(true);
    try {
      const res = await fetch(`${API_URL}/applications/gosuslugi-mock?preset=${preset}`);
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        inn: data.inn,
        ogrn: data.ogrn,
        companyName: data.name,
        legalForm: data.legalForm,
        okved: data.okved,
        okvedTitle: data.okvedTitle,
        registrationDate: data.registrationDate,
        monthlyRevenue: String(data.monthlyRevenue),
        monthlyExpenses: String(data.monthlyExpenses),
        currentDebtLoad: String(data.currentDebtLoad),
      }));
    } finally {
      setLoadingGosuslugi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setIsSubmitted(true);
    } else {
      alert('Пожалуйста, войдите в личный кабинет перед отправкой заявки');
      router.push('/login');
    }
  };

  // Экран успешной отправки с зеленой галочкой
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-6">
        <div className="bg-white max-w-lg w-full rounded-3xl p-8 text-center shadow-sm border border-neutral-200">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0B1F35] mb-2">
            Ваша заявка успешно отправлена
          </h1>
          <p className="text-neutral-500 text-sm mb-6">
            Данные переданы в кредитный конвейер и ML-скоринг Альфа-Банка. Вы можете отслеживать этапы рассмотрения и решение банка в реальном времени.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/my-applications')}
              className="px-6 py-3 bg-[#EF3124] hover:bg-[#d82317] text-white font-semibold rounded-xl"
            >
              Перейти в «Мои заявки» →
            </button>
            <button
              onClick={() => router.push('/survey')}
              className="px-6 py-3 border border-neutral-300 font-semibold rounded-xl"
            >
              Вернуться к калькулятору
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F6] py-10 px-5">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
        <div className="flex items-center justify-between border-b pb-5 mb-6">
          <div>
            <span className="text-xs font-bold uppercase px-2.5 py-1 bg-red-50 text-[#EF3124] rounded-full">
              Продукт {form.productCode}
            </span>
            <h1 className="text-2xl font-extrabold mt-2">{form.productName}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-400">Сумма финансирования</div>
            <div className="text-xl font-black">{Number(form.requestedAmount).toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>

        {/* Блок автозаполнения через Госуслуги / ЕГРЮЛ[cite: 4, 10, 13] */}
        <div className="bg-[#F2F6FF] border border-blue-200 rounded-2xl p-5 mb-7">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
              <div>
                <div className="font-bold text-sm text-[#0B1F35]">
                  Быстрое предзаполнение через Госуслуги и ФНС ЕГРЮЛ
                </div>
                <div className="text-xs text-neutral-600">
                  Подтянем ИНН, ОГРН, ОКВЭД и бухгалтерскую отчетность без ручного ввода
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleFillFromGosuslugi('good')}
                disabled={loadingGosuslugi}
                className="px-4 py-2 bg-[#0D4CD3] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
              >
                Госуслуги / ЕГРЮЛ (Надежный бизнес)
              </button>
              <button
                type="button"
                onClick={() => handleFillFromGosuslugi('medium')}
                className="px-3 py-2 bg-white border border-blue-300 text-blue-800 text-xs font-semibold rounded-xl"
              >
                Пресет: Контр-оффер
              </button>
              <button
                type="button"
                onClick={() => handleFillFromGosuslugi('risky')}
                className="px-3 py-2 bg-white border border-red-200 text-red-700 text-xs font-semibold rounded-xl"
              >
                Пресет: Высокий риск
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-neutral-600">ИНН компании / ИП</label>
              <input
                required
                value={form.inn}
                onChange={(e) => setForm({ ...form, inn: e.target.value })}
                placeholder="7714892011"
                className="w-full mt-1 p-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600">Наименование организации</label>
              <input
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="ООО «ТехноПром»"
                className="w-full mt-1 p-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600">Код ОКВЭД</label>
              <input
                required
                value={form.okved}
                onChange={(e) => setForm({ ...form, okved: e.target.value })}
                placeholder="25.62"
                className="w-full mt-1 p-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600">Дата регистрации бизнеса</label>
              <input
                type="date"
                required
                value={form.registrationDate}
                onChange={(e) => setForm({ ...form, registrationDate: e.target.value })}
                className="w-full mt-1 p-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600">Среднемесячная выручка (₽)</label>
              <input
                type="number"
                required
                value={form.monthlyRevenue}
                onChange={(e) => setForm({ ...form, monthlyRevenue: e.target.value })}
                className="w-full mt-1 p-3 border rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600">Среднемесячные расходы (₽)</label>
              <input
                type="number"
                required
                value={form.monthlyExpenses}
                onChange={(e) => setForm({ ...form, monthlyExpenses: e.target.value })}
                className="w-full mt-1 p-3 border rounded-xl"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-4 bg-[#EF3124] hover:bg-[#d82317] text-white font-bold rounded-xl text-base"
            >
              Отправить заявку в банк
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}