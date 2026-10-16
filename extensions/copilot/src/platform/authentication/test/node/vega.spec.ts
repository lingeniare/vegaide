/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from 'vitest';
import { createVegaTokenInfo, isVegaAuthSession, VEGA_API_BASE_URL, VEGA_API_KEY_PREFIX } from '../../common/vega';

describe('isVegaAuthSession', () => {
	test('detects VEGA application keys', () => {
		expect(isVegaAuthSession({ accessToken: `${VEGA_API_KEY_PREFIX}abc123` })).toBe(true);
	});

	test('rejects GitHub tokens and missing sessions', () => {
		expect(isVegaAuthSession({ accessToken: 'gho_abc123' })).toBe(false);
		expect(isVegaAuthSession({ accessToken: 'ghu_abc123' })).toBe(false);
		expect(isVegaAuthSession({ accessToken: '' })).toBe(false);
		expect(isVegaAuthSession({})).toBe(false);
		expect(isVegaAuthSession(undefined)).toBe(false);
		expect(isVegaAuthSession(null)).toBe(false);
	});
});

describe('createVegaTokenInfo', () => {
	const session = { accessToken: `${VEGA_API_KEY_PREFIX}key-1`, account: { label: 'vega-user' } };

	test('routes model traffic at the VEGA API base', () => {
		const info = createVegaTokenInfo(session);
		expect(info.token).toBe(session.accessToken);
		expect(info.endpoints?.api).toBe(VEGA_API_BASE_URL);
		expect(info.sku).toBe('vega');
		expect(info.copilot_plan).toBe('vega');
		expect(info.username).toBe('vega-user');
	});

	test('envelope is valid without GitHub-only features', () => {
		const info = createVegaTokenInfo(session);
		expect(info.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
		expect(info.refresh_in).toBeGreaterThan(0);
		expect(info.individual).toBe(true);
		expect(info.organization_login_list).toEqual([]);
	});
});
