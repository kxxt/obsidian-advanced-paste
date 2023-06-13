import { TFile } from "obsidian";
import TurndownService from "turndown";
export type TransformType = "text" | "blob";

interface Ok<TValue> {
    kind: "ok";
    value: TValue;
}

interface Err<TError> {
    kind: "err";
    value: TError;
}

export function ok<TValue>(value: TValue): Ok<TValue> {
    return { kind: "ok", value };
}
export function err<TValue>(value: TValue): Err<TValue> {
    return { kind: "err", value };
}

export type TransformResult = Ok<string> | Err<string>;

export interface TransformUtilsBase {
    turndown: TurndownService;
    mime: typeof import("mime");
    _: typeof import("lodash");
    moment: typeof import("moment");
    remark: {
        unified: typeof import("unified").unified;
        remark: typeof import("remark").remark;
        remarkGfm: typeof import("remark-gfm").default;
        remarkMath: typeof import("remark-math").default;
        remarkParse: typeof import("remark-parse").default;
        remarkStringify: typeof import("remark-stringify").default;
        unistUtilVisit: typeof import("unist-util-visit");
        unistUtilIs: typeof import("unist-util-is");
    };
}

export interface TransformUtils extends TransformUtilsBase {
    saveAttachment: (
        name: string,
        ext: string,
        data: ArrayBuffer
    ) => Promise<TFile>;
}

export interface AdvpasteInternalParams {
    shouldHandleImagePasting: boolean;
}

export type TransformFunction = (
    input: string | ClipboardItem,
    utils: TransformUtils,
    internal: AdvpasteInternalParams
) => TransformResult | string;

export type TransformOutput =
    | string
    | Promise<string>
    | TransformResult
    | Promise<TransformResult>;

export interface BlobTransform {
    type: "blob";
    transform: (
        input: ClipboardItem,
        utils: TransformUtils,
        internal: AdvpasteInternalParams
    ) => TransformOutput;
}

export interface TextTransform {
    type: "text";
    transform: (
        input: string,
        utils: TransformUtils,
        internal: AdvpasteInternalParams
    ) => TransformOutput;
}

export type Transform = BlobTransform | TextTransform;

export interface Transforms {
    [id: string]: Transform;
}
