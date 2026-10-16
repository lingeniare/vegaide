/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtendedTokenInfo } from './copilotToken';
import { nowSeconds } from './copilotTokenManager';

/** OpenAI-compatible API base served by the VEGA gateway. */
export const VEGA_API_BASE_URL = 'https://api.vega.chat/api/v1';

/**
 * Server-side API key format minted by VEGA (`POST /api/v1/keys/<app>`).
 */
export const VEGA_API_KEY_PREFIX = 'sk-apivega-';

/**
 * True when a session/token is a VEGA application key rather than a GitHub
 * OAuth token. GitHub REST consumers must treat such sessions as "not
 * signed in" — the key must never be presented to GitHub hosts.
 */
export function isVegaAuthSession(session: { accessToken?: string } | undefined | null): boolean {
	return !!session?.accessToken?.startsWith(VEGA_API_KEY_PREFIX);
}

/**
 * The `sk-apivega-...` application key is long-lived; a one-day envelope
 * lifetime keeps the regular refresh cadence without implying real expiry.
 * Actual revocation is surfaced by 401s on API calls.
 */
const VEGA_TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

/**
 * Builds a Copilot-compatible token envelope from a VEGA authentication
 * session. The session's access token *is* the `sk-apivega-...`
 * application key — VEGA does not mint short-lived session tokens, so the
 * envelope is static and simply routes the OpenAI-compatible API base at
 * `api.vega.chat`.
 */
export function createVegaTokenInfo(session: { accessToken: string; account: { label: string } }): ExtendedTokenInfo {
	const now = nowSeconds();
	return {
		token: session.accessToken,
		expires_at: now + VEGA_TOKEN_LIFETIME_SECONDS,
		refresh_in: VEGA_TOKEN_LIFETIME_SECONDS,
		sku: 'vega',
		individual: true,
		blackbird_clientside_indexing: false,
		code_quote_enabled: false,
		code_review_enabled: false,
		codesearch: false,
		copilotignore_enabled: false,
		public_suggestions: 'disabled',
		telemetry: 'disabled',
		endpoints: {
			api: VEGA_API_BASE_URL,
			telemetry: VEGA_API_BASE_URL,
		},
		username: session.account.label,
		isVscodeTeamMember: false,
		copilot_plan: 'vega',
		organization_login_list: [],
	};
}
