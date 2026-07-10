import { expect, test } from "bun:test";
import type { EnclosureCutoutChild } from "../lib/children";
import { resolveCutouts } from "../lib/cutouts";
import { DEFAULT_DESIGN_RULES } from "../lib/design-rules";
import type { EnclosureFeatures } from "../lib/types";

const edgeHeader = {
	id: "J1",
	center: { x: -21, y: 0 },
	lengthMm: 2.5,
	widthMm: 9,
	heightMm: 8.5,
	ftype: "simple_pin_header",
};

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
	componentBodies: [edgeHeader],
	topComponentHeightMm: 8.5,
	bottomComponentHeightMm: 0,
};

test("explicit cutouts with auto face reuse edge-connector face inference", () => {
	const explicit: EnclosureCutoutChild = {
		kind: "enclosurecutout",
		for: ".J1",
		resolvedId: "J1",
		at: edgeHeader.center,
		face: "auto",
	};
	const out = resolveCutouts(features, [explicit]);

	expect(out).toHaveLength(1);
	expect(out[0].face).toBe("-x");
	expect(out[0].widthMm).toBeCloseTo(
		edgeHeader.widthMm + 2 * DEFAULT_DESIGN_RULES.cutout.defaultMarginMm,
	);
	expect(out[0].heightMm).toBeCloseTo(
		edgeHeader.heightMm + 2 * DEFAULT_DESIGN_RULES.cutout.defaultMarginMm,
	);
	expect(out[0].zCenterAboveBoardMm).toBeCloseTo(edgeHeader.heightMm / 2);
});
