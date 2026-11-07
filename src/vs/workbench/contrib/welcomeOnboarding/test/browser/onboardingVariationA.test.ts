/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import { $ } from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IExtensionGalleryService, IExtensionManagementService } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import product from '../../../../../platform/product/common/product.js';
import { ColorThemeData } from '../../../../services/themes/common/colorThemeData.js';
import { IWorkbenchThemeService } from '../../../../services/themes/common/workbenchThemeService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { OnboardingVariationA } from '../../browser/onboardingVariationA.js';

suite('OnboardingVariationA', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	teardown(() => sinon.restore());

	function createOnboarding(signIn: sinon.SinonStub = sinon.stub().resolves(null)) {
		const container = mainWindow.document.body.appendChild($('div'));
		store.add(toDisposable(() => container.remove()));
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(ILayoutService, { activeContainer: container });
		instantiationService.stub(IWorkbenchThemeService, { getColorTheme: () => ColorThemeData.createLoadedEmptyTheme('test', '') });
		instantiationService.stub(IExtensionGalleryService, {});
		instantiationService.stub(IExtensionManagementService, {});
		instantiationService.stub(IDefaultAccountService, { signIn });
		const commandInvoked = new DeferredPromise<void>();
		const executeCommand = sinon.stub().callsFake(async () => {
			await commandInvoked.complete();
			return false;
		});
		instantiationService.stub(ICommandService, { executeCommand });
		const onboarding = store.add(instantiationService.createInstance(OnboardingVariationA));
		onboarding.show();
		return { container, executeCommand, commandInvoked: commandInvoked.p, signIn };
	}

	test('sign-in step offers only the VEGA provider', () => {
		const { container } = createOnboarding();
		const providerName = product.defaultChatAgent?.provider.default.name;

		assert.strictEqual(container.querySelector('.onboarding-a-signin-title')?.textContent, 'Welcome to VEGA IDE');
		assert.strictEqual(container.querySelector('.onboarding-a-signin-subtitle')?.textContent, `Sign in to use ${providerName}.`);

		const buttons = Array.from(container.querySelectorAll<HTMLElement>('.onboarding-a-signin-actions button'));
		assert.deepStrictEqual(buttons.map(button => button.getAttribute('aria-label')), [`Sign in with ${providerName}`]);
	});

	test('disclaimer links to the terms of service and the privacy policy', () => {
		const { container } = createOnboarding();

		const disclaimer = container.querySelector('.onboarding-a-signin-disclaimer');
		assert.ok(disclaimer);
		assert.ok(disclaimer.textContent?.includes('test deposit'));
		assert.ok(disclaimer.textContent?.includes('free AI models'));
		assert.deepStrictEqual(
			Array.from(disclaimer.querySelectorAll('a')).map(link => ({ label: link.textContent, href: link.getAttribute('href') })),
			[
				{ label: 'terms of service', href: product.defaultChatAgent?.termsStatementUrl },
				{ label: 'personal data processing and privacy policy', href: product.defaultChatAgent?.privacyStatementUrl },
			]
		);
	});

	test('VEGA button runs the default account sign-in and triggers chat setup', async () => {
		const signIn = sinon.stub().resolves({});
		const { container, executeCommand, commandInvoked } = createOnboarding(signIn);

		const button = container.querySelector<HTMLElement>('.onboarding-a-signin-actions button');
		assert.ok(button);
		button.click();
		await commandInvoked;

		assert.ok(signIn.calledOnce);
		assert.strictEqual(executeCommand.firstCall.args[0], 'workbench.action.chat.triggerSetup');
	});
});
