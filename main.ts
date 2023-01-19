import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import textTransforms from "text-transforms";
import * as _ from "lodash";
import { Transform } from "transform";
import { isPromise } from "util/types";

interface AdvancedPasteSettings {
	scriptDir: string;
}

const DEFAULT_SETTINGS: AdvancedPasteSettings = {
	scriptDir: "advpaste",
};

async function executePaste(
	transform: Transform,
	editor: Editor,
	view: MarkdownView
) {
	let result;
	if (transform.type == "text") {
		const input = await navigator.clipboard.readText();
		result = transform.transform(input);
	} else if (transform.type == "blob") {
		const inputs = await navigator.clipboard.read();
		if (inputs.length > 0) {
			result = transform.transform(inputs[0]);
		} else new Notice("Nothing to paste!");
	} else {
		throw new Error("Unsupported input type");
	}
	if (isPromise(result)) result = await result;
	if (result?.kind == "ok") {
		editor.replaceSelection(result.value);
	} else {
		new Notice(result?.value ?? "An error occurred in Advanced Paste.");
	}
}

export default class AdvancedPastePlugin extends Plugin {
	settings: AdvancedPasteSettings;

	async onload() {
		await this.loadSettings();
		// This adds an editor command that can perform some operation on the current editor instance
		for (const transformId in textTransforms) {
			const transform = textTransforms[transformId];
			this.addCommand({
				id: `advpaste-${transformId}`,
				name: _.startCase(transformId),
				editorCallback: _.partial(executePaste, transform),
			});
		}
		this.addCommand({
			id: `advpaste-debug`,
			name: "Debug",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const contents = await navigator.clipboard.read();
				console.log(contents);
				// editor.replaceSelection(transform(text));
			},
		});
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
		console.info("obsidian-advanced-pasted loaded!");
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: AdvancedPastePlugin;

	constructor(app: App, plugin: AdvancedPastePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// containerEl.createEl("h2", { text: "Settings for my awesome plugin." });

		new Setting(containerEl)
			.setName("Script Directory")
			.setDesc("Directory for custom transforms.")
			.addText((text) =>
				text
					.setPlaceholder("advpaste")
					.setValue(this.plugin.settings.scriptDir)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.plugin.settings.scriptDir = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
