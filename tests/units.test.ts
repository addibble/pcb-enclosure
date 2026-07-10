import { expect, test } from "bun:test";
import { mm, toMm } from "../lib/units";

/**
 * Length props accept the same unit strings as the rest of tscircuit
 * (circuit-json's `length`): "0.1in" is 2.54mm, not 0.1mm.
 */
test("toMm converts unit strings, not just strips them", () => {
	expect(toMm(2, 0)).toBe(2);
	expect(toMm("2mm", 0)).toBe(2);
	expect(toMm("2", 0)).toBe(2);
	expect(toMm("1cm", 0)).toBe(10);
	expect(toMm("0.1in", 0)).toBeCloseTo(2.54);
	expect(toMm("50mil", 0)).toBeCloseTo(1.27);
	expect(toMm(".5mm", 0)).toBeCloseTo(0.5);
	expect(toMm("+2mm", 0)).toBeCloseTo(2);
	expect(toMm("1e-3m", 0)).toBeCloseTo(1);
	expect(toMm(undefined, 7)).toBe(7);
	expect(toMm(null, 7)).toBe(7);
	expect(() => toMm("2furlongs", 0)).toThrow(/unsupported length/);
});

test("the `mm` prop schema rejects strings toMm can't convert", () => {
	expect(mm.safeParse("2mm").success).toBe(true);
	expect(mm.safeParse("0.1in").success).toBe(true);
	expect(mm.safeParse(".5mm").success).toBe(true);
	expect(mm.safeParse("1e-3m").success).toBe(true);
	expect(mm.safeParse(3).success).toBe(true);
	expect(mm.safeParse("2furlongs").success).toBe(false);
	expect(mm.safeParse("wide").success).toBe(false);
});
