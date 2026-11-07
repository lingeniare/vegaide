# VS Code Agents Instructions

This file provides instructions for AI coding agents working with the VS Code codebase.

For detailed project overview, architecture, coding guidelines, and validation steps, see the [Copilot Instructions](.github/copilot-instructions.md).

## UI branding

The product is **VEGA IDE**. Every user-visible product name — window title, sign-in and setup dialogs, terms footers, walkthroughs, output channels, account/provider labels — must read `VEGA IDE`. Never write `GitHub Copilot`, `VEGA Code`, `VEGA Copilot`, `API VEGA`, `VEGA's`, or a bare `VEGA` as the product name in strings shown to users. Feature and plan names keep bare `Copilot` (`Copilot Pro`, `Copilot CLI`, `Copilot Edits`).

Technical identifiers are not UI and keep their upstream spelling: `github.copilot*` command/settings/extension ids, `GitHub.copilot-chat`, `provider.id: 'vega'`, file and log paths. When the chat output channel name changes, keep `product.defaultChatAgent.chatExtensionOutputId` in sync.

On a Russian UI brand names go through `withRuBrandNames`/`ruLabel` (`src/vs/platform/product/common/vegaBranding.ts`), where `VEGA IDE` renders as `ВЕГА Редактор`.
