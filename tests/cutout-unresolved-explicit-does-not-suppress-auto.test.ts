import { expect, test } from "bun:test";
import type { EnclosureCutoutChild } from "../lib/children";
import { resolveCutouts } from "../lib/cutouts";
import type { EnclosureFeatures } from "../lib/types";

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
	componentBodies: [
		{
			id: "J1",
			center: { x: -21, y: 0 },
			lengthMm: 2.5,
			widthMm: 9,
			heightMm: 8.5,
			ftype: "simple_pin_header",
			cutoutAperture: {
				shape: "rect",
				widthMm: 9,
				heightMm: 8.5,
			},
		},
	],
	topComponentHeightMm: 8.5,
	bottomComponentHeightMm: 0,
};

test("an unresolved explicit cutout does not suppress a resolved auto cutout", () => {
	const explicit: EnclosureCutoutChild = {
		kind: "enclosurecutout",
		for: ".J1",
		resolvedId: "J1",
		// No `at`: this is not actually resolved and must not shadow auto.
	};
	const out = resolveCutouts(features, [explicit], { autoCutouts: true });

	expect(out).toHaveLength(1);
	expect(out[0].id).toBe("J1");
	expect(out[0].face).toBe("-x");
});
