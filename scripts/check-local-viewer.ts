import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const viewerPath = resolve(
	import.meta.dirname,
	"../../runframe/dist/standalone.min.js",
);

let bundle: string;
try {
	bundle = readFileSync(viewerPath, "utf8");
} catch {
	throw new Error(
		`Missing local RunFrame bundle at ${viewerPath}. Build the sibling runframe enclosure-support branch first.`,
	);
}

if (
	!bundle.includes("enclosure_part_id") ||
	!bundle.includes("cadViewerPartOpacity") ||
	!bundle.includes("enclosure_explode_z_offset_mm") ||
	!bundle.includes("Exploded Enclosure")
) {
	throw new Error(
		`RunFrame bundle at ${viewerPath} does not include enclosure appearance and exploded-view controls.`,
	);
}

console.log(`using enclosure-enabled RunFrame bundle: ${viewerPath}`);
