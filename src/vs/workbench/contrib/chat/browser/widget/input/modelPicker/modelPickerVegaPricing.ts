/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../../../../base/common/cancellation.js';
import { ILogService } from '../../../../../../../platform/log/common/log.js';
import { IRequestService, asJson, isSuccess } from '../../../../../../../platform/request/common/request.js';
import { IAuthenticationService } from '../../../../../../services/authentication/common/authentication.js';
import { ILanguageModelChatMetadataAndIdentifier } from '../../../../common/languageModels.js';

/** The currency VEGA prices are shown in: rubles for the Russian UI, dollars otherwise. */
export type VegaPricingCurrency = 'rub' | 'usd';

/** Prices for one model, in the currency the catalog was requested in. */
export interface IVegaModelPricing {
	/** Currency per 1M prompt tokens. */
	readonly promptPer1M?: number;
	/** Currency per 1M completion tokens. */
	readonly completionPer1M?: number;
	/** Currency per 1M image tokens. */
	readonly imagePer1M?: number;
	/** Flat fee per request. */
	readonly requestFee?: number;
	/** Flat fee per generated image. */
	readonly imageFee?: number;
}

const VEGA_PRICING_URL = 'https://api.vega.chat/api/v1/pricing';
const VEGA_PRICING_PAGE_LIMIT = 200;
const VEGA_PRICING_MAX_PAGES = 10;

/** In-flight and settled lookups, deduplicated per API key and currency. */
const pricingCache = new Map<string, Promise<ReadonlyMap<string, IVegaModelPricing>>>();

/**
 * Loads the VEGA pricing catalog for the signed-in session, once per API key.
 * `/pricing` serves every entry with both `*_rub_*` and `*_usd_*` fields, so the
 * currency picks which side to read. Resolves to `undefined` when there is no
 * VEGA session or the request fails; failures are not cached so the next open retries.
 */
export async function getVegaPricing(
	authenticationService: IAuthenticationService,
	requestService: IRequestService,
	logService: ILogService,
	token: CancellationToken,
	currency: VegaPricingCurrency = 'rub',
): Promise<ReadonlyMap<string, IVegaModelPricing> | undefined> {
	const sessions = await authenticationService.getSessions('vega').catch(() => []);
	const apiKey = sessions[0]?.accessToken;
	if (!apiKey) {
		return undefined;
	}
	const cacheKey = `${apiKey}:${currency}`;
	let pending = pricingCache.get(cacheKey);
	if (!pending) {
		pending = fetchVegaPricing(requestService, apiKey, token, currency).catch(error => {
			pricingCache.delete(cacheKey);
			logService.warn(`[VegaPricing] Failed to load model pricing: ${error instanceof Error ? error.message : String(error)}`);
			return new Map<string, IVegaModelPricing>();
		});
		pricingCache.set(cacheKey, pending);
	}
	return pending;
}

async function fetchVegaPricing(
	requestService: IRequestService,
	apiKey: string,
	token: CancellationToken,
	currency: VegaPricingCurrency,
): Promise<ReadonlyMap<string, IVegaModelPricing>> {
	const pricing = new Map<string, IVegaModelPricing>();
	for (let page = 1; page <= VEGA_PRICING_MAX_PAGES; page++) {
		const response = await requestService.request({
			type: 'GET',
			url: `${VEGA_PRICING_URL}?limit=${VEGA_PRICING_PAGE_LIMIT}&page=${page}`,
			headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
			callSite: 'chat.modelPicker.vegaPricing',
		}, token);
		if (!isSuccess(response)) {
			throw new Error(`GET ${VEGA_PRICING_URL} failed with status ${response.res.statusCode}`);
		}
		const entries = parsePricingEntries(await asJson(response), currency);
		for (const [id, entry] of entries) {
			pricing.set(id, entry);
		}
		if (entries.size < VEGA_PRICING_PAGE_LIMIT) {
			break;
		}
	}
	return pricing;
}

/**
 * Reads whatever array the pricing payload wraps its entries in, keeping the side
 * matching the requested currency. `null` fields, e.g. TTS models' completion
 * price, leave their row out.
 */
function parsePricingEntries(json: unknown, currency: VegaPricingCurrency): Map<string, IVegaModelPricing> {
	const entries = new Map<string, IVegaModelPricing>();
	const container = Array.isArray(json)
		? json
		: isRecord(json) ? (asArray(json.data) ?? asArray(json.models) ?? asArray(json.items) ?? asArray(json.pricing) ?? []) : [];
	for (const raw of container) {
		if (!isRecord(raw)) {
			continue;
		}
		const id = asString(raw.id) ?? asString(raw.model) ?? asString(raw.model_id) ?? asString(raw.slug);
		if (!id) {
			continue;
		}
		entries.set(id.toLowerCase(), currency === 'rub' ? {
			promptPer1M: asNumber(raw.prompt_rub_per_1m),
			completionPer1M: asNumber(raw.completion_rub_per_1m),
			imagePer1M: asNumber(raw.image_rub_per_1m),
			requestFee: asNumber(raw.request_rub),
			imageFee: asNumber(raw.image_rub),
		} : {
			promptPer1M: asNumber(raw.prompt_usd_per_1m),
			completionPer1M: asNumber(raw.completion_usd_per_1m),
			imagePer1M: asNumber(raw.image_usd_per_1m),
			requestFee: asNumber(raw.request_usd),
			imageFee: asNumber(raw.image_usd),
		});
	}
	return entries;
}

/**
 * Finds a model's VEGA pricing. Model identifiers are OpenRouter ids such as
 * `z-ai/glm-4.6`; rows may also carry a provider prefix the catalog does not
 * use, so progressively shorter tail segments are tried as well.
 */
export function vegaPricingForModel(
	pricing: ReadonlyMap<string, IVegaModelPricing> | undefined,
	model: ILanguageModelChatMetadataAndIdentifier,
): IVegaModelPricing | undefined {
	if (!pricing?.size) {
		return undefined;
	}
	const candidates = [model.metadata.id, model.identifier, model.metadata.modelGroup?.id];
	for (const candidate of candidates) {
		for (let id = candidate?.toLowerCase(); id; id = id.includes('/') ? id.slice(id.indexOf('/') + 1) : '') {
			const hit = pricing.get(id);
			if (hit) {
				return hit;
			}
		}
	}
	return undefined;
}

/** Formats one price row, keeping whole amounts plain and small prices readable. */
export function formatVegaPrice(value: number, currency: VegaPricingCurrency): string {
	const rounded = Math.abs(value) >= 1 ? Math.round(value * 100) / 100 : Number(value.toPrecision(3));
	return currency === 'rub' ? `${rounded} ₽` : `$${rounded}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function asArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	const parsed = typeof value === 'string' ? Number(value) : value;
	return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}
