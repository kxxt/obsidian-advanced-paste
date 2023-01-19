import { Transforms, ok } from "transform";

const transforms: Transforms = {
	smartJoin: {
		type: "text",
		transform(text: string) {
			return ok(
				text
					.split("\n")
					.reduce(
						(acc, cur) =>
							acc.endsWith("-")
								? `${acc.slice(0, -1)}${cur.trim()}`
								: `${acc} ${cur.trim()}`,
						""
					)
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
};

export default transforms;
