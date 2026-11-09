/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { language } from '../../../base/common/platform.js';

/**
 * Russian spellings of the VEGA product names. The bundled language packs
 * predate the fork's branding and `product.json` carries no translations, so
 * on a Russian UI the English spellings are swapped for these. Longest names
 * come first so a substring replacement cannot split a longer name.
 */
const RU_BRAND_NAMES: ReadonlyArray<readonly [from: string, to: string]> = [
	['VEGA IDE', 'ВЕГА Редактор'],
	['VEGA Code', 'ВЕГА Редактор'],
	['VEGA', 'ВЕГА'],
];

/**
 * Replaces the VEGA brand names inside `text` with their Russian spellings
 * on a Russian UI; every other locale gets the text back unchanged.
 */
export function withRuBrandNames(text: string): string {
	if (language !== 'ru') {
		return text;
	}
	for (const [from, to] of RU_BRAND_NAMES) {
		text = text.replaceAll(from, to);
	}
	return text;
}

/**
 * Picks the Russian copy on a Russian UI; every other locale keeps the
 * localized default. Same approach as `pricingLabel` in the model picker:
 * the language packs predate the fork's strings, so `localize` alone would
 * leave them English.
 */
export function ruLabel(localized: string, russian: string): string {
	return language === 'ru' ? russian : localized;
}
