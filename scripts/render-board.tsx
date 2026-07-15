/**
 * Write a representative prefab-board Circuit JSON fixture, then run the
 * enclosure feature extractor on it. This intentionally avoids importing
 * @tscircuit/core: the foundational layer is pure Circuit JSON analysis, and the
 * core package's broad runtime peer graph is not needed for this smoke check.
 *
 *   bun run scripts/render-board.tsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
	prefabBoardAperturesBySourceComponentId,
	prefabBoardCircuitJson,
} from "../examples/prefab-board-circuit-json";
import { resolveCutouts } from "../lib/cutouts";
import { extractEnclosureFeatures } from "../lib/extract-features";

const circuitJson = prefabBoardCircuitJson;

mkdirSync("out", { recursive: true });
writeFileSync(
	"out/prefab-board.circuit.json",
	JSON.stringify(circuitJson, null, 2),
);

const f = extractEnclosureFeatures(circuitJson, {
	aperturesBySourceComponentId: prefabBoardAperturesBySourceComponentId,
});
console.log("board bounds:", f.bounds, "thickness:", f.boardThicknessMm);
console.log("mount points:", f.mountPoints.length);
for (const m of f.mountPoints)
	console.log(
		`  • (${m.center.x.toFixed(1)}, ${m.center.y.toFixed(1)})  Ø${m.pcbHoleDiameterMm}`,
	);
const cutouts = resolveCutouts(f, [], { autoCutouts: true }); // opt-in demo
console.log("cutouts:", cutouts.length);
for (const c of cutouts)
	console.log(
		`  • ${c.id} [${c.origin}] face=${c.face} ${c.shape} ${c.widthMm.toFixed(1)}x${c.heightMm.toFixed(1)}`,
	);
console.log("top component height:", f.topComponentHeightMm.toFixed(1), "mm");
console.log(
	"bottom component height:",
	f.bottomComponentHeightMm.toFixed(1),
	"mm",
);
console.log("component bodies:", f.componentBodies.length);
