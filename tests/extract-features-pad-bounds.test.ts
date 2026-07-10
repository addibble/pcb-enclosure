import { expect, test } from "bun:test";
import { extractEnclosureFeatures } from "../lib/extract-features";

test("extractEnclosureFeatures computes body extents from circular and rotated pads", () => {
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
			source_component_id: "src_circle",
			name: "TP1",
		},
		{
			type: "pcb_component",
			pcb_component_id: "pcb_circle",
			source_component_id: "src_circle",
			center: { x: -5, y: 0 },
			layer: "top",
		},
		{
			type: "pcb_smtpad",
			shape: "circle",
			pcb_component_id: "pcb_circle",
			x: -5,
			y: 0,
			radius: 2,
		},
		{ type: "source_component", source_component_id: "src_rot", name: "U1" },
		{
			type: "pcb_component",
			pcb_component_id: "pcb_rot",
			source_component_id: "src_rot",
			center: { x: 5, y: 0 },
			layer: "top",
		},
		{
			type: "pcb_smtpad",
			shape: "rotated_rect",
			pcb_component_id: "pcb_rot",
			x: 5,
			y: 0,
			width: 4,
			height: 2,
			ccw_rotation: 90,
		},
	];

	const bodies = extractEnclosureFeatures(circuitJson).componentBodies;
	const circle = bodies.find((b) => b.id === "TP1")!;
	const rotated = bodies.find((b) => b.id === "U1")!;

	expect(circle.lengthMm).toBeCloseTo(4);
	expect(circle.widthMm).toBeCloseTo(4);
	expect(rotated.lengthMm).toBeCloseTo(2);
	expect(rotated.widthMm).toBeCloseTo(4);
});
