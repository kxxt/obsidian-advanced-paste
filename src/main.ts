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
import {
    Transform,
    TransformUtils,
    TransformUtilsBase,
    err,
    ok,
} from "./transform";
import TurnDownService from "turndown";
import TurndownService from "turndown";
import { getAvailablePathForAttachments } from "obsidian-community-lib";
import mime from "mime";
import moment from "moment";
import {
    AdvancedPasteSettingTab,
    AdvancedPasteSettings,
    DEFAULT_SETTINGS,
} from "./settings";
import { unified } from "unified";
import { remark } from "remark";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import * as unistUtilVisit from "unist-util-visit";
import * as unistUtilIs from "unist-util-is";
import remarkCtor from "./remark-ctor";

// No types for this plugin, so we have to use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { gfm } = require("turndown-plugin-gfm");

const AUTO_LINK_TITLE_REGEX =
    /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;

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

    async saveAttachment(
        name: string,
        ext: string,
        data: ArrayBuffer,
        sourceFile: TFile
    ) {
        const path = await getAvailablePathForAttachments(
            name,
            ext,
            sourceFile
        );
        return this.app.vault.createBinary(path, data);
    }

    async getClipboardData() {
        const data = await navigator.clipboard.read();
        if (data.length == 0) return null;
        return data[0];
    }

    async handleImagePaste(input: ClipboardItem, sourceFile: TFile) {
        for (const type of input.types) {
            if (type.startsWith("image/")) {
                const blob = await input.getType(type);
                const ext = mime.getExtension(type);
                if (!ext) {
                    return err(
                        `Failed to save attachment: Could not determine extension for mime type ${type}`
                    );
                }
                const name = `Pasted Image ${moment().format(
                    "YYYYMMDDHHmmss"
                )}`;
                await this.saveAttachment(
                    name,
                    ext,
                    await blob.arrayBuffer(),
                    sourceFile
                );
                return ok(`![[${name}.${ext}]]`);
            } else if (type == "text/plain") {
                const blob = await input.getType(type);
                const text = await blob.text();
                if (text.match(/^file:\/\/.+$/)) {
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        const fs = require("fs").promises;
                        const path = decodeURIComponent(text).replace(
                            /^file:\/\//,
                            ""
                        );
                        const mimeType = mime.getType(path);
                        if (!mimeType || !mimeType.startsWith("image/"))
                            throw new Error("Not an image file!");
                        const buffer = await fs.readFile(path);
                        const attachmentName = `Pasted Image ${moment().format(
                            "YYYYMMDDHHmmss"
                        )}`;
                        const ext = mime.getExtension(mimeType);
                        if (!ext)
                            throw new Error(
                                `No extension for mime type ${mimeType}`
                            );
                        await this.saveAttachment(
                            attachmentName,
                            ext,
                            buffer,
                            sourceFile
                        );
                        return ok(`![[${attachmentName}.${ext}]]`);
                    } catch (e) {
                        // 1. On mobile platform
                        // 2. Failed to resolve/copy file
                        console.log(
                            `Advanced paste: can't interpret ${text} as an image`,
                            e
                        );
                    }
                }
            }
        }
        return null;
    }

    async defaultPasteCommand(
        evt: ClipboardEvent | null,
        editor: Editor,
        info: MarkdownView | MarkdownFileInfo
    ) {
        const isManuallyTriggered = evt == null; // Not triggered by Ctrl+V
        if (
            !isManuallyTriggered &&
            (evt.clipboardData?.getData("application/x-advpaste-tag") ==
                "tag" ||
                AUTO_LINK_TITLE_REGEX.test(
                    evt.clipboardData?.getData("text/plain") ?? ""
                ))
        ) {
            // 1. Event was triggered by us, don't handle it again
            // 2. url, let obsidian-auto-link-title handle it
            return;
        }
        let html;
        if (isManuallyTriggered) {
            const items = await navigator.clipboard.read();
            if (info.file) {
                // Try to handle image paste first
                const res = await this.handleImagePaste(items[0], info.file);
                if (res != null) {
                    if (res.kind === "ok") {
                        editor.replaceSelection(res.value);
                    } else {
                        new Notice(res.value);
                        return;
                    }
                }
            }
            if (items.length == 0 || !items[0].types.includes("text/html"))
                return;
            const blob = await items[0].getType("text/html");
            html = await blob.text();
        } else {
            // Let obsidian handle image paste, do not handle it ourselves
            if (
                evt.clipboardData?.types.some(
                    (x) => x == "Files" || x.startsWith("image/")
                )
            )
                return;
            html = evt.clipboardData?.getData("text/html");
        }
        if (html) {
            evt?.preventDefault();
            evt?.stopPropagation();
            const md = this.utils.turndown.turndown(html);
            const processed = await remarkCtor(this.settings).process(md);
            const dat = new DataTransfer();
            dat.setData("text/html", `<pre>${processed}</pre>`);
            dat.setData("application/x-advpaste-tag", "tag");
            const e = new ClipboardEvent("paste", {
                clipboardData: dat,
            });
            // console.log(info);
            const clipboardMgr = (this.app.workspace.activeEditor as any)
                ._children[0].clipboardManager;
            // console.log(clipboardMgr);
            clipboardMgr.handlePaste(e, editor, info);
        }
    }

    async onload() {
        await this.loadSettings();
        this.utils = {
            turndown: initTurnDown(this.settings.turndown),
            mime,
            _,
            moment,
            remark: {
                unified,
                remark,
                remarkMath,
                remarkGfm,
                unistUtilVisit,
                unistUtilIs,
                remarkParse,
                remarkStringify,
            },
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
            this.addCommand({
                id: "default",
                name: "Default",
                editorCallback: (editor, info) => {
                    this.defaultPasteCommand(null, editor, info);
                },
            });
            if (this.settings.enhanceDefaultPaste) {
                this.app.workspace.on(
                    "editor-paste",
                    this.defaultPasteCommand.bind(this)
                );
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
        console.info(`${this.manifest.name} loaded!`);
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
