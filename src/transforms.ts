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
        default: {
            type: "blob",
            async transform(
                input,
                { turndown, saveAttachment, mime, moment },
                { shouldHandleImagePasting }
            ) {
                for (const type of input.types) {
                    if (type.startsWith("image/") && shouldHandleImagePasting) {
                        const blob = await input.getType(type);
                        const ext = mime.extension(type);
                        if (!ext) {
                            return err(
                                `Failed to save attachment: Could not determine extension for mime type ${type}`
                            );
                        }
                        const name = `Pasted Image ${moment().format(
                            "YYYYMMDDHHmmss"
                        )}`;
                        await saveAttachment(
                            name,
                            ext,
                            await blob.arrayBuffer()
                        );
                        return ok(`![[${name}.${ext}]]`);
                    } else if (type == "text/plain") {
                        const blob = await input.getType(type);
                        const text = await blob.text();
                        if (
                            text.match(/^file:\/\/.+$/) &&
                            shouldHandleImagePasting
                        ) {
                            try {
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                const fs = require("fs").promises;
                                const path = decodeURIComponent(text).replace(
                                    /^file:\/\//,
                                    ""
                                );
                                const mimeType = mime.lookup(path);
                                if (!mimeType || !mimeType.startsWith("image/"))
                                    throw new Error("Not an image file!");
                                const buffer = await fs.readFile(path);
                                const attachmentName = `Pasted Image ${moment().format(
                                    "YYYYMMDDHHmmss"
                                )}`;
                                const ext = mime.extension(mimeType);
                                if (!ext)
                                    throw new Error(
                                        `No extension for mime type ${mimeType}`
                                    );
                                await saveAttachment(
                                    attachmentName,
                                    ext,
                                    buffer
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
                if (input.types.includes("text/html")) {
                    const html = await input.getType("text/html");
                    return ok(turndown.turndown(await html.text()));
                }
                const text = await input.getType("text/plain");
                return ok(await text.text());
            },
        },
    };
}

export default privilegedWrapper;
