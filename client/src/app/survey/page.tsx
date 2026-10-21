'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SurveyQuestion {
  id: string;
  title: string;
  help?: string;
  type?: 'number' | 'text';
  options?: string[][];
}

// Полный каталог 13 продуктов Альфа-Банка из спецификации[cite: 20, 24]
export const PRODUCTS = [
  { id: 'K1', name: 'Бизнес-кредит без залога', short: 'Кредит без залога', min: 300000, max: 30000000, term: '12–60 мес.', kind: 'loan', minm: 12, maxm: 60, pledge: 'none', goals: ['operations', 'gap', 'equipment', 'auto', 'market', 'other'], usage: ['single'], addons: 'Подписка на бизнес-кредит; «Защита бизнеса»', url: 'https://alfabank.ru/sme/profits/businesscredit/' },
  { id: 'K2', name: 'Бизнес-кредит с залогом', short: 'Кредит с залогом', min: 500000, max: 150000000, term: '12–120 мес.', kind: 'loan', minm: 12, maxm: 120, pledge: 'owned', goals: ['operations', 'equipment', 'auto', 'property', 'market', 'other'], usage: ['single'], addons: '«Защита бизнеса»; применимость подписки уточняется', url: 'https://alfabank.ru/sme/profits/businesscredit/' },
  { id: 'L1', name: 'Возобновляемая линия без залога', short: 'ВКЛ без залога', min: 300000, max: 30000000, term: 'Транш 1–6 мес. / до 12 с подпиской', kind: 'tranche', minm: 1, maxm: 12, pledge: 'none', goals: ['operations', 'gap', 'market', 'other'], usage: ['revolving', 'stages'], addons: 'Подписка на ВКЛ; до 12 мес. на транш', url: 'https://alfabank.ru/sme/profits/creditline/adv/' },
  { id: 'L2', name: 'Возобновляемая линия с залогом', short: 'ВКЛ с залогом', min: 500000, max: 50000000, term: 'Линия до 36 мес.; транш 6 мес.', kind: 'tranche', minm: 1, maxm: 6, pledge: 'owned', goals: ['operations', 'gap', 'market', 'other'], usage: ['revolving', 'stages'], addons: '«Защита бизнеса»', url: 'https://alfabank.ru/sme/profits/creditline/adv/' },
  { id: 'L3', name: 'Невозобновляемая линия с залогом', short: 'НКЛ с залогом', min: 500000, max: 50000000, term: 'До 60 мес.; выдача частями', kind: 'loan', minm: 1, maxm: 60, pledge: 'owned', goals: ['operations', 'equipment', 'other'], usage: ['stages'], addons: '«Защита бизнеса»', url: 'https://alfabank.ru/sme/profits/creditline/adv/' },
  { id: 'O1', name: 'Овердрафт', short: 'Овердрафт', min: 300000, max: 20000000, term: 'Транш 60 дней / 90 с подпиской', kind: 'overdraft', minm: 1, maxm: 3, pledge: 'none', goals: ['gap', 'operations', 'market', 'other'], usage: ['balance', 'revolving'], addons: 'Подписка на овердрафт', url: 'https://alfabank.ru/sme/profits/overdraft/' },
  { id: 'A1', name: 'Альфа-Старт', short: 'Альфа-Старт', min: 50000, max: 1000000, term: 'Транш 1–6 мес. / до 12 с подпиской', kind: 'tranche', minm: 1, maxm: 12, pledge: 'none', goals: ['operations', 'gap', 'equipment', 'market', 'other'], usage: ['stages', 'revolving'], addons: 'Подписка на Альфа-Старт', url: 'https://alfabank.ru/sme/profits/alfastart/' },
  { id: 'M1', name: 'Альфа-Селлер Кредит', short: 'Альфа-Селлер', min: null, max: 20000000, term: 'Транш 1–12 мес.', kind: 'tranche', minm: 1, maxm: 12, pledge: 'none', goals: ['market'], usage: ['single', 'stages', 'revolving'], addons: 'Подписка и «Защита бизнеса»', url: 'https://alfabank.ru/sme/profits/creditsellers/' },
  { id: 'C1', name: 'Business One Credit', short: 'Business One Credit', min: null, max: 1000000, term: 'Льготный период до 60/120 дней', kind: 'card', minm: null, maxm: null, pledge: 'none', goals: ['operations', 'gap', 'market', 'other'], usage: ['card'], addons: 'Базовый / Выгодный / Премиальный тариф', url: 'https://alfabank.ru/sme/profits/creditcard/' },
  { id: 'T1', name: 'Автокредит для бизнеса', short: 'Автокредит', min: null, max: 50000000, term: 'До 120 мес.', kind: 'loan', minm: null, maxm: 120, pledge: 'purchase', goals: ['auto'], usage: ['single'], addons: '«Защита бизнеса»; КАСКО', url: 'https://alfabank.ru/sme/profits/autocredit/' },
  { id: 'N1', name: 'Бизнес-ипотека', short: 'Бизнес-ипотека', min: null, max: 150000000, term: 'До 120 мес.; бизнес от 9 мес.', kind: 'loan', minm: null, maxm: 120, pledge: 'purchase', goals: ['property'], usage: ['single'], addons: '«Защита бизнеса»', url: 'https://alfabank.ru/sme/profits/businessipoteka/' },
  { id: 'R1', name: 'Рефинансирование без залога', short: 'Рефинанс. без залога', min: 300000, max: 30000000, term: '12–60 мес.; бизнес от 9 мес.', kind: 'loan', minm: 12, maxm: 60, pledge: 'none', goals: ['refi'], usage: ['single'], addons: 'Подписка / «Защита бизнеса»', url: 'https://alfabank.ru/sme/profits/refin/' },
  { id: 'R2', name: 'Рефинансирование с залогом', short: 'Рефинанс. с залогом', min: 500000, max: 150000000, term: '12–120 мес.; бизнес от 9 мес.', kind: 'loan', minm: 12, maxm: 120, pledge: 'owned', goals: ['refi'], usage: ['single'], addons: '«Защита бизнеса»', url: 'https://alfabank.ru/sme/profits/refin/' },
];

const GOALS = [
  ['operations', 'Текущие расходы, закупки, сырьё'],
  ['gap', 'Временная нехватка денег на счёте'],
  ['equipment', 'Станки, оборудование, развитие'],
  ['auto', 'Автомобиль или спецтехника'],
  ['property', 'Офис, склад или другая недвижимость'],
  ['refi', 'Погасить старые кредиты'],
  ['market', 'Закупки и продажи на маркетплейсах'],
  ['other', 'Другая задача — свободное описание'],
];
const USAGES = [
  ['single', 'Всю сумму сразу'],
  ['stages', 'Частями для одного проекта'],
  ['revolving', 'Взял → вернул → взял снова'],
  ['balance', 'Оплачивать со счёта при нехватке денег'],
  ['card', 'Оплачивать покупки картой'],
  ['unsure', 'Не знаю — подскажите'],
];
const TERMS = [
  ['2', 'До 2 месяцев'],
  ['3', 'До 3 месяцев'],
  ['6', 'До 6 месяцев'],
  ['12', 'До года'],
  ['36', 'До 3 лет'],
  ['60', 'До 5 лет'],
  ['120', 'До 10 лет'],
];
const AGES = [
  ['unregistered', 'Компания или ИП ещё не зарегистрированы'],
  ['new', 'Зарегистрированы менее 9 месяцев'],
  ['old', '9 месяцев и больше'],
  ['unknown', 'Не знаю точно'],
];
const COLL = [
  ['yes', 'Да, есть подходящее имущество'],
  ['no', 'Нет, только без залога'],
  ['compare', 'Хочу сравнить варианты'],
];
const ASSET = [
  ['yes', 'Да, приобретаемый объект может быть в залоге'],
  ['no', 'Нет, не готов оформлять покупку в залог'],
  ['unknown', 'Нужно объяснить, как это работает'],
];
const REFI = [
  ['single', 'Обычный бизнес-кредит'],
  ['line', 'Кредитная линия'],
  ['od', 'Овердрафт'],
  ['card', 'Кредитная карта'],
  ['other', 'Другое / не знаю'],
];
const REPAY = [
  ['equal', 'Одинаковые платежи'],
  ['decline', 'Уменьшающиеся платежи'],
  ['defer', 'Платить меньше в начале'],
  ['season', 'Учитывать сезонные поступления'],
  ['unknown', 'Не знаю'],
];

const RUB = (num: number) => Number(num).toLocaleString('ru-RU') + ' ₽';

function inferGoal(s = '') {
  const text = s.toLowerCase();
  if (/рефинанс|перекредит|закрыть.*кредит/.test(text)) return 'refi';
  if (/склад|недвиж|офис|помещени/.test(text)) return 'property';
  if (/автомоб|машин|грузов|спецтех|транспорт/.test(text)) return 'auto';
  if (/станок|оборудован/.test(text)) return 'equipment';
  if (/маркетплейс|ozon|wildberries/.test(text)) return 'market';
  if (/кассов|времен.*нехват/.test(text)) return 'gap';
  if (/товар|оборотн|поставщ|сырь|зарплат/.test(text)) return 'operations';
  return 'other';
}

export default function SurveyPage() {
  const router = useRouter();
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [stage, setStage] = useState(0);
  const [amountInput, setAmountInput] = useState('3000000');
  const [otherInput, setOtherInput] = useState('');

  const currentGoal = answer.purpose === 'other' ? inferGoal(answer.other) : answer.purpose;

  // Формирование адаптивной цепочки вопросов Q1-Q8[cite: 18, 19, 24]
  const getQuestions = (): SurveyQuestion[] => {
    const q: SurveyQuestion[] = [
      { id: 'purpose', title: 'Для чего вашему бизнесу нужны деньги?', help: 'Выберите бизнес-задачу, а не банковский продукт.', options: GOALS },
    ];
    if (answer.purpose === 'other') {
      q.push({ id: 'other', title: 'Опишите свою задачу своими словами', type: 'text', help: 'Текст классифицируется ML-моделью для выбора ветки конвейера.' });
    }
    if (answer.purpose && !['auto', 'property', 'refi'].includes(currentGoal)) {
      q.push({ id: 'usage', title: 'Как хотите пользоваться деньгами?', help: 'Помогает ранжировать разовый кредит, линию или овердрафт.', options: USAGES });
    }
    q.push({ id: 'amount', title: 'Какая сумма вам нужна?', type: 'number', help: 'Укажите планируемую сумму или желаемый лимит.' });
    q.push({ id: 'term', title: 'Когда хотите вернуть деньги?', help: 'Для кредитной линии речь идёт о сроке возврата каждого транша.', options: TERMS });
    q.push({ id: 'age', title: 'Как давно зарегистрирован ваш бизнес?', options: AGES });

    if (currentGoal === 'refi') q.push({ id: 'refi_type', title: 'Какой вид кредита хотите заменить?', options: REFI });
    if (currentGoal === 'auto' || currentGoal === 'property') {
      q.push({ id: 'asset', title: 'Готовы оформить покупаемый объект в залог?', options: ASSET });
    }
    if (Number(answer.amount) >= 500000) {
      q.push({ id: 'collateral', title: 'Готовы предоставить имеющееся имущество в залог?', options: COLL });
    }
    q.push({ id: 'repay', title: 'Как удобнее возвращать деньги?', options: REPAY });
    return q;
  };

  // Матрица правил отсечения[cite: 21, 22, 24]
  const evaluateProduct = (p: (typeof PRODUCTS)[0]) => {
    const excluded: string[] = [];
    const pending: string[] = [];
    let soft = 0;
    const amt = Number(answer.amount);
    const months = Number(answer.term);

    if (answer.purpose) {
      if (currentGoal !== 'other' && !p.goals.includes(currentGoal)) excluded.push('Цель отличается от назначения продукта');
      if (currentGoal === 'other') pending.push('Требуется уточнение назначения');
    }
    if (answer.usage && answer.usage !== 'unsure' && !p.usage.includes(answer.usage)) soft += 1;
    if (answer.amount && amt > 0) {
      if (p.min != null && amt < p.min) excluded.push(`Ниже минимальной суммы (${RUB(p.min)})`);
      if (amt > p.max) excluded.push(`Выше максимального лимита (${RUB(p.max)})`);
    }
    if (answer.term && months > 0) {
      if (p.kind === 'loan' && p.minm != null && months < p.minm) excluded.push(`Мин. срок: ${p.minm} мес.`);
      if (p.kind === 'loan' && p.maxm != null && months > p.maxm) excluded.push(`Макс. срок: ${p.maxm} мес.`);
      if (p.kind === 'tranche' && p.maxm != null && months > p.maxm) excluded.push('Для транша указан более короткий срок');
      if (p.kind === 'overdraft' && months > 3) excluded.push('Для овердрафта максимум 60/90 дней');
    }
    if (answer.age === 'unregistered') excluded.push('Бизнес должен быть зарегистрирован');
    if (answer.age === 'new' && ['N1', 'R1', 'R2'].includes(p.id)) excluded.push('Требуется от 9 месяцев работы бизнеса');
    if (answer.collateral === 'no' && p.pledge === 'owned') excluded.push('Требуется залог имеющегося имущества');
    if (answer.asset === 'no' && p.pledge === 'purchase') excluded.push('Требуется залог приобретаемого объекта');
    if (currentGoal === 'refi' && ['od', 'card'].includes(answer.refi_type) && ['R1', 'R2'].includes(p.id)) {
      excluded.push('Овердрафты и бизнес-карты по этой программе не рефинансируются');
    }

    return { p, excluded, pending, soft };
  };

  const qs = getQuestions();
  const done = stage >= qs.length;
  const currentQ = qs[stage];
  const rows = PRODUCTS.map(evaluateProduct);
  const fitted = rows
    .filter((x) => !x.excluded.length)
    .sort((a, b) => a.soft - b.soft || a.pending.length - b.pending.length);
  const removed = rows.filter((x) => x.excluded.length);

  const handleSelect = (id: string, val: string) => {
    setAnswer((prev) => ({ ...prev, [id]: val }));
    setStage((s) => s + 1);
  };

  // Переход на страницу оформления заявки (с проверкой авторизации)
  const handleProceedToApplication = (product: (typeof PRODUCTS)[0]) => {
    const query = new URLSearchParams({
      productCode: product.id,
      productName: product.name,
      amount: answer.amount || '3000000',
      term: answer.term || '24',
      purpose: answer.other || answer.purpose || 'operations',
    }).toString();

    const targetUrl = `/apply?${query}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (!token) {
      // Если клиент еще не авторизован — отправляем на логин с редиректом обратно в заявку
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F6] text-[#171719]">
      <header className="bg-[#171719] text-white px-7 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 font-extrabold text-lg">
          <div className="bg-[#EF3124] w-9 h-9 rounded-lg grid place-items-center text-xl font-black">А</div>
          <div>
            Кредитный консультант Альфа-Банка
            <div className="text-xs text-neutral-400 font-normal">Подбор финансирования без авторизации</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/my-applications')} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm font-medium">
            Мои заявки (ЛК)
          </button>
          <button onClick={() => router.push('/bank')} className="px-4 py-2 rounded-lg bg-[#EF3124] hover:bg-[#d82317] text-sm font-semibold">
            Терминал Сотрудника Банка
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto my-8 px-5 grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
        <section className="bg-white border border-neutral-200 rounded-2xl p-7 shadow-sm">
          {!done ? (
            <>
              <div className="flex justify-between text-xs text-neutral-500 mb-2">
                <span>Вопрос {stage + 1} из {qs.length}</span>
                <span>{Math.round((stage / qs.length) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-neutral-200 rounded-full mb-6 overflow-hidden">
                <div className="h-full bg-[#EF3124] transition-all" style={{ width: `${Math.round((stage / qs.length) * 100)}%` }} />
              </div>

              <h2 className="text-2xl font-bold mb-2">{currentQ.title}</h2>
              {currentQ.help && <p className="text-neutral-500 text-sm mb-6">{currentQ.help}</p>}

              {currentQ.type === 'number' ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[100000, 500000, 1000000, 3000000, 10000000, 50000000].map((sum) => (
                      <button
                        key={sum}
                        onClick={() => setAmountInput(String(sum))}
                        className="px-3.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-sm font-medium"
                      >
                        {sum >= 1000000 ? `${sum / 1000000} млн ₽` : `${sum / 1000} тыс. ₽`}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full max-w-md p-3.5 border border-neutral-300 rounded-xl text-lg mb-4"
                  />
                  <div>
                    <button
                      onClick={() => handleSelect('amount', amountInput)}
                      className="px-6 py-3 bg-[#EF3124] text-white font-semibold rounded-xl"
                    >
                      Продолжить →
                    </button>
                  </div>
                </div>
              ) : currentQ.type === 'text' ? (
                <div>
                  <textarea
                    value={otherInput}
                    onChange={(e) => setOtherInput(e.target.value)}
                    placeholder="Например: хочу купить станок для цеха"
                    className="w-full p-3.5 border border-neutral-300 rounded-xl min-h-[110px] mb-4"
                  />
                  <button
                    onClick={() => handleSelect('other', otherInput)}
                    className="px-6 py-3 bg-[#EF3124] text-white font-semibold rounded-xl"
                  >
                    Продолжить →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentQ.options?.map(([val, text]) => (
                    <button
                      key={val}
                      onClick={() => handleSelect(currentQ.id, val)}
                      className="text-left p-4 border border-neutral-200 rounded-xl hover:border-[#EF3124] hover:bg-[#fff7f6] flex justify-between items-center transition"
                    >
                      <span className="font-medium">{text}</span>
                      <span className="text-neutral-400 text-lg">›</span>
                    </button>
                  ))}
                </div>
              )}

              {stage > 0 && (
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setStage((s) => s - 1)} className="px-4 py-2 border rounded-xl text-sm font-semibold">
                    ← Назад
                  </button>
                  <button onClick={() => { setAnswer({}); setStage(0); }} className="px-4 py-2 border rounded-xl text-sm font-semibold">
                    Сбросить
                  </button>
                </div>
              )}
            </>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-2">Рекомендованные кредитные продукты</h2>
              <p className="text-sm text-neutral-500 mb-6">
                Выберите подходящее предложение для перехода к заполнению заявки в личном кабинете.
              </p>

              <div className="grid gap-4">
                {fitted.slice(0, 3).map(({ p, pending, soft }, idx) => (
                  <div
                    key={p.id}
                    className={`p-5 rounded-2xl border ${idx === 0 ? 'border-2 border-[#EF3124]' : 'border-neutral-200'}`}
                  >
                    <div className="text-xs text-neutral-500 font-semibold">
                      {idx === 0 ? 'Лучшее совпадение' : 'Альтернативный вариант'} • Код {p.id}
                    </div>
                    <div className="text-xl font-extrabold my-1">{p.name}</div>
                    <p className="text-sm text-neutral-600">
                      Лимит до {RUB(p.max)} • {p.term}
                    </p>
                    {soft > 0 && (
                      <p className="text-xs text-amber-700 mt-1">
                        Способ выдачи отличается от указанного, предложено как альтернатива.
                      </p>
                    )}
                    {pending.length > 0 && (
                      <p className="text-xs text-neutral-500 mt-1">Уточнить на этапе заявки: {pending.join(' • ')}</p>
                    )}
                    <div className="mt-3 p-3 bg-[#FFF5EE] rounded-xl text-xs">
                      <b>Кросс-продажа и подписка:</b> {p.addons} (-3% к ставке с подпиской «Альфа-Выгодно»)
                    </div>
                    <div className="mt-4 flex gap-3 items-center">
                      <button
                        onClick={() => handleProceedToApplication(p)}
                        className="px-5 py-2.5 bg-[#EF3124] hover:bg-[#d82317] text-white font-semibold rounded-xl text-sm"
                      >
                        Оформить заявку по продукту →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Правая панель живого отбора[cite: 24] */}
        <aside className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-base">Живой отбор конвейера</h3>
          <div className="text-3xl font-black mt-2">
            {fitted.length} <span className="text-sm font-normal text-neutral-400">из {PRODUCTS.length} продуктов</span>
          </div>
          <div className="text-xs font-bold uppercase text-neutral-400 mt-5 mb-2">Подходят сейчас</div>
          {fitted.slice(0, 6).map(({ p }) => (
            <div key={p.id} className="py-2 border-t border-neutral-100 text-sm flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-neutral-100 rounded text-xs font-bold">{p.id}</span>
              <span className="font-medium">{p.short}</span>
            </div>
          ))}
          {removed.length > 0 && (
            <>
              <div className="text-xs font-bold uppercase text-neutral-400 mt-5 mb-2">Исключены правилами</div>
              {removed.slice(0, 4).map(({ p, excluded }) => (
                <div key={p.id} className="py-2 border-t border-neutral-100 text-xs">
                  <span className="font-bold">{p.id} · {p.short}:</span>{' '}
                  <span className="text-neutral-500">{excluded[0]}</span>
                </div>
              ))}
            </>
          )}
        </aside>
      </main>
    </div>
  );
}