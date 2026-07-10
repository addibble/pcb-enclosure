import { expect, test } from "bun:test";
import { extractEnclosureFeatures } from "../lib/extract-features";

const multiBoardCircuitJson = [
	{
		type: "pcb_board",
		pcb_board_id: "board_a",
		subcircuit_id: "sub_a",
		center: { x: -100, y: 0 },
		width: 20,
		height: 10,
	},
	{
		type: "pcb_board",
		pcb_board_id: "board_b",
		subcircuit_id: "sub_b",
		center: { x: 100, y: 0 },
		width: 30,
		height: 15,
	},
	{ type: "source_component", source_component_id: "src_a", name: "A1" },
	{ type: "source_component", source_component_id: "src_b", name: "B1" },
	{
		type: "pcb_hole",
		subcircuit_id: "sub_a",
		x: -104,
		y: 0,
		hole_diameter: 2.2,
	},
	{
		type: "pcb_hole",
		subcircuit_id: "sub_b",
		x: 104,
		y: 0,
		hole_diameter: 3.2,
	},
	{
		type: "pcb_component",
		pcb_component_id: "pcb_a",
		source_component_id: "src_a",
		subcircuit_id: "sub_a",
		center: { x: -98, y: 0 },
		layer: "top",
	},
	{
		type: "pcb_smtpad",
		shape: "rect",
		pcb_component_id: "pcb_a",
		subcircuit_id: "sub_a",
		x: -98,
		y: 0,
		width: 1,
		height: 1,
	},
	{
		type: "pcb_component",
		pcb_component_id: "pcb_b",
		source_component_id: "src_b",
		subcircuit_id: "sub_b",
		center: { x: 98, y: 0 },
		layer: "top",
	},
	{
		type: "pcb_smtpad",
		shape: "rect",
		pcb_component_id: "pcb_b",
		subcircuit_id: "sub_b",
		x: 98,
		y: 0,
		width: 2,
		height: 2,
	},
];

test("extractEnclosureFeatures scopes holes and component bodies to the selected board", () => {
	const byBoardId = extractEnclosureFeatures(multiBoardCircuitJson, {
		pcbBoardId: "board_b",
	});
	expect(byBoardId.boardCenter).toEqual({ x: 100, y: 0 });
	expect(byBoardId.mountPoints).toHaveLength(1);
	expect(byBoardId.mountPoints[0]).toMatchObject({
		center: { x: 104, y: 0 },
		pcbHoleDiameterMm: 3.2,
	});
	expect(byBoardId.componentBodies.map((b) => b.id)).toEqual(["B1"]);

	const bySubcircuit = extractEnclosureFeatures(multiBoardCircuitJson, {
		subcircuitId: "sub_a",
	});
	expect(bySubcircuit.boardCenter).toEqual({ x: -100, y: 0 });
	expect(bySubcircuit.mountPoints).toHaveLength(1);
	expect(bySubcircuit.componentBodies.map((b) => b.id)).toEqual(["A1"]);
});

test("board scope follows source_board to source_group when pcb_board has no subcircuit_id", () => {
	const renderedCircuitJson = [
		{
			type: "source_group",
			source_group_id: "group_a",
			subcircuit_id: "sub_a",
		},
		{
			type: "source_board",
			source_board_id: "source_board_a",
			source_group_id: "group_a",
		},
		{
			type: "pcb_board",
			pcb_board_id: "board_a",
			source_board_id: "source_board_a",
			center: { x: 0, y: 0 },
			width: 20,
			height: 10,
		},
		{
			type: "pcb_hole",
			subcircuit_id: "sub_a",
			x: 7,
			y: 2,
			hole_diameter: 3.2,
		},
		{
			type: "pcb_hole",
			subcircuit_id: "other_subcircuit",
			x: 100,
			y: 100,
			hole_diameter: 4,
		},
	];

	const features = extractEnclosureFeatures(renderedCircuitJson, {
		subcircuitId: "sub_a",
	});
	expect(features.mountPoints).toEqual([
		{
			center: { x: 7, y: 2 },
			pcbHoleDiameterMm: 3.2,
			side: "floor",
		},
	]);
});
