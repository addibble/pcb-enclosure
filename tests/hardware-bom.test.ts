import { expect, test } from "bun:test";
import * as modeling from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import { buildEnclosure } from "../lib/build-enclosure";
import type { MountingHardwareCatalog } from "../lib/mounting-hardware-catalog";
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
	mountPoints: [
		{ center: { x: -20, y: -10 }, side: "floor" },
		{ center: { x: 20, y: -10 }, side: "floor" },
		{ center: { x: 20, y: 10 }, side: "floor" },
	],
	componentBodies: [],
	topComponentHeightMm: 3,
	bottomComponentHeightMm: 0,
};
const placement: EnclosurePlacementOutput = {
	posts: features.mountPoints.map((m) => ({
		kind: "post",
		center: m.center,
		radiusMm: 2.5,
		ok: true,
		collidesWith: [],
	})),
	bosses: [],
	warnings: [],
};

const build = (params = DEFAULT_PARAMS) =>
	buildEnclosure(features, placement, params, [], modeling, measureBoundingBox);

test("each built PCB mounting boss emits its screw + insert to the BOM", () => {
	const model = build();
	// 3 posts × (1 screw + 1 heat-set insert) = 6 pieces
	expect(model.bomItems).toHaveLength(6);
	expect(model.bomItems.filter((b) => b.role === "screw")).toHaveLength(3);
	expect(model.bomItems.filter((b) => b.role === "insert")).toHaveLength(3);
	// built-in hardware is generic; default "warn" mode does not warn about it
	expect(model.bomItems.every((b) => b.generic)).toBe(true);
	expect(model.warnings).toHaveLength(0);

	const bushings = model.hardware.filter((item) => item.role === "bushing");
	const screws = model.hardware.filter((item) => item.role === "screw");
	expect(bushings).toHaveLength(3);
	expect(screws).toHaveLength(3);
	const lid = model.parts.find((part) => part.id === "lid")!;
	const explodedLidTop = lid.bounds.max[2] + (lid.explodeZOffsetMm ?? 0);
	expect(
		Math.min(
			...bushings.map((item) => item.bounds.min[2] + item.explodeZOffsetMm),
		),
	).toBeGreaterThan(explodedLidTop);
	expect(
		Math.min(
			...screws.map((item) => item.bounds.min[2] + item.explodeZOffsetMm),
		),
	).toBeGreaterThan(
		Math.max(
			...bushings.map((item) => item.bounds.max[2] + item.explodeZOffsetMm),
		),
	);
});

test("bomMode 'strict' warns once per generic hardware group", () => {
	const model = build({ ...DEFAULT_PARAMS, bomMode: "strict" });
	const bomWarnings = model.warnings.filter((w) => w.includes("BOM (strict)"));
	// two distinct generic groups (the socket-cap screw + the heat-set insert)
	expect(bomWarnings).toHaveLength(2);
	expect(bomWarnings.some((w) => w.includes("heat-set insert"))).toBe(true);
});

test("bomMode 'off' drops the hardware BOM but still builds geometry", () => {
	const model = build({ ...DEFAULT_PARAMS, bomMode: "off" });
	expect(model.bomItems).toHaveLength(0);
	expect(model.hardware).toHaveLength(0);
	expect(model.parts.find((p) => p.id === "base")).toBeDefined();
});

test("a user catalog with real part numbers flows onto the BOM without code change", () => {
	const mountingHardwareCatalog: MountingHardwareCatalog = {
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
		mountingStacks: {
			"m3-real": {
				boss: { type: "insert", insert: "m3-heat-set-short" },
				screw: "mcmaster-91292A113",
			},
		},
	};
	const model = build({
		...DEFAULT_PARAMS,
		mountingHardwareCatalog,
		anchor: "m3-real",
		bomMode: "strict",
	});

	const screws = model.bomItems.filter((b) => b.role === "screw");
	expect(screws).toHaveLength(3);
	expect(screws.every((b) => b.manufacturerPartNumber === "91292A113")).toBe(
		true,
	);
	// the real screw no longer warns; only the still-generic insert does
	const bomWarnings = model.warnings.filter((w) => w.includes("BOM (strict)"));
	expect(bomWarnings).toHaveLength(1);
	expect(bomWarnings[0]).toContain("heat-set insert");
});
