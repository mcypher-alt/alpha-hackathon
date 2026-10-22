import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  ScanLine,
  ShieldCheck,
  ChevronRight,
  Building2,
  ShoppingBag,
  Truck,
  TrendingUp,
} from "lucide-react";
export default function Home() {
  return (
    <div className="page dashboard">
      <div className="eyebrow">ВАШ БИЗНЕС. ВАШ СЛЕДУЮЩИЙ ШАГ.</div>
      <div className="page-heading">
        <h1>
          Больше возможностей
          <br />
          для вашего бизнеса
        </h1>
        <p>
          Найдём финансирование под вашу задачу.
          <br />
          От первого вопроса до решения — в одном кабинете.
        </p>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-badge">
            <Sparkles size={15} />
            Умный подбор
          </span>
          <h2>
            Расскажите о планах.
            <br />
            Мы подберём кредит.
          </h2>
          <p>
            Несколько простых вопросов вместо сложных
            <br className="desktop-only" /> банковских терминов. Сравните
            подходящие варианты
            <br className="desktop-only" /> и сразу переходите к заявке.
          </p>
          <Link className="button primary" href="/survey">
            Подобрать финансирование <ArrowRight size={18} />
          </Link>
          <span className="hero-note">
            13 продуктов · Без регистрации для подбора
          </span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-card back-card">
            <span>БИЗНЕС</span>
            <strong>
              Следующий
              <br />
              уровень
            </strong>
            <TrendingUp size={46} />
          </div>
          <div className="art-card front-card">
            <span className="art-chip" />
            <div className="art-alpha">А</div>
            <span className="art-caption">Для больших планов</span>
            <strong>α</strong>
          </div>
          <div className="art-small">
            <ShieldCheck size={20} />
            <span>
              Понятные условия
              <br />
              <b>на каждом шаге</b>
            </span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>На что нужны деньги?</h2>
          <Link href="/survey">
            Все задачи <ChevronRight size={17} />
          </Link>
        </div>
        <div className="purpose-grid">
          {[
            {
              icon: ShoppingBag,
              title: "Закупки и оборот",
              text: "Товары, сырьё и текущие расходы",
              goal: "operations",
            },
            {
              icon: TrendingUp,
              title: "Развитие бизнеса",
              text: "Оборудование и новые проекты",
              goal: "equipment",
            },
            {
              icon: Truck,
              title: "Транспорт",
              text: "Автомобиль или спецтехника",
              goal: "auto",
            },
            {
              icon: Building2,
              title: "Недвижимость",
              text: "Офис, склад или своё помещение",
              goal: "property",
            },
          ].map((x) => (
            <Link
              key={x.goal}
              className="purpose-card"
              href={`/survey?goal=${x.goal}`}
            >
              <x.icon size={24} />
              <h3>{x.title}</h3>
              <p>{x.text}</p>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section process-section">
        <div>
          <div className="eyebrow">ПРОЗРАЧНЫЙ ПРОЦЕСС</div>
          <h2>
            Понятно, что происходит.
            <br />
            Ясно, что делать дальше.
          </h2>
          <p className="muted">
            Один контекст, одна заявка, вся история рядом.
          </p>
        </div>
        <div className="process-list">
          {[
            {
              icon: Sparkles,
              title: "Подберите продукт",
              text: "Цель, сумма и срок. Объясним, почему подходит каждый вариант.",
            },
            {
              icon: ScanLine,
              title: "Отправьте заявку",
              text: "Данные бизнеса и финансовые показатели сохранятся в кабинете.",
            },
            {
              icon: ShieldCheck,
              title: "Получите решение",
              text: "Условия, запрос сведений или причина отказа. Дальнейшие действия всегда видны.",
            },
          ].map((x, i) => (
            <div className="process-step" key={x.title}>
              <span className="step-number">0{i + 1}</span>
              <div>
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </div>
              <x.icon size={22} />
            </div>
          ))}
        </div>
      </section>
      <div className="info-strip">
        <ShieldCheck size={22} />
        <div>
          <b>Можно проверить весь путь</b>
          <p>
            Войдите как предприниматель или сотрудник банка. Данные, проверки,
            документы и выдача — учебные.
          </p>
        </div>
        <Link href="/login">
          Демо-вход <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}
