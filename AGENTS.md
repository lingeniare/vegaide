# VS Code Agents Instructions

This file provides instructions for AI coding agents working with the VS Code codebase.

For detailed project overview, architecture, coding guidelines, and validation steps, see the [Copilot Instructions](.github/copilot-instructions.md).

## UI branding

The product is **VEGA IDE**. Every user-visible product name — window title, sign-in and setup dialogs, terms footers, walkthroughs, output channels, account/provider labels — must read `VEGA IDE`. Never write `GitHub Copilot`, `VEGA Code`, `VEGA Copilot`, `API VEGA`, `VEGA's`, or a bare `VEGA` as the product name in strings shown to users. Feature and plan names keep bare `Copilot` (`Copilot Pro`, `Copilot CLI`, `Copilot Edits`).

Technical identifiers are not UI and keep their upstream spelling: `github.copilot*` command/settings/extension ids, `GitHub.copilot-chat`, `provider.id: 'vega'`, file and log paths. When the chat output channel name changes, keep `product.defaultChatAgent.chatExtensionOutputId` in sync.

On a Russian UI brand names go through `withRuBrandNames`/`ruLabel` (`src/vs/platform/product/common/vegaBranding.ts`), where `VEGA IDE` renders as `ВЕГА Редактор`.

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
