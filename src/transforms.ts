import { ok, err, Transforms } from "./transform";
import { Vault } from "obsidian";

function privilegedWrapper({ vault }: { vault: Vault }): Transforms {
    return {
        smartJoin: {
            type: "text",
            transform(text: string) {
                return ok(
                    text
                        .split("\n")
                        .map((x) => x.trim())
                        .reduce((acc, cur, idx) => {
                            return acc.endsWith("-")
                                ? `${acc.slice(0, -1)}${cur}`
                                : cur !== ""
                                ? `${acc} ${cur}`
                                : `${acc}\n`;
                        })
                );
            },
        },
        joinLines: {
            type: "text",
            transform(text: string) {
                return ok(text.split("\n").join(""));
            },
        },
        removeBlankLines: {
            type: "text",
            transform(text) {
                return ok(
                    text
                        .split("\n")
                        .filter((x) => x.trim() !== "")
                        .join("\n")
                );
            },
        },
        rawHTML: {
            type: "blob",
            async transform(input) {
                if (!input.types.includes("text/html")) {
                    return err("No html found in clipboard!");
                }
                const html = await input.getType("text/html");
                return ok(await html.text());
            },
        },
    };
}

export default privilegedWrapper;
