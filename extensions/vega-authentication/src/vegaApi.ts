/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Thin client for the VEGA application-facing API (`api.vega.chat`).
 *
 * Auth model (see connect-app.md):
 *  1. RFC 8628 device flow mints a short-lived *session token* on the VEGA site.
 *  2. The session token is exchanged for an application-scoped API key
 *     (`sk-apivega-...`) via `POST /api/v1/keys/vegaide`.
 *  3. All application requests use `Authorization: Bearer <sk-apivega-...>`.
 *  4. Sign-out revokes the key via `POST /api/v1/keys/vegaide/revoke`.
 */

export const VEGA_API_ORIGIN = 'https://api.vega.chat';
export const VEGA_OPENAI_BASE = `${VEGA_API_ORIGIN}/api/v1`;

/** Registered application/client id for this product on the VEGA side. */
export const VEGA_CLIENT_ID = 'vegaide';

/** The only scope the application key is minted for. */
export const VEGA_SCOPE = 'api';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

/** Bounds every API call so a slow or unreachable api.vega.chat fails fast instead of freezing the sign-in UI. */
const REQUEST_TIMEOUT_MS = 15_000;

export class VegaApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string,
	) {
		super(message);
		this.name = 'VegaApiError';
	}
}

async function postJson<T>(url: string, body: unknown, bearer?: string): Promise<T> {
	const response = await fetch(url, {
		method: 'POST',
		headers: { ...JSON_HEADERS, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		let code: string | undefined;
		let message = `${response.status} ${response.statusText}`;
		try {
			const data = await response.json() as { error?: string | { code?: string; message?: string }; error_description?: string; message?: string };
			if (typeof data?.error === 'object' && data.error) {
				code = data.error.code;
				message = data.error.message ?? message;
			} else {
				code = typeof data?.error === 'string' ? data.error : code;
				message = data?.error_description ?? data?.message ?? (typeof data?.error === 'string' ? data.error : message);
			}
		} catch {
			// keep the HTTP status message
		}
		throw new VegaApiError(message, response.status, code);
	}
	return response.json() as Promise<T>;
}

export interface IVegaDeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete?: string;
	/** Seconds until the code expires (server-side TTL is ~10 minutes). */
	expires_in: number;
	/** Minimum poll interval in seconds. */
	interval: number;
}

export function requestDeviceCode(): Promise<IVegaDeviceCodeResponse> {
	return postJson(`${VEGA_API_ORIGIN}/api/auth/device/code`, {
		client_id: VEGA_CLIENT_ID,
		scope: VEGA_SCOPE,
	});
}

export type VegaDeviceTokenResult =
	| { readonly kind: 'pending' }
	| { readonly kind: 'slowDown' }
	| { readonly kind: 'denied' }
	| { readonly kind: 'expired' }
	| { readonly kind: 'success'; readonly accessToken: string };

/**
 * Single device-token poll. The caller owns the loop so it can honour
 * `interval`, `expires_in` and cancellation.
 */
export async function pollDeviceToken(deviceCode: string): Promise<VegaDeviceTokenResult> {
	const response = await fetch(`${VEGA_API_ORIGIN}/api/auth/device/token`, {
		method: 'POST',
		headers: JSON_HEADERS,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		body: JSON.stringify({
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			device_code: deviceCode,
			client_id: VEGA_CLIENT_ID,
		}),
	});
	const data = await response.json() as { access_token?: string; error?: string };
	if (response.ok && typeof data.access_token === 'string' && data.access_token) {
		return { kind: 'success', accessToken: data.access_token };
	}
	switch (data?.error) {
		case 'authorization_pending':
			return { kind: 'pending' };
		case 'slow_down':
			return { kind: 'slowDown' };
		case 'access_denied':
			return { kind: 'denied' };
		case 'expired_token':
			return { kind: 'expired' };
		default:
			throw new VegaApiError(data?.error ?? `${response.status} ${response.statusText}`, response.status);
	}
}

export interface IVegaAppKey {
	id: string;
	key: string;
}

/**
 * Mints (or rotates) the `vegaide` application key for the authenticated
 * user. Must be authorized with the *session token* from the device flow,
 * not an `sk-apivega-...` key.
 */
export function createAppKey(sessionToken: string): Promise<IVegaAppKey> {
	return postJson(`${VEGA_API_ORIGIN}/api/v1/keys/${VEGA_CLIENT_ID}`, {}, sessionToken);
}

/** Revokes the application key. Authorized with the key itself (self-revoke). */
export async function revokeAppKey(apiKey: string): Promise<void> {
	await postJson(`${VEGA_API_ORIGIN}/api/v1/keys/${VEGA_CLIENT_ID}/revoke`, {}, apiKey);
}

export interface IVegaAccountInfo {
	id: string;
	label: string;
}

/** Resolves a displayable account identity for the signed-in user. */
export async function getAccountInfo(apiKey: string): Promise<IVegaAccountInfo> {
	const response = await fetch(`${VEGA_API_ORIGIN}/api/v1/account`, {
		headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new VegaApiError(`${response.status} ${response.statusText}`, response.status);
	}
	const data = await response.json() as { id?: string; user_id?: string; email?: string; name?: string };
	return {
		id: data.user_id ?? data.id ?? VEGA_CLIENT_ID,
		label: data.email ?? data.name ?? 'VEGA IDE',
	};
}
