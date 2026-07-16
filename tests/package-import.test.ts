import { expect, test } from "bun:test";

test("the package root exposes authoring while renderer APIs use a subpath", async () => {
	const authoring = await import("pcb-enclosure");
	const renderer = await import("pcb-enclosure/renderer");

	expect(typeof authoring.assembly.device).toBe("function");
	expect(typeof authoring.enclosure.fdm.box).toBe("function");
	expect(typeof renderer.extractEnclosureFeatures).toBe("function");
	expect(typeof renderer.resolveMountingHardware).toBe("function");
	expect(typeof renderer.resolveCutouts).toBe("function");
	expect(typeof renderer.EnclosurePlacementSolver).toBe("function");
	expect(typeof renderer.buildEnclosure).toBe("function");
});
