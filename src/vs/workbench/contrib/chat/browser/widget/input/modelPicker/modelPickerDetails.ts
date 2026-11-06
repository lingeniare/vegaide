/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isHTMLAnchorElement } from '../../../../../../../base/browser/dom.js';
import { renderMarkdown } from '../../../../../../../base/browser/markdownRenderer.js';
import { MarkdownString } from '../../../../../../../base/common/htmlContent.js';
import { DisposableStore } from '../../../../../../../base/common/lifecycle.js';
import { language } from '../../../../../../../base/common/platform.js';
import { URI } from '../../../../../../../base/common/uri.js';
import { localize } from '../../../../../../../nls.js';
import { IOpenerService } from '../../../../../../../platform/opener/common/opener.js';
import { ILanguageModelChatMetadata } from '../../../../common/languageModels.js';

/**
 * Picks the Russian copy on a Russian build. The language packs predate these
 * fork-added strings, so `localize` alone would leave them English; every other
 * locale keeps the localized default.
 */
export function pricingLabel(localized: string, russian: string): string {
	return language === 'ru' ? russian : localized;
}

/** One cost metric, with the value for each context tier. */
export interface IModelCostMetric {
	readonly label: string;
	readonly standard: number | null | undefined;
	readonly extended: number | null | undefined;
}

/** The cost metrics a model reports, in the order they are shown. */
export function getModelCostMetrics(metadata: ILanguageModelChatMetadata): IModelCostMetric[] {
	return [
		{ label: pricingLabel(localize('models.inputCostLabel', "Input"), 'Вход'), standard: metadata.inputCost, extended: metadata.longContextInputCost },
		{ label: pricingLabel(localize('models.outputCostLabel', "Output"), 'Выход'), standard: metadata.outputCost, extended: metadata.longContextOutputCost },
		{ label: pricingLabel(localize('models.cacheCostLabel', "Cache Read"), 'Чтение кэша'), standard: metadata.cacheCost, extended: metadata.longContextCacheCost },
		{ label: pricingLabel(localize('models.cacheWriteCostLabel', "Cache Write"), 'Запись в кэш'), standard: metadata.cacheWriteCost, extended: metadata.longContextCacheWriteCost },
	].filter(metric => metric.standard !== undefined || metric.extended !== undefined);
}

export function formatModelCost(cost: number | null | undefined): string {
	return typeof cost === 'number' ? String(cost) : localize('models.cost.unknown', "Unknown");
}

/** The unit the cost numbers are given in, stated once above them. */
export function getCreditsPerMillionTokensLabel(): string {
	return pricingLabel(localize('models.creditsPerMillionTokens', "Credits per 1M tokens"), 'Кредитов за 1 млн токенов');
}

export function getMaxContextLabel(): string {
	return pricingLabel(localize('models.contextSize', "Max context"), 'Макс. контекст');
}

/** Renders a model's description markdown. The caller places and classes the element. */
export function renderModelDescription(tooltip: string, openerService: IOpenerService, store: DisposableStore, learnMoreUrl?: URI): { readonly element: HTMLElement; readonly learnMoreLink: HTMLAnchorElement | undefined } {
	const content = new MarkdownString(tooltip, { supportThemeIcons: true });
	if (learnMoreUrl) {
		content.appendMarkdown(tooltip ? ' ' : '').appendLink(learnMoreUrl, localize('chat.modelPicker.learnMore', "Learn more"));
	}
	const rendered = store.add(renderMarkdown(content, {
		actionHandler: link => { void openerService.open(link, { allowCommands: false, fromUserGesture: true }); },
	}));
	const possibleLearnMoreLink = learnMoreUrl ? rendered.element.lastElementChild?.lastElementChild : undefined;
	return {
		element: rendered.element,
		learnMoreLink: isHTMLAnchorElement(possibleLearnMoreLink) ? possibleLearnMoreLink : undefined,
	};
}
