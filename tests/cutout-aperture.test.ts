import { expect, test } from "bun:test";
import { resolveCutouts } from "../lib/cutouts";
import type { ComponentBody, EnclosureFeatures } from "../lib/types";

const usbCProfile = {
	shape: "rounded_rect" as const,
	widthMm: 9.2,
	heightMm: 3.3,
	cornerRadiusMm: 1.65,
};

const features = (bodies: ComponentBody[]): EnclosureFeatures => ({
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
	componentBodies: bodies,
	topComponentHeightMm: 4,
	bottomComponentHeightMm: 0,
});

test("a USB-C connector gets a rounded_rect aperture, not a body-sized rect", () => {
	// housing near the +x edge; insertion metadata says the mouth faces right
	const usbc: ComponentBody = {
		id: "J1",
		center: { x: 26, y: 0 },
		lengthMm: 9,
		widthMm: 7.3,
		heightMm: 3.2,
		ftype: "simple_connector",
		cutoutAperture: usbCProfile,
		insertionDirection: "from_right",
	};
	const [c] = resolveCutouts(features([usbc]), [], { autoCutouts: true });
	expect(c.face).toBe("+x");
	expect(c.shape).toBe("rounded_rect");
	expect(c.cornerRadiusMm).toBeCloseTo(1.65 + 0.5);
	// wall-width comes from the profile (9.2 + margin), not the housing y-extent
	// (7.3) that a bbox rectangle would have used
	expect(c.widthMm).toBeCloseTo(9.2 + 2 * 0.5);
	expect(c.heightMm).toBeCloseTo(3.3 + 2 * 0.5);
	// Without authored interaction metadata, vertical placement uses body center.
	expect(c.zCenterAboveBoardMm).toBeCloseTo(1.6);
});

test("embedded aperture metadata defines an auto cutout", () => {
	const connector: ComponentBody = {
		id: "J_EMBEDDED",
		center: { x: 26, y: 0 },
		lengthMm: 8,
		widthMm: 7,
		heightMm: 6,
		ftype: "simple_connector",
		insertionDirection: "from_right",
		cutoutAperture: {
			shape: "circle",
			diameterMm: 8,
		},
	};
	const [cutout] = resolveCutouts(features([connector]), [], {
		autoCutouts: true,
	});

	expect(cutout.shape).toBe("circle");
	expect(cutout.widthMm).toBe(9);
	expect(cutout.zCenterAboveBoardMm).toBe(3);
});

test("cable_insertion_center picks the wall and centers the opening along it", () => {
	// no insertion_direction; the inferred insert point sits just past +y
	const conn: ComponentBody = {
		id: "J2",
		center: { x: 0, y: 16 },
		lengthMm: 8,
		widthMm: 5,
		heightMm: 6,
		ftype: "simple_connector",
		cableInsertionCenter: { x: 3, y: 21 },
		cutoutAperture: usbCProfile,
	};
	const [c] = resolveCutouts(features([conn]), [], { autoCutouts: true });
	expect(c.face).toBe("+y");
	expect(c.center).toEqual({ x: 3, y: 21 });
});

test("cable insertion reach can open a wall even when the body center is farther inboard", () => {
	const flagConnector: ComponentBody = {
		id: "J2_FLAG",
		center: { x: 0, y: 9.9 },
		lengthMm: 4,
		widthMm: 7,
		heightMm: 4,
		ftype: "simple_connector",
		cableInsertionCenter: { x: 0, y: 20.3 },
		cutoutAperture: usbCProfile,
	};
	const [cutout] = resolveCutouts(features([flagConnector]), [], {
		autoCutouts: true,
	});
	expect(cutout.face).toBe("+y");
	expect(cutout.center).toEqual({ x: 0, y: 20.3 });
});

test("model body extent can reach a wall when the component center is farther inboard", () => {
	const connector: ComponentBody = {
		id: "J_BODY_REACH",
		center: { x: 17, y: 0 },
		lengthMm: 12,
		widthMm: 8,
		heightMm: 6,
		ftype: "simple_connector",
		insertionDirection: "from_right",
		cutoutAperture: usbCProfile,
	};

	expect(
		resolveCutouts(features([connector]), [], { autoCutouts: true }),
	).toHaveLength(1);
});

test("a connector without an aperture never gets an invented opening", () => {
	const generic: ComponentBody = {
		id: "J3",
		center: { x: -27, y: 0 },
		lengthMm: 4,
		widthMm: 6,
		heightMm: 5,
		ftype: "simple_connector",
		insertionDirection: "from_left",
	};
	expect(
		resolveCutouts(features([generic]), [], { autoCutouts: true }),
	).toHaveLength(0);
});

test("an incomplete declared aperture surfaces an error instead of using body bounds", () => {
	const incomplete: ComponentBody = {
		id: "J_INCOMPLETE",
		center: { x: -27, y: 0 },
		lengthMm: 4,
		widthMm: 6,
		heightMm: 5,
		ftype: "simple_connector",
		insertionDirection: "from_left",
		cutoutAperture: { shape: "rect" },
	};

	expect(() =>
		resolveCutouts(features([incomplete]), [], { autoCutouts: true }),
	).toThrow(/rect aperture requires width and height/);
});

test("a from_above connector auto-cuts the lid, even mid-board", () => {
	const vertical: ComponentBody = {
		id: "J4",
		center: { x: 0, y: 0 }, // nowhere near an edge
		lengthMm: 9,
		widthMm: 7,
		heightMm: 4,
		ftype: "simple_connector",
		cutoutAperture: usbCProfile,
		insertionDirection: "from_above",
	};
	const [c] = resolveCutouts(features([vertical]), [], { autoCutouts: true });
	expect(c.face).toBe("top");
	expect(c.shape).toBe("rounded_rect");
	expect(c.zCenterAboveBoardMm).toBe(0); // planar lid opening, not a wall height
});

test("an explicitly profiled button can opt into a lid cutout", () => {
	const button: ComponentBody = {
		id: "SW1",
		center: { x: 10, y: -5 },
		lengthMm: 6,
		widthMm: 6,
		heightMm: 15,
		ftype: "simple_chip",
		insertionDirection: "from_above",
		cutoutAperture: { shape: "circle", diameterMm: 4 },
	};
	const [cutout] = resolveCutouts(features([button]), [], {
		autoCutouts: true,
	});
	expect(cutout.face).toBe("top");
	expect(cutout.shape).toBe("circle");
	expect(cutout.center).toEqual(button.center);
});

test("auto cutouts are opt-in: off by default, on with autoCutouts:true", () => {
	const edge: ComponentBody = {
		id: "J5",
		center: { x: 26, y: 0 },
		lengthMm: 9,
		widthMm: 7.3,
		heightMm: 3.2,
		ftype: "simple_connector",
		insertionDirection: "from_right",
		cutoutAperture: usbCProfile,
	};
	// default: no auto detection
	expect(resolveCutouts(features([edge]))).toHaveLength(0);
	// opt in
	expect(
		resolveCutouts(features([edge]), [], { autoCutouts: true }),
	).toHaveLength(1);
	// explicit children resolve regardless of the auto setting
	const withExplicit = resolveCutouts(features([edge]), [
		{
			kind: "enclosurecutout",
			at: { x: 0, y: 0 },
			direction: "+z",
			shape: "circle",
			diameter: 8,
		},
	]);
	expect(withExplicit).toHaveLength(1);
	expect(withExplicit[0].origin).toBe("explicit");
});

test("auto cutouts require the component to be near the selected wall", () => {
	const mismatched: ComponentBody = {
		id: "J6",
		center: { x: 26, y: 0 }, // near +x, not -x
		lengthMm: 9,
		widthMm: 7,
		heightMm: 4,
		ftype: "simple_connector",
		insertionDirection: "from_left",
		cutoutAperture: usbCProfile,
	};
	expect(
		resolveCutouts(features([mismatched]), [], { autoCutouts: true }),
	).toHaveLength(0);
});

test("front/back insertion directions follow the face coordinate convention", () => {
	const front: ComponentBody = {
		id: "J7",
		center: { x: 0, y: -16 },
		lengthMm: 7,
		widthMm: 4,
		heightMm: 3,
		ftype: "simple_connector",
		insertionDirection: "from_front",
		cutoutAperture: usbCProfile,
	};
	const back: ComponentBody = {
		...front,
		id: "J8",
		center: { x: 0, y: 16 },
		insertionDirection: "from_back",
	};
	expect(
		resolveCutouts(features([front]), [], { autoCutouts: true })[0].face,
	).toBe("-y");
	expect(
		resolveCutouts(features([back]), [], { autoCutouts: true })[0].face,
	).toBe("+y");
});

test("an explicit cutout margin overrides aperture profile margin", () => {
	const usbc: ComponentBody = {
		id: "J9",
		center: { x: 26, y: 0 },
		lengthMm: 9,
		widthMm: 7.3,
		heightMm: 3.2,
		ftype: "simple_connector",
		cutoutAperture: usbCProfile,
		insertionDirection: "from_right",
	};
	const [c] = resolveCutouts(features([usbc]), [
		{
			kind: "enclosurecutout",
			for: ".J9",
			resolvedId: "J9",
			at: usbc.center,
			face: "auto",
			margin: 2,
		},
	]);
	expect(c.widthMm).toBeCloseTo(9.2 + 2 * 2);
	expect(c.heightMm).toBeCloseTo(3.3 + 2 * 2);
	expect(c.cornerRadiusMm).toBeCloseTo(1.65 + 2);
});
