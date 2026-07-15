import { expect, test } from "bun:test";
import * as modeling from "@jscad/modeling";
import { measureVolume } from "@jscad/modeling/src/measurements";
import { executeJscadOperations } from "jscad-planner";
import { buildEnclosure } from "../lib/build-enclosure";
import { toStl } from "../lib/export";
import { jscadPlan } from "../lib/jscad-plan";
import { EnclosurePlacementSolver } from "../lib/placement-solver";
import { DEFAULT_PARAMS, type EnclosureFeatures } from "../lib/types";

/**
 * The artifact renderer builds each part as a `jscad-planner` plan. Preview and
 * manufacturing exporters replay it through @jscad/modeling. This exercises the
 * exact plan → mesh → STL path.
 */
const features: EnclosureFeatures = {
	outline: [
		{ x: -20, y: -15 },
		{ x: 20, y: -15 },
		{ x: 20, y: 15 },
		{ x: -20, y: 15 },
	],
	bounds: { minX: -20, minY: -15, maxX: 20, maxY: 15 },
	boardThicknessMm: 1.6,
	boardCenter: { x: 0, y: 0 },
	mountPoints: [
		{ center: { x: -15, y: -10 }, side: "floor" },
		{ center: { x: 15, y: 10 }, side: "floor" },
	],
	componentBodies: [],
	topComponentHeightMm: 4,
	bottomComponentHeightMm: 0,
};

const planContainsOperation = (value: unknown, type: string): boolean => {
	if (Array.isArray(value))
		return value.some((item) => planContainsOperation(item, type));
	if (!value || typeof value !== "object") return false;
	if ((value as any).type === type) return true;
	return Object.values(value).some((item) => planContainsOperation(item, type));
};

test("enclosure plan parts execute to watertight meshes and export to STL", () => {
	const solver = new EnclosurePlacementSolver({
		obstacles: [],
		mountPoints: features.mountPoints.map((m) => ({ center: m.center })),
		boardBounds: features.bounds,
		anchor: DEFAULT_PARAMS.anchor,
		clearanceMm: 1,
		cornerFasteners: true,
		cornerInsetMm: DEFAULT_PARAMS.cornerStandoffInsetMm,
	});
	solver.solve();

	// build with the serializable plan implementation used by the artifact path
	const model = buildEnclosure(
		features,
		solver.getOutput(),
		DEFAULT_PARAMS,
		[],
		jscadPlan,
	);
	expect(model.parts.map((p) => p.id).sort()).toEqual(["base", "lid"]);

	for (const part of model.parts) {
		// The artifact plan is a plain object, not a rendered Geom3.
		expect(part.geom).toBeInstanceOf(Object);
		expect("polygons" in (part.geom as object)).toBe(false);
		// viewer/exporter path: replay the plan through @jscad/modeling
		const mesh = executeJscadOperations(modeling as any, part.geom);
		expect(measureVolume(mesh)).toBeGreaterThan(0);
		expect(toStl(mesh).length).toBeGreaterThan(0);
	}
	for (const hardware of model.hardware) {
		const mesh = executeJscadOperations(modeling as any, hardware.geom);
		expect(measureVolume(mesh)).toBeGreaterThan(0);
	}
	expect(
		model.hardware
			.filter((hardware) => hardware.role === "screw")
			.every((hardware) => planContainsOperation(hardware.geom, "hull")),
	).toBe(true);
});
