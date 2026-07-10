/**
 * Build an enclosure for a board and write one STL per part + a layered viewer.
 *
 *   bun run scripts/build.ts [out/prefab-board.circuit.json]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as modeling from "@jscad/modeling";
import { primitives } from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import { buildEnclosure } from "../lib/build-enclosure";
import {
	checkAssemblyCollisions,
	checkInsertionCollisions,
} from "../lib/assembly-check";
import { extractEnclosureFeatures } from "../lib/extract-features";
import { toStl } from "../lib/export";
import { EnclosurePlacementSolver } from "../lib/placement-solver";
import { DEFAULT_PARAMS } from "../lib/types";
import { viewerHtml, type ViewerLayer } from "../lib/viewer-html";

const path = process.argv[2] ?? "out/prefab-board.circuit.json";

const f = extractEnclosureFeatures(JSON.parse(readFileSync(path, "utf8")));
const obstacles = f.componentBodies.map((b) => ({
	id: b.id,
	cx: b.center.x,
	cy: b.center.y,
	w: b.lengthMm,
	h: b.widthMm,
}));
const solver = new EnclosurePlacementSolver({
	obstacles,
	mountPoints: f.mountPoints.map((m) => ({
		center: m.center,
		pcbHoleDiameterMm: m.pcbHoleDiameterMm,
	})),
	boardBounds: f.bounds,
	anchor: DEFAULT_PARAMS.anchor,
	clearanceMm: 1,
	cornerFasteners: true,
	cornerInsetMm: DEFAULT_PARAMS.cornerStandoffInsetMm,
});
solver.solve();

// auto cutouts are opt-in; enable them here so the demo STL shows the
// connectors' wall openings (real designs usually place explicit cutouts).
const params = { ...DEFAULT_PARAMS, autoCutouts: true };
const model = buildEnclosure(
	f,
	solver.getOutput(),
	params,
	[],
	modeling,
	measureBoundingBox,
);

// part appearance + explode direction (content Z-up frame)
const STYLE: Record<
	string,
	{ color: string; opacity: number; explode: [number, number, number] }
> = {
	base: { color: "#9aa0a6", opacity: 0.85, explode: [0, 0, 0] },
	lid: { color: "#5b8def", opacity: 0.5, explode: [0, 0, 1] },
};

const styleFor = (id: string) =>
	STYLE[id] ?? {
		color: "#9aa0a6",
		opacity: 0.8,
		explode: [0, 0, 0] as [number, number, number],
	};

mkdirSync("out", { recursive: true });
const layers: ViewerLayer[] = [];
for (const part of model.parts) {
	const stl = toStl(part.geom);
	writeFileSync(`out/${part.id}.stl`, stl);
	const [mn, mx] = [part.bounds.min, part.bounds.max];
	console.log(
		`${part.id}.stl  ${(stl.length / 1024).toFixed(0)}KB  bbox ${(mx[0] - mn[0]).toFixed(1)}x${(mx[1] - mn[1]).toFixed(1)}x${(mx[2] - mn[2]).toFixed(1)}mm`,
	);
	const s = styleFor(part.id);
	layers.push({
		name: part.id,
		stl,
		color: s.color,
		opacity: s.opacity,
		explode: s.explode,
	});
}

// PCB slab for the viewer
const bb = f.bounds;
const slab = toStl(
	primitives.cuboid({
		size: [bb.maxX - bb.minX, bb.maxY - bb.minY, f.boardThicknessMm],
		center: [0, 0, model.pcb.boardBottomZ + f.boardThicknessMm / 2],
	}),
);
writeFileSync("out/pcb.stl", slab);
layers.push({
	name: "pcb",
	stl: slab,
	color: "#2e7d32",
	opacity: 1,
	explode: [0, 0, 0],
});

writeFileSync("out/viewer.html", viewerHtml(layers, "Enclosure (split_shell)"));

console.log("\nmeta:", model.meta);
for (const w of model.warnings) console.log("⚠", w);

// Mounting-hardware BOM: group identical pieces (shared bomGroupKey) into lines.
if (model.bomItems.length) {
	const lines = new Map<
		string,
		{ qty: number; displayValue: string; mpn?: string; generic: boolean }
	>();
	for (const item of model.bomItems) {
		const line = lines.get(item.bomGroupKey);
		if (line) line.qty += 1;
		else
			lines.set(item.bomGroupKey, {
				qty: 1,
				displayValue: item.displayValue,
				mpn: item.manufacturerPartNumber,
				generic: item.generic,
			});
	}
	console.log("\nhardware BOM:");
	for (const line of lines.values())
		console.log(
			`  ${line.qty}× ${line.displayValue}${line.mpn ? ` [${line.mpn}]` : line.generic ? " [generic]" : ""}`,
		);
}

// Assembled-collision check (assembly DRC) — seated state
const collisions = checkAssemblyCollisions(model, f);
if (collisions.length === 0) {
	console.log("✓ assembly check (seated): no collisions");
} else {
	console.log(`✗ assembly check (seated): ${collisions.length} collision(s)`);
	for (const c of collisions)
		console.log(
			`  ✗ ${c.partId} ↔ ${c.against}  (${c.overlapMm3.toFixed(1)} mm³)`,
		);
}

// Swept-insertion check — can the board be placed (dropped in) at all?
const insertion = checkInsertionCollisions(model, f, params);
if (insertion.length === 0) {
	console.log("✓ insertion check (placement travel): clear");
} else {
	console.log(
		`✗ insertion check (placement travel): ${insertion.length} collision(s)`,
	);
	for (const c of insertion)
		console.log(
			`  ✗ ${c.partId} ↔ ${c.against}  (${c.overlapMm3.toFixed(1)} mm³)`,
		);
}

console.log(
	`\nwrote ${model.parts.map((p) => `out/${p.id}.stl`).join(", ")}, out/pcb.stl, out/viewer.html`,
);
