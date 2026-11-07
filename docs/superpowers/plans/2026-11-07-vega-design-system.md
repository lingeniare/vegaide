# VEGA Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Фирменная дизайн-система VEGA IDE: темы VEGA Dark / VEGA Light (дефолтные, primary `#059669`, нейтралы и слои из 2026) + Google Sans в интерфейсе и Google Sans Code как моношрифт продукта.

**Architecture:** Две новые темы в `theme-defaults` через `include` над 2026-файлами (наследуют tokenColors + нейтральные цвета, переопределяют только акцентные ключи). Дефолты переключаются в `ThemeSettingDefaults` + `product.json`. Variable-TTF шрифты (OFL) коммитятся в `src/vs/base/browser/media/fonts/`, подключаются `@font-face` в `style.css` и prepend-ом в системные font-stacks; `EDITOR_FONT_DEFAULTS` меняет моношрифт всего продукта.

**Tech Stack:** VS Code theme JSON (include-chain), product.json, esbuild file-loader (`.ttf` уже в loader map), resources.ts copy globs, SIL OFL fonts.

**Spec:** `docs/superpowers/specs/2026-11-07-vega-design-system-design.md`

## Global Constraints

- Primary `#059669`; шкала: hover-светлее `#10B981` (dark) / темнее `#047857` (light), ссылки на тёмном `#34D399`/`#6EE7B7`, tint'ы `#059669` + альфа `12/15/1A/26/30/33/40/55/60/80/90`.
- Темы `Dark/Light 2026` остаются зарегистрированными и не редактируются. HC-темы не трогаем.
- Только `.ttf` (не `.woff2` — не обрабатывается сборкой).
- CSS: значения по дизайн-токенам; цветовые литералы — только в theme JSON и @font-face-блоках.
- Шрифтовые цепочки обязаны сохранять существующие фолбэки (CJK-стеки, Consolas, Menlo, Droid Sans Mono).
- Не коммитим без запроса; стиль коммитов — conventional (`feat:`, `style:`).

## Review Focus

1. **Синий акцент, переживший include** — ключ не переопределён в vega-файле → наследуется синий из 2026. Тест: скрипт мерджит include-цепочку и проверяет, что в финальной палитре нет accent-синих значений из списка (Task 1, шаг проверки).
2. **Шрифт не доехал до `out/`** — ресурс не скопировался → молча системный шрифт. Тест: после сборки файл существует в `out/vs/base/browser/media/fonts/` (Task 3).
3. **Кириллица в коде** — рендерится фолбэк-моно (принято пользователем); проверить, что в стеке GSC стоит фолбэк (Task 3, шаг fontInfo).
4. **Рассинхрон id темы** — `product.json.onboardingThemes[].id` ↔ `theme-preview-${id}.svg` ↔ `package.json.id`; рассинхрон = 404 плитка (Task 2, шаг svg).
5. **JSONC-опечатки** в theme-файлах (trailing comma — VS Code парсит jsonc и допускает, но лучше чисто) — проверка парсингом в Task 1.

---

### Task 1: Файлы тем VEGA + регистрация

**Files:**
- Create: `extensions/theme-defaults/themes/vega-dark.json`
- Create: `extensions/theme-defaults/themes/vega-light.json`
- Modify: `extensions/theme-defaults/package.json` (contributes.themes)
- Modify: `extensions/theme-defaults/package.nls.json`

**Interfaces:**
- Produces: theme ids `VEGA Dark` / `VEGA Light` (используются в Task 2: ThemeSettingDefaults, product.json themeId).

- [ ] **Step 1: `vega-dark.json`** — `{"include": "./2026-dark.json", "name": "VEGA Dark", "type": "dark", "colors": {…}}`. В `colors` — ТОЛЬКО акцентные ключи (нейтралы наследуются). Маппинг из 2026-dark → VEGA:

  `focusBorder` `#3994BCB3`→`#059669B3`; `textLink.foreground`→`#34D399`, `textLink.activeForeground`→`#6EE7B7`; `button.background`/`button.border`→`#059669`, `button.hoverBackground`→`#10B981`; `inputValidation.infoBackground`→`#064E3B`, `inputValidation.infoBorder`→`#059669`; `badge.background`→`#047857`; `progressBar.background`→`#059669`; `list.dropBackground`→`#0596691A`, `list.focusOutline`→`#059669B3`, `list.highlightForeground`→`#34D399`; `activityBar.activeFocusBorder`→`#059669B3`, `activityBarBadge.background`→`#047857`; `menu.selectionBackground`→`#05966926`, `menu.selectionBorder`→`#059669`; `editor.selectionBackground`→`#04785780`, `editor.inactiveSelectionBackground`/`editor.selectionHighlightBackground`→`#05966930`, `editor.wordHighlightBackground`→`#05966926`, `editor.wordHighlightStrongBackground`→`#05966940`, `editor.findMatchBackground`→`#05966980`, `editor.findMatchHighlightBackground`→`#05966940`; `editorLink.activeForeground`→`#34D399`; `editorBracketMatch.background`→`#05966955`; `editorOverviewRuler.findMatchForeground`→`#34D39999`, `editorOverviewRuler.addedForeground`/`modifiedForeground`→`#34D399`; `editorGutter.addedBackground`→`#34D399`; `diffEditor.insertedLineBackground`→`#05966926`, `diffEditor.insertedTextBackground`→`#34D3994d`; `peekViewEditor.matchHighlightBackground`/`peekViewResult.matchHighlightBackground`→`#05966933`, `peekViewResult.selectionBackground`→`#05966926`; `panelTitle.activeBorder`→`#059669`; `statusBar.focusBorder`→`#059669B3`, `statusBar.debuggingBackground`/`prominentBackground`/`prominentHoverBackground`→`#059669`; `tab.activeBorderTop`→`#059669`; `extensionButton.prominentBackground`/`prominentHoverBackground`→`#047857`/`#059669`; `quickInputList.focusBackground`→`#047857`; `terminal.selectionBackground`→`#05966933`; `gitDecoration.addedResourceForeground`/`untrackedResourceForeground`→`#34D399`; `notificationLink.foreground`/`notificationsInfoIcon.foreground`/`editorSuggestWidget.focusOutline`→`#34D399`/`#059669B3`; `chat.inputWorkingBorderColor1`→`#059669`; `editorCommentsWidget.rangeBackground`/`rangeActiveBackground`→`#05966926`/`#05966946`; `charts.green`→`#34D399`; `agentsGradient.tintColor`→`#059669`; `agentsBadge.background`/`agentsUnreadBadge.background`→`#047857`.

- [ ] **Step 2: `vega-light.json`** — `{"include": "./2026-light.json", "name": "VEGA Light", "type": "light", "colors": {…}}`. Маппинг `#0069CC`→emerald:

  `focusBorder`→`#059669`; `textLink.foreground`/`activeForeground`→`#047857`; `button.background`/`button.border`→`#059669`, `button.hoverBackground`→`#047857`; `inputValidation.infoBackground`→`#E6F4EE`, `inputValidation.infoBorder`→`#059669`; `badge.background`→`#059669`; `progressBar.background`→`#059669`; `list.dropBackground`→`#05966915`, `list.focusOutline`→`#059669`, `list.highlightForeground`→`#047857`; `activityBar.activeFocusBorder`→`#059669`, `activityBarBadge.background`→`#059669`; `menu.selectionBackground`→`#0596691A`, `menu.selectionBorder`→`#059669`; `editor.selectionBackground`/`editor.findMatchBackground`→`#05966940`, `editor.inactiveSelectionBackground`/`editor.findMatchHighlightBackground`→`#0596691A`, `editor.selectionHighlightBackground`→`#05966915`, `editor.wordHighlight*`→`#05966926`; `editorLink.activeForeground`/`editorSuggestWidget.highlightForeground`/`notificationLink.foreground`/`notificationsInfoIcon.foreground`/`agentsChatInput.focusBorder`→`#047857` (кроме `agentsChatInput.focusBorder` → `#059669`); `editorBracketMatch.background`/`peekView*.matchHighlightBackground`→`#05966940`/`#05966933`; `peekView.border`→`#059669`; `editorSuggestWidget.focusOutline`/`statusBar.focusBorder`/`statusBarItem.focusBorder`/`statusBar.debuggingBackground`/`statusBarItem.prominent*`→`#059669`; `panelTitle.activeBorder`/`tab.activeBorderTop`→`#059669`; `extensionButton.prominent*`→`#059669`/`#047857`; `quickInputList.focusBackground`→`#059669`; `terminal.selectionBackground`→`#05966926`; `editorOverviewRuler.findMatchForeground`→`#05966999`, `modifiedForeground`→`#059669`, `addedForeground`/`editorGutter.addedBackground`/`gitDecoration.added*`/`untracked*`→`#059669`; `diffEditor.insertedTextBackground`→`#05966926`; `chat.requestBubbleBackground`→`#05966912`, `chat.requestBubbleHoverBackground`→`#05966919`, `chat.inputWorkingBorderColor1`→`#059669`; `editorCommentsWidget.rangeBackground`→`#D9F0E7`, `rangeActiveBackground`→`#C7E9DB`; `charts.green`→`#059669`; `agentsGradient.tintColor`→`#059669`; `agentsBadge.background`/`agentsUnreadBadge.background`→`#059669`.

  (Значения с двумя вариантами через `/` — выбрать по контрасту; `#587c0c`-зелёные git/diff ключи → `#059669`.)

- [ ] **Step 3: Проверка валидности и «синих остатков»**

  ```bash
  node -e "const fs=require('fs');const j=p=>JSON.parse(fs.readFileSync('extensions/theme-defaults/themes/'+p,'utf8'));const m={...j('2026-dark.json').colors,...j('vega-dark.json').colors};const bad=['#3994BC','#297AA0','#48A0C7','#53A5CA','#307E9F','#276782','#3a94bc','#488FAE','#2B7DA3'];console.log(Object.entries(m).filter(([k,v])=>bad.some(b=>String(v).toLowerCase().includes(b.toLowerCase()))))"
  ```
  Expected: пустой массив для обеих тем (включить `#0069CC` в список для light). Также `node -e "JSON.parse(...)"` обоих файлов — валидный JSON.

- [ ] **Step 4: Регистрация** — в `package.json` contributes.themes добавить два объекта **первыми**:
  `{ "id": "VEGA Dark", "label": "%vegaDarkThemeLabel%", "uiTheme": "vs-dark", "path": "./themes/vega-dark.json" }` и аналогично `VEGA Light` / `vs`. В `package.nls.json` добавить `"vegaDarkThemeLabel": "VEGA Dark"`, `"vegaLightThemeLabel": "VEGA Light"` (проверить наличие `package.nls.ru.json` — добавить и туда, если есть).

- [ ] **Step 5: Commit**

  ```bash
  git add extensions/theme-defaults/themes/vega-*.json extensions/theme-defaults/package*.json
  git commit -m "feat: add VEGA Dark and VEGA Light color themes"
  ```

---

### Task 2: Дефолты, boot-палитра, onboarding

**Files:**
- Modify: `src/vs/workbench/services/themes/common/workbenchThemeService.ts:43-44,73-213` (+ LIGHT_INITIAL_COLORS далее по файлу)
- Modify: `product.json` (onboardingThemes)
- Create: `src/vs/workbench/contrib/welcomeOnboarding/browser/media/theme-preview-vega-dark.svg`
- Create: `src/vs/workbench/contrib/welcomeOnboarding/browser/media/theme-preview-vega-light.svg`
- Modify (проверить): `src/vs/workbench/contrib/themes/test/node/defaultThemeColors.test.ts`

**Interfaces:**
- Consumes: theme ids из Task 1.
- Produces: дефолтная тема нового профиля — VEGA.

- [ ] **Step 1:** `COLOR_THEME_DARK = 'VEGA Dark'`, `COLOR_THEME_LIGHT = 'VEGA Light'` (workbenchThemeService.ts:43-44).

- [ ] **Step 2:** Реколор `COLOR_THEME_DARK_INITIAL_COLORS` и `COLOR_THEME_LIGHT_INITIAL_COLORS` под VEGA-палитру: нейтралы → значения 2026 (`#121314` editor, `#191A1B` chrome, `#2A2B2C` borders; `#FFFFFF`/`#FAFAFD`/`#F0F1F2` light), акценты `#0078D4`/`#005FB8`/`#4daafc`/`#2488DB`-подобные → emerald (`#059669`, ссылки dark `#34D399`, light `#047857`).

- [ ] **Step 3:** `product.json` `onboardingThemes`: записи `dark-2026`/`light-2026` → `{ "id": "vega-dark", "label": "VEGA Dark", "themeId": "VEGA Dark", "type": "dark" }` и `vega-light` аналогично. Остальные 4 записи не трогаем.

- [ ] **Step 4:** Скопировать `theme-preview-dark-2026.svg` → `theme-preview-vega-dark.svg` (заменить `#3994BC`→`#059669`; фоны уже VEGA-нейтралы), `theme-preview-light-2026.svg` → `theme-preview-vega-light.svg` (`#0069CC`→`#059669`; если там есть другие синие акценты — тем же правилом).

- [ ] **Step 5: Проверка**

  ```bash
  node -e "const p=require('./product.json');console.log(p.onboardingThemes.map(t=>t.id))" && ls src/vs/workbench/contrib/welcomeOnboarding/browser/media/ | grep vega
  ```
  Expected: `vega-dark`, `vega-light` в списке; оба svg существуют (id ↔ файл совпадают).

- [ ] **Step 6:** Прочитать `defaultThemeColors.test.ts` — если в нём таблица дефолтных тем, добавить `{ name: 'VEGA Dark', file: 'vega-dark.json', selector: 'vs-dark' }` / light; прогнать файл тестов (`scripts/test.bat --run` либо `npm run test-browser -- --run ...` — уточнить команду в репо; если тестовая инфра недоступна локально — отметить и идти дальше).

- [ ] **Step 7: Commit**

  ```bash
  git add src/vs/workbench/services/themes/common/workbenchThemeService.ts product.json src/vs/workbench/contrib/welcomeOnboarding/browser/media/theme-preview-vega-*.svg src/vs/workbench/contrib/themes/test/node/defaultThemeColors.test.ts
  git commit -m "feat: make VEGA themes the product defaults"
  ```

---

### Task 3: Шрифты — файлы, @font-face, font-stacks

**Files:**
- Create: `src/vs/base/browser/media/fonts/` + `GoogleSans.ttf`, `GoogleSans-Italic.ttf`, `GoogleSansCode.ttf`, `GoogleSansCode-Italic.ttf`, `OFL.txt`
- Modify: `build/next/resources.ts` (desktop + web списки)
- Modify: `src/vs/workbench/browser/media/style.css:1-35` (@font-face + font-stacks + `--monaco-monospace-font`)
- Modify: `src/vs/base/browser/fonts.ts:18`
- Modify: `src/vs/editor/common/config/fontInfo.ts:222-236`
- Modify: `ThirdPartyNotices.txt`

**Interfaces:**
- Produces: семейства `'Google Sans'`, `'Google Sans Code'` доступны рендереру.

- [ ] **Step 1: Скачать шрифты** из `github.com/google/fonts` (raw): `ofl/googlesans/GoogleSans[GRAD,opsz,wght].ttf` → `GoogleSans.ttf`; `ofl/googlesans/GoogleSans-Italic[GRAD,opsz,wght].ttf` → `GoogleSans-Italic.ttf`; `ofl/googlesanscode/GoogleSansCode[wght].ttf` → `GoogleSansCode.ttf`; `ofl/googlesanscode/GoogleSansCode-Italic[wght].ttf` → `GoogleSansCode-Italic.ttf`; `ofl/googlesanscode/OFL.txt` → `OFL.txt`. Проверить точные имена через GitHub API/ls репо. Проверить файл не LFS-указатель (размер >100KB, magic bytes `00 01 00 00`).

- [ ] **Step 2:** В `resources.ts` добавить `'vs/base/browser/media/fonts/*.ttf'` в `desktopResourcePatterns` и `webResourcePatterns` (после блока images; server-таргету шрифты не нужны).

- [ ] **Step 3:** В начало `style.css` — `@font-face` для 4 файлов (путь от `vs/workbench/browser/media/`: `url('../../../base/browser/media/fonts/<file>.ttf') format('truetype')`; `font-weight: 300 800` (или по фактическим осям METADATA.pb); отдельные блоки для italic). Затем prepend `"Google Sans", ` во все `.monaco-workbench.*` font-stacks (windows/mac/linux + все `:lang()` варианты) и `'Google Sans Code', ` в `--monaco-monospace-font`.

- [ ] **Step 4:** `fonts.ts:18` — prepend `"Google Sans", ` в каждый из трёх platform-стеков `DEFAULT_FONT_FAMILY`.

- [ ] **Step 5:** `fontInfo.ts` — `DEFAULT_WINDOWS_FONT_FAMILY = '\'Google Sans Code\', Consolas, \'Courier New\', monospace'`, `DEFAULT_MAC_FONT_FAMILY = '\'Google Sans Code\', Menlo, Monaco, \'Courier New\', monospace'`, `DEFAULT_LINUX_FONT_FAMILY = '\'Google Sans Code\', \'Droid Sans Mono\', monospace'`.

- [ ] **Step 6:** `ThirdPartyNotices.txt` — добавить секцию Google Sans / Google Sans Code под SIL OFL (по образцу существующих записей; проверить .gitignore на `*.ttf`/`media/fonts`).

- [ ] **Step 7: Проверка** — `npm run compile` (или команда сборки из package.json scripts) без ошибок; `ls out/vs/base/browser/media/fonts/` — ttf на месте.

- [ ] **Step 8: Commit**

  ```bash
  git add src/vs/base/browser/media/fonts build/next/resources.ts src/vs/workbench/browser/media/style.css src/vs/base/browser/fonts.ts src/vs/editor/common/config/fontInfo.ts ThirdPartyNotices.txt
  git commit -m "feat: bundle Google Sans + Google Sans Code fonts"
  ```

---

### Task 4: Верификация

**Files:** только проверочные действия.

- [ ] **Step 1:** Unit-тесты тем — `scripts/test.bat` (Windows) для `defaultThemeColors.test.ts` / тематических unit-тестов; ожидание — зелёные (или документировать недоступность окружения).

- [ ] **Step 2:** Stylelint/hygiene на изменённых css (`npm run hygiene` либо lint-скрипт, который использует репо).

- [ ] **Step 3:** Smoke — собрать dev build (`npm run watch`/compile) и запустить Code OSS (по скиллу `launch` при наличии): тема VEGA применилась, шрифты видны в DevTools (computed font-family в чате и редакторе).
