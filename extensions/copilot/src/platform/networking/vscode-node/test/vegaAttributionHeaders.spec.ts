/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { DefaultsOnlyConfigurationService } from '../../../configuration/common/defaultsOnlyConfigurationService';
import { InMemoryConfigurationService } from '../../../configuration/test/common/inMemoryConfigurationService';
import { FakeHeaders } from '../../../test/node/fetcher';
import { TestLogService } from '../../../testing/common/testLogService';
import { FetchOptions, IAbortController, PaginationOptions, Response } from '../../common/fetcherService';
import { IFetcher } from '../../common/networking';
import { FetcherService } from '../fetcherServiceImpl';

describe('FetcherService VEGA attribution headers', () => {

	let capturedOptions: FetchOptions | undefined;

	function createCapturingFetcher(): IFetcher {
		return {
			getUserAgentLibrary: () => 'test',
			fetch: async (_url: string, options: FetchOptions) => {
				capturedOptions = options;
				return Response.fromText(200, 'OK', new FakeHeaders(), '{}', 'test-stub');
			},
			fetchWithPagination: async <T>(_baseUrl: string, _options: PaginationOptions<T>): Promise<T[]> => {
				throw new Error('Method not implemented.');
			},
			disconnectAll: async () => { },
			makeAbortController: () => ({ signal: new AbortController().signal, abort: () => { } }) as IAbortController,
			isAbortError: () => false,
			isInternetDisconnectedError: () => false,
			isFetcherError: () => false,
			isNetworkProcessCrashedError: () => false,
			getUserMessageForFetcherError: () => 'error',
		};
	}

	function createFetcherService(): FetcherService {
		return new FetcherService(
			createCapturingFetcher(),
			new TestLogService(),
			{ machineId: '', sessionId: '', vscodeVersion: '', getName: () => 'test', getVersion: () => '0.0.0', getBuildType: () => 'development' as any } as any,
			new InMemoryConfigurationService(new DefaultsOnlyConfigurationService()),
			{ globalStorageUri: undefined } as any,
		);
	}

	const fetchOptions: FetchOptions = { callSite: 'test', method: 'GET', headers: { Authorization: 'Bearer sk-apivega-test' } };

	it('adds OpenRouter app attribution headers to api.vega.chat requests', async () => {
		const service = createFetcherService();

		await service.fetch('https://api.vega.chat/api/v1/chat/completions', { ...fetchOptions });

		expect(capturedOptions?.headers?.['HTTP-Referer']).toBe('https://api.vega.chat');
		expect(capturedOptions?.headers?.['X-OpenRouter-Title']).toBe('VEGA');
		expect(capturedOptions?.headers?.['X-OpenRouter-Categories']).toBe('general-chat');
		expect(capturedOptions?.headers?.Authorization).toBe('Bearer sk-apivega-test');
	});

	it('does not add attribution headers to non-VEGA requests', async () => {
		const service = createFetcherService();

		await service.fetch('https://api.githubcopilot.com/models', { ...fetchOptions });

		expect(capturedOptions?.headers?.['HTTP-Referer']).toBeUndefined();
		expect(capturedOptions?.headers?.['X-OpenRouter-Title']).toBeUndefined();
		expect(capturedOptions?.headers?.['X-OpenRouter-Categories']).toBeUndefined();
	});

	it('caller-supplied headers win over VEGA attribution defaults', async () => {
		const service = createFetcherService();

		await service.fetch('https://api.vega.chat/api/v1/models', {
			...fetchOptions,
			headers: { 'HTTP-Referer': 'https://custom.example', 'X-OpenRouter-Title': 'Custom' },
		});

		expect(capturedOptions?.headers?.['HTTP-Referer']).toBe('https://custom.example');
		expect(capturedOptions?.headers?.['X-OpenRouter-Title']).toBe('Custom');
		expect(capturedOptions?.headers?.['X-OpenRouter-Categories']).toBe('general-chat');
	});

	it('does not mutate the caller-provided options object', async () => {
		const service = createFetcherService();
		const options: FetchOptions = { callSite: 'test', method: 'GET', headers: { Authorization: 'Bearer sk-apivega-test' } };

		await service.fetch('https://api.vega.chat/api/v1/models', options);

		expect(options.headers?.['HTTP-Referer']).toBeUndefined();
	});
});
