import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import remarkWhitespaceReducer from "./remark-whitespace-reducer";
import { AdvancedPasteSettings } from "./settings";

export default function remarkCtor(pluginSettings: AdvancedPasteSettings) {
    return (
        unified()
            .use(remarkParse)
            .use(remarkGfm)
            .use(remarkMath)
            .use(remarkWhitespaceReducer)
            // @ts-expect-error
            .use(remarkStringify, {
                bullet: pluginSettings.turndown.bulletListMarker ?? "-",
                fence: pluginSettings.turndown.fence?.[0] ?? "`",
                setext: pluginSettings.turndown.headingStyle == "setext",
                strong: pluginSettings.turndown.strongDelimiter?.[0] ?? "*",
                emphasis: pluginSettings.turndown.emDelimiter?.[0] ?? "*",
            })
    );
}
