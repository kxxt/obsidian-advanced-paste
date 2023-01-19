import { Transforms, ok, err } from "transform";

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

export default transforms;
