export type TransformType = "text" | "blob";

interface Ok<TValue> {
	kind: "ok";
	value: TValue;
}

interface Err<TError> {
	kind: "err";
	value: TError;
}

export type TransformResult = Ok<string> | Err<string>;

export type TransformFunction = (
	input: string | ClipboardItem
) => TransformResult;

export interface BlobTransform {
	type: "blob";
	transform: (input: ClipboardItem) => TransformResult;
}

export interface TextTransform {
	type: "text";
	transform: (input: string) => TransformResult;
}

export type Transform = BlobTransform | TextTransform;

export interface Transforms {
	[id: string]: Transform;
}
