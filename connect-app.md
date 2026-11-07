# Подключение приложения к api.vega.chat

Полный контур «приложение → VEGA»: вход пользователя через сайт → именной
ключ `sk-apivega-...` → свой список моделей из env → щит ПДн (152-ФЗ).
Эталон — `officevega`. Документа достаточно, чтобы подключить любое
приложение: десктоп, IDE-плагин, CLI, бот, медиа-редактор.

> **Статус:** `vegacode`, `vegaharness`, `vegaide`, `vegamedia` уже
> зарегистрированы в коде — весь чеклист раздела 4 применён (device flow
> принимает их `client_id`, роуты ключей и защита от удаления на месте,
> env-заполнители и `PII_SHIELD_KEY_NAMES` вписаны в `.env`). Осталось:
> заменить `<vendor>/<model>` в `<APP>_ALLOWED_MODELS` на живые id
> (раздел 2.3) и перезапустить процесс.
>
> План: выбираешь путь (A/B/C, раздел 1) → заводишь приложение на сервере
> (раздел 4) → прописываешь список моделей в env (раздел 2) → даёшь клиенту
> ТЗ (разделы 5–9) → проверяешь по use-case (раздел 11).
>
> Критерии приёмки: новый `client_id` логинится через `/device` (или `/auth`),
> ключ `sk-apivega-...` работает и не удаляется из дашборда, `GET /models`
> отдаёт только env-список приложения, ФИО в ответе реальные
> (а не `#PERSON_1#`), выход отзывает ключ.

---

## 0. Как это устроено сейчас (officevega — эталон)

```
Приложение ──► POST /api/auth/device/code (client_id=officevega)
     │         Пользователь подтверждает код на https://api.vega.chat/device
     │         Приложение забирает session-token (poll /api/auth/device/token)
     ├───────► POST /api/v1/keys/officevega (Bearer session-token) → { id, key: sk-apivega-... }
     │         Ключ хранится ТОЛЬКО в приложении, пользователю не показывается
     ├───────► все запросы к /api/v1/* с Bearer sk-apivega-...
     │         + X-Vega-Anonymize: true (щит ПДн) + X-Vega-Session (сессия меток)
     │         GET /models отдаёт whitelist приложения; шлюз обезличивает → OpenRouter → restore
     └───────► выход: POST /api/v1/keys/officevega/revoke (Bearer sk-apivega-...) → ключ disabled
```

Та же схема уже работает для `vegacode`, `vegaharness`, `vegaide`,
`vegamedia` — у каждого свой `client_id`, роут `keys/<app>` и env-список.

Ключевые файлы (все пути — от корня `api.vega.chat`):

| Слой | Файл | Что там |
|---|---|---|
| Device flow whitelist | `src/lib/auth.ts` | `deviceAuthorization({ verificationUri: "/device", validateClient })` — принимает `officevega`, `vegaoffice`, `vegacode`, `vegaharness`, `vegaide`, `vegamedia` |
| Страница подтверждения device | `src/app/device/page.tsx` | `CLIENT_NAMES = { officevega, vegaoffice, vegacode: "VEGA IDE", vegaharness: "Vega Harness", vegaide: "Vega IDE", vegamedia: "Vega Media" }` |
| PKCE-страница `/auth` | `src/app/auth/page.tsx`, `src/lib/pkce-auth-codes.ts`, `src/app/api/v1/auth/keys/route.ts` | OpenRouter-совместимый OAuth: `callback_url` + `code_challenge` (S256) → одноразовый `code` (10 мин) → `POST /api/v1/auth/keys` → `{ key }` |
| Выдача / отзыв ключей | `src/lib/officevega-keys.ts` | `OFFICEVEGA_KEY_NAME` + `VEGACODE_KEY_NAME`/`VEGAHARNESS_KEY_NAME`/`VEGAIDE_KEY_NAME`/`VEGAMEDIA_KEY_NAME`, `LEGACY_APP_KEY_NAMES`, `normalizeKeyName`, `mintNamedApiKey` (один активный ключ), `revokeNamedApiKeys`, `revokeApiKeyById` |
| Роуты ключей | `src/app/api/v1/keys/<app>/route.ts`, `.../revoke/route.ts` для `officevega` (+ алиас `vegaoffice/`), `vegacode`, `vegaharness`, `vegaide`, `vegamedia` | POST выдача по session-token, POST отзыв по `sk-apivega-...` (self) или session-token (все ключи имени) |
| Дашборд (защита от удаления) | `src/app/dashboard/keys/actions.ts`, `src/app/dashboard/keys/key-list.tsx` | `APP_MANAGED_KEY_NAMES` (все 5 приложений + legacy-алиасы) — такие ключи нельзя удалить вручную |
| Whitelist моделей | `src/lib/model-whitelist.ts` | `APP_WHITELIST_ENV`: имя ключа → env-переменная со списком моделей (6 записей). Применяется к `GET /api/v1/models`, `/models/user`, `/models/count`, `/pricing` |
| Щит ПДн | `src/lib/pii/shield.ts` (`shieldApplies`), `src/lib/pii/config.ts` (`PII_SHIELD_KEY_NAMES`, дефолт `officevega`; в `.env` — все 5 app-ключей) | Щит включается **по имени ключа + opt-in заголовку `X-Vega-Anonymize: true`** на каждом запросе (guard-URL и `PII_SHIELD_SCOPE=all` — без заголовка). Покрытие: `chat/completions`, `responses`, `messages`, `completions`, `embeddings`, `images`, `decisions` (только `state.*`). `POST /files` под щитом — только `image/*` |
| Алиасы моделей | `src/lib/model-aliases.ts` | Ремап захардкоженных id моделей клиента, если апстрим retired id |
| Детект web search (биллинг) | `src/lib/billing-cost.ts` (`requestIncludesWebSearch`) | `:online`, plugin `*web*`, `web_search_options`, tool `*web_search*` — все формы учитываются в списании |
| Тесты | `scripts/test-device-flow.ts`, `scripts/test-model-whitelist.ts` | E2E device flow (включая приём `device/code` для всех 4 новых `client_id`) + юнит-проверка whitelist (vegacode, fail-closed vegaharness) |
| ТЗ для клиента | `docs/pii-shield.md` + разделы 7–8 этой доки | Заголовки `X-Vega-Anonymize` + `X-Vega-Session`, таблица ошибок `pii_*`, индикатор щита в UI |

Инварианты (не ломать):

1. Ключ показывается **один раз** при выдаче, хранится только хеш (`hashValue`).
2. Ключи **не удаляются**, только `enabled=false` (биллинг по `usage_logs.api_key_id`).
3. Перевыпуск гасит предыдущий ключ того же имени (один активный ключ на приложение).
4. Щит fail-closed: недоступен pii-service → ошибка клиенту, наружу ничего не уходит.
5. Словарь меток живёт в pii-service (Redis, TTL 2 ч), изолирован по сессии `k:<hash ключа>:h:<hash X-Vega-Session>`.
6. Whitelist — это фильтр **каталога**, а не брандмауэр: `/models` и `/pricing`
   отдают только разрешённое, но запрос с моделью вне списка пока не
   блокируется. Дисциплина — на клиенте (или добавь проверку в роут
   `chat/completions` по `getAppModelWhitelist`, если нужен hard-block).
7. `POST /api/v1/keys` и `POST /api/v1/auth/keys` принимают только API-ключ /
   PKCE-код — session-token из device flow туда не подходит; именные ключи
   выдаются только в роутах `keys/<app>` через `auth.api.getSession`.

---

## 1. Выбор пути: A (guard-URL), B (device flow), C (PKCE)

| | A — через guard-URL | B — как officevega (свой client_id) | C — PKCE `/auth` (OpenRouter-совместимый) |
|---|---|---|---|
| Изменения на сервере | **Ноль.** Любой обычный ключ из дашборда | Чеклист раздела 4 (~30 мин на приложение) | **Ноль.** Страница `/auth` уже работает |
| Щит ПДн | Всегда (выбором URL `/api/guard/...`) | Opt-in на запросе: `X-Vega-Anonymize: true` (имя ключа в `PII_SHIELD_KEY_NAMES`, раздел 8) | Только через guard-URL или `PII_SHIELD_SCOPE=all` — ключ получает имя `oauth:<label>`, в `PII_SHIELD_KEY_NAMES` его нет |
| Свой список моделей | Нет (общий каталог) | Да (`<APP>_ALLOWED_MODELS`, раздел 2) | Нет (`oauth:*` имена не в `APP_WHITELIST_ENV`) |
| Авторизация | Своя (ключ вшиваешь сам) | `/device`, RFC 8628 — код на сайте | `/auth?callback_url=...&code_challenge=...` — редирект обратно в приложение |
| Когда выбирать | Бот, интеграция, MVP, тест щита | Десктоп/мобильное приложение с логином и своим каталогом | Готовые OpenRouter-клиенты (Cline-подобные), CLI с localhost-redirect |
| BaseURL клиента | `https://api.vega.chat/guard/v1` | `https://api.vega.chat/api/v1` | `https://api.vega.chat/api/v1` |

Если сомневаешься — начни с **A**, переход на **B** потом ничего не ломает.
**C** нужен, когда приложение уже умеет OpenRouter-PKCE (редирект в браузер +
обмен кода), а именной ключ и whitelist не требуются.

### Путь A (5 минут, без правок сервера)

```python
from openai import OpenAI
client = OpenAI(base_url="https://api.vega.chat/guard/v1", api_key="<обычный ключ из дашборда>")
```

Плюс заголовок `X-Vega-Session: <uuid-диалога>` на каждый запрос. Дальше —
клиентское ТЗ из разделов 5–9.

### Путь C (PKCE, 0 правок сервера)

Совместим с OpenRouter: любой клиент, умеющий `https://openrouter.ai/auth`,
работает и с `https://api.vega.chat/auth`.

1. Приложение генерирует `code_verifier` (random 32–96 байт) и
   `code_challenge = base64url(sha256(verifier))`.
2. Открывает браузер:
   `https://api.vega.chat/auth?callback_url=<myapp://callback или http://localhost:PORT/cb>&code_challenge=<challenge>&code_challenge_method=S256&key_label=<myapp>`
   (`callback_url` можно опустить — код покажется на экране для ручного ввода).
3. Пользователь жмёт «Разрешить» → редирект `callback_url?code=pkce-...`.
4. Обмен: `POST /api/v1/auth/keys` `{ code, code_verifier, code_challenge_method: "S256" }` → `{ key: "sk-apivega-...", user_id }`.
   Код одноразовый, TTL 10 минут. Ключ получает имя `oauth:<key_label|host callback_url>` —
   обычный пользовательский ключ: удаляемый из дашборда, без whitelist и без щита по имени.

---

## 2. Списки моделей приложений (env)

### 2.1. Механика

`src/lib/model-whitelist.ts` держит реестр `APP_WHITELIST_ENV`:
**имя ключа → env-переменная** со списком моделей. Когда запрос аутентифицирован
ключом с таким именем, выдача моделей сужается до списка.

- Формат env: id через запятую, пробелы обрезаются. `vendor/*` — весь
  префикс вендора. Сравнение идёт и по `id`, и по `canonical_slug`
  (датированные варианты `openai/gpt-5-2025-08-07` проходят по `openai/gpt-5`).
- Fail-closed: приложение зарегистрировано, а env пуст/не задан →
  **пустой список**, не весь каталог. WARN в лог.
- `LEGACY_WHITELIST_ENV`: старое имя переменной читается, если новое не задано
  (у officevega — `VEGAOFFICE_ALLOWED_MODELS` как фолбэк).
- Применяется к: `GET /api/v1/models`, `GET /api/v1/models/user`,
  `GET /api/v1/models/count`, `GET /api/v1/pricing`.
- НЕ применяется к: `/images/models`, `/videos/models`, `/embeddings/models`
  (там только глобальный фильтр заблокированных) и к самим генерациям —
  см. инвариант 6.

### 2.2. Реестр приложений

| Приложение | client_id / имя ключа | Env-список моделей | Назначение | Щит |
|---|---|---|---|---|
| officevega | `officevega` (алиасы `vegaoffice`, `getoffice`, `genoffice`) | `OFFICEVEGA_ALLOWED_MODELS` (фолбэк `VEGAOFFICE_ALLOWED_MODELS`) | Офисный агент: чат + правки документов + картинки | да |
| vegacode | `vegacode` | `VEGACODE_ALLOWED_MODELS` | Кодовый агент: codegen, правки, tool-цикл | да |
| vegaharness | `vegaharness` | `VEGAHARNESS_ALLOWED_MODELS` | Агентный рантайм (оркестрация, MCP-tools) | да |
| vegaide | `vegaide` | `VEGAIDE_ALLOWED_MODELS` | IDE-ассистент: чат + автодополнение + inline-edit | да |
| vegamedia | `vegamedia` | `VEGAMEDIA_ALLOWED_MODELS` | Медиа-редактор: генерация/редакт картинок, видео, аудио | да |

Имена ключей и `client_id` совпадают с именами приложений — так же, как
`officevega`. Щит включается добавлением имён в `PII_SHIELD_KEY_NAMES`.

### 2.3. Блок env (заполнители уже в `.env` — заменить на живые id)

Актуальные id смотри в `GET https://api.vega.chat/api/v1/models` или на
странице каталога. Пример реального списка officevega (боевой .env):

```bash
OFFICEVEGA_ALLOWED_MODELS="deepseek/deepseek-v4.1-flash,z-ai/glm-5.3-flash,...,openai/gpt-image-2.5-sunburst"
```

Блок для четырёх новых приложений — **уже вписан в `.env` с заполнителями
`<...>`**. Заполнитель `<vendor>/<model>` не матчит ни одну модель →
каталог у приложения пустой (fail-closed): до деплоя замени на живые id:

```bash
# --- vegacode: кодовые LLM (агентные правки, длинный контекст) ---
VEGACODE_ALLOWED_MODELS="<vendor>/<coding-model-1>,<vendor>/<coding-model-2>,<vendor>/<cheap-fast-model>"

# --- vegaharness: модели для агентного рантайма (tools, reasoning) ---
VEGAHARNESS_ALLOWED_MODELS="<vendor>/<agent-model-1>,<vendor>/<agent-model-2>"

# --- vegaide: чат-модель + быстрая модель для автодополнения ---
VEGAIDE_ALLOWED_MODELS="<vendor>/<chat-model-1>,<vendor>/<fim-or-fast-model-1>"

# --- vegamedia: генерация и редактирование изображений + vision ---
VEGAMEDIA_ALLOWED_MODELS="<vendor>/<image-gen-model-1>,<vendor>/<image-edit-model-1>,<vendor>/<vision-model-1>"

# Щит ПДн для всех app-ключей (имена через запятую, без пробелов лучше):
PII_SHIELD_KEY_NAMES=officevega,vegacode,vegaharness,vegaide,vegamedia
```

Советы:

- `vendor/*` разрешает весь вендор — удобно для песочницы, не для прода.
- Включай в список датированный id И/ИЛИ canonical slug — `canonical_slug`
  сматчит оба (см. тест `scripts/test-model-whitelist.ts`).
- vegamedia: `/images/models` и `/videos/models` whitelist не фильтруют —
  либо захардкожь список медиа-моделей в клиенте, либо добавь
  `applyAppModelWhitelist` в `src/app/api/v1/images/models/route.ts` и
  `videos/models/route.ts` (одна строка в каждом, apiKeyRecord.name уже есть).

---

## 3. Авторизация пользователя через сайт (путь B, device flow)

RFC 8628 через better-auth `deviceAuthorization`. Срок кода 10 минут,
интервал опроса 5 сек (slow_down enforced).

### Шаги для клиента

1. `POST /api/auth/device/code`
   `{ "client_id": "vegacode", "scope": "api" }` →
   `{ device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval }`.
2. Показать пользователю `user_code` + ссылку
   `https://api.vega.chat/device?user_code=XXXX-XXXX`
   (или открыть `verification_uri_complete`).
   Страница `/device` сама отправит на `/login`, если пользователь не вошёл.
   Подпись «приложение X» берётся из `CLIENT_NAMES` (раздел 4, правка 2).
3. Poll `POST /api/auth/device/token` каждые `interval` сек:
   `{ "grant_type": "urn:ietf:params:oauth:grant-type:device_code", "device_code": "...", "client_id": "vegacode" }`.
   Пока ждём — `400 { "error": "authorization_pending" }`. После
   подтверждения — `200 { "access_token": "<session-token>", ... }`.
4. С session-token: `POST /api/v1/keys/vegacode` с
   `Authorization: Bearer <session-token>` → `{ id, key: "sk-apivega-..." }`.
   Ключ — в secure storage, **не показывать в UI, не логировать**.
   Повторный вход гасит предыдущий ключ этого приложения (инвариант 3).
5. Выход: `POST /api/v1/keys/vegacode/revoke` с
   `Authorization: Bearer <sk-apivega-...>` → `{ success: true, revoked: 1 }`,
   стереть ключ локально.

Полезные эндпоинты с этим ключом: `GET /api/v1/key` (инфо ключа),
`GET /api/v1/account` (email, баланс, имя ключа), `GET /api/v1/credits`.
Щит ПДн включается заголовком `X-Vega-Anonymize: true` на каждом запросе
(разделы 7–8).

---

## 4. Серверный чеклист «завести приложение» (путь B)

Шесть правок (последняя — только env). **Для `vegacode`, `vegaharness`,
`vegaide`, `vegamedia` все применены** — каждая правка помечена ✅.
Чеклист остаётся рецептом для любого следующего `myapp`: те же шесть
шагов с его именем.

### Правка 1. Whitelist device-flow — `src/lib/auth.ts` ✅

```ts
validateClient: (clientId) =>
  ["officevega", "vegaoffice", "vegacode", "vegaharness", "vegaide", "vegamedia"].includes(clientId),
```

Иначе клиент получит `400 invalid_client` на `POST /api/auth/device/code`.

### Правка 2. Подписи на странице подтверждения — `src/app/device/page.tsx` ✅

```ts
const CLIENT_NAMES: Record<string, string> = {
  officevega: "officevega",
  vegaoffice: "officevega",
  vegacode: "VEGA IDE",
  vegaharness: "Vega Harness",
  vegaide: "Vega IDE",
  vegamedia: "Vega Media",
};
```

### Правка 3. Роуты выдачи/отзыва ключей — по папке на приложение ✅

Уже созданы: `src/app/api/v1/keys/vegacode/`, `.../vegaharness/`,
`.../vegaide/`, `.../vegamedia/` — каждый с `route.ts` и `revoke/route.ts`.
Дефолт имени вынесен в константы `VEGACODE_KEY_NAME` и т.д. в
`src/lib/officevega-keys.ts`. Для нового `myapp`:

```bash
cp -r src/app/api/v1/keys/officevega src/app/api/v1/keys/myapp
```

В обоих роутах заменить дефолт имени: `OFFICEVEGA_KEY_NAME` → константу
приложения, экспортированную из `src/lib/officevega-keys.ts` (функции уже
принимают `name` параметром):

```ts
export const MYAPP_KEY_NAME = "myapp"; // в src/lib/officevega-keys.ts
// ...
let name = MYAPP_KEY_NAME; // вместо OFFICEVEGA_KEY_NAME в обоих роутах
```

Правила те же: `normalizeKeyName` → `mintNamedApiKey` гасит старые ключи
имени → ключ возвращается один раз → `revoke` по `sk-apivega-...` (self)
или по session-token (все ключи имени). Если у приложения были старые
сборки с другими именами ключей — добавь их в список legacy-алиасов по
образцу `LEGACY_APP_KEY_NAMES`.

### Правка 4. Ключи без удаления — 2 файла дашборда ✅

`src/app/dashboard/keys/actions.ts` и `src/app/dashboard/keys/key-list.tsx`:

```ts
const APP_MANAGED_KEY_NAMES = new Set([
  "officevega", "vegaoffice", "getoffice", "genoffice",
  "vegacode", "vegaharness", "vegaide", "vegamedia",
]);
```

### Правка 5. Реестр whitelist моделей — `src/lib/model-whitelist.ts` ✅

```ts
const APP_WHITELIST_ENV: Record<string, string> = {
  officevega: "OFFICEVEGA_ALLOWED_MODELS",
  vegaoffice: "OFFICEVEGA_ALLOWED_MODELS",
  vegacode: "VEGACODE_ALLOWED_MODELS",
  vegaharness: "VEGAHARNESS_ALLOWED_MODELS",
  vegaide: "VEGAIDE_ALLOWED_MODELS",
  vegamedia: "VEGAMEDIA_ALLOWED_MODELS",
};
```

### Правка 6. env — списки моделей + щит (без кода) ✅ (заполнители)

См. блок раздела 2.3 — в `.env` уже стоят 4 `*_ALLOWED_MODELS` с
заполнителями и `PII_SHIELD_KEY_NAMES` со всеми пятью именами.
`PII_SHIELD_KEY_NAMES` читается динамически на каждый вызов — достаточно
рестарта процесса, пересборка не нужна. Проверь
`PII_SHIELD_SCOPE=office` (по умолчанию) и `PII_SHIELD_ENABLED=true`.

### Опционально

- `src/lib/model-aliases.ts` — если клиент шьёт фиксированные id моделей
  (capability-слоты), иначе retired id → 404.
- `src/app/api/v1/images/models/route.ts`, `videos/models/route.ts` —
  `applyAppModelWhitelist(data, apiKeyRecord?.name)`, если медиа-пикер
  приложения тоже должен быть урезан.
- `scripts/test-device-flow.ts` — кейсы `device/code` для всех 4 client_id
  уже добавлены; для `myapp` добавь свой.
  `scripts/test-model-whitelist.ts` — есть кейсы vegacode и fail-closed
  vegaharness; для `myapp` добавь кейс с новым env.

---

## 5. API для клиента: модели, параметры, tools

BaseURL `https://api.vega.chat/api/v1`. Любой OpenAI/Anthropic SDK работает
сменой base URL. Заголовки: `Authorization: Bearer sk-apivega-...`,
`Content-Type: application/json`, опционально `HTTP-Referer` (URL приложения)
и `X-Title` (имя) для атрибуции, `X-Vega-Session` — см. раздел 7.

### 5.1. Список моделей

```bash
curl https://api.vega.chat/api/v1/models -H "Authorization: Bearer <key>"
```

Для app-ключа ответ уже урезан whitelist'ом (раздел 2). Пикеры клиента
кормятся отсюда; `id` → поле `model` в запросах. `GET /api/v1/model/{author}/{slug}`
— детали модели (контекст, цены, `architecture.modality` вида
`text+image->text`); `GET /api/v1/models/{author}/{slug}/endpoints` —
провайдерные эндпоинты. Дополнительно: `/models/count`, `/models/user`,
`/pricing` (цены в рублях с наценкой).

### 5.2. Параметры генерации (`POST /chat/completions`)

Тело: `model` или `models` (fallback-список, до 50), `messages` или
`prompt`, `stream`. Все sampling-параметры проксируются апстриму;
не заданное не подменяется дефолтом сервера.

| Параметр | Тип | Смысл |
|---|---|---|
| `temperature` | float 0–2 (принимаем до 5) | Креативность |
| `top_p` | float (0,1] | Nucleus-сэмплинг |
| `top_k` | int ≥1 | Жёсткий топ-k (не для OpenAI-моделей) |
| `min_p`, `top_a` | float 0–1 | Альтернативные пороги сэмплинга |
| `frequency_penalty`, `presence_penalty` | float −2..2 | Штрафы повторов |
| `repetition_penalty` | float (0,2] | Штраф повторов (не-OpenAI) |
| `seed` | int | Детерминизм (не гарантирован всеми провайдерами) |
| `max_tokens` / `max_completion_tokens` | int | Лимит токенов ответа |
| `stop` | string \| string[] | Стоп-последовательности |
| `logit_bias` | map token→−100..100 | Смещение логитов |
| `logprobs`, `top_logprobs` | bool, int 0–20 | Лог-вероятности токенов |
| `response_format` | `{type:"json_object"}` \| `{type:"json_schema", json_schema:{name,strict,schema}}` | JSON-mode / structured output |
| `structured_outputs` | bool | Флаг поддержки structured outputs |
| `reasoning` | `{enabled, effort, max_tokens, exclude}` | Управление reasoning-моделями |
| `reasoning_effort` | `xhigh\|high\|medium\|low\|minimal\|none` | OpenAI-стиль effort |
| `include_reasoning` | bool | Устаревший синоним `reasoning.exclude=false` |
| `verbosity` | `low\|medium\|high\|xhigh\|max` | Многословность ответа |
| `prediction` | `{type:"content", content:"..."}` | Predicted output (ускорение правок) |
| `user` | string | Идентификатор конечного пользователя |

Reasoning-пример: `{"model": "...", "messages": [...], "reasoning": {"effort": "high"}}`
или `{"reasoning": {"max_tokens": 8000}}` — бюджет мышления в токенах;
`"exclude": true` — модель думает, но токены рассуждений не возвращаются.

### 5.3. Function calling (клиентские tools)

```json
{
  "model": "openai/gpt-4o",
  "messages": [{"role": "user", "content": "Какая погода в Париже?"}],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get weather for a city",
      "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}
    }
  }],
  "tool_choice": "auto",
  "parallel_tool_calls": true
}
```

`finish_reason: "tool_calls"` → выполняешь функцию → шлёшь
`{"role":"tool","tool_call_id":"...","content":"..."}` следующим ходом.
`tool_choice`: `none`/`auto`/`required`/`{type:"function",function:{name}}`.
Под щитом ПДн `tool_calls[].function.arguments` обезличиваются и
восстанавливаются как JSON — клиент ничего не декодирует.

### 5.4. Server tools и plugins (web search и др.)

**Веб-поиск — актуальный способ** (server tool в массиве `tools`):

```json
{
  "model": "anthropic/claude-sonnet-4.6",
  "messages": [{"role": "user", "content": "Что нового в React?"}],
  "tools": [{"type": "openrouter:web_search", "parameters": {
    "engine": "auto",
    "max_results": 5,
    "allowed_domains": ["react.dev"]
  }}]
}
```

`parameters` (всё опционально): `engine` = `auto|native|exa|parallel|firecrawl|perplexity`,
`max_results` (def 5, Perplexity ≤20), `max_total_results` (def 50),
`max_uses`, `allowed_domains`/`excluded_domains` (взаимоисключающие),
`max_characters`, `search_context_size` = `low|medium|high`.
Шорткаты `web_search`, `web_search_preview`, `web_search_20250305`
авто-конвертируются в `openrouter:web_search`.

Другие server tools: `openrouter:web_fetch` (забрать страницу/PDF по URL,
`parameters.max_uses`), `openrouter:subagent` (делегировать подзадачу дешёвой
модели, `parameters.model`), `openrouter:image_generation`,
`openrouter:experimental__search_models`.

**Устаревшие, но рабочие способы поиска:**

- `plugins: [{"id": "web", "engine": "exa", "max_results": 5, "include_domains": [...], "exclude_domains": [...]}]`
- Суффикс модели `"openai/gpt-4o:online"`.
- `web_search_options: {"search_context_size": "medium"}` — нативный поиск у поддерживающих провайдеров.

Все формы детектируются биллингом (`requestIncludesWebSearch`: `:online`,
plugin `*web*`, `web_search_options`, tool `*web_search*`) — surcharge
считается по `usage.cost_details.web_search_cost` /
`usage.server_tool_use.web_search_requests`.

**Прочие plugins** (массив `plugins` рядом с `tools`):
`{"id": "file-parser"}` — парсинг PDF (в т.ч. `pdf.engine`),
`{"id": "response-healing"}` — починка битого JSON ответа,
`{"id": "context-compression"}` — сжатие длинного контекста.

Для x-ai моделей — `x_search_filter` верхнего уровня (фильтры X/Twitter:
`allowed_x_handles`, `from_date`, `enable_image_understanding` и др.).

### 5.5. Маршрутизация и fallback

```json
{"models": ["openai/gpt-4o", "anthropic/claude-sonnet-4.6"], "route": "fallback"}
```

или выбор провайдера:

```json
{"provider": {"order": ["OpenAI", "Anthropic"], "allow_fallbacks": true, "require_parameters": true}}
```

Если клиент не задал `provider`, шлюз сам включает фолбэк на альтернативных
провайдеров (`applyProviderRoutingPreferences`).

### 5.6. Стриминг

`"stream": true` → SSE `data: {...}` до `data: [DONE]`. Комментарии
`: OPENROUTER PROCESSING` (heartbeat) пропускать перед JSON.parse. Шлюз сам
добавляет `stream_options.include_usage` и шлёт heartbeat-кадры. Отмена —
`AbortController`/закрытие соединения (останавливает и биллинг у
поддерживающих провайдеров). `X-Generation-Id` в ответе — id генерации
(`GET /api/v1/generation?id=...` — расходы/модель/токены).

---

## 6. Картинки: генерация и редактирование

### 6.1. `POST /api/v1/images` (алиас: `/api/v1/images/generations`)

```bash
curl https://api.vega.chat/api/v1/images \
  -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  -d '{"model": "bytedance-seed/seedream-4.5",
       "prompt": "a red panda astronaut floating in space, studio lighting",
       "aspect_ratio": "16:9", "n": 1}'
```

Ответ: `{ created, data: [{ b64_json, media_type }], usage }`.
`"stream": true` → SSE-части (`image_generation.partial_image`) — только у
провайдеров с нативным стримингом, остальные отвечают обычным JSON.

Параметры (схема `model`+`prompt` обязательны, остальное passthrough):

| Параметр | Значения | Смысл |
|---|---|---|
| `n` | int 1–10 | Количество картинок (провайдер может вернуть меньше) |
| `aspect_ratio` | `1:1` … `16:9`, `9:16`, `21:9`, `auto` и др. | Соотношение сторон (клампится под провайдера) |
| `size` | `"512"`, `"1K"`, `"2K"`, `"4K"` или `"2048x2048"` | Шорткат разрешения; явные пиксели — авторитетны (конфликт с `resolution`/`aspect_ratio` → 400) |
| `resolution` | `512`, `1K`, `2K`, `4K` | Ярус разрешения |
| `quality` | `auto`, `low`, `medium`, `high` | Качество рендера |
| `background` | `auto`, `transparent`, `opaque` | Прозрачность требует `output_format` `png`/`webp` |
| `output_format` | `png`, `jpeg`, `webp`, `svg` | Кодировка `b64_json` |
| `output_compression` | 0–100 | Сжатие для jpeg/webp |
| `seed` | int | Детерминизм генерации |
| `provider` | object | Те же preferences, что в чате |
| `stream` | bool | SSE-стрим частичных картинок |

### 6.2. Редактирование — `input_references`

```json
{
  "model": "<image-edit-модель>",
  "prompt": "замени фон на закатный пляж, сохрани человека",
  "input_references": [
    {"type": "image_url", "image_url": {"url": "data:image/png;base64,<...>"}},
    {"type": "image_url", "image_url": {"url": "https://example.com/ref.jpg"}}
  ]
}
```

До 16 референсов, base64 data-URL или http(s). Это и есть image-edit путь.

### 6.3. Альтернатива: картинки через chat/completions

Модели с модальностью `...->image` (поле `architecture.modality` в
`/models`) генерируют картинки прямо в чате; входные картинки —
content-part `{"type": "image_url", "image_url": {"url": "...", "detail": "auto|low|high"}}`
(http-URL или `data:image/...;base64,`). Так работает и «редактирование
диалогом». Под щитом ПДн картинки идут как есть — щит их не обрабатывает
(раздел 7).

### 6.4. Список image-моделей

`GET /api/v1/images/models` — каталог с `supported_parameters` и
`supported_aspect_ratios`; `GET /images/models/{author}/{slug}/endpoints` —
провайдерные эндпоинты. **Внимание:** этот листинг whitelist приложения не
фильтрует (см. 2.3 и правку «опционально» в разделе 4).

Минимальный баланс-холд для image-запроса — 20 ₽ (chat-модель с image-выводом
— тоже 20 ₽, video — 200 ₽).

---

## 7. Щит ПДн (как у officevega)

### 7.1. Как включается

| Способ | Что делать |
|---|---|
| По имени ключа + заголовку (путь B) | Имя в `PII_SHIELD_KEY_NAMES` (env, читается динамически; уже покрыто правкой 6) **и** `X-Vega-Anonymize: true` на каждом обезличиваемом запросе. Opt-in: без заголовка или при `false`/`0` запрос идёт мимо щита — ПДн уйдут провайдеру в открытую |
| По URL (путь A) | BaseURL `https://api.vega.chat/guard/v1` — щит всегда, для любого ключа, заголовок не нужен |
| Все ключи | `PII_SHIELD_SCOPE=all` — щит независимо от заголовка |

Конфиг сервера: `PII_SERVICE_URL`, `PII_SERVICE_TOKEN`, `PII_SHIELD_ENABLED`
(def `true`), `PII_SHIELD_SCOPE` (def `office`),
`PII_SERVICE_TEXT_TIMEOUT_MS`, `PII_SERVICE_TIMEOUT_MS`, `PII_MAX_TEXT_CHARS`.

### 7.2. Покрытие

| Эндпоинт | Щит |
|---|---|
| `POST /api/v1/chat/completions` | messages, `prompt`, `tool_calls.arguments` (JSON валиден), не-image `file` data-URL; `image_url` и image `file`-парты — без изменений; restore JSON + SSE |
| `POST /api/v1/responses`, `/messages`, `/completions` | Обход пользовательских строк, не-image файловые блоки отклоняются (image-блоки проходят); restore JSON + SSE |
| `POST /api/v1/embeddings`, `/api/v1/images` | Щит на входе, без restore (`embeddings` — векторы, `images` — бинарь) |
| `POST /api/v1/decisions`, `/api/alpha/decisions`, `/api/v1/systemone` | Только `state.*`, таймаут 3 с |
| `POST /api/v1/files` | Только `image/*` (mime/расширение); остальное — `400 pii_attachment_not_allowed` |
| Видео, аудио, изображения любые | Passthrough (картинки щитом не обрабатываются) |

Guard-URL (`/api/guard/v1/...`): `chat/completions`, `responses`, `messages` —
тонкие делегаты, щит форсирован адресом.

### 7.3. `X-Vega-Session` (обязательно)

Ко всем запросам на `api.vega.chat`: стабильный id в рамках чата/документа,
новый для нового чата; без ПДн; ≤ 200 символов; на каждом ходе агентного
цикла один и тот же. Без него сессия выводится из первого user-сообщения —
после правки первого сообщения нумерация `#PERSON_N#` плывёт.

### 7.4. Ошибки щита (обязательно обработать)

Формат: `{"error":{"code":"<pii_code>","message":"<по-русски>","type":"pii_shield_error"}}`.

| HTTP | code | Показать пользователю |
|---|---|---|
| 503 | `pii_unavailable` | «Защита персональных данных временно недоступна. Запрос не отправлен, повторите позже» (2–3 ретрая с backoff) |
| 400 | `pii_attachment_not_allowed` | «Вложения этого типа не поддерживаются в режиме защиты ПДн» |
| 413 | `pii_too_large` | «Слишком большой объём для обезличивания. Уменьшите документ» |
| 422 | `pii_extract_failed` | «Не удалось прочитать файл» |
| 400 | `pii_bad_request` | Некорректный запрос к pii-service |

Не ретраить `400/413/422`. Неизвестный код → `error.message` из ответа.
Никогда — тихий «пустой ответ» агента.

### 7.5. Ограничения (показать в справке приложения)

- Восстанавливается каноническая форма значения, падеж может не совпасть.
- Токены, искажённые моделью (регистр, номер), не восстанавливаются.
- Over-masking: слова с заглавной буквы могут замаскироваться как имя.
- Словарь сессии живёт 2 ч (скользящий TTL) — в старом чате метки могут
  стать другими; клиент должен уметь «перечитать документ» штатно.
- Фото без текста, видео и аудио не обезличиваются.

---

## 8. Сервис анонимизации ПДн: использование из приложения

Практический раздел для клиента (VEGA-IDE, VEGA-Harness, officevega).
Анонимизацию выполняет внутренний pii-service шлюза (`PII_SERVICE_URL`,
по умолчанию `127.0.0.1:8787`, токен `PII_SERVICE_TOKEN`) — публичного API
у него нет. Приложение пользуется сервисом «сквозь» обычные запросы к
`/api/v1/*`: шлюз сам вызывает обезличивание до отправки провайдеру и
восстановление реальных значений в ответе.

```
Клиент ── запрос (реальные ПДн) ──► api.vega.chat ── запрос (#TYPE_N#) ──► провайдер
Клиент ◄── ответ (реальные ПДн) ─── api.vega.chat ◄── ответ (#TYPE_N#) ────┘
        словарь «метка → значение» живёт в Redis pii-service, TTL 2 ч, per-сессия
```

### 8.1. Контракт заголовков

| Заголовок | Значение | Когда слать |
|---|---|---|
| `X-Vega-Anonymize` | `true` / `1` / `yes` / `on` | На каждом запросе app-ключа, который нужно обезличить. Opt-in: без заголовка (или при `false`/`0`) запрос идёт мимо щита — ПДн уйдут провайдеру как есть |
| `X-Vega-Pii-Shield` | то же | Legacy-синоним `X-Vega-Anonymize`; достаточно одного из двух |
| `X-Vega-Session` | стабильный id диалога | На каждом запросе диалога; ≤200 символов, без ПДн в самом id |

Решение — `shieldApplies` (`src/lib/pii/shield.ts`): имя ключа ∈
`PII_SHIELD_KEY_NAMES` **И** заголовок truthy → щит. Два случая без
заголовка: `PII_SHIELD_SCOPE=all` (все ключи) и guard-URL
`/api/guard/v1/*` (любой ключ — щит форсируется адресом).

### 8.2. Сквозной пример

Клиент шлёт обычный `POST /api/v1/chat/completions` с заголовками из 8.1:

```json
{"model": "<модель>",
 "messages": [{"role": "user", "content": "Отредактируй договор: заказчик Иванов Иван Иванович, тел. +7 916 555-35-35"}]}
```

Провайдеру уходит:

```text
Отредактируй договор: заказчик #PERSON_1#, тел. #PHONE_NUMBER_1#
```

Обратная подстановка прозрачна — и в JSON, и в SSE-стриме (рваные метки
склеивает шлюз), и в `tool_calls[].function.arguments` (JSON остаётся
валидным):

```text
Модель вернула: «Внёс правки для #PERSON_1# (#PHONE_NUMBER_1#).»
Клиент видит:   «Внёс правки для Иванов Иван Иванович (+7 916 555-35-35).»
```

### 8.3. Сессия и словарь меток

- `X-Vega-Session` → id сессии `k:<hash ключа>:h:<hash заголовка>` —
  словарь привязан к ключу, чужим id чужие метки не открыть.
- Без заголовка сессия выводится из первого user-сообщения: правка первого
  сообщения создаёт другой словарь, нумерация меток «поплывёт». Поэтому
  заголовок — всегда.
- Один `X-Vega-Session` на весь диалог/агентный прогон, включая шаги
  tool-цикла — тогда `#PERSON_1#` стабильна от первой реплики до
  последнего tool call.
- Словарь живёт 2 ч (скользящий TTL Redis). В давнем «разбуженном» чате
  нумерация может начаться заново — метки не хранить как данные, документ
  перечитывать штатно.

### 8.4. Что попадает под сервис

| Куда | Обезличивается | Restore в ответе |
|---|---|---|
| `chat/completions`: messages, `prompt`, не-image `file` data-URL | да | да |
| `tool_calls[].function.arguments` (в обе стороны) | да | да — JSON остаётся валидным |
| `responses`, `messages`, `completions`: пользовательские строки | да; не-image файловые блоки отклоняются | да |
| `embeddings`, `images` (промпт) | да | нет (векторы/бинарь) |
| `decisions`, `systemone`, `alpha/decisions` | только `state.*`, таймаут 3 с | нет |
| `POST /files` | — | только `image/*`, остальное — `400 pii_attachment_not_allowed` |
| Изображения любые (`image_url`, image-блоки, image data-URL) | нет — passthrough | — |
| Видео, аудио (TTS/STT), `rerank` | нет | — |

Полное покрытие по эндпоинтам и коды ошибок — раздел 7.

### 8.5. Для агентных приложений (VEGA-IDE, VEGA-Harness)

- Текст файлов проекта и вывод инструментов идут в `messages` —
  обезличиваются штатно, отдельного «режима кода» нет.
- `role:"tool"` ответы и все следующие ходы цикла — с тем же
  `X-Vega-Session`, словарь общий.
- Метки могут встречаться в `tool_calls` — клиенту декодировать ничего не
  нужно: шлюз уже подставил реальные значения до передачи ответа.
- `503 pii_unavailable` — запрос НЕ ушёл провайдеру (fail-closed): ретрай
  с backoff (2–3 попытки), пользователю — текст из таблицы 7.4.

### 8.6. Когда заголовок можно не слать

Чисто технические вызовы без пользовательского контента (system-only
промпт, прогрев модели) можно слать без `X-Vega-Anonymize` — пропускается
вызов pii-service. На любом пользовательском контенте — слать всегда:
забытый заголовок = ПДн ушли провайдеру в открытую. Проще и безопаснее
ставить его на все запросы без разбора.

### 8.7. Минимальная проверка

```bash
curl https://api.vega.chat/api/v1/chat/completions \
  -H "Authorization: Bearer <sk-apivega-...>" \
  -H "X-Vega-Anonymize: true" -H "X-Vega-Session: test-1" \
  -H "Content-Type: application/json" \
  -d '{"model":"<модель>","messages":[{"role":"user","content":"Повтори дословно: Иванов Иван Иванович, тел. +7 916 555-35-35"}]}'
# ожидаем: в ответе реальные ФИО/телефон — модель видела только #PERSON_1#
```

`#PERSON_1#` в ответе → сменился `X-Vega-Session`. ПДн ушли
немаскированными → не было `X-Vega-Anonymize` (проверь
`PII_SHIELD_KEY_NAMES` и `PII_SHIELD_ENABLED`).

---

## 9. ТЗ для клиента (чеклист, одинаково для A/B/C)

Отдай разработчику приложения вместе с разделом 8 (сервис анонимизации).

1. **Auth (B):** device flow из раздела 3; ключ в secure storage, не в UI и
   не в логах; logout = `POST /api/v1/keys/<app>/revoke`.
   **(C):** PKCE из раздела 1. **(A):** ключ из дашборда, baseURL guard.
2. **Модели:** пикер от `GET /api/v1/models` (для app-ключа список уже
   урезан). Не хардкодить id — или помнить про `model-aliases`.
3. **`X-Vega-Anonymize: true` + `X-Vega-Session`** на все запросы с
   пользовательским контентом (правила 7.3, 8.1).
4. **Ошибки:** общие (401 невалидный ключ, 402 баланс/лимит ключа, 404
   `model_not_found`, 429 rate limit, `wrong_endpoint` для неверной
   модальности) + `pii_*` из 7.4.
5. **Стрим:** SSE-комментарии `:` пропускать; `finish_reason`
   нормализован (`stop|tool_calls|length|content_filter|error`,
   сырое — `native_finish_reason`).
6. **Tools:** function calling loop; server tools `openrouter:web_search` /
   `web_fetch` при необходимости; биллинг поиска учтён.
7. **Картинки:** `/api/v1/images` с `input_references` для редактирования;
   `b64_json` в ответе.
8. **UI:** индикатор «Персональные данные обезличиваются автоматически»
   (щит), без выключателя. RU-сборка: только `api.vega.chat`, прямые
   провайдеры (OpenAI/Anthropic/Gemini) отключены или за предупреждением
   «Данные пойдут напрямую за рубеж, защита VEGA не применяется».
9. **Запреты:** не анонимизировать на клиенте, не слать содержимое документов
   в обход `api.vega.chat`, не логировать тела запросов/ответов.
10. **Прочий трафик:** проверить, что индексация/поиск не шлют текст
    документов мимо защищённых эндпоинтов.

Прочие эндпоинты сервиса (все под тем же ключом): `/embeddings` (+`/models`),
`/responses`, `/messages`, `/completions`, `/audio/speech` (TTS),
`/audio/transcriptions` (STT), `/videos` (+`/videos/models`, статус
`/videos/{jobId}`), `/rerank`, `/decisions` (+`/api/v1/systemone`,
`/api/alpha/decisions`), `/files` (обычные ключи), `/generation`,
`/key`, `/account`, `/credits`, `/keys`, `/presets`, `/providers`,
`/api/v1/batches`. OpenAPI: `https://api.vega.chat/openapi.yaml`.

---

## 10. Промпт для AI (скопируй и вставь)

> **Вариант 1 — сервер (этот репозиторий, `api.vega.chat`).** Четыре
> приложения уже подключены (vegacode/vegaharness/vegaide/vegamedia —
> бери их за образец). Для нового `<myapp>`:
>
> ```
> Подключи новое приложение <myapp> по образцу vegacode (спек:
> docs/connect-app.md разделы 2 и 4):
> 1. src/lib/auth.ts — добавь "<myapp>" в массив validateClient
>    deviceAuthorization.
> 2. src/app/device/page.tsx — CLIENT_NAMES: "<myapp>": "<Имя для пользователя>".
> 3. src/app/api/v1/keys/<myapp>/{route.ts,revoke/route.ts} — копия officevega,
>    дефолт имени MYAPP_KEY_NAME (экспортируй из src/lib/officevega-keys.ts).
> 4. src/app/dashboard/keys/actions.ts + key-list.tsx — добавь "<myapp>" в
>    APP_MANAGED_KEY_NAMES (ключи не удаляются из дашборда).
> 5. src/lib/model-whitelist.ts — APP_WHITELIST_ENV: "<myapp>" → MYAPP_ALLOWED_MODELS.
> 6. env: MYAPP_ALLOWED_MODELS="..." и добавь <myapp> в PII_SHIELD_KEY_NAMES.
> Проверь: pnpm exec tsx scripts/test-device-flow.ts (добавь кейс <myapp>),
> pnpm exec tsx scripts/test-model-whitelist.ts, curl-проверки из раздела 11.
> Не пересобирай проект (build делает пользователь), docs/*.md не трогай.
> ```
>
> **Вариант 2 — клиент (репозиторий приложения):**
>
> ```
> Подключись к VEGA-гейту по образцу officevega (контракт: docs/connect-app.md,
> разделы 3, 5–9):
> 1. Device flow: POST /api/auth/device/code (client_id=<app>) → показать
>    user_code + ссылку /device → poll token → POST /api/v1/keys/<app> →
>    secure storage ключа (не показывать, не логировать). Выход — .../revoke.
>    (Путь A: baseURL https://api.vega.chat/guard/v1 + обычный ключ.
>     Путь C: PKCE /auth + POST /api/v1/auth/keys.)
> 2. Модели — из GET /api/v1/models (уже whitelist).
> 3. Все запросы — с заголовком X-Vega-Session (uuid диалога).
> 4. Ошибки pii_*: 503 ретрай+сообщение, 400/413/422 — сообщение без ретрая.
> 5. UI: индикатор «Персональные данные обезличиваются автоматически».
> 6. RU-сборка: только api.vega.chat, прямые провайдеры за предупреждением.
> Критерии приёмки — раздел 11: правка документа с ФИО вставляет реальное
> значение, а не #PERSON_1#.
> ```

---

## 11. Проверка (use-case, ~15 минут)

```bash
APP=vegacode  # или vegaharness / vegaide / vegamedia / myapp

# 1. Whitelist client_id: чужой отклоняется
curl -X POST https://api.vega.chat/api/auth/device/code \
  -H "Content-Type: application/json" -d '{"client_id":"evil-app"}'
# ожидаем: 400/403 invalid_client

# 2. Код для нового приложения выдаётся
curl -X POST https://api.vega.chat/api/auth/device/code \
  -H "Content-Type: application/json" -d "{\"client_id\":\"$APP\",\"scope\":\"api\"}"
# ожидаем: { device_code, user_code, verification_uri, ... }

# 3. Полный цикл после подтверждения в браузере:
# 3а. выдать ключ (Bearer = session-token из device/token)
curl -X POST https://api.vega.chat/api/v1/keys/$APP \
  -H "Authorization: Bearer <session-token>" -H "Content-Type: application/json" -d '{}'
# ожидаем: { id, key: "sk-apivega-..." }

# 3б. whitelist моделей: каталог урезан до env-списка приложения
curl -s https://api.vega.chat/api/v1/models -H "Authorization: Bearer <sk-apivega-$APP>" \
  | python3 -c 'import json,sys; print([m["id"] for m in json.load(sys.stdin)["data"]])'
# ожидаем: только модели из <APP>_ALLOWED_MODELS (env пуст → пустой список, не весь каталог!)

# 3в. щит работает (путь B: обычный URL + имя ключа в PII_SHIELD_KEY_NAMES + opt-in заголовок)
curl -N https://api.vega.chat/api/v1/chat/completions \
  -H "Authorization: Bearer <sk-apivega-$APP>" -H "X-Vega-Anonymize: true" \
  -H "X-Vega-Session: test-$APP-1" \
  -H "Content-Type: application/json" \
  -d '{"model":"<любая из списка>","stream":false,"messages":[{"role":"user","content":"Повтори дословно: Иванов Иван Иванович, тел. +7 916 555-35-35"}]}'
# ожидаем: в ответе РЕАЛЬНЫЕ ФИО и телефон (модель видела только #PERSON_1# / #PHONE_NUMBER_1#)

# 3г. щит работает (путь A: guard-URL + любой ключ)
curl -N https://api.vega.chat/guard/v1/chat/completions \
  -H "Authorization: Bearer <любой-ключ>" -H "X-Vega-Session: test-guard-1" \
  -H "Content-Type: application/json" \
  -d '{"model":"<любая>","stream":false,"messages":[{"role":"user","content":"Повтори дословно: Иванов Иван Иванович"}]}'
# ожидаем: в ответе реальные ФИО

# 3д. генерация картинки (app-ключ, модель из whitelist/mediamodels)
curl https://api.vega.chat/api/v1/images \
  -H "Authorization: Bearer <sk-apivega-$APP>" -H "Content-Type: application/json" \
  -d '{"model":"<image-модель>","prompt":"красная панда в космосе","aspect_ratio":"1:1"}'
# ожидаем: { created, data: [{ b64_json, ... }], usage }

# 3е. PKCE (путь C): код → ключ
curl -X POST https://api.vega.chat/api/v1/auth/keys \
  -H "Content-Type: application/json" \
  -d '{"code":"<pkce-код из /auth>","code_verifier":"<verifier>","code_challenge_method":"S256"}'
# ожидаем: { key: "sk-apivega-...", user_id }

# 4. Выход отзывает ключ
curl -X POST https://api.vega.chat/api/v1/keys/$APP/revoke \
  -H "Authorization: Bearer <sk-apivega-$APP>"
# ожидаем: { success: true, revoked: 1 }, повторный запрос с тем же ключом → 401
```

Если в ответе осталась метка `#PERSON_1#`: сменился `X-Vega-Session` либо
запрос шёл мимо щита (проверь URL, имя ключа в `PII_SHIELD_KEY_NAMES` и
заголовок `X-Vega-Anonymize: true`). Если `/models` пуст — приложение зарегистрировано,
но env-список пуст (fail-closed): заполни `<APP>_ALLOWED_MODELS`.

Связанные доки: `docs/pii-shield.md` (архитектура щита),
`docs/pages/api-guides/parameters.md` и `docs/pages/` (публичный API-справочник),
`AGENTS.md` (инварианты биллинга и щита).
