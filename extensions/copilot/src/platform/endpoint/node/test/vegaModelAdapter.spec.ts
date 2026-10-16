/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, test } from 'vitest';
import { IChatModelInformation, ModelSupportedEndpoint } from '../../common/endpointProvider';
import { isVegaModelEntry, toVegaModelInformation, type IVegaModelEntry } from '../../common/vegaModelAdapter';

describe('isVegaModelEntry', () => {
	test('accepts OpenRouter-shaped entries', () => {
		expect(isVegaModelEntry({ id: 'openai/gpt-4o' })).toBe(true);
	});

	test('rejects CAPI-shaped entries and non-models', () => {
		expect(isVegaModelEntry({ id: 'gpt-4o', capabilities: {} })).toBe(false);
		expect(isVegaModelEntry({})).toBe(false);
		expect(isVegaModelEntry(undefined)).toBe(false);
		expect(isVegaModelEntry(null)).toBe(false);
		expect(isVegaModelEntry('gpt-4o')).toBe(false);
	});
});

describe('toVegaModelInformation', () => {
	test('maps context limits, vision, tools and reasoning flags', () => {
		const entry: IVegaModelEntry = {
			id: 'openai/gpt-4o',
			name: 'GPT-4o',
			context_length: 128000,
			architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
			top_provider: { max_completion_tokens: 16384 },
			supported_parameters: ['tools', 'reasoning'],
		};
		const model = toVegaModelInformation(entry) as IChatModelInformation;

		expect(model.id).toBe('openai/gpt-4o');
		expect(model.vendor).toBe('openai');
		expect(model.name).toBe('GPT-4o');
		expect(model.capabilities.type).toBe('chat');
		expect(model.capabilities.limits?.max_context_window_tokens).toBe(128000);
		expect(model.capabilities.limits?.max_output_tokens).toBe(16384);
		expect(model.capabilities.supports?.vision).toBe(true);
		expect(model.capabilities.supports?.tool_calls).toBe(true);
		expect(model.capabilities.supports?.thinking).toBe(true);
		expect(model.supported_endpoints).toEqual([ModelSupportedEndpoint.ChatCompletions]);
		expect(model.model_picker_enabled).toBe(true);
	});

	test('derives modalities from the compact modality string', () => {
		const model = toVegaModelInformation({ id: 'vendor/multimodal', architecture: { modality: 'text+image->text' } }) as IChatModelInformation;
		expect(model.capabilities.supports?.vision).toBe(true);

		const textOnly = toVegaModelInformation({ id: 'vendor/text-only', architecture: { modality: 'text->text' } }) as IChatModelInformation;
		expect(textOnly.capabilities.supports?.vision).toBe(false);
	});

	test('falls back to defaults and top_provider context length', () => {
		const model = toVegaModelInformation({ id: 'vendor/m', top_provider: { context_length: 64000 } }) as IChatModelInformation;
		expect(model.capabilities.limits?.max_context_window_tokens).toBe(64000);
		expect(model.capabilities.limits?.max_output_tokens).toBe(4096);
		expect(model.name).toBe('vendor/m');
	});

	test('marks embedding models out of the picker', () => {
		const model = toVegaModelInformation({ id: 'openai/text-embedding-3', architecture: { output_modalities: ['embeddings'] } });
		expect(model.model_picker_enabled).toBe(false);
		expect(model.capabilities.type).toBe('embeddings');
	});
});
