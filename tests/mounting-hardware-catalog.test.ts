import { expect, test } from "bun:test";
import { DEFAULT_DESIGN_RULES } from "../lib/design-rules";
import {
	BUILTIN_MOUNTING_HARDWARE_CATALOG,
	type MountingHardwareCatalog,
	expandHardwareBom,
	mergeMountingHardwareCatalog,
	resolveMountingHardware,
} from "../lib/mounting-hardware-catalog";

test("built-in m3-heat-set resolves to a derived boss + generic screw/insert BOM", () => {
	const hw = resolveMountingHardware(
		"m3-heat-set",
		BUILTIN_MOUNTING_HARDWARE_CATALOG,
	);

	// boss OD derived from insert install-hole Ø + 2 × min insert wall
	expect(hw.geometry.bossOuterDiameterMm).toBeCloseTo(
		4.0 + 2 * DEFAULT_DESIGN_RULES.fastener.minInsertWallMm,
	);
	expect(hw.geometry.bossBoreDiameterMm).toBeCloseTo(4.0);
	expect(hw.geometry.bossBoreDepthMm).toBeCloseTo(
		3.0 + DEFAULT_DESIGN_RULES.fastener.insertMeltReliefMm,
	);
	expect(hw.geometry.boreType).toBe("insert");
	expect(hw.geometry.screwClearanceDiameterMm).toBeCloseTo(3.4);
	expect(hw.geometry.pcbHoleDiameterMm).toBeCloseTo(3.2);
	expect(hw.geometry.headDiameterMm).toBeCloseTo(6);
	expect(hw.geometry.counterboreDepthMm).toBeCloseTo(1.7);

	// consumes one insert + one screw, both generic (no procurement identity)
	expect(hw.bomItems.map((b) => b.role).sort()).toEqual(["insert", "screw"]);
	expect(hw.bomItems.find((b) => b.role === "screw")?.displayValue).toContain(
		"flat head countersunk",
	);
	expect(hw.generic).toBe(true);
});

test("a self-tap stack bores a screw pilot and consumes only a screw", () => {
	const hw = resolveMountingHardware(
		"m3-self-tap",
		BUILTIN_MOUNTING_HARDWARE_CATALOG,
	);

	expect(hw.geometry.boreType).toBe("self_tap");
	expect(hw.geometry.bossBoreDiameterMm).toBeCloseTo(2.5); // M3 pilot
	expect(hw.geometry.bossBoreDepthMm).toBeCloseTo(
		DEFAULT_DESIGN_RULES.fastener.selfTapPilotDepthMm,
	);
	expect(hw.geometry.bossOuterDiameterMm).toBeCloseTo(6.5);
	expect(hw.bomItems.map((b) => b.role)).toEqual(["screw"]);
});

test("a user catalog overrides hardware with real part numbers (no code change)", () => {
	const userCatalog: MountingHardwareCatalog = {
		screws: {
			"mcmaster-91292A113": {
				thread: "M3",
				clearanceHoleDiameterMm: 3.4,
				pcbClearanceHoleDiameterMm: 3.2,
				headDiameterMm: 5.5,
				headHeightMm: 3,
				bom: {
					displayValue: "M3 × 10mm socket head cap screw, A2",
					manufacturerPartNumber: "91292A113",
					supplierPartNumbers: { mcmaster: ["91292A113"] },
				},
			},
		},
		washers: {
			"din125-m3": {
				bom: {
					displayValue: "M3 DIN 125 washer, A2",
					manufacturerPartNumber: "DIN125-M3-A2",
				},
			},
		},
		mountingStacks: {
			"m3-heatset-real": {
				boss: { type: "insert", insert: "m3-heat-set-short" },
				screw: "mcmaster-91292A113",
				extraBom: [{ role: "washer", ref: "din125-m3" }],
			},
		},
	};
	const catalog = mergeMountingHardwareCatalog(
		BUILTIN_MOUNTING_HARDWARE_CATALOG,
		userCatalog,
	);
	const hw = resolveMountingHardware("m3-heatset-real", catalog);

	// the insert is still a built-in generic; the screw + washer are real
	const screw = hw.bomItems.find((b) => b.role === "screw");
	expect(screw?.manufacturerPartNumber).toBe("91292A113");
	expect(screw?.generic).toBe(false);
	expect(hw.bomItems.map((b) => b.role).sort()).toEqual([
		"insert",
		"screw",
		"washer",
	]);

	// one physical piece per role at a mount, grouped by a stable key
	const bom = expandHardwareBom(hw, "MH1");
	expect(bom).toHaveLength(3);
	expect(bom.find((b) => b.role === "screw")?.bomGroupKey).toBe(
		"mpn:91292A113",
	);
});

test("resolving an inline stack spec needs no catalog key", () => {
	const hw = resolveMountingHardware({
		boss: { type: "self_tap", outerDiameterMm: 6 },
		screw: "m3-socket-cap",
	});
	expect(hw.stackRef).toBe("(inline)");
	expect(hw.geometry.bossOuterDiameterMm).toBeCloseTo(6);
});

test("an unknown mounting stack throws a clear error", () => {
	expect(() => resolveMountingHardware("nope")).toThrow(
		/mounting stack "nope"/,
	);
});
