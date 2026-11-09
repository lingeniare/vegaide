<p align="center">
  <img src="vegaide.png" alt="VEGA IDE" width="104" height="104">
</p>

<h1 align="center">VEGA IDE</h1>

<p align="center">
  Редактор кода, в котором ИИ — не плагин, а ядро.<br>
  Форк <a href="https://github.com/microsoft/vscode">Code-OSS</a> с провайдером <a href="https://vega.chat">ВЕГА</a> вместо GitHub Copilot.
</p>

<p align="center">
  <b>RU</b> &nbsp;·&nbsp; <a href="README_EN.md">EN</a>
</p>

<p align="center">
  <a href="LICENSE.txt"><img alt="Лицензия MIT" src="https://img.shields.io/badge/%D0%BB%D0%B8%D1%86%D0%B5%D0%BD%D0%B7%D0%B8%D1%8F-MIT-2ea44f"></a>
  <img alt="База: Code-OSS 1.142" src="https://img.shields.io/badge/%D0%B1%D0%B0%D0%B7%D0%B0-Code--OSS%201.142-0078d4">
  <img alt="Windows, macOS, Linux" src="https://img.shields.io/badge/Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-444">
  <a href="https://vega.chat"><img alt="vega.chat" src="https://img.shields.io/badge/vega.chat-0b0f14?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMNCAyMmgybDYtMTIgNiAxMmgyeiIvPjwvc3ZnPg=="></a>
</p>

<br>

## Что это

**VEGA IDE** — независимая сборка VS Code, в которой весь ИИ-стек переведён на российского провайдера [ВЕГА](https://vega.chat). Тот же знакомый редактор — та же сетка редактора, терминал, отладчик, расширения Open VSX — но с другой моделью доступа к ИИ: без VPN, без зарубежной карты, без передачи телеметрии.

## Отличия от VS Code + GitHub Copilot

| | VS Code + Copilot | VEGA IDE |
|---|---|---|
| **Модели** | Только каталог GitHub Copilot, платная подписка | API ВЕГА — все новые модели в одном месте; бесплатные модели для кодинга **до 1000 запросов в сутки** |
| **Поиск в интернете** | Ограничен | Встроенные web-search и web-fetch на базе Parallel AI |
| **Документация в контексте** | Нет | Context7 и Devin DeepWiki — актуальные доки библиотек прямо в промпте агента |
| **Персональные данные** | Обрабатываются за рубежом | Соответствие **152-ФЗ** |
| **Доступность** | Гео-ограничения, нужен VPN | Работает без VPN и региональных блокировок |
| **Стоимость запросов** | Каждый запрос тарифицируется | Кэширование запросов — лимиты расходуются экономнее |
| **Аналитика** | Телеметрия Microsoft | Веб-аналитика вырезана полностью |
| **Оплата** | Зарубежная карта | Рубли |

## Что внутри

- **Полный редактор Code-OSS** — синхронизируемся с upstream `microsoft/vscode`
- **ИИ-чат и агенты** через провайдер `api.vega.chat` — OpenRouter-совместимый прокси ко всем актуальным моделям
- **Русский интерфейс из коробки** — языковой пакет встроен, английский доступен переключением
- **MCP-серверы, агенты, инструкции, хуки** — вся система кастомизации агентов из Code-OSS
- **Изолированные данные** — VEGA IDE ставится рядом с VS Code и не делит с ним настройки, расширения и профили

## Установка

Готовые сборки публикуются на [vega.chat](https://vega.chat). Сборка из исходников — по [инструкции upstream](https://github.com/microsoft/vscode/wiki/How-to-Contribute#build-and-run-from-source) (Node.js + npm, `npm install` → `npm run watch` → `scripts\code.bat` / `./scripts/code.sh`).

## Обратная связь и вклад

- **Баги и идеи** — [Issues](https://github.com/lingeniare/vegaide/issues), принимаем.
- **Pull request'ы с кодом** — не принимаем: репозиторий ведёт одна команда, чужие правки не сольются.
- **Уязвимости** — не пишите в Issues, сообщайте приватно через [Security Advisories](https://github.com/lingeniare/vegaide/security/advisories/new) ([политика](SECURITY.md)).

## Правовое

- Исходный код этого репозитория — под [лицензией MIT](LICENSE.txt), унаследованной от Code-OSS.
- Собранный продукт VEGA IDE распространяется по [EULA](LICENSE.rtf).
- Проект независим и не аффилирован с Microsoft и GitHub; «VS Code» — товарный знак Microsoft.

---

<p align="center">
  <a href="https://vega.chat">vega.chat</a> &nbsp;·&nbsp; <a href="https://api.vega.chat">api.vega.chat</a> &nbsp;·&nbsp; <a href="https://github.com/lingeniare/vegaide/issues">issues</a>
</p>
