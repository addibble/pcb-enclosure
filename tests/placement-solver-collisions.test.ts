import { expect, test } from "bun:test";
import { EnclosurePlacementSolver } from "../lib/placement-solver";

test("EnclosurePlacementSolver flags colliding mounting posts and creates uncovered corner bosses", () => {
	const solver = new EnclosurePlacementSolver({
		obstacles: [{ id: "U1", cx: 0, cy: 0, w: 8, h: 8 }],
		mountPoints: [{ center: { x: 0, y: 0 }, anchor: "m2-self-tap" }],
		boardBounds: { minX: -20, minY: -10, maxX: 20, maxY: 10 },
		anchor: "m2-self-tap",
		clearanceMm: 0.5,
		cornerFasteners: true,
		cornerInsetMm: 3,
	});

	solver.solve();
	const out = solver.getOutput();

	expect(out.posts).toHaveLength(1);
	expect(out.posts[0].ok).toBe(false);
	expect(out.posts[0].collidesWith).toEqual(["U1"]);
	expect(out.bosses).toHaveLength(4);
	expect(out.warnings[0]).toContain("overlaps U1");
});

test("EnclosurePlacementSolver rejects mounting stacks that do not fit the PCB hole", () => {
	const solver = new EnclosurePlacementSolver({
		obstacles: [],
		mountPoints: [
			{
				center: { x: 17, y: 7 },
				anchor: "m3-heat-set",
				pcbHoleDiameterMm: 1,
			},
		],
		boardBounds: { minX: -20, minY: -10, maxX: 20, maxY: 10 },
		anchor: "m3-heat-set",
		clearanceMm: 0.5,
		cornerFasteners: true,
		cornerInsetMm: 3,
	});

	solver.solve();
	const out = solver.getOutput();

	expect(out.posts).toHaveLength(1);
	expect(out.posts[0].ok).toBe(false);
	expect(out.posts[0].fitError).toContain("requires Ø3.20mm");
	// The undersized mounting hole must not suppress the fallback corner ear.
	expect(out.bosses).toHaveLength(4);
	expect(out.warnings.some((w) => w.includes("cannot use this hole"))).toBe(
		true,
	);
});
