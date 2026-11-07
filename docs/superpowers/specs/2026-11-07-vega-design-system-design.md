# VEGA Design System: темы VEGA Dark / VEGA Light + фирменная типографика

## Зачем

Пользователь хочет фирменный вид VEGA IDE по мотивам скриншотов (Devin-подобный UI):
отделённая рабочая область, слоистые фоны, скругления. Primary color — `#059669` (emerald-600).
Шрифты: Google Sans — интерфейс, Google Sans Code — редактор и кодблоки чата.

Ключевая находка разведки: нужного «вида» уже почти достигли — в форке есть модуль
`modernUI` (плавающие карточки, скруглённые углы, connected-табы, frosted glass) и
дефолтные темы `Dark/Light 2026` со слоистой палитрой (`agents.*`, `surface.*`).
Задача — перекрасить акцент в emerald и подключить шрифты, а не строить layout с нуля.

## Цели

- Две новые темы **VEGA Dark** и **VEGA Light**, дефолтные для продукта.
- Акцент `#059669` и его шкала во всех интерактивных местах (фокус, кнопки, ссылки,
  выделение, табы, бейджи, прогресс-бар).
- Google Sans — шрифт workbench-интерфейса (включая чат); Google Sans Code —
  дефолтный шрифт редактора и кодблоков чата. Шрифты встроены в сборку (woff2/ttf + OFL).
- Темы `Dark/Light 2026` остаются выбираемыми.

## Не-цели

- Не меняем структуру layout, скругления, тени — это уже делает `modernUI`.
- Не трогаем syntax-подсветку (наследуем tokenColors из 2026 — читаемая палитра).
- Не трогаем темы High Contrast, иконки, другие брендовые темы.
- Не грузим шрифты с CDN (офлайн-детерминированная сборка).

## Анти-цели

- Провал контраста: зелёный не должен ломать читаемость — на тёмном фоне ссылки
  берём светлый emerald (`#34D399`/`#6EE7B7`), заливки кнопок — более тёмный `#047857`.
- Не ломаем существующие тесты тем и настроек (миграции id не нужны — старые темы остаются).

## Подходы (выбрано)

**Темы — через `include` (выбрано).** `vega-dark.json` наследует `./2026-dark.json`
(tokenColors + нейтральные цвета), сверху переопределяет ~60 акцентных ключей.
Цепочка include уже используется в репо (2026 → modern → plus). Альтернатива —
полные копии файлов — отвергнута: дублирует ~700 строк и рассинхронится при апстриме.

**Шрифты — бандл `.ttf` в репо (выбрано).** Google Sans и Google Sans Code с ноября 2025
под SIL OFL — легально встраиваются. Берём **variable-шрифты в TTF**: в сборке
`.woff2` не обработан нигде (нет loader в esbuild, нет глобов копирования, rspack и
gulp знают только `.ttf`), а `.ttf` — уже поддерживаемый loader (`build/next/index.ts:520`,
`build/lib/standalone.ts:142`). Альтернатива (CDN fonts.googleapis.com) отвергнута:
офлайн-контекст Electron + CSP, недетерминированно.

**Моношрифт — везде Google Sans Code + системный фолбэк (выбор пользователя).**
`EDITOR_FONT_DEFAULTS` — фолбэк не только для редактора: терминал, debug REPL,
merge editor, parameter hints, inlay hints тоже наследуют его → весь моношрифт
продукта становится GSC. `METADATA.pb` у GSC: кириллицы нет — кириллические
символы (комментарии/строки на русском) будут рендериться следующим шрифтом в
стеке (Consolas/др. по ОС). Пользователь принял этот компромисс ради единого
«гуглового» вида кода; цепочки фолбэков сохраняем без изменений.
`--monaco-monospace-font` (инлайн-код в чате, кейбиндинги, диалоги) тоже получает GSC.

## Emerald-шкала

| Токен | Hex | Применение |
|---|---|---|
| primary | `#059669` | focusBorder (с `B3`), активные бордеры табов/панелей, badge акценты, ссылки в light-теме, прогресс |
| primary-hover / deep | `#047857` | фоны кнопок и бейджей (контраст с белым текстом ~4.4:1), debugging statusbar |
| bright (dark-тема) | `#34D399` / `#6EE7B7` | textLink, list.highlight, links — читаемость на `#121314` |
| tints | `#0596691A/26/30/60/80/90` | selection, find-match, hover-tints (по образцу текущих синих tint'ов) |

Нейтральные фоны (`#121314` editor / `#191A1B` sidebar / `#2A2B2C` borders и светлые
аналоги) берём из 2026 без изменений — это и есть «отделённая рабочая область».

## Файлы

**Темы:**
- `extensions/theme-defaults/themes/vega-dark.json` — `{ "include": "./2026-dark.json", "name": "VEGA Dark", "type": "dark", "colors": { … } }`
- `extensions/theme-defaults/themes/vega-light.json` — аналогично над `2026-light.json`, акценты темнее (`#047857` ссылки, `#059669` кнопки/фокус)
- `extensions/theme-defaults/package.json` — регистрация двух тем (`id`, `uiTheme`, `path`)
- `extensions/theme-defaults/package.nls.json` — лейблы `vegaDarkThemeLabel`, `vegaLightThemeLabel`
- `src/vs/workbench/services/themes/common/workbenchThemeService.ts` — `COLOR_THEME_DARK = 'VEGA Dark'`, `COLOR_THEME_LIGHT = 'VEGA Light'`
- `product.json` — `onboardingThemes`: записи 2026 → VEGA (остальные темы в списке не трогаем)
- `src/vs/workbench/services/themes/common/workbenchThemeService.ts` — реколор
  `COLOR_THEME_DARK_INITIAL_COLORS` / `_LIGHT_` в VEGA-палитру (boot-вспышка до загрузки
  темы сейчас синяя `#0078D4`)
- `onboarding-превью`: новые `theme-preview-vega-dark.svg` / `vega-light` (id тем в
  `product.json` — `vega-dark`/`vega-light`; файлы — перекрашенные копии 2026-превью,
  путь `src/vs/sessions/contrib/welcome/browser/media/themePreviews/` или
  `welcomeOnboarding` — уточнить по месту)
- `src/vs/workbench/contrib/themes/test/node/defaultThemeColors.test.ts` — при необходимости дополнить ожиданиями для VEGA-тем

**Шрифты:**
- `src/vs/base/browser/media/fonts/` (новая папка) — `GoogleSans.ttf` (variable), `GoogleSansCode.ttf`, `GoogleSansCode-Italic.ttf`, `OFL.txt`
- `build/next/resources.ts` — глоб `'vs/base/browser/media/fonts/*.ttf'` в списки копируемых ресурсов (иначе файлы не попадут в `out/`)
- `src/vs/workbench/browser/media/style.css` — `@font-face` + prepend `"Google Sans"` в `.monaco-workbench.*` font-stacks (с сохранением CJK-фолбэков) + `--monaco-monospace-font: 'Google Sans Code', ...`
- `src/vs/base/browser/fonts.ts` — `DEFAULT_FONT_FAMILY`: prepend `"Google Sans"` (используется chat input, SCM input, suggest inputs)
- `src/vs/editor/common/config/fontInfo.ts` — `DEFAULT_*_FONT_FAMILY`: prepend `'Google Sans Code'` → наследуется редактором, `chat.editor.fontFamily`, терминалом, REPL
- `ThirdPartyNotices.txt` — запись о Google Fonts OFL (если формат позволяет)

## Критерии приёмки

1. `VEGA Dark` и `VEGA Light` видны в списке тем и применяются; новый профиль стартует с VEGA-темой.
2. Primary `#059669` читается в фокус-обводках, кнопках, ссылках, выделении, активном табе — без «синих остатков» в основных поверхностях.
3. Сообщения чата и весь UI рендерятся Google Sans; редактор и кодблоки чата — Google Sans Code (проверка через DevTools computed font + визуально).
4. `Dark 2026`/`Light 2026` по-прежнему выбираются и выглядят как раньше; HC-темы не изменились.
5. Тесты тем (`defaultThemeColors.test.ts` и смежные) зелёные; stylelint/hygiene по CSS не ругается.
6. Сборка без сети: шрифты лежат локально, попадают в `out/` и резолвятся рендерером.
7. Boot-вспышка до загрузки темы идёт в VEGA-палитре (INITIAL_COLORS), onboarding-превью не 404 и не синие.

## Открытые мелочи (решаю по ходу, помечу в реализации)

- Покрытие проверено: Google Sans — полная кириллица; Google Sans Code — без кириллицы (принято: фолбэк на системный моно для кириллических символов).
- Пользователи с дефолтной 2026-темой молча переедут на VEGA (приемлемо — ребрендинг); пользователи со своей темой не тронуты.
- Коммит design-дока — вместе с реализацией или по запросу.
