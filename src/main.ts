import { Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { DEFAULT_SETTINGS, makeCapitalizeOnWordEnd } from './capitalize';
import type { SentenceCapitalizerSettings } from './capitalize';
import { DEFAULT_TWO_CAPS_SETTINGS, makeFixTwoInitialCapsOnWordEnd } from './twoCaps';
import type { TwoCapsSettings } from './twoCaps';
import { DEFAULT_DASH_SETTINGS, makeAutocorrectDashesOnWordEnd } from './dashes';
import type { DashSettings } from './dashes';

type AllSettings = SentenceCapitalizerSettings & TwoCapsSettings & DashSettings;

const DEFAULT_ALL_SETTINGS: AllSettings = {
	...DEFAULT_SETTINGS,
	...DEFAULT_TWO_CAPS_SETTINGS,
	...DEFAULT_DASH_SETTINGS,
};

const NEW_DEFAULTS_NOTICE =
	'Sentence Case & Dash Autocorrect: two new autocorrect features (TWo INitial CApitals, en/em-dashes) are now on by default. Open the plugin settings to turn them off if you don\'t want them.';

interface PluginData {
	settings?: Partial<AllSettings>;
	shownNewDefaultsNotice?: boolean;
}

const CAPITALIZE_LIST_ITEMS_DESC = 'Also auto-capitalize the first word of list and checkbox items, not just sentences.';
const FIX_TWO_INITIAL_CAPS_DESC =
	'Fix words that start with two capital letters followed by a lowercase letter, e.g. "THe" -> "The".';
const TWO_CAPS_EXCEPTIONS_DESC =
	'Words to never fix, separated by commas (exact, case-sensitive match), e.g. "IDs, CDs, TVs".';
const AUTOCORRECT_DASHES_DESC =
	'Convert typed hyphens into dashes: "word--word" -> em dash, "word - word" -> en dash. A single unspaced hyphen (e.g. "well-known") is left alone.';

function parseExceptions(value: string): string[] {
	return value
		.split(',')
		.map((word) => word.trim())
		.filter((word) => word.length > 0);
}

class SentenceCapitalizerSettingTab extends PluginSettingTab {
	plugin: SentenceCapitalizerPlugin;

	constructor(plugin: SentenceCapitalizerPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	// Obsidian 1.13+ reads this declaratively (and indexes it for settings
	// search); display() below is the fallback for older versions.
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Capitalize list items',
				desc: CAPITALIZE_LIST_ITEMS_DESC,
				control: { type: 'toggle', key: 'capitalizeListItems' },
			},
			{
				name: 'Fix two initial capitals',
				desc: FIX_TWO_INITIAL_CAPS_DESC,
				control: { type: 'toggle', key: 'fixTwoInitialCaps' },
			},
			{
				name: 'Two initial capitals exceptions',
				desc: TWO_CAPS_EXCEPTIONS_DESC,
				control: { type: 'text', key: 'twoCapsExceptionsText', placeholder: 'IDs, CDs, TVs' },
			},
			{
				name: 'Autocorrect dashes',
				desc: AUTOCORRECT_DASHES_DESC,
				control: { type: 'toggle', key: 'autocorrectDashes' },
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === 'twoCapsExceptionsText') return this.plugin.settings.twoCapsExceptions.join(', ');
		return this.plugin.settings[key as keyof AllSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'capitalizeListItems') {
			this.plugin.settings.capitalizeListItems = value as boolean;
		} else if (key === 'fixTwoInitialCaps') {
			this.plugin.settings.fixTwoInitialCaps = value as boolean;
		} else if (key === 'twoCapsExceptionsText') {
			this.plugin.settings.twoCapsExceptions = parseExceptions(value as string);
		} else if (key === 'autocorrectDashes') {
			this.plugin.settings.autocorrectDashes = value as boolean;
		} else {
			return;
		}
		await this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Capitalize list items')
			.setDesc(CAPITALIZE_LIST_ITEMS_DESC)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.capitalizeListItems).onChange(async (value) => {
					this.plugin.settings.capitalizeListItems = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Fix two initial capitals')
			.setDesc(FIX_TWO_INITIAL_CAPS_DESC)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.fixTwoInitialCaps).onChange(async (value) => {
					this.plugin.settings.fixTwoInitialCaps = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Two initial capitals exceptions')
			.setDesc(TWO_CAPS_EXCEPTIONS_DESC)
			.addText((text) =>
				text
					.setPlaceholder('IDs, CDs, TVs')
					.setValue(this.plugin.settings.twoCapsExceptions.join(', '))
					.onChange(async (value) => {
						this.plugin.settings.twoCapsExceptions = parseExceptions(value);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Autocorrect dashes')
			.setDesc(AUTOCORRECT_DASHES_DESC)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autocorrectDashes).onChange(async (value) => {
					this.plugin.settings.autocorrectDashes = value;
					await this.plugin.saveSettings();
				})
			);
	}
}

export default class SentenceCapitalizerPlugin extends Plugin {
	settings: AllSettings = DEFAULT_ALL_SETTINGS;
	private hasLoadedBefore = false;
	private shownNewDefaultsNotice = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SentenceCapitalizerSettingTab(this));
		this.registerEditorExtension(makeCapitalizeOnWordEnd(() => this.settings));
		this.registerEditorExtension(makeFixTwoInitialCapsOnWordEnd(() => this.settings));
		this.registerEditorExtension(makeAutocorrectDashesOnWordEnd(() => this.settings));
		await this.maybeShowNewDefaultsNotice();
	}

	/**
	 * Shows a one-time Notice to existing users updating into this version,
	 * since two new autocorrect features just turned on by default. Never
	 * shown on a fresh install (nothing to update from) or more than once.
	 */
	private async maybeShowNewDefaultsNotice(): Promise<void> {
		if (this.hasLoadedBefore && !this.shownNewDefaultsNotice) {
			new Notice(NEW_DEFAULTS_NOTICE, 15000);
			this.shownNewDefaultsNotice = true;
			await this.saveSettings();
		}
	}

	async loadSettings() {
		const stored = (await this.loadData()) as PluginData | null;
		this.settings = Object.assign({}, DEFAULT_ALL_SETTINGS, stored?.settings);
		// `stored` is non-null for anyone who has ever saved data with this
		// plugin before, including versions that predate this notice feature
		// -- that's what tells a genuinely fresh install (stored is null)
		// apart from an existing user updating into this version.
		this.hasLoadedBefore = stored != null;
		this.shownNewDefaultsNotice = stored?.shownNewDefaultsNotice ?? false;
	}

	async saveSettings() {
		const data: PluginData = { settings: this.settings, shownNewDefaultsNotice: this.shownNewDefaultsNotice };
		await this.saveData(data);
	}

	onunload() { }
}
