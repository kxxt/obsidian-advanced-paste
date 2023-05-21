import { App, PluginSettingTab, Setting } from "obsidian";
import TurndownService from "turndown";
import TurnDownService from "turndown";
import AdvancedPastePlugin from "./main";

export interface AdvancedPasteSettings {
    scriptDir: string;
    turndown: TurnDownService.Options;
    enhanceDefaultPaste: boolean;
    autoLinkTitleRegex: RegExp;
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
    enhanceDefaultPaste: true,
    autoLinkTitleRegex:
        /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i,
};

export { DEFAULT_SETTINGS };

export class AdvancedPasteSettingTab extends PluginSettingTab {
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
        const hint = containerEl.createEl("h2", {
            text: "Please unbind Ctrl+V if you previously bind it to advanced paste's default paste command. Use the `Enhanced Ctrl+V` setting instead.",
        });
        hint.style.color = "orange";
        new Setting(containerEl)
            .setName("Enhanced Ctrl+V")
            .setDesc(
                "Enhance the default Ctrl+V behavior. You need to restart Obsidian for the changes to take effect."
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.enhanceDefaultPaste);
                toggle.onChange(async (value) => {
                    this.plugin.settings.enhanceDefaultPaste = value;
                    await this.plugin.saveSettings();
                });
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
        // new Setting(containerEl)
        //     .setName("Auto Link Title Regex")
        //     .setDesc("The regex used in the auto link title plugin.")
        //     .addText((text) =>
        //         text
        //             .setValue(this.plugin.settings.autoLinkTitleRegex.source)
        //             .onChange(async (value) => {
        //                 this.plugin.settings.autoLinkTitleRegex = new RegExp(
        //                     value
        //                 );
        //                 await this.plugin.saveSettings();
        //             })
        //     );
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
