/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TokenizerType } from '../../../util/common/tokenizer';
import { IChatModelInformation, IEmbeddingModelInformation, IModelAPIResponse, ModelSupportedEndpoint } from './endpointProvider';

/**
 * Entry shape returned by the VEGA `/api/v1/models` endpoint
 * (OpenRouter-compatible). VEGA is an OpenRouter proxy, so the model list
 * uses the OpenRouter schema rather than the Copilot (CAPI) schema.
 */
export interface IVegaModelEntry {
	readonly id: string;
	readonly name?: string;
	readonly description?: string;
	readonly context_length?: number;
	readonly architecture?: {
		readonly modality?: string;
		readonly input_modalities?: readonly string[];
		readonly output_modalities?: readonly string[];
		readonly tokenizer?: string;
	};
	readonly top_provider?: {
		readonly context_length?: number;
		readonly max_completion_tokens?: number;
		readonly is_moderated?: boolean;
	};
	readonly supported_parameters?: readonly string[];
	readonly pricing?: { readonly prompt?: string; readonly completion?: string };
}

const DEFAULT_CONTEXT_WINDOW = 128000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

/** Detects an OpenRouter-shaped model entry (i.e. not a CAPI `capabilities` payload). */
export function isVegaModelEntry(model: unknown): model is IVegaModelEntry {
	return typeof model === 'object'
		&& model !== null
		&& typeof (model as { id?: unknown }).id === 'string'
		&& (model as { capabilities?: unknown }).capabilities === undefined;
}

function supportsParameter(entry: IVegaModelEntry, parameter: string): boolean {
	return !!entry.supported_parameters?.includes(parameter);
}

function inputModalities(entry: IVegaModelEntry): readonly string[] {
	if (entry.architecture?.input_modalities?.length) {
		return entry.architecture.input_modalities;
	}
	const modality = entry.architecture?.modality ?? 'text->text';
	return modality.split('->')[0].split('+');
}

function outputModalities(entry: IVegaModelEntry): readonly string[] {
	if (entry.architecture?.output_modalities?.length) {
		return entry.architecture.output_modalities;
	}
	const modality = entry.architecture?.modality ?? 'text->text';
	return modality.split('->')[1].split('+');
}

/**
 * Normalizes a VEGA model listing entry into the CAPI `IModelAPIResponse`
 * shape consumed by the endpoint provider and model picker. All models are
 * routed over the chat completions wire API (`/chat/completions`), which
 * VEGA serves OpenAI-compatibly for every listed model.
 */
export function toVegaModelInformation(entry: IVegaModelEntry): IModelAPIResponse {
	const contextWindow = entry.context_length ?? entry.top_provider?.context_length ?? DEFAULT_CONTEXT_WINDOW;
	const maxOutputTokens = entry.top_provider?.max_completion_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
	const inputs = inputModalities(entry);
	const outputs = outputModalities(entry);
	const supportsTools = supportsParameter(entry, 'tools');
	const supportsVision = inputs.some(m => m === 'image' || m === 'file');
	const supportsReasoning = supportsParameter(entry, 'reasoning') || supportsParameter(entry, 'include_reasoning');
	const isEmbedding = outputs.some(m => m === 'embeddings' || m === 'embedding');

	const base = {
		id: entry.id,
		vendor: entry.id.split('/')[0] ?? 'vega',
		name: entry.name ?? entry.id,
		model_picker_enabled: !isEmbedding,
		is_chat_default: false,
		is_chat_fallback: false,
		version: '1',
		billing: { is_premium: false, multiplier: 1 },
		supported_endpoints: [ModelSupportedEndpoint.ChatCompletions],
	} satisfies Partial<IModelAPIResponse>;

	if (isEmbedding) {
		return {
			...base,
			capabilities: {
				type: 'embeddings',
				family: entry.id,
				tokenizer: TokenizerType.O200K,
				limits: { max_inputs: 1 },
			},
		} satisfies IEmbeddingModelInformation;
	}

	return {
		...base,
		capabilities: {
			type: 'chat',
			family: entry.id,
			tokenizer: TokenizerType.O200K,
			limits: {
				max_prompt_tokens: contextWindow,
				max_output_tokens: maxOutputTokens,
				max_context_window_tokens: contextWindow,
			},
			supports: {
				streaming: true,
				tool_calls: supportsTools,
				parallel_tool_calls: supportsTools,
				vision: supportsVision,
				thinking: supportsReasoning,
			},
		},
	} satisfies IChatModelInformation;
}
