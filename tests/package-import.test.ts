import { expect, test } from "bun:test";

test("the package root exports the board-mounting analysis API", async () => {
	const mod = await import("pcb-enclosure");

	expect(typeof mod.extractEnclosureFeatures).toBe("function");
	expect(typeof mod.resolveMountingHardware).toBe("function");
	expect(typeof mod.resolveCutoutAperture).toBe("function");
	expect(typeof mod.resolveCutouts).toBe("function");
	expect(typeof mod.EnclosurePlacementSolver).toBe("function");
	expect(typeof mod.buildEnclosure).toBe("function");
});
