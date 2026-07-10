import { expect, test } from "bun:test";
import { extractEnclosureFeatures } from "../lib/extract-features";

test("extractEnclosureFeatures keeps padless components that have CAD body data", () => {
	const circuitJson = [
		{
			type: "pcb_board",
			center: { x: 0, y: 0 },
			width: 40,
			height: 30,
			thickness: 1.6,
		},
		{
			type: "source_component",
			source_component_id: "src_j1",
			name: "J1",
			ftype: "simple_connector",
		},
		{
			type: "pcb_component",
			pcb_component_id: "pcb_j1",
			source_component_id: "src_j1",
			center: { x: 0, y: 0 },
			layer: "top",
		},
		{
			type: "cad_component",
			cad_component_id: "cad_j1",
			pcb_component_id: "pcb_j1",
			source_component_id: "src_j1",
			position: { x: 6, y: 2, z: 2 },
			size: { x: 10, y: 4, z: 5 },
		},
	];

	const features = extractEnclosureFeatures(circuitJson);
	const body = features.componentBodies[0];

	expect(features.componentBodies).toHaveLength(1);
	expect(body.id).toBe("J1");
	expect(body.center).toEqual({ x: 6, y: 2 });
	expect(body.lengthMm).toBeCloseTo(10);
	expect(body.widthMm).toBeCloseTo(4);
	expect(body.heightMm).toBeCloseTo(5);
});
