import { expect, test } from "bun:test";
import * as modeling from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import { buildEnclosure } from "../lib/build-enclosure";
import { EnclosurePlacementSolver } from "../lib/placement-solver";
import { DEFAULT_PARAMS, type EnclosureFeatures } from "../lib/types";

const features: EnclosureFeatures = {
	outline: [
		{ x: -21, y: -15 },
		{ x: 21, y: -15 },
		{ x: 21, y: 15 },
		{ x: -21, y: 15 },
	],
	bounds: { minX: -21, minY: -15, maxX: 21, maxY: 15 },
	boardThicknessMm: 1.6,
	boardCenter: { x: 0, y: 0 },
	// no mounting holes → the corner fasteners are fallback screw bosses
	mountPoints: [],
	componentBodies: [
		{ id: "U1", center: { x: 0, y: 0 }, lengthMm: 12, widthMm: 9, heightMm: 2 },
	],
	topComponentHeightMm: 2,
	bottomComponentHeightMm: 0,
};

/**
 * A fallback corner fastener joins base+lid where there is no mounting
 * hole. On a board that fills its bounding box the boss must not pass through the
 * PCB slab, so it is rendered as an **external corner mounting ear** (a tab just
 * outside the cavity) and the shell grows corner tabs beyond its nominal outer
 * box.
 */
test("corner screw bosses render as external ears", () => {
	const solver = new EnclosurePlacementSolver({
		obstacles: features.componentBodies.map((b) => ({
			id: b.id,
			cx: b.center.x,
			cy: b.center.y,
			w: b.lengthMm,
			h: b.widthMm,
		})),
		mountPoints: [],
		boardBounds: features.bounds,
		anchor: DEFAULT_PARAMS.anchor,
		clearanceMm: 1,
		cornerFasteners: true,
		cornerInsetMm: 4,
	});
	solver.solve();

	const params = DEFAULT_PARAMS;
	const model = buildEnclosure(
		features,
		solver.getOutput(),
		params,
		[],
		modeling,
		measureBoundingBox,
	);

	// four corner ears with visible hardware
	expect(model.meta.bosses).toBe(4);
	expect(model.warnings.length).toBe(0);
	expect(model.hardware.filter((item) => item.role === "screw")).toHaveLength(
		4,
	);
	expect(model.hardware.filter((item) => item.role === "bushing")).toHaveLength(
		4,
	);
	// the ears extend the shell beyond its nominal outer box (board + walls)
	const boardW = features.bounds.maxX - features.bounds.minX;
	const nominalOuterW =
		boardW + 2 * params.boardClearanceMm + 2 * params.wallThicknessMm;
	const base = model.parts.find((p) => p.id === "base")!;
	expect(base.bounds.max[0] - base.bounds.min[0]).toBeGreaterThan(
		nominalOuterW + 2,
	);
});
