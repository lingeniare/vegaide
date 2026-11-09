/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { bufferToStream, VSBuffer } from '../../../../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../../../../base/common/cancellation.js';
import { IRequestContext } from '../../../../../../../../base/parts/request/common/request.js';
import { upcastPartial } from '../../../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../../../../platform/log/common/log.js';
import { IRequestService } from '../../../../../../../../platform/request/common/request.js';
import { AuthenticationSession, IAuthenticationService } from '../../../../../../../services/authentication/common/authentication.js';
import { ILanguageModelChatMetadata, ILanguageModelChatMetadataAndIdentifier } from '../../../../../common/languageModels.js';
import { formatVegaPrice, getVegaPricing, vegaPricingForModel, IVegaModelPricing } from '../../../../../browser/widget/input/modelPicker/modelPickerVegaPricing.js';

suite('modelPickerVegaPricing', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	let apiKeyCounter = 0;

	function model(id: string, identifier = `vega/${id}`): ILanguageModelChatMetadataAndIdentifier {
		return {
			identifier,
			metadata: upcastPartial<ILanguageModelChatMetadata>({ id, name: id, vendor: 'vega' }),
		};
	}

	function authenticationService(apiKey: string | undefined): IAuthenticationService {
		return upcastPartial<IAuthenticationService>({
			getSessions: async (providerId: string) => providerId === 'vega' && apiKey
				? [upcastPartial<AuthenticationSession>({ id: 'vega', accessToken: apiKey, account: upcastPartial<AuthenticationSession['account']>({ id: 'user', label: 'User' }), scopes: ['api'] })]
				: [],
		});
	}

	function requestService(handler: (url: string | undefined, authorization: string | string[] | undefined) => unknown): { service: IRequestService; calls: string[] } {
		const calls: string[] = [];
		const service = upcastPartial<IRequestService>({
			request: async options => {
				calls.push(options.url ?? '');
				return upcastPartial<IRequestContext>({
					res: { statusCode: 200, headers: {} },
					stream: bufferToStream(VSBuffer.fromString(JSON.stringify(handler(options.url, options.headers?.Authorization)))),
				});
			},
		});
		return { service, calls };
	}

	test('formatVegaPrice keeps whole amounts plain and small prices precise', () => {
		assert.deepStrictEqual([12.34, 0.5, 0.01234, 1500].map(value => formatVegaPrice(value, 'rub')), ['12.34 ₽', '0.5 ₽', '0.0123 ₽', '1500 ₽']);
		assert.deepStrictEqual([3, 0.075, 0.00075, 1500].map(value => formatVegaPrice(value, 'usd')), ['$3', '$0.075', '$0.00075', '$1500']);
	});

	test('vegaPricingForModel finds pricing by metadata id, prefixed identifier, or misses cleanly', () => {
		const pricing = new Map([['z-ai/glm-4.6', { promptPer1M: 30 }]]);
		assert.strictEqual(vegaPricingForModel(pricing, model('z-ai/glm-4.6'))?.promptPer1M, 30);
		assert.strictEqual(vegaPricingForModel(pricing, model('other', 'vega/z-ai/glm-4.6'))?.promptPer1M, 30);
		assert.strictEqual(vegaPricingForModel(pricing, model('unknown')), undefined);
		assert.strictEqual(vegaPricingForModel(undefined, model('z-ai/glm-4.6')), undefined);
	});

	test('vegaPricingForModel resolves agent-host selection ids, grouped bare slugs, and unique slug suffixes', () => {
		const pricing = new Map<string, IVegaModelPricing>([
			['openai/gpt-6.1-sol', { promptPer1M: 3.4 }],
			['anthropic/claude-opus-5.5', { promptPer1M: 6.8 }],
		]);
		// A Codex provider-qualified id, as both metadata.id and identifier carry it.
		assert.strictEqual(vegaPricingForModel(pricing, model('@provider=openai:gpt-6.1-sol', 'agent-host-codex:@provider=openai:gpt-6.1-sol'))?.promptPer1M, 3.4);
		// A proxy-routed selection's provider is no catalog vendor; the bare slug still pins it uniquely.
		assert.strictEqual(vegaPricingForModel(pricing, model('@provider=vscode-proxy:gpt-6.1-sol', 'agent-host-codex:@provider=vscode-proxy:gpt-6.1-sol'))?.promptPer1M, 3.4);
		// A Claude provider-qualified id joins the same way.
		assert.strictEqual(vegaPricingForModel(pricing, model('@provider=anthropic:claude-opus-5.5', 'agent-host-claude:@provider=anthropic:claude-opus-5.5'))?.promptPer1M, 6.8);
		// A bare slug joins its picker's group vendor.
		const bare = model('gpt-6.1-sol', 'agent-host-codex:gpt-6.1-sol');
		assert.strictEqual(vegaPricingForModel(pricing, { ...bare, metadata: { ...bare.metadata, modelGroup: { id: 'openai' } } })?.promptPer1M, 3.4);
		// An identifier's `vendor:` prefix peels off to the slug.
		assert.strictEqual(vegaPricingForModel(pricing, model('x', 'agent-host-copilot:gpt-6.1-sol'))?.promptPer1M, 3.4);
		// A slug two vendors share stays unknown rather than guessing a price.
		const ambiguous = new Map<string, IVegaModelPricing>([['a/x', { promptPer1M: 1 }], ['b/x', { promptPer1M: 2 }]]);
		assert.strictEqual(vegaPricingForModel(ambiguous, model('x')), undefined);
		// But the group vendor still disambiguates it.
		const grouped = model('x');
		assert.strictEqual(vegaPricingForModel(ambiguous, { ...grouped, metadata: { ...grouped.metadata, modelGroup: { id: 'b' } } })?.promptPer1M, 2);
	});

	test('getVegaPricing authorizes the ruble request and maps fields by model id', async () => {
		const apiKey = `sk-apivega-test-${++apiKeyCounter}`;
		const { service, calls } = requestService((_url, authorization) => {
			assert.strictEqual(authorization, `Bearer ${apiKey}`);
			return {
				data: [{
					model: 'z-ai/glm-4.6',
					prompt_rub_per_1m: 30.5,
					completion_rub_per_1m: 91.25,
					input_cache_read_rub_per_1m: 3.05,
					input_cache_write_rub_per_1m: 38.1,
					image_rub_per_1m: 10,
					request_rub: 0.25,
					image_rub: 4,
				}],
			};
		});
		const pricing = await getVegaPricing(authenticationService(apiKey), service, new NullLogService(), CancellationToken.None, 'rub');
		assert.ok(calls[0]?.startsWith('https://api.vega.chat/api/v1/pricing?'), calls[0]);
		assert.deepStrictEqual(pricing?.get('z-ai/glm-4.6'), {
			promptPer1M: 30.5, completionPer1M: 91.25, cacheReadPer1M: 3.05, cacheWritePer1M: 38.1, imagePer1M: 10, requestFee: 0.25, imageFee: 4,
		});
	});

	test('getVegaPricing reads the dollar fields the same catalog serves', async () => {
		const apiKey = `sk-apivega-test-${++apiKeyCounter}`;
		const { service, calls } = requestService(() => ({
			data: [{
				id: 'z-ai/glm-4.6',
				prompt_usd_per_1m: 30.5,
				completion_usd_per_1m: 91.25,
				cache_read_usd_per_1m: 0.031,
				cache_write_usd_per_1m: 0.38,
				image_usd_per_1m: null,
				request_usd: 0.00025,
				image_usd: 0.004,
				currency: 'RUB',
			}],
		}));
		const pricing = await getVegaPricing(authenticationService(apiKey), service, new NullLogService(), CancellationToken.None, 'usd');
		assert.ok(calls[0]?.startsWith('https://api.vega.chat/api/v1/pricing?'), calls[0]);
		assert.deepStrictEqual(pricing?.get('z-ai/glm-4.6'), {
			promptPer1M: 30.5, completionPer1M: 91.25, cacheReadPer1M: 0.031, cacheWritePer1M: 0.38, imagePer1M: undefined, requestFee: 0.00025, imageFee: 0.004,
		});
	});

	test('getVegaPricing resolves empty without a session and caches failures as non-fatal', async () => {
		assert.strictEqual(await getVegaPricing(authenticationService(undefined), requestService(() => assert.fail('no request expected')).service, new NullLogService(), CancellationToken.None), undefined);
		const apiKey = `sk-apivega-test-${++apiKeyCounter}`;
		const failing = upcastPartial<IRequestService>({ request: async () => { throw new Error('offline'); } });
		const empty = await getVegaPricing(authenticationService(apiKey), failing, new NullLogService(), CancellationToken.None);
		assert.strictEqual(empty?.size, 0);
	});
});
