/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGitHubEndpoints } from '../../github/common/githubEndpoints.js';
import { ProtectedResourceMetadata } from './state/protocol/state.js';

/** OpenAI-compatible API base served by the VEGA gateway. */
export const VEGA_API_BASE_URL = 'https://api.vega.chat/api/v1';

/** The VEGA site origin; also the authorization-server URI for VEGA sessions. */
export const VEGA_AUTH_SERVER_URL = 'https://api.vega.chat';

/**
 * The VEGA protected resource. Under the VEGA product configuration the agent
 * host authenticates against `api.vega.chat` instead of VEGA IDE: the
 * `vega` authentication provider resolves a device-flow session whose access
 * token is the `sk-apivega-...` application key.
 */
export function vegaChatResource(): ProtectedResourceMetadata {
	return {
		resource: VEGA_API_BASE_URL,
		resource_name: 'VEGA',
		authorization_servers: [VEGA_AUTH_SERVER_URL],
		scopes_supported: ['api'],
		required: true,
	};
}

/**
 * The VEGA IDE protected resource for the given endpoints. Shared by the
 * endpoint service and tests so the resource identity is defined once.
 */
export function gitHubCopilotResource(endpoints: IGitHubEndpoints): ProtectedResourceMetadata {
	return {
		resource: endpoints.apiBaseUri,
		resource_name: 'VEGA IDE',
		authorization_servers: [endpoints.oauthServer],
		scopes_supported: ['read:user', 'user:email'],
		required: true,
	};
}

/** The GitHub repository protected resource for the given endpoints. */
export function gitHubRepoResource(endpoints: IGitHubEndpoints): ProtectedResourceMetadata {
	return {
		resource: `${endpoints.apiBaseUri}/repos`,
		resource_name: 'GitHub Repository',
		authorization_servers: [endpoints.oauthServer],
		scopes_supported: ['repo'],
		required: false,
	};
}
