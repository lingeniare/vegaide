/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { refineServiceDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Event } from '../../../../base/common/event.js';
import { Color } from '../../../../base/common/color.js';
import { IColorTheme, IThemeService, IFileIconTheme, IProductIconTheme } from '../../../../platform/theme/common/themeService.js';
import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import { isBoolean, isString } from '../../../../base/common/types.js';
import { IconContribution, IconDefinition } from '../../../../platform/theme/common/iconRegistry.js';
import { ColorScheme, ThemeTypeSelector } from '../../../../platform/theme/common/theme.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

export const IWorkbenchThemeService = refineServiceDecorator<IThemeService, IWorkbenchThemeService>(IThemeService);

export const THEME_SCOPE_OPEN_PAREN = '[';
export const THEME_SCOPE_CLOSE_PAREN = ']';
export const THEME_SCOPE_WILDCARD = '*';

export const themeScopeRegex = /\[(.+?)\]/g;

export enum ThemeSettings {
	COLOR_THEME = 'workbench.colorTheme',
	FILE_ICON_THEME = 'workbench.iconTheme',
	PRODUCT_ICON_THEME = 'workbench.productIconTheme',
	COLOR_CUSTOMIZATIONS = 'workbench.colorCustomizations',
	TOKEN_COLOR_CUSTOMIZATIONS = 'editor.tokenColorCustomizations',
	SEMANTIC_TOKEN_COLOR_CUSTOMIZATIONS = 'editor.semanticTokenColorCustomizations',

	PREFERRED_DARK_THEME = 'workbench.preferredDarkColorTheme',
	PREFERRED_LIGHT_THEME = 'workbench.preferredLightColorTheme',
	PREFERRED_HC_DARK_THEME = 'workbench.preferredHighContrastColorTheme', /* id kept for compatibility reasons */
	PREFERRED_HC_LIGHT_THEME = 'workbench.preferredHighContrastLightColorTheme',
	DETECT_COLOR_SCHEME = 'window.autoDetectColorScheme',
	DETECT_HC = 'window.autoDetectHighContrast',

	SYSTEM_COLOR_THEME = 'window.systemColorTheme'
}

export namespace ThemeSettingDefaults {
	export const COLOR_THEME_DARK = 'VEGA Dark';
	export const COLOR_THEME_LIGHT = 'VEGA Light';
	export const COLOR_THEME_HC_DARK = 'Default High Contrast';
	export const COLOR_THEME_HC_LIGHT = 'Default High Contrast Light';

	export const FILE_ICON_THEME = 'vs-seti';
	export const PRODUCT_ICON_THEME = 'Default';
}

/**
 * Migrates legacy theme settings IDs to their current equivalents.
 * Theme IDs were simplified: "Default" prefix was removed from built-in themes,
 * and "Experimental" prefix was replaced when VS Code themes became GA.
 */
export function migrateThemeSettingsId(settingsId: string): string {
	switch (settingsId) {
		case 'Default Dark Modern': return 'Dark Modern';
		case 'Default Light Modern': return 'Light Modern';
		case 'Default Dark+': return 'Dark+';
		case 'Default Light+': return 'Light+';
		case 'Experimental Dark':
		case 'VS Code Dark':
			return ThemeSettingDefaults.COLOR_THEME_DARK;
		case 'Experimental Light':
		case 'VS Code Light':
			return ThemeSettingDefaults.COLOR_THEME_LIGHT;
	}
	return settingsId;
}

export const COLOR_THEME_DARK_INITIAL_COLORS = {
	'actionBar.toggledBackground': '#383a49',
	'activityBar.activeBorder': '#bfbfbf',
	'activityBar.background': '#191A1B',
	'activityBar.border': '#2A2B2C',
	'activityBar.foreground': '#bfbfbf',
	'activityBar.inactiveForeground': '#8C8C8C',
	'activityBarBadge.background': '#41356e',
	'activityBarBadge.foreground': '#FFFFFF',
	'badge.background': '#41356e',
	'badge.foreground': '#FFFFFF',
	'button.background': '#564592',
	'button.border': '#564592',
	'button.foreground': '#FFFFFF',
	'button.hoverBackground': '#6a55b8',
	'button.secondaryBackground': '#313131',
	'button.secondaryForeground': '#CCCCCC',
	'button.secondaryHoverBackground': '#FFFFFF10',
	'chat.slashCommandBackground': '#56459266',
	'chat.slashCommandForeground': '#a597d8',
	'chat.editedFileForeground': '#E2C08D',
	'checkbox.background': '#242526',
	'checkbox.border': '#707070',
	'debugToolBar.background': '#181818',
	'descriptionForeground': '#8C8C8C',
	'dropdown.background': '#191A1B',
	'dropdown.border': '#333536',
	'dropdown.foreground': '#bfbfbf',
	'dropdown.listBackground': '#191A1B',
	'editor.background': '#121314',
	'editor.findMatchBackground': '#56459290',
	'editor.foreground': '#BBBEBF',
	'editor.inactiveSelectionBackground': '#56459240',
	'editor.selectionHighlightBackground': '#56459240',
	'editorGroup.border': '#FFFFFF17',
	'editorGroupHeader.tabsBackground': '#191A1B',
	'editorGroupHeader.tabsBorder': '#2A2B2C',
	'editorGutter.addedBackground': '#a597d8',
	'editorGutter.deletedBackground': '#F28772',
	'editorGutter.modifiedBackground': '#564592',
	'editorIndentGuide.activeBackground1': '#838485',
	'editorIndentGuide.background1': '#8384854D',
	'editorLineNumber.activeForeground': '#BBBEBF',
	'editorLineNumber.foreground': '#858889',
	'editorOverviewRuler.border': '#2A2B2C',
	'editorWidget.background': '#202122',
	'errorForeground': '#f48771',
	'focusBorder': '#8572caB3',
	'foreground': '#bfbfbf',
	'icon.foreground': '#8C8C8C',
	'input.background': '#191A1B',
	'input.border': '#333536',
	'input.foreground': '#bfbfbf',
	'input.placeholderForeground': '#555555',
	'inputOption.activeBackground': '#313233',
	'inputOption.activeBorder': '#2A2B2C',
	'keybindingLabel.foreground': '#CCCCCC',
	'list.activeSelectionIconForeground': '#FFF',
	'list.dropBackground': '#5645921A',
	'menu.background': '#202122',
	'menu.border': '#2A2B2C',
	'menu.foreground': '#bfbfbf',
	'menu.selectionBackground': '#56459226',
	'menu.separatorBackground': '#2A2B2C',
	'notificationCenterHeader.background': '#242526',
	'notificationCenterHeader.foreground': '#bfbfbf',
	'notifications.background': '#202122',
	'notifications.border': '#2A2B2C',
	'notifications.foreground': '#bfbfbf',
	'panel.background': '#191A1B',
	'panel.border': '#2A2B2C',
	'panelInput.border': '#2B2B2B',
	'panelTitle.activeBorder': '#564592',
	'panelTitle.activeForeground': '#bfbfbf',
	'panelTitle.inactiveForeground': '#8C8C8C',
	'peekViewEditor.background': '#191A1B',
	'peekViewEditor.matchHighlightBackground': '#56459233',
	'peekViewResult.background': '#191A1B',
	'peekViewResult.matchHighlightBackground': '#56459233',
	'pickerGroup.border': '#2A2B2C',
	'ports.iconRunningProcessForeground': '#a597d8',
	'progressBar.background': '#564592',
	'quickInput.background': '#202122',
	'quickInput.foreground': '#bfbfbf',
	'settings.dropdownBackground': '#313131',
	'settings.dropdownBorder': '#3C3C3C',
	'settings.headerForeground': '#FFFFFF',
	'settings.modifiedItemIndicator': '#BB800966',
	'sideBar.background': '#191A1B',
	'sideBar.border': '#2A2B2C',
	'sideBar.foreground': '#bfbfbf',
	'sideBarSectionHeader.background': '#191A1B',
	'sideBarSectionHeader.border': '#2A2B2C',
	'sideBarSectionHeader.foreground': '#bfbfbf',
	'sideBarTitle.foreground': '#bfbfbf',
	'statusBar.background': '#191A1B',
	'statusBar.border': '#2A2B2C',
	'statusBar.debuggingBackground': '#564592',
	'statusBar.debuggingForeground': '#FFFFFF',
	'statusBar.focusBorder': '#8572caB3',
	'statusBar.foreground': '#8C8C8C',
	'statusBar.noFolderBackground': '#191A1B',
	'statusBarItem.focusBorder': '#8572caB3',
	'statusBarItem.prominentBackground': '#564592',
	'statusBarItem.remoteBackground': '#564592',
	'statusBarItem.remoteForeground': '#FFFFFF',
	'tab.activeBackground': '#121314',
	'tab.activeBorder': '#121314',
	'tab.activeBorderTop': '#564592',
	'tab.activeForeground': '#bfbfbf',
	'tab.border': '#2A2B2C',
	'tab.hoverBackground': '#121314',
	'tab.inactiveBackground': '#191A1B',
	'tab.inactiveForeground': '#8C8C8C',
	'tab.lastPinnedBorder': '#2A2B2C',
	'tab.selectedBackground': '#37373D',
	'tab.selectedBorderTop': '#a597d8',
	'tab.selectedForeground': '#FFFFFF',
	'tab.unfocusedActiveBorder': '#1F1F1F',
	'tab.unfocusedActiveBorderTop': '#2B2B2B',
	'tab.unfocusedHoverBackground': '#1F1F1F',
	'terminal.foreground': '#bfbfbf',
	'terminal.inactiveSelectionBackground': '#3A3D41',
	'terminal.tab.activeBorder': '#56459200',
	'textBlockQuote.background': '#242526',
	'textBlockQuote.border': '#2A2B2C',
	'textCodeBlock.background': '#242526',
	'textLink.activeForeground': '#c5bce6',
	'textLink.foreground': '#a597d8',
	'textPreformat.background': '#262626',
	'textPreformat.foreground': '#8C8C8C',
	'textSeparator.foreground': '#2a2a2a',
	'titleBar.activeBackground': '#191A1B',
	'titleBar.activeForeground': '#8C8C8C',
	'titleBar.border': '#2A2B2C',
	'titleBar.inactiveBackground': '#121314',
	'titleBar.inactiveForeground': '#8C8C8C',
	'welcomePage.progress.foreground': '#564592',
	'welcomePage.tileBackground': '#2B2B2B',
	'widget.border': '#2A2B2C'
};

export const COLOR_THEME_LIGHT_INITIAL_COLORS = {
	'actionBar.toggledBackground': '#dddddd',
	'activityBar.activeBorder': '#000000',
	'activityBar.background': '#FAFAFD',
	'activityBar.border': '#F0F1F2',
	'activityBar.foreground': '#202020',
	'activityBar.inactiveForeground': '#606060',
	'activityBarBadge.background': '#059669',
	'activityBarBadge.foreground': '#FFFFFF',
	'badge.background': '#059669',
	'badge.foreground': '#FFFFFF',
	'button.background': '#059669',
	'button.border': '#059669',
	'button.foreground': '#FFFFFF',
	'button.hoverBackground': '#047857',
	'button.secondaryBackground': '#EAEAEA',
	'button.secondaryForeground': '#202020',
	'button.secondaryHoverBackground': '#F2F3F4',
	'chat.slashCommandBackground': '#05966950',
	'chat.slashCommandForeground': '#047857',
	'chat.editedFileForeground': '#895503',
	'checkbox.background': '#EAEAEA',
	'checkbox.border': '#868686',
	'descriptionForeground': '#606060',
	'diffEditor.unchangedRegionBackground': '#f8f8f8',
	'dropdown.background': '#FFFFFF',
	'dropdown.border': '#D8D8D8',
	'dropdown.foreground': '#202020',
	'dropdown.listBackground': '#FFFFFF',
	'editor.background': '#FFFFFF',
	'editor.foreground': '#202020',
	'editor.inactiveSelectionBackground': '#0596691A',
	'editor.selectionHighlightBackground': '#05966915',
	'editorGroup.border': '#E5E5E5',
	'editorGroupHeader.tabsBackground': '#FAFAFD',
	'editorGroupHeader.tabsBorder': '#F0F1F2',
	'editorGutter.addedBackground': '#059669',
	'editorGutter.deletedBackground': '#ad0707',
	'editorGutter.modifiedBackground': '#059669',
	'editorIndentGuide.activeBackground1': '#EEEEEE',
	'editorIndentGuide.background1': '#F7F7F740',
	'editorLineNumber.activeForeground': '#202020',
	'editorLineNumber.foreground': '#606060',
	'editorOverviewRuler.border': '#F0F1F2',
	'editorSuggestWidget.background': '#FAFAFD',
	'editorWidget.background': '#FAFAFD',
	'errorForeground': '#ad0707',
	'focusBorder': '#059669',
	'foreground': '#202020',
	'icon.foreground': '#606060',
	'input.background': '#FFFFFF',
	'input.border': '#D8D8D866',
	'input.foreground': '#202020',
	'input.placeholderForeground': '#999999',
	'inputOption.activeBackground': '#D6D6D6',
	'inputOption.activeBorder': '#F0F1F2',
	'inputOption.activeForeground': '#202020',
	'keybindingLabel.foreground': '#3B3B3B',
	'list.activeSelectionBackground': '#00000025',
	'list.activeSelectionForeground': '#202020',
	'list.activeSelectionIconForeground': '#000000',
	'list.focusAndSelectionOutline': '#059669',
	'list.hoverBackground': '#00000014',
	'menu.border': '#E4E5E6',
	'menu.selectionBackground': '#0596691A',
	'menu.selectionForeground': '#202020',
	'notebook.cellBorderColor': '#E5E5E5',
	'notebook.selectedCellBackground': '#05966950',
	'notificationCenterHeader.background': '#FAFAFD',
	'notificationCenterHeader.foreground': '#202020',
	'notifications.background': '#FAFAFD',
	'notifications.border': '#F0F1F2',
	'notifications.foreground': '#202020',
	'panel.background': '#FAFAFD',
	'panel.border': '#F0F1F2',
	'panelInput.border': '#E5E5E5',
	'panelTitle.activeBorder': '#059669',
	'panelTitle.activeForeground': '#202020',
	'panelTitle.inactiveForeground': '#606060',
	'peekViewEditor.matchHighlightBackground': '#05966933',
	'peekViewResult.background': '#FAFAFD',
	'peekViewResult.matchHighlightBackground': '#05966933',
	'pickerGroup.border': '#EEEEF1',
	'pickerGroup.foreground': '#202020',
	'ports.iconRunningProcessForeground': '#047857',
	'progressBar.background': '#059669',
	'quickInput.background': '#FAFAFD',
	'quickInput.foreground': '#202020',
	'searchEditor.textInputBorder': '#CECECE',
	'settings.dropdownBackground': '#FFFFFF',
	'settings.dropdownBorder': '#CECECE',
	'settings.headerForeground': '#1F1F1F',
	'settings.modifiedItemIndicator': '#BB800966',
	'settings.numberInputBorder': '#CECECE',
	'settings.textInputBorder': '#CECECE',
	'sideBar.background': '#FAFAFD',
	'sideBar.border': '#F0F1F2',
	'sideBar.foreground': '#202020',
	'sideBarSectionHeader.background': '#FAFAFD',
	'sideBarSectionHeader.border': '#F0F1F2',
	'sideBarSectionHeader.foreground': '#202020',
	'sideBarTitle.foreground': '#202020',
	'statusBar.background': '#FAFAFD',
	'statusBar.border': '#F0F1F2',
	'statusBar.debuggingBackground': '#059669',
	'statusBar.debuggingForeground': '#FFFFFF',
	'statusBar.focusBorder': '#059669',
	'statusBar.foreground': '#606060',
	'statusBar.noFolderBackground': '#F0F0F3',
	'statusBarItem.compactHoverBackground': '#CCCCCC',
	'statusBarItem.errorBackground': '#C72E0F',
	'statusBarItem.focusBorder': '#059669',
	'statusBarItem.hoverBackground': '#E3E3E5',
	'statusBarItem.prominentBackground': '#059669DD',
	'statusBarItem.remoteBackground': '#059669',
	'statusBarItem.remoteForeground': '#FFFFFF',
	'tab.activeBackground': '#FFFFFF',
	'tab.activeBorder': '#FFFFFF',
	'tab.activeBorderTop': '#059669',
	'tab.activeForeground': '#202020',
	'tab.border': '#F0F1F2',
	'tab.hoverBackground': '#FFFFFF',
	'tab.inactiveBackground': '#FAFAFD',
	'tab.inactiveForeground': '#606060',
	'tab.lastPinnedBorder': '#F0F1F2',
	'tab.selectedBackground': '#E4E6F1',
	'tab.selectedBorderTop': '#047857',
	'tab.selectedForeground': '#333333',
	'tab.unfocusedActiveBorder': '#F8F8F8',
	'tab.unfocusedActiveBorderTop': '#E5E5E5',
	'tab.unfocusedHoverBackground': '#F8F8F8',
	'terminal.foreground': '#3B3B3B',
	'terminal.inactiveSelectionBackground': '#0596691A',
	'terminal.tab.activeBorder': '#059669',
	'terminalCursor.foreground': '#202020',
	'textBlockQuote.background': '#EAEAEA',
	'textBlockQuote.border': '#F0F1F2',
	'textCodeBlock.background': '#EAEAEA',
	'textLink.activeForeground': '#059669',
	'textLink.foreground': '#047857',
	'textPreformat.background': '#ECECEC',
	'textPreformat.foreground': '#606060',
	'textSeparator.foreground': '#EEEEEE',
	'titleBar.activeBackground': '#FAFAFD',
	'titleBar.activeForeground': '#606060',
	'titleBar.border': '#F0F1F2',
	'titleBar.inactiveBackground': '#FAFAFD',
	'titleBar.inactiveForeground': '#606060',
	'welcomePage.tileBackground': '#F3F3F3',
	'widget.border': '#E2E2E5'
};

export interface IWorkbenchTheme {
	readonly id: string;
	readonly label: string;
	readonly extensionData?: ExtensionData;
	readonly description?: string;
	readonly settingsId: string | null;
}

export interface IWorkbenchColorTheme extends IWorkbenchTheme, IColorTheme {
	readonly settingsId: string;
	readonly tokenColors: ITextMateThemingRule[];
}

export interface IColorMap {
	[id: string]: Color;
}

export interface IWorkbenchFileIconTheme extends IWorkbenchTheme, IFileIconTheme {
}

export interface IWorkbenchProductIconTheme extends IWorkbenchTheme, IProductIconTheme {
	readonly settingsId: string;

	getIcon(icon: IconContribution): IconDefinition | undefined;
}

export type ThemeSettingTarget = ConfigurationTarget | undefined | 'auto' | 'preview';


export interface IWorkbenchThemeService extends IThemeService {
	readonly _serviceBrand: undefined;
	setColorTheme(themeId: string | undefined | IWorkbenchColorTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchColorTheme | null>;
	getColorTheme(): IWorkbenchColorTheme;
	/** Returns the selected theme and user customizations without window-local overlays. */
	getBaseColorTheme(): IWorkbenchColorTheme;
	getColorThemes(): Promise<IWorkbenchColorTheme[]>;
	getMarketplaceColorThemes(publisher: string, name: string, version: string): Promise<IWorkbenchColorTheme[]>;
	readonly onDidColorThemeChange: Event<IWorkbenchColorTheme>;

	/** Applies window-local colors computed from the base theme, without persisting them or changing the selected theme. */
	registerColorThemeOverlay(getColors: (theme: IWorkbenchColorTheme) => IColorMap): IDisposable;

	getPreferredColorScheme(): ColorScheme | undefined;

	setFileIconTheme(iconThemeId: string | undefined | IWorkbenchFileIconTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchFileIconTheme>;
	getFileIconTheme(): IWorkbenchFileIconTheme;
	getFileIconThemes(): Promise<IWorkbenchFileIconTheme[]>;
	getMarketplaceFileIconThemes(publisher: string, name: string, version: string): Promise<IWorkbenchFileIconTheme[]>;
	readonly onDidFileIconThemeChange: Event<IWorkbenchFileIconTheme>;

	setProductIconTheme(iconThemeId: string | undefined | IWorkbenchProductIconTheme, settingsTarget: ThemeSettingTarget): Promise<IWorkbenchProductIconTheme>;
	getProductIconTheme(): IWorkbenchProductIconTheme;
	getProductIconThemes(): Promise<IWorkbenchProductIconTheme[]>;
	getMarketplaceProductIconThemes(publisher: string, name: string, version: string): Promise<IWorkbenchProductIconTheme[]>;
	readonly onDidProductIconThemeChange: Event<IWorkbenchProductIconTheme>;
}

export interface IThemeScopedColorCustomizations {
	[colorId: string]: string;
}

export interface IColorCustomizations {
	[colorIdOrThemeScope: string]: IThemeScopedColorCustomizations | string;
}

export interface IThemeScopedTokenColorCustomizations {
	[groupId: string]: ITextMateThemingRule[] | ITokenColorizationSetting | boolean | string | undefined;
	comments?: string | ITokenColorizationSetting;
	strings?: string | ITokenColorizationSetting;
	numbers?: string | ITokenColorizationSetting;
	keywords?: string | ITokenColorizationSetting;
	types?: string | ITokenColorizationSetting;
	functions?: string | ITokenColorizationSetting;
	variables?: string | ITokenColorizationSetting;
	textMateRules?: ITextMateThemingRule[];
	semanticHighlighting?: boolean; // deprecated, use ISemanticTokenColorCustomizations.enabled instead
}

export interface ITokenColorCustomizations {
	[groupIdOrThemeScope: string]: IThemeScopedTokenColorCustomizations | ITextMateThemingRule[] | ITokenColorizationSetting | boolean | string | undefined;
	comments?: string | ITokenColorizationSetting;
	strings?: string | ITokenColorizationSetting;
	numbers?: string | ITokenColorizationSetting;
	keywords?: string | ITokenColorizationSetting;
	types?: string | ITokenColorizationSetting;
	functions?: string | ITokenColorizationSetting;
	variables?: string | ITokenColorizationSetting;
	textMateRules?: ITextMateThemingRule[];
	semanticHighlighting?: boolean; // deprecated, use ISemanticTokenColorCustomizations.enabled instead
}

export interface IThemeScopedSemanticTokenColorCustomizations {
	[styleRule: string]: ISemanticTokenRules | boolean | undefined;
	enabled?: boolean;
	rules?: ISemanticTokenRules;
}

export interface ISemanticTokenColorCustomizations {
	[styleRuleOrThemeScope: string]: IThemeScopedSemanticTokenColorCustomizations | ISemanticTokenRules | boolean | undefined;
	enabled?: boolean;
	rules?: ISemanticTokenRules;
}

export interface IThemeScopedExperimentalSemanticTokenColorCustomizations {
	[themeScope: string]: ISemanticTokenRules | undefined;
}

export interface IExperimentalSemanticTokenColorCustomizations {
	[styleRuleOrThemeScope: string]: IThemeScopedExperimentalSemanticTokenColorCustomizations | ISemanticTokenRules | undefined;
}

export type IThemeScopedCustomizations =
	IThemeScopedColorCustomizations
	| IThemeScopedTokenColorCustomizations
	| IThemeScopedExperimentalSemanticTokenColorCustomizations
	| IThemeScopedSemanticTokenColorCustomizations;

export type IThemeScopableCustomizations =
	IColorCustomizations
	| ITokenColorCustomizations
	| IExperimentalSemanticTokenColorCustomizations
	| ISemanticTokenColorCustomizations;

export interface ISemanticTokenRules {
	[selector: string]: string | ISemanticTokenColorizationSetting | undefined;
}

export interface ITextMateThemingRule {
	name?: string;
	scope?: string | string[];
	settings: ITokenColorizationSetting;
}

export interface ITokenColorizationSetting {
	foreground?: string;
	background?: string;
	fontStyle?: string; /* [italic|bold|underline|strikethrough] */
	fontFamily?: string;
	fontSize?: number;
	lineHeight?: number;
}

export interface ISemanticTokenColorizationSetting {
	foreground?: string;
	fontStyle?: string; /* [italic|bold|underline|strikethrough] */
	bold?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	italic?: boolean;
}

export interface ExtensionData {
	extensionId: string;
	extensionPublisher: string;
	extensionName: string;
	extensionIsBuiltin: boolean;
}

export namespace ExtensionData {
	export function toJSONObject(d: ExtensionData | undefined): any {
		return d && { _extensionId: d.extensionId, _extensionIsBuiltin: d.extensionIsBuiltin, _extensionName: d.extensionName, _extensionPublisher: d.extensionPublisher };
	}
	export function fromJSONObject(o: any): ExtensionData | undefined {
		if (o && isString(o._extensionId) && isBoolean(o._extensionIsBuiltin) && isString(o._extensionName) && isString(o._extensionPublisher)) {
			return { extensionId: o._extensionId, extensionIsBuiltin: o._extensionIsBuiltin, extensionName: o._extensionName, extensionPublisher: o._extensionPublisher };
		}
		return undefined;
	}
	export function fromName(publisher: string, name: string, isBuiltin = false): ExtensionData {
		return { extensionPublisher: publisher, extensionId: `${publisher}.${name}`, extensionName: name, extensionIsBuiltin: isBuiltin };
	}
}

export interface IThemeExtensionPoint {
	id: string;
	label?: string;
	description?: string;
	path: string;
	uiTheme?: ThemeTypeSelector;
	_watch: boolean; // unsupported options to watch location
}
