import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import transforms from "transforms";
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
	if (typeof result == "string") editor.replaceSelection(result);
	else if (result?.kind == "ok") {
		editor.replaceSelection(result.value);
	} else {
		new Notice(result?.value ?? "An error occurred in Advanced Paste.");
	}
}

export default class AdvancedPastePlugin extends Plugin {
	settings: AdvancedPasteSettings;

	registerTransform(
		transformId: string,
		transform: Transform,
		transformName: null | string = null
	) {
		this.addCommand({
			id: `advpaste-${transformId}`,
			name: transformName ?? _.startCase(transformId),
			editorCallback: _.partial(executePaste, transform),
		});
	}

	async onload() {
		await this.loadSettings();
		// This adds an editor command that can perform some operation on the current editor instance
		for (const transformId in transforms) {
			const transform = transforms[transformId];
			this.registerTransform(transformId, transform);
		}
		const { adapter } = this.app.vault;
		const { scriptDir = DEFAULT_SETTINGS.scriptDir } = this.settings;
		if (
			(await adapter.exists(scriptDir)) &&
			(await adapter.stat(scriptDir))?.type == "folder"
		) {
			const { files } = await adapter.list(scriptDir);
			for (const filePath of files) {
				let module;
				if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
					try {
						module = await import(
							"data:text/javascript," +
								(await adapter.read(filePath))
						);
					} catch (e) {
						new Notice(
							`Advanced Paste failed to load script: ${filePath}\nPlease check your script!`
						);
						console.error("Advanced Paste Script Error:", e);
					}
				}
				if (!module) continue;
				for (const prop of Object.getOwnPropertyNames(module)) {
					const obj = module[prop];
					if (typeof obj == "function") {
						const { type = "text" } = obj;
						const transform = { type, transform: obj };
						this.registerTransform(
							`advpaste-custom-${prop}`,
							transform,
							_.startCase(prop)
						);
					}
				}
			}
		}
		// this.addCommand({
		// 	id: `advpaste-debug`,
		// 	name: "Debug",
		// 	editorCallback: async (editor: Editor, view: MarkdownView) => {
		// 		const contents = await navigator.clipboard.read();
		// 		console.log(contents);
		// 		// editor.replaceSelection(transform(text));
		// 	},
		// });
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AdvancedPasteSettingTab(this.app, this));
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

class AdvancedPasteSettingTab extends PluginSettingTab {
	plugin: AdvancedPastePlugin;

	constructor(app: App, plugin: AdvancedPastePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		const warning = containerEl.createEl("h2", {
			text: "Never add untrusted scripts to the script directory BECAUSE IT MIGHT DESTROY YOUR VAULT OR WORSE!",
		});
		warning.style.color = "red";
		containerEl.createEl("h2", {
			text: "You need to disable and re-enable this plugin to apply the changes to your custom transform scripts and the script directory.",
		});

		new Setting(containerEl)
			.setName("Script Directory")
			.setDesc("Directory for custom transforms.")
			.addText((text) =>
				text
					.setPlaceholder("advpaste")
					.setValue(this.plugin.settings.scriptDir)
					.onChange(async (value) => {
						this.plugin.settings.scriptDir = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
