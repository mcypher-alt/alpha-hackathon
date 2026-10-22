import assert from "node:assert/strict";
const base = (process.env.API_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);
let count = 0;
async function request(
  path,
  { method = "GET", token, body, expect = 200 } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  assert.ok(
    [expect].flat().includes(response.status),
    `${method} ${path}: wanted ${expect}, got ${response.status}: ${text.slice(0, 350)}`,
  );
  count++;
  return data;
}
const password = "AlfaDemo2026!";
const suffix = String(Date.now()).slice(-8);
const user = await request("/auth/register", {
  method: "POST",
  expect: 201,
  body: {
    phone: `+799${suffix}`,
    password,
    fullName: "Синтетический тестовый клиент",
    position: "Директор",
  },
});
const outsider = await request("/auth/register", {
  method: "POST",
  expect: 201,
  body: {
    phone: `+798${suffix}`,
    password,
    fullName: "Другой тестовый клиент",
    position: "Директор",
  },
});
const bank = await request("/auth/login", {
  method: "POST",
  expect: [200, 201],
  body: { phone: "+79990000002", password },
});
assert.ok(user.accessToken && outsider.accessToken && bank.accessToken);
await request("/ready");
await request("/applications/bank/all", { expect: 401 });
await request("/applications/bank/all", {
  token: user.accessToken,
  expect: 403,
});
const profile = await request("/applications/gosuslugi-mock?preset=good");
const payload = {
  inn: `99${suffix}`,
  ogrn: "1187746009123",
  companyName: "ООО Синтетический API-тест",
  legalForm: "ООО",
  okved: "25.62",
  okvedTitle: "Производство",
  registrationDate: "2022-03-15",
  monthlyRevenue: 12000000,
  monthlyExpenses: 3000000,
  currentDebtLoad: 0,
  productCode: "K1",
  requestedAmount: 3000000,
  requestedTermMonths: 36,
  purpose: "Приобретение станка",
  purposeCode: "equipment",
  answers: { purpose: "equipment", collateral: "no" },
  consent: true,
};
assert.ok(profile.inn && profile.name);
await request("/applications", {
  method: "POST",
  token: user.accessToken,
  body: { ...payload, requestedAmount: -1 },
  expect: 400,
});
await request("/applications", {
  method: "POST",
  token: user.accessToken,
  body: { ...payload, productCode: "UNKNOWN" },
  expect: 400,
});
await request("/applications", {
  method: "POST",
  token: user.accessToken,
  body: { ...payload, requestedTermMonths: 1.5 },
  expect: 400,
});
await request("/applications", {
  method: "POST",
  token: user.accessToken,
  body: { ...payload, consent: false },
  expect: 400,
});
let app = await request("/applications", {
  method: "POST",
  token: user.accessToken,
  body: payload,
  expect: 201,
});
assert.ok(app.id && app.statusHistory.length >= 2);
const stages = [...app.statusHistory].sort(
  (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
);
assert.equal(
  stages
    .slice(0, 4)
    .map((h) => h.toStatus)
    .join(","),
  "SUBMITTED,VALIDATING,ENRICHING,SCORING",
  "Automatic stages must have a stable chronological order",
);
await request(`/applications/${app.id}`, {
  token: outsider.accessToken,
  expect: [403, 404],
});
await request("/applications", {
  method: "POST",
  token: outsider.accessToken,
  body: payload,
  expect: [403, 409],
});
await request(`/applications/bank/${app.id}/intervene`, {
  method: "PATCH",
  token: user.accessToken,
  body: { toStatus: "REJECTED", decisionNote: "Попытка доступа клиента" },
  expect: 403,
});
await request(`/applications/${app.id}/client-action`, {
  method: "PATCH",
  token: user.accessToken,
  body: { action: "SIGN_CONTRACT" },
  expect: [400, 409],
});
if (app.status === "MANUAL_REVIEW")
  app = await request(`/applications/bank/${app.id}/intervene`, {
    method: "PATCH",
    token: bank.accessToken,
    body: {
      toStatus: "APPROVED",
      decisionNote: "Положительное решение в синтетическом API-тесте",
      approvedAmount: 3000000,
      approvedTermMonths: 36,
      approvedRate: 21.5,
    },
  });
assert.ok(
  ["APPROVED", "COUNTER_OFFER"].includes(app.status),
  `Expected a positive synthetic fixture, got ${app.status}`,
);
app = await request(`/applications/${app.id}/client-action`, {
  method: "PATCH",
  token: user.accessToken,
  body: { action: "ACCEPT_OFFER", expectedVersion: app.version },
});
assert.equal(app.status, "SIGNING");
const signingVersion = app.version;
app = await request(`/applications/${app.id}/client-action`, {
  method: "PATCH",
  token: user.accessToken,
  body: { action: "SIGN_CONTRACT", expectedVersion: signingVersion },
});
assert.equal(app.status, "DISBURSED");
await request(`/applications/${app.id}/client-action`, {
  method: "PATCH",
  token: user.accessToken,
  body: { action: "SIGN_CONTRACT", expectedVersion: signingVersion },
  expect: [400, 409],
});
const persisted = await request(`/applications/${app.id}`, {
  token: user.accessToken,
});
assert.equal(persisted.status, "DISBURSED");
assert.equal(
  persisted.statusHistory.filter((h) => h.toStatus === "DISBURSED").length,
  1,
);
assert.ok(
  persisted.documents?.some((d) => d.isSigned),
  "Signed demonstration document must be persisted",
);
const signed = persisted.documents.find((d) => d.isSigned);
await request(`/applications/${app.id}/documents/${signed.id}`, {
  token: outsider.accessToken,
  expect: [403, 404],
});

let review = await request("/applications", {
  method: "POST",
  token: user.accessToken,
  body: {
    ...payload,
    requestedAmount: 2000000,
    purposeCode: undefined,
    answers: undefined,
  },
  expect: 201,
});
assert.equal(review.status, "MANUAL_REVIEW");
review = await request(`/applications/bank/${review.id}/intervene`, {
  method: "PATCH",
  token: bank.accessToken,
  body: {
    toStatus: "NEED_INFO",
    decisionNote: "Прикрепите синтетическую выписку за квартал",
    expectedVersion: review.version,
  },
});
const doc = await request(`/applications/${review.id}/documents`, {
  method: "POST",
  token: user.accessToken,
  body: {
    type: "STATEMENT",
    title: "Тестовая выписка",
    content:
      "Синтетическая выписка. Поступления 12000000 руб. Расходы 3000000 руб.",
  },
  expect: 201,
});
assert.ok(doc.id);
review = await request(`/applications/${review.id}`, {
  token: user.accessToken,
});
review = await request(`/applications/${review.id}/client-action`, {
  method: "PATCH",
  token: user.accessToken,
  body: {
    action: "PROVIDE_INFO",
    clientComment: "Синтетическая выписка приложена",
    expectedVersion: review.version,
  },
});
assert.equal(review.status, "MANUAL_REVIEW");
const competitors = await Promise.all([
  fetch(`${base}/applications/bank/${review.id}/intervene`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bank.accessToken}`,
    },
    body: JSON.stringify({
      toStatus: "REJECTED",
      decisionNote: "Синтетическое решение для теста конкурентных запросов",
      expectedVersion: review.version,
    }),
  }),
  fetch(`${base}/applications/bank/${review.id}/intervene`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bank.accessToken}`,
    },
    body: JSON.stringify({
      toStatus: "NEED_INFO",
      decisionNote: "Конкурентный дозапрос тестовых сведений",
      expectedVersion: review.version,
    }),
  }),
]);
assert.equal(
  competitors.filter((r) => r.ok).length,
  1,
  "Only one concurrent decision may succeed",
);
assert.ok(competitors.some((r) => [400, 409].includes(r.status)));
count += 2;
const newsManufacturing = await request("/news?okved=25.62&status=APPROVED", {
  token: user.accessToken,
});
const newsRetail = await request("/news?okved=47.91&status=NEED_INFO", {
  token: user.accessToken,
});
const items = (x) => (Array.isArray(x) ? x : x.items);
assert.ok(items(newsManufacturing)?.length && items(newsRetail)?.length);
assert.notDeepEqual(
  items(newsManufacturing).map((x) => x.id),
  items(newsRetail).map((x) => x.id),
);
const article = await request(`/news/${items(newsManufacturing)[0].id}`, {
  token: user.accessToken,
});
assert.ok(article.content.length > 100);
const queue = await request("/applications/bank/all", {
  token: bank.accessToken,
});
assert.ok(
  !JSON.stringify(queue).includes("passwordHash"),
  "Bank queue must not expose password hashes",
);
console.log(
  JSON.stringify(
    {
      result: "PASS",
      requests: count,
      applicationId: app.id,
      reviewId: review.id,
      checks: [
        "persistence",
        "approval-signing-disbursement",
        "document ownership",
        "request-info",
        "role access",
        "company ownership",
        "input validation",
        "concurrent decisions",
        "news personalization",
      ],
    },
    null,
    2,
  ),
);
