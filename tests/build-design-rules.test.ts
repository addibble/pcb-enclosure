import { expect, test } from "bun:test";
import * as modeling from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import { buildEnclosure } from "../lib/build-enclosure";
import { DEFAULT_DESIGN_RULES } from "../lib/design-rules";
import type { EnclosurePlacementOutput } from "../lib/placement-solver";
import { DEFAULT_PARAMS, type EnclosureFeatures } from "../lib/types";

const features: EnclosureFeatures = {
	outline: [
		{ x: -25, y: -15 },
		{ x: 25, y: -15 },
		{ x: 25, y: 15 },
		{ x: -25, y: 15 },
	],
	bounds: { minX: -25, minY: -15, maxX: 25, maxY: 15 },
	boardThicknessMm: 1.6,
	boardCenter: { x: 0, y: 0 },
	mountPoints: [],
	componentBodies: [],
	topComponentHeightMm: 5,
	bottomComponentHeightMm: 0,
};
const noPlacement: EnclosurePlacementOutput = {
	posts: [],
	bosses: [],
	warnings: [],
};

const headroomOf = (headroomOverTallestMm?: number) => {
	const params = {
		...DEFAULT_PARAMS,
		topHeadroomMm: 0, // let the tallest-component rule decide
		designRules:
			headroomOverTallestMm == null
				? undefined
				: { ...DEFAULT_DESIGN_RULES, headroomOverTallestMm },
	};
	return buildEnclosure(
		features,
		noPlacement,
		params,
		[],
		modeling,
		measureBoundingBox,
	).meta.headroom;
};

test("buildEnclosure honors injected design rules (headroomOverTallest)", () => {
	// default rule: 5mm tallest + 2mm headroom
	expect(headroomOf()).toBeCloseTo(7);
	// injected: 5mm tallest + 10mm headroom
	expect(headroomOf(10)).toBeCloseTo(15);
});

test("buildEnclosure raises standoff height for bottom-side clearance", () => {
	const bottomFeatures: EnclosureFeatures = {
		...features,
		componentBodies: [
			{
				id: "U_BOTTOM",
				center: { x: 0, y: 0 },
				lengthMm: 8,
				widthMm: 8,
				heightMm: 5,
				side: "bottom",
			},
		],
		topComponentHeightMm: 0,
		bottomComponentHeightMm: 5,
	};
	const model = buildEnclosure(
		bottomFeatures,
		noPlacement,
		DEFAULT_PARAMS,
		[],
		modeling,
		measureBoundingBox,
	);

	expect(model.meta.boardBottomZ).toBeCloseTo(
		DEFAULT_PARAMS.floorThicknessMm +
			5 +
			DEFAULT_DESIGN_RULES.component.bottomClearanceMm,
	);
	expect(model.warnings.some((w) => w.includes("standoffHeight raised"))).toBe(
		true,
	);
});
