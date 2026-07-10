import { expect, test } from "bun:test";
import {
	DEFAULT_PARAMS,
	enclosureProps,
	resolveEnclosureParams,
} from "pcb-enclosure";

test("enclosureProps accepts unit strings and the opt-in flags", () => {
	const parsed = enclosureProps.parse({
		name: "EN1",
		wallThickness: "2.5mm",
		standoffHeight: "0.2in",
		anchor: "m3-self-tap",
		autoCutouts: true,
	});
	expect(parsed.name).toBe("EN1");
	expect(parsed.autoCutouts).toBe(true);
});

test("enclosureProps rejects unknown props instead of silently ignoring typos", () => {
	expect(() => enclosureProps.parse({ wallThicknes: "2mm" } as any)).toThrow(
		/Unrecognized key/,
	);
});

test("resolveEnclosureParams maps props onto EnclosureParams (pure, no core)", () => {
	const params = resolveEnclosureParams({
		wallThickness: "3mm",
		standoffHeight: "0.2in", // 5.08mm
		anchor: "m3-self-tap",
		autoCutouts: true,
	});
	expect(params.wallThicknessMm).toBe(3);
	expect(params.standoffHeightMm).toBeCloseTo(5.08);
	expect(params.anchor).toBe("m3-self-tap");
	expect(params.autoCutouts).toBe(true);
	// untouched fields keep their defaults
	expect(params.floorThicknessMm).toBe(DEFAULT_PARAMS.floorThicknessMm);
});
