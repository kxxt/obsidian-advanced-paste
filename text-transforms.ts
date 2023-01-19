import { Transforms } from "transform";

const transforms: Transforms = {
	smartJoin: {
		type: "text",
		transform(text: string) {
			return {
				kind: "ok",
				value: text
					.split("\n")
					.reduce(
						(acc, cur) =>
							acc.endsWith("-")
								? `${acc.slice(0, -1)}${cur.trim()}`
								: `${acc} ${cur.trim()}`,
						""
					),
			};
		},
	},
	joinLines: {
		type: "text",
		transform(text: string) {
			return { kind: "ok", value: text.split("\n").join("") };
		},
	},
	removeBlankLines: {
		type: "text",
		transform(text) {
			return {
				kind: "ok",
				value: text
					.split("\n")
					.filter((x) => x.trim() !== "")
					.join("\n"),
			};
		},
	},
};

export default transforms;
