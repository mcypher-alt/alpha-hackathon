import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Layers3,
  Laptop,
  Package,
  Truck,
  Warehouse,
} from "lucide-react";

const facts = [
  {
    icon: Building2,
    title: "Для ИП и ООО",
    text: "Подбор под задачу и показатели бизнеса.",
  },
  {
    icon: Warehouse,
    title: "С залогом и без",
    text: "Собственное имущество или приобретаемый объект.",
  },
  {
    icon: Layers3,
    title: "Разово или частями",
    text: "Кредит, кредитная линия и овердрафт.",
  },
  {
    icon: Laptop,
    title: "Заявка онлайн",
    text: "Ответ банка и документы в личном кабинете.",
  },
];

const purposes = [
  {
    icon: Package,
    title: "Закупить товары",
    text: "Товары, сырьё и другие оборотные расходы.",
    goal: "operations",
  },
  {
    icon: CircleDollarSign,
    title: "Купить оборудование",
    text: "Станки, техника и оснащение бизнеса.",
    goal: "equipment",
  },
  {
    icon: Truck,
    title: "Приобрести транспорт",
    text: "Автомобиль или спецтехника для компании.",
    goal: "auto",
  },
  {
    icon: Building2,
    title: "Купить помещение",
    text: "Офис, склад или торговая недвижимость.",
    goal: "property",
  },
];

const questions = [
  {
    title: "С чего начать, если я не знаю, какой кредит нужен?",
    answer:
      "Выберите задачу бизнеса и укажите, сколько денег примерно потребуется. Название кредитного продукта знать не нужно: в подборе появятся подходящие варианты и различия между ними.",
  },
  {
    title: "Какие цифры понадобятся для подбора?",
    answer:
      "Средняя выручка за месяц, операционные расходы и платежи по действующим кредитам. Если точных цифр под рукой нет, можно указать приблизительные значения или пропустить этот шаг. Перед отправкой заявки сведения нужно проверить.",
  },
  {
    title: "Нужно ли заранее выбирать срок кредита?",
    answer:
      "Нет. Для разового кредита можно получить ориентир по сроку и платежу на основе введённых доходов и расходов. Для регулярных закупок полезнее знать, сколько времени проходит от оплаты товара до получения денег от продаж. Предложенный срок можно изменить в заявке.",
  },
  {
    title: "Чем отличаются кредит, кредитная линия и овердрафт?",
    answer:
      "По разовому кредиту деньги выдают одной суммой. Кредитная линия позволяет получать их частями в пределах лимита. Овердрафт используют для платежей с расчётного счёта, когда собственных денег на нём временно не хватает.",
  },
  {
    title: "Можно ли получить кредит без собственного имущества в залог?",
    answer:
      "В каталоге есть варианты без залога. Если вы покупаете транспорт или недвижимость, залогом может стать сам приобретаемый объект. Поэтому готовность заложить покупку и наличие другого имущества спрашиваются отдельно.",
  },
  {
    title: "Подбор означает, что кредит уже одобрен?",
    answer:
      "Нет. Подбор показывает варианты по вашим ответам. Решение принимается после подачи заявки и проверки сведений. Результатом могут стать одобрение, другие условия, запрос документов или отказ с объяснением.",
  },
];

export default function Home() {
  return (
    <div className="credit-landing">
      <section className="credit-hero" aria-labelledby="credit-title">
        <div className="credit-hero-inner landing-container">
          <div className="credit-hero-copy">
            <div className="credit-breadcrumb">
              Бизнесу <span>/</span> Кредитование
            </div>
            <h1 id="credit-title">
              Кредиты
              <br />
              для бизнеса
            </h1>
            <p>
              На закупку товаров, новое оборудование
              <br className="credit-desktop-break" /> и другие задачи компании
            </p>
            <Link className="bank-button" href="/survey">
              Поможем определиться с условиями
            </Link>
          </div>
          <div className="credit-hero-art" aria-hidden="true">
            <div className="credit-art-shadow" />
            <span className="credit-art-letter">А</span>
            <span className="credit-art-line" />
          </div>
        </div>
      </section>

      <section
        className="credit-facts landing-container"
        aria-label="О кредитовании бизнеса"
      >
        {facts.map(({ icon: Icon, title, text }) => (
          <div className="credit-fact" key={title}>
            <Icon size={28} strokeWidth={1.6} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        ))}
      </section>

      <section
        className="credit-section landing-container"
        id="products"
        aria-labelledby="purposes-title"
      >
        <h2 id="purposes-title">На что нужны деньги?</h2>
        <div className="credit-purpose-grid">
          {purposes.map(({ icon: Icon, title, text, goal }) => (
            <Link
              key={goal}
              href={`/survey?goal=${goal}`}
              className="credit-purpose"
            >
              <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
              <ArrowRight size={23} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section
        className="credit-help-section"
        id="selection"
        aria-labelledby="selection-title"
      >
        <div className="landing-container credit-help-inner">
          <div>
            <h2 id="selection-title">
              Не знаете, какие
              <br />
              условия выбрать?
            </h2>
            <p>
              Начните с того, что знаете о своём бизнесе:
              <br className="credit-desktop-break" /> сколько он зарабатывает и
              на что тратит деньги.
            </p>
            <Link className="bank-button" href="/survey">
              Перейти к подбору
            </Link>
          </div>
          <div className="credit-preparation">
            <h3>Что можно подготовить</h3>
            <ul>
              <li>Примерную сумму на вашу задачу</li>
              <li>Средние поступления и расходы за месяц</li>
              <li>Платежи по действующим кредитам</li>
            </ul>
            <p>
              Не знаете точные цифры — укажите оценку.
              <br />
              Срок и параметры можно уточнить в заявке.
            </p>
          </div>
        </div>
      </section>

      <section
        className="credit-section credit-faq landing-container"
        id="questions"
        aria-labelledby="questions-title"
      >
        <h2 id="questions-title">Ответы на вопросы</h2>
        <div>
          {questions.map(({ title, answer }) => (
            <details key={title} className="credit-faq-item">
              <summary>
                {title}
                <span className="credit-faq-symbol" aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
