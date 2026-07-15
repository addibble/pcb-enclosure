import { expect, test } from "bun:test";
import { enclosureProps, resolveEnclosureParams } from "pcb-enclosure";
import { DEFAULT_PARAMS } from "pcb-enclosure/renderer";

test("enclosureProps accepts unit strings and the opt-in flags", () => {
	const parsed = enclosureProps.parse({
		boardRef: ".B1",
		name: "EN1",
		width: "2in",
		depth: "20mm",
		wallThickness: "2.5mm",
		standoffHeight: "0.2in",
		anchor: "m3-self-tap",
		autoCutouts: true,
	});
	expect(parsed.name).toBe("EN1");
	expect(parsed.width).toBeCloseTo(50.8);
	expect(parsed.depth).toBe(20);
	expect(parsed.autoCutouts).toBe(true);
});

test("enclosureProps rejects unknown props instead of silently ignoring typos", () => {
	expect(() =>
		enclosureProps.parse({
			boardRef: ".B1",
			wallThicknes: "2mm",
		} as any),
	).toThrow(/Unrecognized key/);
});

test("resolveEnclosureParams maps props onto EnclosureParams (pure, no core)", () => {
	const params = resolveEnclosureParams({
		boardRef: ".B1",
		width: "60mm",
		height: "50mm",
		depth: "1in",
		wallThickness: "3mm",
		standoffHeight: "0.2in", // 5.08mm
		anchor: "m3-self-tap",
		autoCutouts: true,
	});
	expect(params.wallThicknessMm).toBe(3);
	expect(params.standoffHeightMm).toBeCloseTo(5.08);
	expect(params.widthMm).toBe(60);
	expect(params.heightMm).toBe(50);
	expect(params.depthMm).toBeCloseTo(25.4);
	expect(params.anchor).toBe("m3-self-tap");
	expect(params.autoCutouts).toBe(true);
	// untouched fields keep their defaults
	expect(params.floorThicknessMm).toBe(DEFAULT_PARAMS.floorThicknessMm);
});
