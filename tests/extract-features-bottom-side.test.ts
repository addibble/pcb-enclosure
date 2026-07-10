import { expect, test } from "bun:test";
import { extractEnclosureFeatures } from "../lib/extract-features";

test("extractEnclosureFeatures tracks top and bottom component height separately", () => {
	const circuitJson = [
		{
			type: "pcb_board",
			center: { x: 0, y: 0 },
			width: 30,
			height: 20,
			thickness: 1.6,
		},
		{
			type: "source_component",
			source_component_id: "src_top",
			name: "R1",
			ftype: "simple_resistor",
		},
		{
			type: "pcb_component",
			pcb_component_id: "pcb_top",
			source_component_id: "src_top",
			center: { x: -5, y: 0 },
			layer: "top",
		},
		{
			type: "pcb_smtpad",
			shape: "rect",
			pcb_component_id: "pcb_top",
			x: -5.5,
			y: 0,
			width: 1,
			height: 1,
		},
		{
			type: "source_component",
			source_component_id: "src_bottom",
			name: "U1",
			ftype: "simple_chip",
		},
		{
			type: "pcb_component",
			pcb_component_id: "pcb_bottom",
			source_component_id: "src_bottom",
			center: { x: 5, y: 0 },
			layer: "bottom",
		},
		{
			type: "pcb_smtpad",
			shape: "rect",
			pcb_component_id: "pcb_bottom",
			x: 4.5,
			y: 0,
			width: 1,
			height: 1,
		},
	];

	const features = extractEnclosureFeatures(circuitJson);
	const bottom = features.componentBodies.find((b) => b.id === "U1");

	expect(features.topComponentHeightMm).toBeCloseTo(0.6);
	expect(features.bottomComponentHeightMm).toBeCloseTo(1.2);
	expect(bottom?.side).toBe("bottom");
});
