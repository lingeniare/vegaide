/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import '../media/openInVSCode.css';
import { $, append, EventHelper, EventLike } from '../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { BaseActionViewItem, IBaseActionViewItemOptions } from '../../../base/browser/ui/actionbar/actionViewItems.js';
import { IAction } from '../../../base/common/actions.js';
import { localize } from '../../../nls.js';
import { IHoverService } from '../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { IProductService } from '../../../platform/product/common/productService.js';
import { ruLabel } from '../../../platform/product/common/vegaBranding.js';

/**
 * Renders the "Open in Editor" titlebar entry as an icon-only button that
 * expands to reveal a label on hover / keyboard focus.
 */
export class OpenInVSCodeTitleBarWidget extends BaseActionViewItem {

	constructor(
		action: IAction,
		options: IBaseActionViewItemOptions | undefined,
		private readonly keybindingCommandId: string,
		@IProductService private readonly productService: IProductService,
		@IHoverService private readonly hoverService: IHoverService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
	) {
		super(undefined, action, options);
	}

	override render(container: HTMLElement): void {
		super.render(container);

		container.classList.add('open-in-vscode-titlebar-widget');
		container.setAttribute('role', 'button');

		// Expose the product quality on the widget for tests and tooling.
		const quality = this.productService.quality;
		if (quality) {
			container.setAttribute('data-product-quality', quality);
		}

		const label = this.action.label;
		const hoverText = this.keybindingService.appendKeybinding(ruLabel(localize('openInVSCodeHover', "Open in VEGA IDE Editor Window"), 'Открыть в окне редактора ВЕГА IDE'), this.keybindingCommandId);
		container.setAttribute('aria-label', hoverText);
		this._register(this.hoverService.setupManagedHover(this.options.hoverDelegate ?? getDefaultHoverDelegate('element'), container, hoverText));

		const icon = append(container, $('span.open-in-vscode-titlebar-widget-icon'));
		icon.setAttribute('aria-hidden', 'true');

		const labelEl = append(container, $('span.open-in-vscode-titlebar-widget-label'));
		labelEl.textContent = label;
	}

	override onClick(event: EventLike): void {
		EventHelper.stop(event, true);
		this.action.run();
	}
}
