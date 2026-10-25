import { writeFileSync } from "node:fs";
const request = (name, method, path, body, token = "token", tests) => ({
  name,
  request: {
    method,
    header: [
      ...(body ? [{ key: "Content-Type", value: "application/json" }] : []),
      ...(token
        ? [{ key: "Authorization", value: `Bearer {{${token}}}` }]
        : []),
    ],
    url: `{{baseUrl}}${path}`,
    ...(body
      ? {
          body: {
            mode: "raw",
            raw: JSON.stringify(body, null, 2),
            options: { raw: { language: "json" } },
          },
        }
      : {}),
  },
  ...(tests
    ? {
        event: [
          { listen: "test", script: { type: "text/javascript", exec: tests } },
        ],
      }
    : {}),
});
const payload = {
  inn: "9900000021",
  ogrn: "1187746009123",
  companyName: "ООО Тестовая мастерская",
  legalForm: "ООО",
  okved: "25.62",
  registrationDate: "2022-03-15",
  monthlyRevenue: 12000000,
  monthlyExpenses: 3000000,
  currentDebtLoad: 0,
  productCode: "K1",
  requestedAmount: 3000000,
  requestedTermMonths: 36,
  purpose: "Покупка станка",
  purposeCode: "equipment",
  answers: { purpose: "equipment", collateral: "no" },
  consent: true,
};
const setToken = (key) => [
  `pm.test('Successful login', () => pm.expect(pm.response.code).to.be.oneOf([200,201]));`,
  `pm.collectionVariables.set('${key}',pm.response.json().accessToken);`,
];
const collection = {
  info: {
    name: "Альфа • Кредитный кабинет — синтетическое демо",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    description:
      "Запустить Compose. Сначала выполнить вход клиента и аналитика, затем создать заявку. Все операции демонстрационные. applicationId заполняется автоматически.",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:4000" },
    { key: "token", value: "" },
    { key: "bankToken", value: "" },
    { key: "applicationId", value: "" },
  ],
  item: [
    request("Готовность", "GET", "/ready", null, null),
    request(
      "Вход клиента",
      "POST",
      "/auth/login",
      { phone: "+79990000001", password: "AlfaDemo2026!" },
      null,
      setToken("token"),
    ),
    request(
      "Вход аналитика",
      "POST",
      "/auth/login",
      { phone: "+79990000002", password: "AlfaDemo2026!" },
      null,
      setToken("bankToken"),
    ),
    request(
      "Синтетический профиль",
      "GET",
      "/applications/gosuslugi-mock?preset=good",
      null,
      null,
    ),
    request(
      "Создать положительную заявку",
      "POST",
      "/applications",
      payload,
      "token",
      [
        "pm.test('Created',()=>pm.response.to.have.status(201));",
        "pm.collectionVariables.set('applicationId',pm.response.json().id);",
      ],
    ),
    request("Мои заявки", "GET", "/applications/my"),
    request("Заявка и история", "GET", "/applications/{{applicationId}}"),
    request(
      "Очередь банка",
      "GET",
      "/applications/bank/all?completion=ALL",
      null,
      "bankToken",
    ),
    request(
      "Принять условия",
      "PATCH",
      "/applications/{{applicationId}}/client-action",
      { action: "ACCEPT_OFFER" },
    ),
    request(
      "Подписать и смоделировать выдачу",
      "PATCH",
      "/applications/{{applicationId}}/client-action",
      { action: "SIGN_CONTRACT" },
    ),
    request("Лента производства", "GET", "/news?okved=25.62&status=APPROVED"),
    request(
      "Лента торговли при дозапросе",
      "GET",
      "/news?okved=47.91&status=NEED_INFO",
    ),
    request(
      "Негативный тест: клиент читает банковскую очередь",
      "GET",
      "/applications/bank/all",
      null,
      "token",
      ["pm.test('Forbidden',()=>pm.response.to.have.status(403));"],
    ),
  ],
};
writeFileSync(
  new URL("../docs/postman_collection.json", import.meta.url),
  JSON.stringify(collection, null, 2) + "\n",
);
