import { Transforms, ok, err } from "./transform";

const transforms: Transforms = {
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
        async transform(input, { turndown, saveAttachment, mime, moment }) {
            for (const type of input.types) {
                if (type.startsWith("image/")) {
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
                    await saveAttachment(name, ext, await blob.arrayBuffer());
                    return ok(`![[${name}.${ext}]]`);
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

export default transforms;
