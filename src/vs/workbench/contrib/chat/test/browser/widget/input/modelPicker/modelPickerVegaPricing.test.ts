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
import { formatVegaPrice, getVegaPricing, vegaPricingForModel } from '../../../../../browser/widget/input/modelPicker/modelPickerVegaPricing.js';

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

	test('getVegaPricing authorizes the ruble request and maps fields by model id', async () => {
		const apiKey = `sk-apivega-test-${++apiKeyCounter}`;
		const { service, calls } = requestService((_url, authorization) => {
			assert.strictEqual(authorization, `Bearer ${apiKey}`);
			return {
				data: [{
					model: 'z-ai/glm-4.6',
					prompt_rub_per_1m: 30.5,
					completion_rub_per_1m: 91.25,
					image_rub_per_1m: 10,
					request_rub: 0.25,
					image_rub: 4,
				}],
			};
		});
		const pricing = await getVegaPricing(authenticationService(apiKey), service, new NullLogService(), CancellationToken.None, 'rub');
		assert.ok(calls[0]?.startsWith('https://api.vega.chat/api/v1/pricing?'), calls[0]);
		assert.deepStrictEqual(pricing?.get('z-ai/glm-4.6'), {
			promptPer1M: 30.5, completionPer1M: 91.25, imagePer1M: 10, requestFee: 0.25, imageFee: 4,
		});
	});

	test('getVegaPricing reads the dollar fields the same catalog serves', async () => {
		const apiKey = `sk-apivega-test-${++apiKeyCounter}`;
		const { service, calls } = requestService(() => ({
			data: [{
				id: 'z-ai/glm-4.6',
				prompt_usd_per_1m: 30.5,
				completion_usd_per_1m: 91.25,
				image_usd_per_1m: null,
				request_usd: 0.00025,
				image_usd: 0.004,
				currency: 'RUB',
			}],
		}));
		const pricing = await getVegaPricing(authenticationService(apiKey), service, new NullLogService(), CancellationToken.None, 'usd');
		assert.ok(calls[0]?.startsWith('https://api.vega.chat/api/v1/pricing?'), calls[0]);
		assert.deepStrictEqual(pricing?.get('z-ai/glm-4.6'), {
			promptPer1M: 30.5, completionPer1M: 91.25, imagePer1M: undefined, requestFee: 0.00025, imageFee: 0.004,
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
