import { expect, test } from "bun:test";
import type { EnclosureCutoutChild } from "../lib/children";
import { resolveCutouts } from "../lib/cutouts";
import { DEFAULT_DESIGN_RULES } from "../lib/design-rules";
import type { ComponentBody, EnclosureFeatures } from "../lib/types";

const M = DEFAULT_DESIGN_RULES.cutout.defaultMarginMm;

const features = (bodies: ComponentBody[]): EnclosureFeatures => ({
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
	componentBodies: bodies,
	topComponentHeightMm: 10,
	bottomComponentHeightMm: 0,
});

// a 1×n header on the -x edge, rotated so it runs along y (long axis = y)
const edgeHeader: ComponentBody = {
	id: "J1",
	center: { x: -21, y: 0 },
	lengthMm: 2.5, // x extent
	widthMm: 9, // y extent (runs along the wall)
	heightMm: 8.5,
	ftype: "simple_pin_header",
	cutoutAperture: {
		shape: "rect",
		widthMm: 9,
		heightMm: 8.5,
		position: { z: 4.25 },
	},
};

test("auto cutouts: only edge-mount ftypes near an edge; sized face-relative", () => {
	const interiorButton: ComponentBody = {
		id: "SW1",
		center: { x: 8, y: 8 }, // 7mm from +y edge — but a button, not a connector
		lengthMm: 6,
		widthMm: 6,
		heightMm: 5,
		ftype: "simple_push_button",
	};
	const interiorConnector: ComponentBody = {
		id: "J9",
		center: { x: 0, y: 0 }, // 15mm from the nearest edge — unreachable
		lengthMm: 4,
		widthMm: 4,
		heightMm: 6,
		ftype: "simple_connector",
		cutoutAperture: {
			shape: "rect",
			widthMm: 4,
			heightMm: 6,
		},
	};
	const out = resolveCutouts(
		features([edgeHeader, interiorButton, interiorConnector]),
		[],
		{ autoCutouts: true },
	);
	// a button never gets an implicit hole in the side of the case, and an
	// interior connector can't be reached through a wall
	expect(out).toHaveLength(1);
	expect(out[0].id).toBe("J1");
	expect(out[0].face).toBe("-x");
	// an x-wall opening is sized from the y extent (along the wall) and the
	// body height (vertical) — never from the x extent
	expect(out[0].widthMm).toBeCloseTo(edgeHeader.widthMm + 2 * M);
	expect(out[0].heightMm).toBeCloseTo(edgeHeader.heightMm + 2 * M);
	// centered on the body's vertical middle
	expect(out[0].zCenterAboveBoardMm).toBeCloseTo(edgeHeader.heightMm / 2);
});

test("an explicit cutout for the same component suppresses its auto cutout", () => {
	const explicit: EnclosureCutoutChild = {
		kind: "enclosurecutout",
		for: ".J1",
		resolvedId: "J1",
		at: edgeHeader.center,
		face: "-x",
		footprintLengthMm: edgeHeader.lengthMm,
		footprintWidthMm: edgeHeader.widthMm,
		bodyHeightMm: edgeHeader.heightMm,
		margin: 1,
	};
	const out = resolveCutouts(features([edgeHeader]), [explicit], {
		autoCutouts: true,
	});
	// exactly one opening — the explicit one (margin 1), not a double-cut
	expect(out).toHaveLength(1);
	expect(out[0].widthMm).toBeCloseTo(edgeHeader.widthMm + 2);
	// side opening resolved from a component brackets the body vertically
	expect(out[0].zCenterAboveBoardMm).toBeCloseTo(edgeHeader.heightMm / 2);
});

test("explicit circle + direction resolution", () => {
	const out = resolveCutouts(features([]), [
		{
			kind: "enclosurecutout",
			at: { x: 5, y: 5 },
			direction: "+z",
			shape: "circle",
			diameter: 8,
		},
	]);
	expect(out).toHaveLength(1);
	expect(out[0].face).toBe("top");
	expect(out[0].shape).toBe("circle");
	expect(out[0].widthMm).toBeCloseTo(8 + 2 * M);
	expect(out[0].heightMm).toBeCloseTo(8 + 2 * M);
});
