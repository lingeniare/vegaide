# VS Code Agents Instructions

This file provides instructions for AI coding agents working with the VS Code codebase.

For detailed project overview, architecture, coding guidelines, and validation steps, see the [Copilot Instructions](.github/copilot-instructions.md).

## UI branding

The product is **VEGA IDE**. Every user-visible product name — window title, sign-in and setup dialogs, terms footers, walkthroughs, output channels, account/provider labels — must read `VEGA IDE`. Never write `GitHub Copilot`, `VEGA Code`, `VEGA Copilot`, `API VEGA`, `VEGA's`, or a bare `VEGA` as the product name in strings shown to users. Feature and plan names keep bare `Copilot` (`Copilot Pro`, `Copilot CLI`, `Copilot Edits`).

Technical identifiers are not UI and keep their upstream spelling: `github.copilot*` command/settings/extension ids, `GitHub.copilot-chat`, `provider.id: 'vega'`, file and log paths. When the chat output channel name changes, keep `product.defaultChatAgent.chatExtensionOutputId` in sync.

On a Russian UI brand names go through `withRuBrandNames`/`ruLabel` (`src/vs/platform/product/common/vegaBranding.ts`), where `VEGA IDE` renders as `ВЕГА Редактор`.

### Brand-rename pitfalls (learned 2026-11)

- **Feature/plan names map to bare `Copilot`, never `VEGA IDE`**: upstream `GitHub Copilot CLI` → `Copilot CLI`, `GitHub Copilot Pro/Free/Business/Enterprise` → `Copilot …`, `Copilot Edits`, `Copilot subscription/plan/tokens`. Only the product itself is `VEGA IDE`. A blind `GitHub Copilot` → `VEGA IDE` rename produces wrong strings like "VEGA IDE CLI is a separate GitHub product".
- **Auth provider ids are split**: `vega` = VEGA sign-in (`extensions/vega-authentication`), `github`/`github-enterprise` = GitHub.com git/scm auth (still live for issues, credentials, GitHub-coupled voice/STT). Welcome/sign-in flows key on `getSessions('vega')`; GitHub-service callers keep `'github'`. Settings-sync handoff in `workbench.ts` still expects `'github'` — open gap if VEGA settings sync is wanted.
- **File-format signatures are not branding**: `copilot_shim` legacy detection (`legacy.rs`) matches upstream-written file markers verbatim (e.g. `windows github copilot cli bootstrapper`). Renaming markers in fixtures/docs breaks `positive_fixtures` tests — fixtures must keep upstream bytes.
- **Codicon glyphs carry semantics**: `[class*="codicon-copilot"]` matches status variants (`copilot-warning`, `-error`, `-snooze`, …); the VEGA star mask in `style.css` excludes them via `:not()` so status icons keep meaning.
- **`RU_BRAND_NAMES` keys must stay unique** — duplicate `from` entries are dead code.
- **Locale overlays drift**: `extensions/copilot/package.nls.ru.json` is a hand-maintained translation of `package.nls.json` — every EN rename needs the RU pass too ("VEGA IDE"→"ВЕГА Редактор", feature names stay Latin "Copilot …").
- **VEGA star lives in one CSS var**: `--vega-star-icon` (`:root` in `src/vs/workbench/browser/media/style.css`) holds the star data-URI (rays shortened ~20% vs the original `y 12–748`, `stroke-width 24`). Reuse it via `mask-image: var(--vega-star-icon)` instead of duplicating the SVG — it already drives codicon-copilot glyphs, the chat-setup dialog header icon (`chatSetup.css`), the "Continue with" button icon, and the sessions loading overlay (`sessionsSetUp.css`).
- **Sign-in dialogs carry no legal footer**: `ChatSetup.showDialog` passes `footer: ''` whenever `offersProviderSignIn` is true (terms are accepted in the provider auth window). `ChatSetupDialog` also adds `chat-setup-empty-detail` — its `detail: ' '` is only a marker to force the title markup; CSS hides the placeholder so the title sits directly above the button.
- **Generated files**: `build/lib/policies/policyData.jsonc` is produced by `npm run export-policy-data` from runtime `localize()` strings — edit the source strings, keep the generated file in sync (its `--check` mode diffs them).
- **Repo tooling exe names**: `.agents/skills/launch` cleanup matches the built exe name (`VEGA IDE.exe` = `product.nameShort`), not upstream `Code - OSS.exe`.

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

## Link protection trusted domains

`product.json` `linkProtectionTrustedDomains` ships VEGA/doc domains (`api.vega.chat`, `vega.codes`, `context7.com`, `deepwiki.com`) so the "Trust domain" quick-pick never appears for them. The same list is duplicated in the web-dev templates `build/vite/workbench-vite.html` and `build/rspack/workbench-rspack.html` (embedded `productConfiguration`) — keep them in sync. Entries have no subdomain matching: `https://api.vega.chat` covers any path on that host only; use `https://*.vega.chat` for all subdomains.
