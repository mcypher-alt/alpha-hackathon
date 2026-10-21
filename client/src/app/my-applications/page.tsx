'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSignature,
  Sparkles,
  ArrowRight,
  Newspaper,
  RefreshCw,
} from 'lucide-react';
import type { LoanApplicationItem, ApplicationStatusType } from '../bank/page';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PIPELINE_STEPS = [
  { key: 'SUBMITTED', title: 'Заявка принята' },
  { key: 'SCORING', title: 'Проверка и скоринг' },
  { key: 'DECISION', title: 'Решение банка' },
  { key: 'SIGNING', title: 'Подписание ПЭП' },
  { key: 'DISBURSED', title: 'Деньги на счёте' },
];

function getStepIndex(status: ApplicationStatusType): number {
  switch (status) {
    case 'DRAFT':
    case 'SUBMITTED':
      return 0;
    case 'VALIDATING':
    case 'ENRICHING':
    case 'SCORING':
    case 'MANUAL_REVIEW':
    case 'NEED_INFO':
      return 1;
    case 'COUNTER_OFFER':
    case 'APPROVED':
    case 'REJECTED':
      return 2;
    case 'SIGNING':
      return 3;
    case 'DISBURSED':
      return 4;
    default:
      return 1;
  }
}

interface NewsArticle {
  id: string;
  tag: string;
  title: string;
  summary: string;
  reason: string;
}

// Генератор адаптивной новостной ленты под профиль клиента и статус его заявки
function getPersonalizedNews(apps: LoanApplicationItem[]): NewsArticle[] {
  const latest = apps[0];
  const okved = latest?.company?.okved || '47.91';
  const status = latest?.status;

  const news: NewsArticle[] = [];

  if (status === 'COUNTER_OFFER') {
    news.push({
      id: 'n-counter',
      tag: 'Советы по кредитованию',
      title: 'Почему банк предлагает альтернативный лимит и как увеличить сумму в будущем',
      summary:
        'Разбираем, как показатель долговой нагрузки (DTI) влияет на одобренный лимит и как через 3 месяца оборотов по счёту повысить кредитный лимит в 1,5 раза.',
      reason: 'Подобрано на основе статуса вашей заявки: Альтернативное предложение',
    });
  } else if (status === 'APPROVED' || status === 'DISBURSED') {
    news.push({
      id: 'n-sub',
      tag: 'Выгода для заёмщиков',
      title: 'Как сэкономить до 3% годовых по активному кредиту с подпиской «Альфа-Выгодно»',
      summary:
        'Подключение подписки снижает ставку со следующего расчетного периода и открывает бесплатные переводы юрлицам.',
      reason: 'Подобрано для клиентов с одобренным финансированием',
    });
  } else {
    news.push({
      id: 'n-prep',
      tag: 'Аналитика МСП',
      title: 'Как бизнесу подготовиться к экспресс-скорингу: 4 главных показателя ФНС и БКИ',
      summary:
        'Автоматический конвейер оценивает регулярность выручки и отсутствие кассовых разрывов. Проверьте чек-лист перед подачей.',
      reason: 'Актуально на этапе рассмотрения заявки',
    });
  }

  if (okved.startsWith('25') || okved.startsWith('28')) {
    news.push({
      id: 'n-ind',
      tag: 'Господдержка производства',
      title: 'Льготное финансирование закупки станков и промышленного оборудования в 2026 году',
      summary:
        'Предприятия обрабатывающей промышленности (ОКВЭД 25) могут совместить инвестиционный кредит с субсидией Минпромторга.',
      reason: `Персонально по вашему ОКВЭД ${okved} (Производство)`,
    });
  } else if (okved.startsWith('47')) {
    news.push({
      id: 'n-ecom',
      tag: 'Маркетплейсы и Ритейл',
      title: 'Кредитные линии и овердрафты под высокий сезон распродаж на маркетплейсах',
      summary:
        'Как селлерам пополнить складские остатки без заморозки собственной оборотной выручки.',
      reason: `Персонально по вашему ОКВЭД ${okved} (Торговля и E-commerce)`,
    });
  } else {
    news.push({
      id: 'n-gen',
      tag: 'Финансы бизнеса',
      title: 'Управление оборотным капиталом: когда выгоднее овердрафт, а когда ВКЛ',
      summary: 'Сравнение стоимости привлечения коротких денег для закрытия кассовых разрывов.',
      reason: `Подобрано для профиля «${latest?.company?.name || 'Малый бизнес'}»`,
    });
  }

  return news;
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<LoanApplicationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [infoInputs, setInfoInputs] = useState<Record<string, string>>({});

  const fetchMyApps = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login?redirect=/my-applications');
        return;
      }
      const res = await fetch(`${API_URL}/applications/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: unknown = await res.json();
        setApplications(Array.isArray(data) ? (data as LoanApplicationItem[]) : []);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchMyApps();
  }, [fetchMyApps]);

  const sendClientAction = async (
    appId: string,
    action: 'ACCEPT_OFFER' | 'SIGN_CONTRACT' | 'PROVIDE_INFO',
  ) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_URL}/applications/${appId}/client-action`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action,
        clientComment: infoInputs[appId] || '',
      }),
    });

    if (res.ok) {
      void fetchMyApps();
    }
  };

  const personalizedNews = getPersonalizedNews(applications);

  return (
    <div className="min-h-screen bg-[#F2F3F5] text-[#0B1F35]">
      <header className="bg-[#171719] text-white px-7 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 font-extrabold text-lg">
          <div className="bg-[#EF3124] w-9 h-9 rounded-lg grid place-items-center text-xl font-black">
            А
          </div>
          <div>
            Личный кабинет предпринимателя
            <div className="text-xs text-neutral-400 font-normal">Мои кредитные заявки и предложения</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/survey')}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium"
          >
            + Подобрать новый кредит
          </button>
          <button
            onClick={() => router.push('/bank')}
            className="px-4 py-2 rounded-lg bg-[#EF3124] hover:bg-[#d82317] text-sm font-semibold"
          >
            Режим Сотрудника Банка
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto my-8 px-5 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* Левая колонка: Список заявок клиента */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold">Мои заявки ({applications.length})</h1>
            <button
              onClick={() => void fetchMyApps()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-white border rounded-xl hover:bg-neutral-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Обновить статусы
            </button>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-8 text-center text-neutral-500">
              Загрузка заявок...
            </div>
          ) : applications.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-neutral-200">
              <h3 className="text-lg font-bold mb-2">У вас пока нет активных заявок</h3>
              <p className="text-sm text-neutral-500 mb-5">
                Пройдите 1-минутный подбор кредитного продукта, и данные автоматически появятся здесь.
              </p>
              <button
                onClick={() => router.push('/survey')}
                className="px-6 py-3 bg-[#EF3124] text-white font-semibold rounded-xl text-sm"
              >
                Подобрать финансирование →
              </button>
            </div>
          ) : (
            applications.map((app) => {
              const currentStep = getStepIndex(app.status);

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-5"
                >
                  {/* Шапка карточки заявки */}
                  <div className="flex flex-wrap justify-between items-start gap-4 border-b pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-red-50 text-[#EF3124] font-bold text-xs rounded-full">
                          {app.product?.code}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {app.company?.name} (ИНН {app.company?.inn})
                        </span>
                      </div>
                      <h2 className="text-xl font-extrabold mt-1">{app.product?.title}</h2>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-neutral-400">Запрошенная сумма</div>
                      <div className="text-lg font-black">
                        {Number(app.requestedAmount).toLocaleString('ru-RU')} ₽ на {app.requestedTermMonths} мес.
                      </div>
                    </div>
                  </div>

                  {/* Прогресс-бар сквозного пути */}
                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {PIPELINE_STEPS.map((st, idx) => {
                      const isDone = idx <= currentStep && app.status !== 'REJECTED';
                      return (
                        <div key={st.key} className="text-center">
                          <div
                            className={`h-2 rounded-full mb-1.5 ${
                              app.status === 'REJECTED'
                                ? 'bg-red-200'
                                : isDone
                                ? 'bg-[#0CC44D]'
                                : 'bg-neutral-200'
                            }`}
                          />
                          <span className={`text-[11px] font-semibold ${isDone ? 'text-[#0B1F35]' : 'text-neutral-400'}`}>
                            {st.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Интерактивный блок в зависимости от статуса */}
                  {app.status === 'COUNTER_OFFER' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                        <Sparkles className="w-5 h-5 text-amber-600" />
                        Банк готов профинансировать вас на скорректированных условиях (Контр-оффер)
                      </div>
                      <p className="text-xs text-amber-800">{app.decisionNote}</p>

                      <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-amber-100 text-sm">
                        <div>
                          <div className="text-xs text-neutral-400">Вы запрашивали</div>
                          <div className="font-bold line-through text-neutral-400">
                            {Number(app.requestedAmount).toLocaleString('ru-RU')} ₽ • {app.requestedTermMonths} мес.
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-emerald-700 font-semibold">Одобренное предложение банка</div>
                          <div className="font-black text-base text-[#0B1F35]">
                            {Number(app.approvedAmount).toLocaleString('ru-RU')} ₽ • {app.approvedTermMonths} мес. (Ставка {app.approvedRate}%)
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => void sendClientAction(app.id, 'ACCEPT_OFFER')}
                        className="px-5 py-2.5 bg-[#EF3124] hover:bg-[#d82317] text-white font-semibold rounded-xl text-sm flex items-center gap-2"
                      >
                        Принять условия контр-оффера и перейти к подписанию <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {app.status === 'APPROVED' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-emerald-900 font-bold">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          Заявка одобрена на сумму {Number(app.approvedAmount ?? app.requestedAmount).toLocaleString('ru-RU')} ₽ (Ставка {app.approvedRate}%)
                        </div>
                        <p className="text-xs text-emerald-800 mt-1">{app.decisionNote}</p>
                      </div>
                      <button
                        onClick={() => void sendClientAction(app.id, 'ACCEPT_OFFER')}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm"
                      >
                        Перейти к подписанию договора →
                      </button>
                    </div>
                  )}

                  {app.status === 'SIGNING' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                          <FileSignature className="w-5 h-5 text-blue-600" />
                          Кредитный договор сформирован и ожидает вашей электронной подписи (ПЭП)
                        </div>
                        <p className="text-xs text-blue-800 mt-1">
                          Сумма к зачислению: {Number(app.approvedAmount ?? app.requestedAmount).toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                      <button
                        onClick={() => void sendClientAction(app.id, 'SIGN_CONTRACT')}
                        className="px-5 py-2.5 bg-[#0D4CD3] hover:bg-blue-800 text-white font-semibold rounded-xl text-sm"
                      >
                        Подписать ПЭП и зачислить средства
                      </button>
                    </div>
                  )}

                  {app.status === 'DISBURSED' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-900 text-sm font-semibold">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                      Договор подписан. Средства ({Number(app.approvedAmount ?? app.requestedAmount).toLocaleString('ru-RU')} ₽) зачислены на ваш расчётный счёт в Альфа-Банке!
                    </div>
                  )}

                  {app.status === 'NEED_INFO' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2 text-orange-900 font-bold text-sm">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        Банк запросил дополнительную информацию по заявке
                      </div>
                      <p className="text-xs text-orange-800">{app.decisionNote}</p>
                      <div className="flex gap-2">
                        <input
                          value={infoInputs[app.id] || ''}
                          onChange={(e) => setInfoInputs({ ...infoInputs, [app.id]: e.target.value })}
                          placeholder="Введите пояснение или ссылку на выписку по контракту..."
                          className="flex-1 p-2.5 bg-white border rounded-xl text-sm"
                        />
                        <button
                          onClick={() => void sendClientAction(app.id, 'PROVIDE_INFO')}
                          className="px-4 py-2.5 bg-[#EF3124] text-white font-semibold rounded-xl text-xs"
                        >
                          Отправить в банк
                        </button>
                      </div>
                    </div>
                  )}

                  {app.status === 'REJECTED' && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-900 text-xs">
                      <b>К сожалению, по заявке принято отрицательное решение:</b> {app.decisionNote}
                    </div>
                  )}

                  {['SUBMITTED', 'VALIDATING', 'ENRICHING', 'SCORING', 'MANUAL_REVIEW'].includes(app.status) && (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-neutral-600">
                      <Clock className="w-5 h-5 text-neutral-400 shrink-0" />
                      <div>
                        <b>Текущий этап: {app.status}</b> — {app.decisionNote || 'Заявка обрабатывается кредитным конвейером.'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>

        {/* Правая колонка: Персонализированная новостная лента под клиента */}
        <aside className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-[#EF3124]" />
            <h3 className="font-extrabold text-base">Умная лента для вашего бизнеса</h3>
          </div>
          <p className="text-xs text-neutral-500">
            Подстраивается под ваш ОКВЭД и текущий этап рассмотрения заявки в конвейере.
          </p>

          <div className="space-y-3 pt-2">
            {personalizedNews.map((item) => (
              <div key={item.id} className="p-4 rounded-xl bg-[#F9FAFC] border border-neutral-100 space-y-1.5">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-red-50 text-[#EF3124] rounded-full">
                  {item.tag}
                </span>
                <h4 className="font-bold text-sm leading-snug">{item.title}</h4>
                <p className="text-xs text-neutral-600">{item.summary}</p>
                <div className="text-[11px] text-emerald-700 font-medium pt-1">
                  ✦ {item.reason}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}