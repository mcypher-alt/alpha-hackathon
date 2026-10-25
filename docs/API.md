# REST API

Base URL: `http://localhost:4000`. В браузере Next.js проксирует `/api/*` на backend. Формат JSON, авторизация `Authorization: Bearer <accessToken>`. Ошибки возвращают HTTP 400/401/403/404/409 и сообщение; нельзя считать неуспешный ответ действием, выполненным банком.

Точный машиночитаемый контракт доступен в `openapi.json` и `/api/docs-json`. Swagger `/api/docs` поддерживает авторизацию.

| Метод | Путь | Назначение / доступ |
|---|---|---|
| POST | /auth/register | Регистрация клиента; банковскую роль передать нельзя |
| POST | /auth/login | Телефон и пароль → accessToken и безопасные поля пользователя |
| GET | /applications/gosuslugi-mock?preset=good | Синтетический профиль; good / medium / risky |
| POST | /applications/intent | Обученное локальное распознавание цели, с уточнением при неопределенности |
| GET | /products | 13 продуктов с ограничениями и ссылками проектного снимка |
| POST | /applications | Создать заявку; только CLIENT |
| GET | /applications/my | Заявки текущего владельца |
| GET | /applications/:id | Заявка с историей и документами; владелец / аналитик |
| GET | /applications/bank/all | Очередь; UNDERWRITER / ADMIN |
| PATCH | /applications/bank/:id/intervene | Решение или дозапрос аналитика |
| PATCH | /applications/:id/client-action | Принятие условий, сведения, демонстрационная подпись |
| POST | /applications/:id/documents | Текстовый демонстрационный документ; владелец |
| GET | /applications/:id/documents/:documentId | Документ с проверкой доступа |
| GET | /news?okved=47.91&status=APPROVED | Контекстные демонстрационные статьи; после входа |
| GET | /news/:id | Полный текст статьи; после входа |
| GET | /health | Состояние процесса |
| GET | /ready | Готовность с проверкой БД |

Пример входа:

```json
{"phone":"+79990000001","password":"AlfaDemo2026!"}
```

Пример действия клиента:

```json
{"action":"PROVIDE_INFO","clientComment":"Добавлена синтетическая выписка за квартал"}
```

Пример решения аналитика:

```json
{"toStatus":"NEED_INFO","decisionNote":"Уточните структуру расходов за последний квартал"}
```

Внешние интеграции локальны и явно обозначены как симуляции. Недоступность реальных банковских систем не меняет сценарий. Подписание создает демонстрационный документ и не использует SMS, телефон или мессенджеры.
