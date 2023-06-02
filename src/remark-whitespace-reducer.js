import { is } from "unist-util-is";
import { visit, SKIP } from "unist-util-visit";

export default function remarkWhitespaceReducer() {
    return (tree, file) => {
        visit(tree, ["link", "heading"], (node, index, parent) => {
            // console.log(node);
            if (
                is(node, "heading") &&
                (node.children.length === 0 || // A heading without children
                    (node.children.length === 1 &&
                        is(node.children[0], "link") &&
                        node.children[0].children.length === 0)) // A heading with a single child that is an empty link
            ) {
                console.log("removing empty heading");
                parent.children.splice(index, 1);
                return [SKIP, index];
            } else if (is(node, "link") && node.children.length == 0) {
                console.log("removing empty link");
                parent.children.splice(index, 1);
                return [SKIP, index];
            }
        });
    };
}
