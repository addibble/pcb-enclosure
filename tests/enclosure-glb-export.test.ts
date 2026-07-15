import { expect, test } from "bun:test";
import type { CircuitJson } from "circuit-json";
import { renderGLTFToPNGFromGLB } from "poppygl";
import {
	prefabBoardAperturesBySourceComponentId,
	prefabBoardCircuitJson,
} from "../examples/prefab-board-circuit-json";
import { exportEnclosureModelToGlb } from "../lib/export-glb";
import { renderEnclosureFromCircuitJson } from "../lib/render-enclosure";

test("the artifact renderer exports a PoppyGL-readable enclosure GLB", async () => {
	const rendered = renderEnclosureFromCircuitJson(
		prefabBoardCircuitJson as unknown as CircuitJson,
		{ boardRef: "board", autoCutouts: true },
		{
			extract: {
				aperturesBySourceComponentId: prefabBoardAperturesBySourceComponentId,
			},
		},
	);
	const glb = await exportEnclosureModelToGlb(rendered.model);

	expect(new DataView(glb).getUint32(0, true)).toBe(0x46546c67);
	const png = await renderGLTFToPNGFromGLB(glb, {
		width: 64,
		height: 64,
	});
	expect(png.byteLength).toBeGreaterThan(100);
});
