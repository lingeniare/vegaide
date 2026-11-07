/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VEGA_API_ORIGIN, VEGA_CLIENT_ID, VEGA_SCOPE, createAppKey, getAccountInfo, pollDeviceToken, requestDeviceCode, revokeAppKey } from './vegaApi';

const SESSIONS_STORAGE_KEY = `${VEGA_CLIENT_ID}.sessions`;

// The language packs predate the fork's branding, so on a Russian UI these
// strings are taken from the hardcoded Russian copy; `vscode.l10n.t` still
// serves every other locale.
const isRussian = vscode.env.language === 'ru';
const ruT = (en: string, ru: string): string => isRussian ? ru : vscode.l10n.t(en);

/**
 * Authentication provider for VEGA (`api.vega.chat`).
 *
 * Sign-in runs the RFC 8628 device flow on the VEGA site and exchanges the
 * resulting session token for an application-scoped API key
 * (`sk-apivega-...`). The API key — not an OAuth token — is what is stored
 * as the session `accessToken`, and it is what callers send as
 * `Authorization: Bearer` against `https://api.vega.chat/api/v1`.
 *
 * The key is application-scoped, so scope matching is lenient by design:
 * a stored session satisfies any scope request, and the canonical scope
 * `api` is always recorded on the session so product-level scope matching
 * (`defaultChatAgent.providerScopes`) keeps working.
 */
class VegaAuthenticationProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	private _sessionsPromise: Promise<vscode.AuthenticationSession[]>;
	private readonly _disposable: vscode.Disposable;

	constructor(private readonly _context: vscode.ExtensionContext, private readonly _logger: vscode.LogOutputChannel) {
		this._sessionsPromise = this._loadSessions();
		this._disposable = vscode.Disposable.from(
			this._onDidChangeSessions,
			this._context.secrets.onDidChange(e => {
				if (e.key === SESSIONS_STORAGE_KEY) {
					this._sessionsPromise = this._loadSessions();
				}
			}),
		);
	}

	dispose(): void {
		this._disposable.dispose();
	}

	private async _loadSessions(): Promise<vscode.AuthenticationSession[]> {
		const raw = await this._context.secrets.get(SESSIONS_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		try {
			const sessions = JSON.parse(raw) as vscode.AuthenticationSession[];
			return Array.isArray(sessions) ? sessions : [];
		} catch {
			this._logger.warn('Stored VEGA IDE sessions were corrupt, clearing them.');
			await this._context.secrets.delete(SESSIONS_STORAGE_KEY);
			return [];
		}
	}

	private async _storeSessions(sessions: vscode.AuthenticationSession[]): Promise<void> {
		if (sessions.length) {
			await this._context.secrets.store(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
		} else {
			await this._context.secrets.delete(SESSIONS_STORAGE_KEY);
		}
		this._sessionsPromise = Promise.resolve(sessions);
	}

	async getSessions(_scopes: readonly string[] | undefined, options?: vscode.AuthenticationProviderSessionOptions): Promise<vscode.AuthenticationSession[]> {
		const sessions = await this._sessionsPromise;
		if (options?.account) {
			return sessions.filter(session => session.account.id === options.account!.id || session.account.label === options.account!.label);
		}
		// The stored credential is an application key that covers the whole
		// VEGA API surface; any scope request is satisfied by it.
		return [...sessions];
	}

	async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		const mergedScopes = [...new Set([VEGA_SCOPE, ...scopes])];

		const existing = await this._sessionsPromise;
		if (existing.length) {
			const session = existing[0];
			if (!mergedScopes.every(scope => session.scopes.includes(scope))) {
				const updated = { ...session, scopes: mergedScopes };
				await this._storeSessions([updated]);
				this._onDidChangeSessions.fire({ added: [], removed: [], changed: [updated] });
				return updated;
			}
			return session;
		}

		this._logger.info('Starting VEGA IDE device flow sign-in...');
		const device = await requestDeviceCode();

		const button = ruT('Copy & Continue to VEGA IDE', 'Скопировать и перейти в ВЕГА Редактор');
		const selection = await vscode.window.showInformationMessage(
			isRussian ? `Ваш код: ${device.user_code}` : vscode.l10n.t('Your code: {0}', device.user_code),
			{
				modal: true,
				detail: ruT('To finish signing in, open VEGA IDE and enter this one-time code.', 'Чтобы завершить вход, откройте ВЕГА Редактор и введите этот одноразовый код.'),
			},
			button,
		);
		if (selection !== button) {
			throw new Error('User cancelled');
		}

		await vscode.env.clipboard.writeText(device.user_code);
		const verification = device.verification_uri_complete ?? device.verification_uri ?? `${VEGA_API_ORIGIN}/device`;
		await vscode.env.openExternal(vscode.Uri.parse(verification));

		const sessionToken = await this._pollForSessionToken(device);
		const appKey = await createAppKey(sessionToken);
		const account = await this._resolveAccountLabel(appKey.key);

		const session: vscode.AuthenticationSession = {
			id: `${VEGA_CLIENT_ID}:${appKey.id}`,
			accessToken: appKey.key,
			account,
			scopes: mergedScopes,
		};
		await this._storeSessions([session]);
		this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
		this._logger.info('VEGA IDE sign-in completed.');
		return session;
	}

	async removeSession(sessionId: string): Promise<void> {
		const sessions = await this._sessionsPromise;
		const session = sessions.find(candidate => candidate.id === sessionId);
		if (!session) {
			return;
		}
		try {
			await revokeAppKey(session.accessToken);
		} catch (error) {
			// The key may already be revoked server-side; local sign-out proceeds regardless.
			this._logger.warn(`Failed to revoke the VEGA IDE application key: ${error instanceof Error ? error.message : String(error)}`);
		}
		const remaining = sessions.filter(candidate => candidate.id !== sessionId);
		await this._storeSessions(remaining);
		this._onDidChangeSessions.fire({ added: [], removed: [session], changed: [] });
		this._logger.info('VEGA IDE session removed.');
	}

	private async _pollForSessionToken(device: { device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }): Promise<string> {
		return vscode.window.withProgress<string>({
			location: vscode.ProgressLocation.Notification,
			cancellable: true,
			title: isRussian
				? `Ожидание входа в ВЕГА Редактор… Введите код ${device.user_code} на ${device.verification_uri}`
				: vscode.l10n.t('Waiting for VEGA IDE sign-in… Enter code {0} at {1}', device.user_code, device.verification_uri),
		}, async (_progress, token) => {
			let intervalMs = Math.max(device.interval, 1) * 1000;
			const deadline = Date.now() + device.expires_in * 1000;
			while (Date.now() < deadline) {
				if (token.isCancellationRequested) {
					throw new Error('User cancelled');
				}
				await new Promise(resolve => setTimeout(resolve, intervalMs));
				if (token.isCancellationRequested) {
					throw new Error('User cancelled');
				}
				const result = await pollDeviceToken(device.device_code);
				switch (result.kind) {
					case 'pending':
						continue;
					case 'slowDown':
						intervalMs += 5000;
						continue;
					case 'denied':
						throw new Error(ruT('The sign-in request was declined on VEGA IDE.', 'Запрос на вход отклонён в ВЕГА Редактор.'));
					case 'expired':
						throw new Error(ruT('The VEGA IDE sign-in code expired. Please try again.', 'Срок действия кода входа ВЕГА Редактор истёк. Попробуйте ещё раз.'));
					case 'success':
						return result.accessToken;
				}
			}
			throw new Error(ruT('The VEGA IDE sign-in code expired. Please try again.', 'Срок действия кода входа ВЕГА Редактор истёк. Попробуйте ещё раз.'));
		});
	}

	private async _resolveAccountLabel(apiKey: string): Promise<vscode.AuthenticationSessionAccountInformation> {
		try {
			const account = await getAccountInfo(apiKey);
			return { id: account.id, label: account.label === 'VEGA' ? (isRussian ? 'ВЕГА Редактор' : 'VEGA IDE') : account.label };
		} catch (error) {
			this._logger.warn(`Failed to resolve the VEGA IDE account label: ${error instanceof Error ? error.message : String(error)}`);
			return { id: VEGA_CLIENT_ID, label: isRussian ? 'ВЕГА Редактор' : 'VEGA IDE' };
		}
	}
}

const CONTEXT7_MCP_URL = 'https://mcp.context7.com/mcp';

/**
 * Definition provider for the built-in Context7 documentation server
 * (`io.github.upstash/context7`). The remote HTTP endpoint works without
 * credentials on a rate-limited tier; when a `CONTEXT7_API_KEY` environment
 * variable is present it is attached as a bearer token when the server starts.
 */
class Context7McpDefinitionProvider implements vscode.McpServerDefinitionProvider<vscode.McpHttpServerDefinition> {
	provideMcpServerDefinitions(): vscode.McpHttpServerDefinition[] {
		return [new vscode.McpHttpServerDefinition('Context7', vscode.Uri.parse(CONTEXT7_MCP_URL))];
	}

	resolveMcpServerDefinition(server: vscode.McpHttpServerDefinition): vscode.McpHttpServerDefinition {
		const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
		if (env?.CONTEXT7_API_KEY) {
			server.headers['Authorization'] = `Bearer ${env.CONTEXT7_API_KEY}`;
		}
		return server;
	}
}

export function activate(context: vscode.ExtensionContext) {
	const logger = vscode.window.createOutputChannel(isRussian ? 'Аутентификация VEGA IDE' : 'VEGA IDE Authentication', { log: true });
	context.subscriptions.push(logger);

	const provider = new VegaAuthenticationProvider(context, logger);
	context.subscriptions.push(provider);
	context.subscriptions.push(vscode.authentication.registerAuthenticationProvider('vega', isRussian ? 'ВЕГА Редактор' : 'VEGA IDE', provider, {
		supportsMultipleAccounts: false,
		supportedAuthorizationServers: [vscode.Uri.parse(VEGA_API_ORIGIN)],
	}));
	context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider('context7', new Context7McpDefinitionProvider()));
}
