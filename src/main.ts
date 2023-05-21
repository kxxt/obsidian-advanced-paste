import {
    Editor,
    MarkdownFileInfo,
    MarkdownView,
    Notice,
    Plugin,
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
import {
    AdvancedPasteSettingTab,
    AdvancedPasteSettings,
    DEFAULT_SETTINGS,
} from "./settings";
// No types for this plugin, so we have to use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gfm } = require("turndown-plugin-gfm");

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
            if (this.settings.enhanceDefaultPaste) {
                this.app.workspace.on("editor-paste", (evt, editor, info) => {
                    if (
                        evt.clipboardData?.getData(
                            "application/x-advpaste-tag"
                        ) == "tag" ||
                        this.settings.autoLinkTitleRegex.test(
                            evt.clipboardData?.getData("text/plain") ?? ""
                        )
                    ) {
                        // 1. Event was triggered by us, don't handle it again
                        // 2. url, let obsidian-auto-link-title handle it
                        return;
                    }
                    const html = evt.clipboardData?.getData("text/html");
                    if (html) {
                        evt.preventDefault();
                        evt.stopPropagation();
                        const md = this.utils.turndown.turndown(html);
                        const dat = new DataTransfer();
                        dat.setData("text/html", `<pre>${md}</pre>`);
                        dat.setData("application/x-advpaste-tag", "tag");
                        const e = new ClipboardEvent("paste", {
                            clipboardData: dat,
                        });
                        // console.log(info);
                        const clipboardMgr = (
                            this.app.workspace.activeEditor as any
                        )._children[0].clipboardManager;
                        // console.log(clipboardMgr);
                        clipboardMgr.handlePaste(e, editor, info);
                    }
                });
            }
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
