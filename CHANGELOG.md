# Changelog

Все значимые изменения VEGA IDE. Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версионирование — [SemVer](https://semver.org/lang/ru/).

## [1.147.0] — 2026-11-23

Обновление базы до **Microsoft VS Code 1.147.0** (ветка `upstream/release/1.147`, тег `1.147.0`,
коммит `8a14f0cc1b0`).

### Обновление до VS Code 1.147

Ключевое из [release notes 1.147](https://code.visualstudio.com/updates/v1_147):

- **Агент-сессии**
  - Send Later (эксп.) — отложенная отправка запросов и follow-up'ов по расписанию из окна Agents.
  - Draft requests (эксп.) — несколько неотправленных запросов с собственным контекстом и конфигурацией,
    переживают перезапуск.
  - Шаринг удалённых окружений как GitHub Environments — поднять сессии SSH/WSL/Dev Tunnel с другого
    устройства.
  - Сохранение чат-сессий при пересборке Dev Container (эксп., state volume).
  - Inbox mode: подтверждение (acknowledge) сессий, фильтры по workspace и окружению.
- **Агенты**
  - Model routers (эксп.) — YAML-роутеры в `~/.agents/model-routers/` выбирают модель под тип задачи.
  - HTML-превью и нативные визуалы (отчёты, мокапы, графики) прямо в ответах агента.
  - Automations и настраиваемые assisted permissions — свои правила, что безопасно, а что требует
    одобрения.
  - Панель Details можно переставлять вокруг редактора (эксп.); информация о расширениях в окне Agents.
- **Чат** — скриншоты других приложений как вложения (эксп.), захват и разметка изображений,
  inline attachment pills (эксп.).
- **MCP** — Skills over MCP.
- **Интеграция браузера (preview)** — агенты управляют браузером (Browser Use), превью удалённых
  HTML-файлов без копирования, открытие не-localhost ссылок, отключение димминга.
- **Песочница** — повтор действия с обновлёнными разрешениями внутри sandbox.
- **Редактор** — настройка скруглений и отступов панелей, connected panel tabs (эксп.),
  редактирование Markdown-таблиц по ячейкам, сворачиваемые details-секции.
- **Enterprise** — Claude и Codex рядом с managed settings; регулярные выражения в правилах
  managed shell permissions.
- **Устаревает** — десктоп на macOS Ventura/Sonoma и 32-bit ARM Linux; Local harness будет удалён
  в феврале 2027.

### VEGA IDE

- **OpenRouter-атрибуция для всех запросов к api.vega.chat.** Заголовки `HTTP-Referer:
  https://api.vega.chat`, `X-OpenRouter-Title: VEGA`, `X-OpenRouter-Categories: general-chat`
  объявлены один раз как `VEGA_ATTRIBUTION_HEADERS` в каждом пакете и теперь применяются везде:
  `vega-authentication`, расширение `copilot` (fetch и WebSocket через `FetcherService`), agent host
  (`CopilotApiService`, `ProviderConfig.headers` Copilot SDK) и загрузка каталога `/pricing` в
  workbench.
- **`isVegaApiKey` стал type guard** (`token is string`) — после проверки ключ доступен компилятору
  как `string` без повторных проверок.
- **Адаптация к API upstream 1.147** — обновлена сигнатура `getChatSetupDialogButtons` в фикстуре
  `sessionsSignInDialog`.
- **Тесты**: новые `vegaAttributionHeaders.spec.ts` (copilot, vitest) и кейсы атрибуции в
  `copilotApiService`/`copilotGitHubCredentials` (agentHost); `chatSetup` ожидает единственный
  провайдер `vega` в диалоге входа — социальные кнопки не показываются независимо от результата
  Microsoft sign-in пробы.

### Проверено

- `pnpm run compile` — 0 ошибок (клиент + расширение Copilot).
- `scripts\test.bat` по затронутым областям — 220 тестов зелёные (copilotApiService,
  copilotGitHubCredentials, githubEndpoints, chatSetup, modelPickerVegaPricing,
  onboardingVariationA, defaultThemeColors, account.contribution).
- `vitest` расширения copilot — 14/14 (vegaAttributionHeaders, vega, vegaModelAdapter).

## [1.146.0] — 2026-11-15

Первый публичный релиз VEGA IDE на базе **Microsoft VS Code 1.146.0** (ветка `release/1.146`, коммит `69047191fc4`).

### Обновление до VS Code 1.146

Полный merge ветки `upstream/release/1.146` в форк: 1447 коммитов, 3271 изменённый файл,
48 конфликтов разрешено вручную (product.json, package.json, agentHost, модель-пикер, чат/сессии).

Ключевое из [release notes 1.146](https://code.visualstudio.com/updates/v1_146):

- **Agents**
  - Inbox mode для сессий (эксп.) — единый список сессий, требующих внимания, с отложкой и сноузом.
  - Inline actions в списке сессий (эксп.) — исправление проверок и ответы на комментарии прямо из строки.
  - Chat windows (preview) — чат в отдельном окне, перетаскивание частей, вкладок и терминала.
  - Управление расширениями прямо из окна Agents (эксп.) — установка и удаление без переключения на редактор.
  - Сравнение моделей (preview): судья и синтезатор без workspace, поддержка Copilot Fusion, запуск оценок агентом.
  - Canvases (preview): права для canvas-расширений, восстановление холстов без повторного запроса.
  - Agent Host теперь работает в виртуальных репозиториях.
- **Chat**
  - Продолжение сессии GitHub Copilot CLI прямо в IDE (эксп. команда `/code`).
  - Настраиваемый шорткат фоновой отправки сообщения.
- **MCP**
  - Skills over MCP (preview, SEP-2640) — MCP-серверы могут отдавать навыки модели.
- **Безопасность и корпоративная среда**
  - Более гранулярные запросы разрешений: по умолчанию — конкретные домены, команды и каталоги.
  - Маскирование переменных окружения в песочнице (`chat.agent.sandbox.credentials.envVars`).
  - Индикатор «(sandbox enabled)» в поле ввода чата.
  - Корпоративные прокси (PAC и Kerberos) для агент-сессий.
  - `communication.support.url` — свои ссылки «Contact Admin» при блокировках политиками.
  - `strictPluginOnlyCustomization` теперь блокирует и standalone canvas-расширения.
- **Редактор и доступность**
  - Mermaid 12 (новые типы диаграмм, обновлённый авто-лейаут).
  - Копирование `file://`-адреса локального HTML в Integrated Browser.
  - Видимый фокус клавиатуры на странице Welcome.
- **Устаревает**
  - Local harness объявлен устаревшим и будет удалён в феврале 2027 (Copilot harness — с 1.143).

### VEGA IDE

- **Брендинг.** Продукт называется VEGA IDE во всех пользовательских строках: окно, диалоги входа,
  категории команд, названия выходных каналов. Технические идентификаторы (`github.copilot*`,
  `provider.id: 'vega'`, пути `~/.vegaide`) сохранены.
- **Только VEGA-вход.** Знак входа в аккаунт выполняет device flow (RFC 8628) через `api.vega.chat`;
  расширение `vega-authentication` заменяет GitHub-аутентификацию в чате.
- **Agent Host работает с VEGA API.** Ключ `sk-apivega-…` распознаётся по `isVegaApiKey`, запросы идут
  в `https://api.vega.chat/api/v1`, список моделей нормализуется из формата OpenRouter, GitHub-ресурсы
  остаются без credential (репозитории/PR в VEGA не работают — это осознанное ограничение).
- **Своя модель подписки в модель-пикере** (`modelPickerVegaPricing`): цены и тарифы VEGA.
- **Темы VEGA Dark и VEGA Light** — собственные цветовые схемы, включены по умолчанию
  (акценты переопределяют унаследованные синие).
- **Google Sans** — шрифт по умолчанию, встроен в сборку (включая markdown и notebooks).
- **Русский язык по умолчанию.** Встроенный языковой пакет `MS-CEINTL.vscode-language-pack-ru`,
  `defaultLocale: "ru"`, брендинг переводится через `ruLabel` / `withRuBrandNames`.
- **Open VSX** как источник расширений; `linkProtectionTrustedDomains` для api.vega.chat, vega.codes,
  context7.com, deepwiki.com.
- **Своя лицензия.** EULA VEGA IDE (`vega.codes/offer`) вместо MIT; `ThirdPartyNotices` обновлён.
- **Иконка приложения** — растр `vegaide.png` (терминальное окно на тёмном скруглённом квадрате)
  во всех потребителях: workbench, title bar, onboarding, задачи Windows, веб-манифест.

### Сборка и репозиторий

- Миграция на **pnpm 12.16.0** (следствие перехода upstream 1.146): `package-lock.json` удалены,
  `overrides` / `allowBuilds` перенесены в `pnpm-workspace.yaml`, инструкции `AGENTS.md` обновлены.
- Требуется **Node.js 24.22.1** (`.nvmrc`); сборка идёт через fnm.
- Исправлен конфликт импортов в `chatContinueInAction.ts` (после удаления форком экшена
  «Continue Chat in…» остались неиспользуемые импорты от upstream).

### Проверено

- `pnpm run typecheck-client` — 0 ошибок.
- `pnpm run compile` — 0 ошибок (клиент + расширение Copilot).
- `pnpm run valid-layers-check`, ESLint по изменённым файлам — ок.

[1.147.0]: https://github.com/lingeniare/vegaide/releases/tag/v1.147.0
[1.146.0]: https://github.com/lingeniare/vegaide/releases/tag/v1.146.0
