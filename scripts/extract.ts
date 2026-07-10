/**
 * Run the enclosure feature extractor on an already-built Circuit JSON file.
 * No @tscircuit/core needed — pure analysis.
 *
 *   bun run scripts/extract.ts out/prefab-board.circuit.json
 */
import { readFileSync } from "node:fs";
import { resolveCutouts } from "../lib/cutouts";
import { extractEnclosureFeatures } from "../lib/extract-features";

const path = process.argv[2] ?? "out/prefab-board.circuit.json";
const cj = JSON.parse(readFileSync(path, "utf8"));
const f = extractEnclosureFeatures(cj);

console.log("file:", path);
console.log(
	"board bounds:",
	f.bounds,
	"thickness:",
	f.boardThicknessMm,
	"outlinePts:",
	f.outline.length,
);
console.log("mount points:", f.mountPoints.length);
for (const m of f.mountPoints)
	console.log(
		`  • (${m.center.x.toFixed(1)}, ${m.center.y.toFixed(1)})  Ø${m.pcbHoleDiameterMm}`,
	);
const cutouts = resolveCutouts(f, [], { autoCutouts: true }); // opt-in demo
console.log("cutouts:", cutouts.length);
for (const c of cutouts)
	console.log(
		`  • ${c.id} [${c.origin}] face=${c.face} ${c.shape} ${c.widthMm.toFixed(1)}x${c.heightMm.toFixed(1)}  @(${c.center.x.toFixed(1)},${c.center.y.toFixed(1)})${c.isFallback ? " (bbox fallback)" : ""}`,
	);
console.log("top component height:", f.topComponentHeightMm.toFixed(1), "mm");
console.log(
	"bottom component height:",
	f.bottomComponentHeightMm.toFixed(1),
	"mm",
);
console.log("component bodies:", f.componentBodies.length);
for (const b of f.componentBodies)
	console.log(
		`  • ${b.id} ${b.ftype ?? "?"} ${b.side ?? "top"}  ${b.lengthMm.toFixed(1)}x${b.widthMm.toFixed(1)}x${b.heightMm.toFixed(1)}`,
	);
