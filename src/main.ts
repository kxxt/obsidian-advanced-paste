import {
    App,
    Editor,
    MarkdownFileInfo,
    MarkdownView,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    TFolder,
    Vault,
} from "obsidian";
import transformsWrapper from "./transforms";
import * as _ from "lodash";
import { Transform, TransformUtils, TransformUtilsBase } from "./transform";
import TurnDownService from "turndown";
import TurndownService from "turndown";
import { getAvailablePathForAttachments } from "obsidian-community-lib";
import mime from "mime-types";
import moment from "moment";
// No types for this plugin, so we have to use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gfm } = require("turndown-plugin-gfm");

interface AdvancedPasteSettings {
    scriptDir: string;
    turndown: TurnDownService.Options;
}

const DEFAULT_SETTINGS: AdvancedPasteSettings = {
    scriptDir: "advpaste",
    turndown: {
        headingStyle: "atx",
        hr: "* * *",
        bulletListMarker: "-",
        codeBlockStyle: "fenced",
        fence: "```",
        emDelimiter: "*",
        strongDelimiter: "**",
        linkStyle: "inlined",
        linkReferenceStyle: "full",
        // preformattedCode: false,
    },
};

function initTurnDown(options: TurndownService.Options): TurnDownService {
    const turndown = new TurndownService(options);
    turndown.use(gfm);
    return turndown;
}

async function executePaste(
    transform: Transform,
    utilsBase: TransformUtilsBase,
    vault: Vault,
    withinEvent: boolean,
    editor: Editor,
    view: MarkdownFileInfo
): Promise<string | null> {
    let result;
    const file = view.file;
    if (file == null) {
        new Notice("Advanced paste: Can't determine active file!");
        console.log(view);
        throw new Error(
            "Advanced paste: Can't determine active file!, view is"
        );
    }
    const utils: TransformUtils = {
        ...utilsBase,
        async saveAttachment(name, ext, data) {
            const path = await getAvailablePathForAttachments(name, ext, file);
            return vault.createBinary(path, data);
        },
    };
    const internalParams = { shouldHandleImagePasting: !withinEvent };
    try {
        if (transform.type == "text") {
            const input = await navigator.clipboard.readText();
            result = transform.transform(input, utils, internalParams);
        } else if (transform.type == "blob") {
            const inputs = await navigator.clipboard.read();
            if (inputs.length > 0) {
                result = transform.transform(inputs[0], utils, internalParams);
            } else new Notice("Nothing to paste!");
        } else {
            throw new Error("Unsupported input type");
        }
    } catch (e) {
        if (
            e instanceof DOMException &&
            e.message == "No valid data on clipboard."
        ) {
            return null;
        }
        throw e;
    }
    const resultStringHandler = (str: string) => {
        if (!withinEvent) editor.replaceSelection(str);
        return str;
    };
    result = await Promise.resolve(result);
    if (typeof result == "string") return resultStringHandler(result);
    else if (result?.kind == "ok") {
        return resultStringHandler(result.value);
    } else {
        new Notice(result?.value ?? "An error occurred in Advanced Paste.");
    }
    return null;
}

export default class AdvancedPastePlugin extends Plugin {
    settings: AdvancedPasteSettings;
    utils: TransformUtilsBase;

    registerTransform(
        transformId: string,
        transform: Transform,
        transformName: null | string = null
    ) {
        this.addCommand({
            id: transformId,
            name: transformName ?? _.startCase(transformId),
            editorCallback: _.partial(
                executePaste,
                transform,
                this.utils,
                this.app.vault,
                false
            ),
        });
    }

    async onload() {
        await this.loadSettings();
        this.utils = {
            turndown: initTurnDown(this.settings.turndown),
            mime,
            _,
            moment,
        };
        const transforms = transformsWrapper({ vault: this.app.vault });
        for (const transformId in transforms) {
            const transform = transforms[transformId];
            this.registerTransform(transformId, transform);
        }
        const vault = this.app.vault;
        const { scriptDir = DEFAULT_SETTINGS.scriptDir } = this.settings;
        // Wait for vault to be loaded
        this.app.workspace.onLayoutReady(async () => {
            const fileOrFolder = vault.getAbstractFileByPath(scriptDir);
            if (fileOrFolder instanceof TFolder) {
                const scriptFolder = fileOrFolder;
                const entries = await scriptFolder.children;
                for (const entry of entries) {
                    let module;
                    if (
                        entry instanceof TFile &&
                        (entry.name.endsWith(".js") ||
                            entry.name.endsWith(".mjs"))
                    ) {
                        console.log(
                            `Advanced Paste: Loading script ${entry.name}`
                        );
                        try {
                            module = await import(
                                "data:text/javascript," +
                                    (await vault.read(entry))
                            );
                        } catch (e) {
                            new Notice(
                                `Advanced Paste failed to load script: ${entry}\nPlease check your script!`
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
                                `custom-${prop}`,
                                transform,
                                _.startCase(prop)
                            );
                        }
                    }
                }
            }
            this.app.workspace.on("editor-paste", async (evt, editor, info) => {
                // evt.stopPropagation();
                // evt.preventDefault();
                const result = await executePaste(
                    transforms["default"],
                    this.utils,
                    this.app.vault,
                    true,
                    editor,
                    info
                );
                if (result == null) {
                    return;
                }
                evt.clipboardData?.clearData();
                evt.clipboardData?.setData("text/plain", result);
            });
        });
        this.addCommand({
            id: `advpaste-debug`,
            name: "Dump Clipboard to Console",
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                const contents = await navigator.clipboard.read();
                console.log(contents);
            },
        });
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
        this.utils.turndown = initTurnDown(this.settings.turndown);
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
            text: "You need to disable and re-enable this plugin in order to apply the changes to the script directory",
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
        containerEl.createEl("h2", {
            text: "Turndown Settings",
        });
        containerEl.createEl("p", {
            text: "Turndown is a library that converts HTML to Markdown. Some transforms in this plugin use it. You can configure it here.",
        });
        new Setting(containerEl)
            .setName("Heading Style")
            .setDesc("atx for `# heading`, setext for line under `heading`")
            .addDropdown((dropdown) => {
                dropdown.addOption("atx", "atx");
                dropdown.addOption("setext", "setext");
                dropdown.addOption("", "turndown default");
                dropdown.setValue(
                    this.plugin.settings.turndown.headingStyle ?? ""
                );
                dropdown.onChange(async (value) => {
                    this.plugin.settings.turndown.headingStyle =
                        value === ""
                            ? undefined
                            : (value as TurndownService.Options["headingStyle"]);
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Bullet List Marker")
            .addText((text) => {
                text.setPlaceholder("-")
                    .setValue(
                        this.plugin.settings.turndown.bulletListMarker ?? "-"
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.turndown.bulletListMarker =
                            value as TurndownService.Options["bulletListMarker"];
                        await this.plugin.saveSettings();
                    });
            });
        new Setting(containerEl)
            .setName("Code Block Style")
            .addDropdown((dropdown) => {
                dropdown.addOption("fenced", "fenced");
                dropdown.addOption("indented", "indented");
                dropdown.addOption("", "turndown default");
                dropdown.setValue(
                    this.plugin.settings.turndown.codeBlockStyle ?? ""
                );
                dropdown.onChange(async (value) => {
                    this.plugin.settings.turndown.codeBlockStyle =
                        value === ""
                            ? undefined
                            : (value as TurndownService.Options["codeBlockStyle"]);
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Code Block Fence Style")
            .addDropdown((dropdown) => {
                dropdown.addOption("```", "```");
                dropdown.addOption("~~~", "~~~");
                dropdown.addOption("", "turndown default");
                dropdown.setValue(this.plugin.settings.turndown.fence ?? "");
                dropdown.onChange(async (value) => {
                    this.plugin.settings.turndown.fence =
                        value === ""
                            ? undefined
                            : (value as TurndownService.Options["fence"]);
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Emphasis Style")
            .addDropdown((dropdown) => {
                dropdown.addOption("*", "asterisk");
                dropdown.addOption("_", "underscore");
                dropdown.addOption("", "turndown default");
                dropdown.setValue(
                    this.plugin.settings.turndown.emDelimiter ?? ""
                );
                dropdown.onChange(async (value) => {
                    this.plugin.settings.turndown.emDelimiter =
                        value === ""
                            ? undefined
                            : (value as TurndownService.Options["emDelimiter"]);
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Strong Style")
            .addDropdown((dropdown) => {
                dropdown.addOption("**", "asterisk");
                dropdown.addOption("__", "underscore");
                dropdown.addOption("", "turndown default");
                dropdown.setValue(
                    this.plugin.settings.turndown.strongDelimiter ?? ""
                );
                dropdown.onChange(async (value) => {
                    this.plugin.settings.turndown.strongDelimiter =
                        value === ""
                            ? undefined
                            : (value as TurndownService.Options["strongDelimiter"]);
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Link Style")
            .addDropdown((dropdown) => {
                dropdown.addOption("inlined", "inlined");
                dropdown.addOption("referenced", "referenced");
                dropdown.addOption("", "turndown default");
                dropdown.setValue(
                    this.plugin.settings.turndown.linkStyle ?? ""
                );
                dropdown.onChange(async (value) => {
                    this.plugin.settings.turndown.linkStyle =
                        value === ""
                            ? undefined
                            : (value as TurndownService.Options["linkStyle"]);
                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Link Reference Style")
            .addDropdown((dropdown) => {
                dropdown.addOption("full", "full");
                dropdown.addOption("collapsed", "collapsed");
                dropdown.addOption("shortcut", "shortcut");
                dropdown.addOption("", "turndown default");
                dropdown.setValue(
                    this.plugin.settings.turndown.linkReferenceStyle ?? ""
                );
                dropdown.onChange(async (value) => {
                    this.plugin.settings.turndown.linkReferenceStyle =
                        value === ""
                            ? undefined
                            : (value as TurndownService.Options["linkReferenceStyle"]);
                    await this.plugin.saveSettings();
                });
            });
    }
}
