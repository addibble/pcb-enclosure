import { expect, test } from "bun:test";
import * as modeling from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import { buildEnclosure } from "../lib/build-enclosure";
import type { EnclosurePlacementOutput } from "../lib/placement-solver";
import { DEFAULT_PARAMS, type EnclosureFeatures } from "../lib/types";

const emptyPlacement: EnclosurePlacementOutput = {
	posts: [],
	bosses: [],
	warnings: [],
};

const withConnector = (body: EnclosureFeatures["componentBodies"][number]) =>
	({
		outline: [
			{ x: -30, y: -20 },
			{ x: 30, y: -20 },
			{ x: 30, y: 20 },
			{ x: -30, y: 20 },
		],
		bounds: { minX: -30, minY: -20, maxX: 30, maxY: 20 },
		boardThicknessMm: 1.6,
		boardCenter: { x: 0, y: 0 },
		mountPoints: [],
		componentBodies: [body],
		topComponentHeightMm: Math.max(4, body.heightMm),
		bottomComponentHeightMm: 0,
	}) satisfies EnclosureFeatures;

const build = (f: EnclosureFeatures) =>
	buildEnclosure(
		f,
		emptyPlacement,
		{ ...DEFAULT_PARAMS, autoCutouts: true },
		[],
		modeling,
		measureBoundingBox,
	);

test("a USB-C rounded_rect wall aperture renders a solid base + lid", () => {
	const f = withConnector({
		id: "J1",
		center: { x: 26, y: 0 },
		lengthMm: 9,
		widthMm: 7.3,
		heightMm: 3.2,
		ftype: "simple_connector",
		cutoutAperture: {
			shape: "rounded_rect",
			widthMm: 9.2,
			heightMm: 3.3,
			cornerRadiusMm: 1.65,
		},
		insertionDirection: "from_right",
	});
	const model = build(f);
	const base = model.parts.find((p) => p.id === "base")!;
	// the +x wall opening leaves the base as a real, bounded solid
	expect(base.bounds.max[0] - base.bounds.min[0]).toBeGreaterThan(0);
	expect(model.warnings).toHaveLength(0);
});

test("a D-hole (toggle) and a circle (barrel) render from part metadata", () => {
	for (const cutoutAperture of [
		{
			shape: "d_shape" as const,
			diameterMm: 6.1,
			flatOffsetMm: 2.3,
		},
		{
			shape: "circle" as const,
			diameterMm: 8,
		},
	]) {
		const f = withConnector({
			id: "J",
			center: { x: -27, y: 0 },
			lengthMm: 10,
			widthMm: 10,
			heightMm: 11,
			ftype: "simple_connector",
			cutoutAperture,
			insertionDirection: "from_left",
		});
		const model = build(f);
		const base = model.parts.find((p) => p.id === "base")!;
		expect(base.bounds.max[2] - base.bounds.min[2]).toBeGreaterThan(0);
	}
});
