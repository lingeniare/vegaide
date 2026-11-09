# VS Code Agents Instructions

This file provides instructions for AI coding agents working with the VS Code codebase.

For detailed project overview, architecture, coding guidelines, and validation steps, see the [Copilot Instructions](.github/copilot-instructions.md).

## UI branding

The product is **VEGA IDE**. Every user-visible product name — window title, sign-in and setup dialogs, terms footers, walkthroughs, output channels, account/provider labels — must read `VEGA IDE`. Never write `GitHub Copilot`, `VEGA Code`, `VEGA Copilot`, `API VEGA`, `VEGA's`, or a bare `VEGA` as the product name in strings shown to users. Feature and plan names keep bare `Copilot` (`Copilot Pro`, `Copilot CLI`, `Copilot Edits`).

Technical identifiers are not UI and keep their upstream spelling: `github.copilot*` command/settings/extension ids, `GitHub.copilot-chat`, `provider.id: 'vega'`, file and log paths. When the chat output channel name changes, keep `product.defaultChatAgent.chatExtensionOutputId` in sync.

On a Russian UI brand names go through `withRuBrandNames`/`ruLabel` (`src/vs/platform/product/common/vegaBranding.ts`), where `VEGA IDE` renders as `ВЕГА IDE` (Cyrillic `ВЕГА`, Latin `IDE`; indeclinable).

### Brand-rename pitfalls (learned 2026-11)

- **Feature/plan names map to bare `Copilot`, never `VEGA IDE`**: upstream `GitHub Copilot CLI` → `Copilot CLI`, `GitHub Copilot Pro/Free/Business/Enterprise` → `Copilot …`, `Copilot Edits`, `Copilot subscription/plan/tokens`. Only the product itself is `VEGA IDE`. A blind `GitHub Copilot` → `VEGA IDE` rename produces wrong strings like "VEGA IDE CLI is a separate GitHub product".
- **Auth provider ids are split**: `vega` = VEGA sign-in (`extensions/vega-authentication`), `github`/`github-enterprise` = GitHub.com git/scm auth (still live for issues, credentials, GitHub-coupled voice/STT). Welcome/sign-in flows key on `getSessions('vega')`; GitHub-service callers keep `'github'`. Settings-sync handoff in `workbench.ts` still expects `'github'` — open gap if VEGA settings sync is wanted.
- **File-format signatures are not branding**: `copilot_shim` legacy detection (`legacy.rs`) matches upstream-written file markers verbatim (e.g. `windows github copilot cli bootstrapper`). Renaming markers in fixtures/docs breaks `positive_fixtures` tests — fixtures must keep upstream bytes.
- **Codicon glyphs carry semantics**: `[class*="codicon-copilot"]` matches status variants (`copilot-warning`, `-error`, `-snooze`, …); the VEGA star mask in `style.css` excludes them via `:not()` so status icons keep meaning.
- **`RU_BRAND_NAMES` keys must stay unique** — duplicate `from` entries are dead code.
- **Locale overlays drift**: `extensions/copilot/package.nls.ru.json` is a hand-maintained translation of `package.nls.json` — every EN rename needs the RU pass too ("VEGA IDE"→"ВЕГА IDE", feature names stay Latin "Copilot …").
- **Bundled MS language pack serves stale brand strings**: keeping an upstream `localize` key while rebranding the EN message means the RU pack's old translation (with "GitHub Copilot") still wins at runtime — e.g. `settingUpCopilotNeeded` showed "настроить GitHub Copilot". Fix per-string with `ruLabel(localize(...), '…ВЕГА IDE…')`; `ruLabel` also has an `ILocalizedString` overload for `localize2` action/menu titles (it swaps only `value`, `original` stays English). Watch out for pack translations whose placeholders were rearranged — the `settings` setup footer rendered "{3} Copilot может показывать" because the pack hardcoded "Copilot" where the EN now injects `{3}`=provider name; for those, format the Russian string yourself instead of relying on `{n}` placeholders.
- **VEGA star lives in one CSS var**: `--vega-star-icon` (`:root` in `src/vs/workbench/browser/media/style.css`) holds the star data-URI (rays shortened ~20% vs the original `y 12–748`, `stroke-width 24`). Reuse it via `mask-image: var(--vega-star-icon)` instead of duplicating the SVG — it already drives codicon-copilot glyphs, the chat-setup dialog header icon (`chatSetup.css`), the "Continue with" button icon, and the sessions loading overlay (`sessionsSetUp.css`).
- **Sign-in dialogs carry no legal footer**: `ChatSetup.showDialog` passes `footer: ''` whenever `offersProviderSignIn` is true (terms are accepted in the provider auth window). `ChatSetupDialog` also adds `chat-setup-empty-detail` — its `detail: ' '` is only a marker to force the title markup; CSS hides the placeholder so the title sits directly above the button.
- **Dialog CSS specificity traps (learned 2026-11)**: two global rules beat naive per-dialog overrides — (1) `style.css` `[class*="codicon-copilot"]:not(…8 variants)::before` repaints every copilot glyph with the star mask and `background-color: currentColor` at ~10-class specificity, so tinting the chat-setup header star means setting `color:` on the `.dialog-icon` element, not `background-color` on `::before` (it loses); (2) `modern-ui-notifications-dialogs` restyles `.monaco-dialog-box` `.dialog-message-row`/`.dialog-buttons-row` paddings at 3-class specificity, so overrides in `chatSetup.css` must reach 4+ classes (e.g. `&.monaco-dialog-box.align-vertical …`) or they silently lose on source order.
- **Generated files**: `build/lib/policies/policyData.jsonc` is produced by `npm run export-policy-data` from runtime `localize()` strings — edit the source strings, keep the generated file in sync (its `--check` mode diffs them).
- **Repo tooling exe names**: `.agents/skills/launch` cleanup matches the built exe name (`VEGA IDE.exe` = `product.nameShort`), not upstream `Code - OSS.exe`.

### App icon assets (learned 2026-11)

The product icon is a raster PNG (terminal window on a dark rounded square; source `vegaide.png` in repo root). It is **not** an SVG — when changing it, regenerate every consumer:

- `src/vs/workbench/browser/media/code-icon.png` (512²) — the shared workbench mark: onboarding sign-in hero + provider mark (`variationA.css`), titlebar app icon (`titlebarpart.css`), banner (`bannerpart.css`), walkthrough (`walkThroughPart.css`), update badge (`updateTooltip.css`), getting-started watermark (`gettingStarted.css`), agents/voice surfaces (`openInAgents.css`, `agentsVoiceWindowService.ts` `copilotIconSrc`). Keep `build/next/resources.ts` glob `code-icon.{svg,png}` in sync — the brace also keeps `resources.test.ts` svg fixtures matching.
- `extensions/github-authentication/media/code-icon.png` (256²) + `favicon.ico` — auth redirect page (`index.html` `<img>`).
- OS-level: `resources/win32/code.ico` (multi-size, baked into the exe via rcedit + Inno `SetupIconFile` + `.code-workspace` file-assoc icon), `code_150x150.png`/`code_70x70.png` (tiles, dev-run window icon per `windows.ts`), `resources/linux/code.png` (512², window + deb/rpm/snap), `resources/darwin/code.icns` (bundle icon via `darwinIcon` in `build/lib/electron.ts`).
- Web: `resources/server/favicon.ico`, `code-192.png`, `code-512.png` (`manifest.json` + `workbench.html` apple-touch-icon/favicon).
- PIL (`python` + Pillow) generates all of these, including `.ico`/`.icns`; the source PNG must be cropped to a square around the alpha bbox first.
- **Not the app icon, leave alone**: `sessions-logo-{dark,light}.svg` (`currentColor` outline mark, mobile shell + policy-blocked), `vscodeLogoPath.ts` (aquarium easter-egg silhouette — inline path data, the source `vscode-icon.svg` is deleted), per-format `resources/**/*.ico`/`*.icns` document-type icons, `microsoft-authentication` media.
- **"Open in Editor" (id `openInVSCode`) opens a session in *this* product's editor** — its icon is the shared `code-icon.png` (`openInVSCode.css`), hover reads "Open in VEGA IDE Editor Window", and `agentsVoice` buttons say "Open in Editor". Separate, intentionally upstream-named flow: `applyChangesToParentRepo` "Open in VS Code" really opens the `vscode://` URI scheme.
- Gotcha: `vscode-icon.svg` **contains** `code-icon.svg` as a substring — a naive `s/code-icon\.svg/` also rewrites it.

### VEGA sign-in / api.vega.chat calls (learned 2026-11)

- Sign-in is RFC 8628 device flow in `extensions/vega-authentication` (`requestDeviceCode` → modal with `user_code` → `openExternal` → `pollDeviceToken` loop → `createAppKey` → session `accessToken` = `sk-apivega-...` app key, not OAuth).
- **Every fetch in `vegaApi.ts` must keep `AbortSignal.timeout(REQUEST_TIMEOUT_MS)` (15 s)** — api.vega.chat can blackhole TCP connects, and a bare fetch hangs ~60 s+ on the OS TCP timeout, which looked like a dead sign-in button. The onboarding button also goes `busy`/disabled for the whole `signIn()` await and shows a `withProgress` notification during `requestDeviceCode`, so add new API calls with a signal too — never a naked `fetch`.
- `defaultAccountService.signIn()` first waits on `initBarrier` (the startup `provider.refresh()`); for provider id `vega`, token entitlements are short-circuited offline (`defaultAccount.ts`), but entitlements/MCP-registry requests still hit the network when signed in.

## UI localization (Russian default)

VEGA IDE ships Russian as the default display language via a bundled language pack — no install or restart needed on first launch.

- **Default locale**: `product.json` `defaultLocale: "ru"` is read in `src/mainImpl.ts` (`getUserDefinedLocale(argvConfig) ?? product.defaultLocale?.toLowerCase()`). An explicit user choice always wins: `--locale` flag > `argv.json` `locale` > `defaultLocale`. "Configure Display Language" writes `locale` into `argv.json`, so it overrides the default too.
- **Bundled pack**: `MS-CEINTL.vscode-language-pack-ru` is a `product.json` `builtInExtensions` entry (pinned `version`+`sha256`, downloaded from the open-vsx `extensionsGallery.serviceUrl` at build into `resources/app/extensions`; in dev it lives at `.build/builtInExtensions` via `npm run download-builtin-extensions`). More languages can be added the same way — one entry each.
- **First launch**: `languagepacks.json` doesn't exist yet, so `resolveNLSConfiguration` falls back to `getBuiltinLanguagePackConfigurations()` (`src/vs/base/node/nls.ts`), which scans `builtinExtensionsPath` (`<resources/app>/extensions`) for `contributes.localizations`. Later runs use `languagepacks.json`, regenerated by the shared-process `LocalizationsUpdater` (`getInstalled()` covers system + user extensions).
- **Pack version vs app version**: the pack is older than the app — missing nls keys fall back to English per-string, that's normal. open-vsx's latest is what's pinned; the MS marketplace may have newer builds.
- **Dev limitation**: `VSCODE_DEV` set or missing `commit` → `resolveNLSConfiguration` returns `en` regardless. Dev runs are always English; verify localization in packaged builds or the `src/vs/base/test/node/nls.test.ts` unit tests. Smoke coverage: `localization.test.ts` asserts the RU default plus the marketplace-free `vscode-smoketest-language-pack-de` fixture.

## Install/data directory isolation (no conflicts with upstream VS Code)

The fork must install and run side-by-side with VS Code / Code OSS without sharing directories or identifiers. Canonical names live in `product.json`; most runtime paths derive from them automatically.

| Field | Value | Drives |
|---|---|---|
| `applicationName` | `vegaide` | binary name, `/usr/bin`, `/usr/share` |
| `dataFolderName` | `.vegaide` | `~/.vegaide` (argv.json, extensions; `-dev` suffix in dev) |
| `sharedDataFolderName` | `.vegaide-shared` | shared state between instances |
| `serverDataFolderName` | `.vegaide-server` | remote/WSL/devcontainer install root |
| `serverApplicationName` / `tunnelApplicationName` | `vegaide-server` / `vegaide-tunnel` | server & tunnel binary names |
| `urlProtocol` | `vegaide` | `vegaide://` handler |
| `win32MutexName` / `win32RegValueName` / `win32AppUserModelId` | `vegaide` / `VegaIDE` / `VEGA.IDE` | single-instance mutex, policy key, taskbar id |
| `darwinBundleIdentifier` / `linuxDesktopName` / `linuxIconName` | `chat.vega.ide` / `chat.vega.ide` / `vegaide` | bundle, .desktop, icon |

Key derivation points: `environmentService` (argv/extensions dirs), `userDataPath.ts` (portable, `VSCODE_APPDATA`, dev → `vegaide-dev` app-data dir), `mainImpl.ts` (`getArgvConfigPath`), `server.main.ts` (remote data dir), `cli/src/constants.rs` (baked from product.json via build.rs).

Fallbacks that bypass product.json also carry VEGA values: `product.ts` (out-of-source dev), `sshRemoteAgentHostService`/`devContainerAgentHostService` (`?? '.vegaide-server'`), `cli/src/options.rs` (`vegaide-server`), `cli/src/state.rs` (migrates `~/.vegaide-cli`, never upstream `~/.vscode-cli`).

### Intentionally retained upstream identifiers (do not "fix")

- **Interop on-disk formats**: `.vscode-server.json`, `.vscode-owner.json` (Copilot bridge), `.vscode/settings.json`-style workspace dirs.
- **Cross-quality compat lookups**: `agentHostLogSources` candidates (`.vscode-server*` of other qualities), `remoteDevContainerFixtures` consent candidates, `~/.vscode-cli{,-q}` legacy remote CLI fallbacks, `version_manager.rs` `bin/code*` detection list (with `bin/vegaide*` first).
- **Policy reads of other qualities**: copilot shim checks `CodeOSS`/`VSCode*` registry keys and `com.visualstudio.code.oss`/etc. macOS domains **plus** our `VegaIDE`/`chat.vega.ide` — a co-installed product's disable-policy must still apply.
- **Test fixtures of upstream products**: `CodeOSS.admx`, `com.visualstudio.code.oss.plist`/`.mobileconfig`, `policyConversion.test.ts`, xterm recordings.
- **Protocol/wire labels**: `vscode-server-launcher`, `x-tunnels-vscode-*` headers, `vscode-cli` secret namespace (shared auth is a feature).
- **Infra/tool names**: `vscode-oss-build-secrets` (MS Key Vault), `code-oss-launcher` dev tool dir, `package.json` name `code-oss-dev`, `code-oss` codicon ids.
- **Docs quoting upstream**: `extensions/copilot/CONTRIBUTING.md` example shows upstream `product.ts` values verbatim — that is correct.

## Windows packaging (learned 2026-11)

Local sequence for a win32-x64 installer (mirrors `product-build-win32-compile.yml` + `codesign.ts`, minus signing):

```sh
npm run gulp vscode-win32-x64-min          # full compile → C:\project\VSCode-win32-x64
# incremental re-pack after the bundle exists:
npm run gulp vscode-win32-x64-min-ci       # reuses out-vscode-min, ~2 min
npm run gulp vscode-win32-x64-inno-updater # copies tools\inno_updater.exe
npm run gulp vscode-win32-x64-user-setup   # → .build\win32-x64\user-setup\VSCodeSetup.exe
# also available: vscode-win32-x64-system-setup (admin install)
```

- **`signtool.exe` must be on PATH** for `patchWin32DependenciesTask` (strips Authenticode before `rcedit` version stamping). SDK lives at `C:\Program Files (x86)\Windows Kits\10\bin\<sdk>\x64` — add it to `PATH` for the gulp invocation. Code signing itself is skipped unless `--sign` is passed.
- **`copilot/shims.txt` build race**: a dev-run app materializes `extensions/copilot/node_modules/@github/copilot/shims.txt` (`ensureShims` in `copilotCli.ts`); the copilot extension's `.esbuild.mts` then runs `postinstall.ts`, which deletes it while `gulp.src` walks the same tree concurrently → `ENOENT lstat .../shims.txt`. Fix: delete the stale `shims.txt` from the source tree before packaging; the packaged extension gets its own marker from `prepareBuiltInCopilotRipgrepShim` (build/lib/copilot.ts) regardless.
- Output naming: Inno always emits `VSCodeSetup.exe`; CI renames to `VSCodeUserSetup-<arch>-<version>.exe` / `VSCodeSetup-<arch>-<version>.exe`.

## Installer license / legal branding (learned 2026-11)

The setup wizard's license page shows the **VEGA IDE EULA**, not upstream MIT:

- `LICENSE.rtf` in the repo root wins over `LICENSE.txt` for every installer language (`RootLicenseFileName` in `build/win32/code.iss`). Pure-ASCII RTF via `\uNNNN?` escapes; regenerate with the temp generator, validate by loading in a `System.Windows.Forms.RichTextBox`. `LICENSE.txt` stays MIT — it is still shipped inside the app via `product.json` `licenseFileName` and referenced by the EULA's OSS clause (plus `ThirdPartyNotices.txt`).
- If a `licenses/` dir is ever created, **every** `[Languages]` entry needs `licenses/LICENSE-<lang>.rtf` — the ISPP check is `DirExists` only, a missing file fails the compile.
- `copyrightFilter` in `build/filters.ts` excludes `!**/*.rtf` — without it hygiene demands the C-style MS header in the doc.
- `product.json` license fields: `licenseUrl`/`serverLicenseUrl` = `https://vega.codes/offer` (Help → View License), `licenseName` = `LicenseRef-proprietary` (feeds rpm `License:` and appdata `project_license`/`metadata_license` via `@@LICENSE@@`). Dev fallbacks mirror in `src/vs/platform/product/common/product.ts`.
- Publisher metadata: `code.iss` `AppPublisher`/`AppPublisherURL`/`AppSupportURL`/`AppUpdatesURL` = VEGA / vega.codes; `rcedit` stamps in `patchWin32DependenciesTask` (`gulpfile.vscode.ts`, `gulpfile.reh.ts`) write `CompanyName: VEGA` + `Copyright (C) 2026 VEGA` into bundled `*.node`/`rg.exe`.
- `UpdatingVisualStudioCode` in all 13 `build/win32/i18n/messages.*.isl` is the inno_updater.exe progress caption — keep it translated as "VEGA IDE".
- Legal entity for docs: ИП Филиппов Дмитрий Семенович, ОГРНИП 324595800091282, ИНН 590310081811, mail@vega.chat (source: officevega.com/oferta). Model: free personal/non-commercial + qualifying NCOs, paid for business.

## Link protection trusted domains

`product.json` `linkProtectionTrustedDomains` ships VEGA/doc domains (`api.vega.chat`, `vega.codes`, `context7.com`, `deepwiki.com`) so the "Trust domain" quick-pick never appears for them. The same list is duplicated in the web-dev templates `build/vite/workbench-vite.html` and `build/rspack/workbench-rspack.html` (embedded `productConfiguration`) — keep them in sync. Entries have no subdomain matching: `https://api.vega.chat` covers any path on that host only; use `https://*.vega.chat` for all subdomains.

## VEGA theme accent color (learned 2026-11)

The accent of `VEGA Dark` / `VEGA Light` lives in **three** places — change all of them or the boot flash / onboarding preview will show the old color:

- `extensions/theme-defaults/themes/vega-dark.json` / `vega-light.json` — ~66 accent keys over `2026-*.json` via `include`.
- `COLOR_THEME_DARK_INITIAL_COLORS` / `_LIGHT_` in `src/vs/workbench/services/themes/common/workbenchThemeService.ts` — duplicated subset for the pre-theme boot splash. The dark and light blocks sit back to back; several `'key': '#hex'` lines are identical in both, so disambiguate edits with context.
- `src/vs/workbench/contrib/welcomeOnboarding/browser/media/theme-preview-vega-*.svg` — accent stroke inside the onboarding preview.

Scale is role-based: primary anchor (borders/buttons/progress), deep (badge bg, selection — keep ≥4.5:1 vs white text), hover (lighter step), bright + lightest (links/highlights on dark). Hex alpha suffixes (`B3`, `40`, `26`, …) stay untouched — swap the base color only. Since 2026-11 VEGA Dark uses purple anchored on `#564592`; `*focusBorder/Outline` keys sit one step lighter (`#8572caB3`) because the deep anchor is nearly invisible as a focus ring on `#121314`. VEGA Light still uses the emerald scale (`#059669`/`#047857`/`#34D399`).
