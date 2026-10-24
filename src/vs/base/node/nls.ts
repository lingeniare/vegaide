/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from '../common/path.js';
import { promises } from 'fs';
import { createHash } from 'crypto';
import { mark } from '../common/performance.js';
import { ILanguagePacks, INLSConfiguration } from '../../nls.js';
import { Promises } from './pfs.js';

export interface IResolveNLSConfigurationContext {

	/**
	 * Location where `nls.messages.json` and `nls.keys.json` are stored.
	 */
	readonly nlsMetadataPath: string;

	/**
	 * Precomputed identity of the commit and NLS tables, supplied by packaged products.
	 */
	readonly nlsMetadataHash?: string;

	/**
	 * Path to the user data directory. Used as a cache for
	 * language packs converted to the format we need.
	 */
	readonly userDataPath: string;

	/**
	 * Commit of the running application. Can be `undefined`
	 * when not built.
	 */
	readonly commit: string | undefined;

	/**
	 * Locale as defined in `argv.json` or `app.getLocale()`.
	 */
	readonly userLocale: string;

	/**
	 * Locale as defined by the OS (e.g. `app.getPreferredSystemLanguages()`).
	 */
	readonly osLocale: string;

	/**
	 * Location of the extensions shipped with the product. Used to discover
	 * language packs bundled into the product when `languagepacks.json` does
	 * not exist yet (first launch).
	 */
	readonly builtinExtensionsPath?: string;
}

export async function resolveNLSConfiguration({ userLocale, osLocale, userDataPath, commit, nlsMetadataPath, nlsMetadataHash, builtinExtensionsPath }: IResolveNLSConfigurationContext): Promise<INLSConfiguration> {
	mark('code/willGenerateNls');

	if (
		process.env['VSCODE_DEV'] ||
		userLocale === 'pseudo' ||
		userLocale.startsWith('en') ||
		!commit ||
		!userDataPath
	) {
		return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
	}

	try {
		const languagePacks = await getLanguagePackConfigurations(userDataPath)
			?? await getBuiltinLanguagePackConfigurations(builtinExtensionsPath);
		if (!languagePacks) {
			return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
		}

		const resolvedLanguage = resolveLanguagePackLanguage(languagePacks, userLocale);
		if (!resolvedLanguage) {
			return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
		}

		const languagePack = languagePacks[resolvedLanguage];
		const mainLanguagePackPath = languagePack?.translations?.['vscode'];
		if (
			!languagePack ||
			typeof languagePack.hash !== 'string' ||
			!languagePack.translations ||
			typeof mainLanguagePackPath !== 'string' ||
			!(await Promises.exists(mainLanguagePackPath))
		) {
			return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
		}

		const languagePackId = `${languagePack.hash}.${resolvedLanguage}`;
		const globalLanguagePackCachePath = join(userDataPath, 'clp', languagePackId);
		const commitLanguagePackCachePath = join(globalLanguagePackCachePath, nlsMetadataHash ?? commit);
		const languagePackMessagesFile = join(commitLanguagePackCachePath, 'nls.messages.json');
		const translationsConfigFile = join(globalLanguagePackCachePath, 'tcf.json');
		const languagePackCorruptMarkerFile = join(globalLanguagePackCachePath, 'corrupted.info');

		if (await Promises.exists(languagePackCorruptMarkerFile)) {
			await promises.rm(globalLanguagePackCachePath, { recursive: true, force: true, maxRetries: 3 }); // delete corrupted cache folder
		}

		const result: INLSConfiguration = {
			userLocale,
			osLocale,
			resolvedLanguage,
			defaultMessagesFile: join(nlsMetadataPath, 'nls.messages.json'),
			languagePack: {
				translationsConfigFile,
				messagesFile: languagePackMessagesFile,
				corruptMarkerFile: languagePackCorruptMarkerFile
			},

			// NLS: below properties are a relic from old times only used by vscode-nls and deprecated
			locale: userLocale,
			availableLanguages: { '*': resolvedLanguage },
			_languagePackId: languagePackId,
			_languagePackSupport: true,
			_translationsConfigFile: translationsConfigFile,
			_cacheRoot: globalLanguagePackCachePath,
			_resolvedLanguagePackCoreLocation: commitLanguagePackCachePath,
			_corruptedFile: languagePackCorruptMarkerFile
		};

		if (await Promises.exists(languagePackMessagesFile)) {
			touch(commitLanguagePackCachePath).catch(() => { }); // We don't wait for this. No big harm if we can't touch
			mark('code/didGenerateNls');
			return result;
		}

		const [
			nlsDefaultKeys,
			nlsDefaultMessages,
			nlsPackdata
		]:
			[Array<[string, string[]]>, string[], { contents: Record<string, Record<string, string>> }]
			//      ^moduleId ^nlsKeys                               ^moduleId      ^nlsKey ^nlsValue
			= await Promise.all([
				promises.readFile(join(nlsMetadataPath, 'nls.keys.json'), 'utf-8').then(content => JSON.parse(content)),
				promises.readFile(join(nlsMetadataPath, 'nls.messages.json'), 'utf-8').then(content => JSON.parse(content)),
				promises.readFile(mainLanguagePackPath, 'utf-8').then(content => JSON.parse(content)),
			]);

		const nlsResult: string[] = [];

		// We expect NLS messages to be in a flat array in sorted order as they
		// where produced during build time. We use `nls.keys.json` to know the
		// right order and then lookup the related message from the translation.
		// If a translation does not exist, we fallback to the default message.

		let nlsIndex = 0;
		for (const [moduleId, nlsKeys] of nlsDefaultKeys) {
			const moduleTranslations = nlsPackdata.contents[moduleId];
			for (const nlsKey of nlsKeys) {
				nlsResult.push(moduleTranslations?.[nlsKey] || nlsDefaultMessages[nlsIndex]);
				nlsIndex++;
			}
		}

		await promises.mkdir(commitLanguagePackCachePath, { recursive: true });

		await Promise.all([
			promises.writeFile(languagePackMessagesFile, JSON.stringify(nlsResult), 'utf-8'),
			promises.writeFile(translationsConfigFile, JSON.stringify(languagePack.translations), 'utf-8')
		]);

		mark('code/didGenerateNls');

		return result;
	} catch (error) {
		console.error('Generating translation files failed.', error);
	}

	return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
}

/**
 * The `languagepacks.json` file is a JSON file that contains all metadata
 * about installed language extensions per language. Specifically, for
 * core (`vscode`) and all extensions it supports, it points to the related
 * translation files.
 *
 * The file is updated whenever a new language pack is installed or removed.
 */
async function getLanguagePackConfigurations(userDataPath: string): Promise<ILanguagePacks | undefined> {
	const configFile = join(userDataPath, 'languagepacks.json');
	try {
		return JSON.parse(await promises.readFile(configFile, 'utf-8'));
	} catch (err) {
		return undefined; // Do nothing. If we can't read the file we have no language pack config.
	}
}

interface IMutableLanguagePack {
	hash: string;
	label: string | undefined;
	extensions: { extensionIdentifier: { id: string }; version: string }[];
	translations: Record<string, string | undefined>;
}

interface IBundledExtensionManifest {
	publisher?: string;
	name?: unknown;
	version?: unknown;
	contributes?: {
		localizations?: {
			languageId?: unknown;
			languageName?: unknown;
			localizedLanguageName?: unknown;
			translations?: { id?: unknown; path?: unknown }[];
		}[];
	};
}

/**
 * `languagepacks.json` is written by the shared process at runtime, so it
 * does not exist on the very first launch of the product. To still resolve
 * a language provided by a language pack that ships inside the product,
 * scan the built-in extensions folder for localization contributions.
 */
async function getBuiltinLanguagePackConfigurations(builtinExtensionsPath: string | undefined): Promise<ILanguagePacks | undefined> {
	if (!builtinExtensionsPath) {
		return undefined;
	}

	let extensionFolderNames: string[];
	try {
		extensionFolderNames = await promises.readdir(builtinExtensionsPath);
	} catch (error) {
		return undefined;
	}

	const languagePacks: Record<string, IMutableLanguagePack> = {};
	for (const extensionFolderName of extensionFolderNames) {
		const extensionPath = join(builtinExtensionsPath, extensionFolderName);
		let manifest: IBundledExtensionManifest;
		try {
			manifest = JSON.parse(await promises.readFile(join(extensionPath, 'package.json'), 'utf-8'));
		} catch (error) {
			continue;
		}
		if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string' || !Array.isArray(manifest.contributes?.localizations)) {
			continue;
		}

		const extensionIdentifierId = `${manifest.publisher ?? 'undefined_publisher'}.${manifest.name}`.toLowerCase();
		for (const localization of manifest.contributes.localizations) {
			if (typeof localization.languageId !== 'string' || !Array.isArray(localization.translations)) {
				continue;
			}
			const translations = localization.translations.filter((t): t is { id: string; path: string } => typeof t.id === 'string' && typeof t.path === 'string');
			if (!translations.length) {
				continue;
			}

			const languagePack = languagePacks[localization.languageId] ??= {
				hash: '',
				label: typeof localization.localizedLanguageName === 'string' ? localization.localizedLanguageName
					: typeof localization.languageName === 'string' ? localization.languageName : undefined,
				extensions: [],
				translations: {}
			};
			if (!languagePack.extensions.some(e => e.extensionIdentifier.id === extensionIdentifierId)) {
				languagePack.extensions.push({ extensionIdentifier: { id: extensionIdentifierId }, version: manifest.version });
			}
			for (const translation of translations) {
				languagePack.translations[translation.id] = join(extensionPath, translation.path);
			}
		}
	}

	const languages = Object.keys(languagePacks);
	if (!languages.length) {
		return undefined;
	}
	for (const language of languages) {
		const languagePack = languagePacks[language];
		const md5 = createHash('md5');
		for (const extension of languagePack.extensions) {
			md5.update(extension.extensionIdentifier.id).update(extension.version);
		}
		languagePack.hash = md5.digest('hex');
	}

	return languagePacks;
}

function resolveLanguagePackLanguage(languagePacks: ILanguagePacks, locale: string | undefined): string | undefined {
	try {
		while (locale) {
			if (languagePacks[locale]) {
				return locale;
			}

			const index = locale.lastIndexOf('-');
			if (index > 0) {
				locale = locale.substring(0, index);
			} else {
				return undefined;
			}
		}
	} catch (error) {
		console.error('Resolving language pack configuration failed.', error);
	}

	return undefined;
}

function defaultNLSConfiguration(userLocale: string, osLocale: string, nlsMetadataPath: string): INLSConfiguration {
	mark('code/didGenerateNls');

	return {
		userLocale,
		osLocale,
		resolvedLanguage: 'en',
		defaultMessagesFile: join(nlsMetadataPath, 'nls.messages.json'),

		// NLS: below 2 are a relic from old times only used by vscode-nls and deprecated
		locale: userLocale,
		availableLanguages: {}
	};
}

//#region fs helpers

function touch(path: string): Promise<void> {
	const date = new Date();

	return promises.utimes(path, date, date);
}

//#endregion
