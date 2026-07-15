import { expect, test } from "bun:test";
import { buildEnclosure } from "../lib/build-enclosure";
import { resolveEnclosureParams } from "../lib/enclosure-props";
import { jscadPlan } from "../lib/jscad-plan";
import type { EnclosurePlacementOutput } from "../lib/placement-solver";
import type { EnclosureFeatures } from "../lib/types";

const features: EnclosureFeatures = {
	outline: [
		{ x: -20, y: -15 },
		{ x: 20, y: -15 },
		{ x: 20, y: 15 },
		{ x: -20, y: 15 },
	],
	bounds: { minX: -20, minY: -15, maxX: 20, maxY: 15 },
	boardThicknessMm: 1.6,
	boardCenter: { x: 0, y: 0 },
	mountPoints: [],
	componentBodies: [],
	topComponentHeightMm: 2,
	bottomComponentHeightMm: 0,
};

const placement: EnclosurePlacementOutput = {
	posts: [],
	bosses: [],
	warnings: [],
};

test("enclosure.fdm.box outer dimension overrides reach the generated shell", () => {
	const params = resolveEnclosureParams({
		boardRef: ".B1",
		width: "60mm",
		height: "50mm",
		depth: "25mm",
	});
	const model = buildEnclosure(features, placement, params, [], jscadPlan);

	expect(model.meta.outerW).toBe(60);
	expect(model.meta.outerH).toBe(50);
	expect(model.meta.totalH).toBe(25);
});
