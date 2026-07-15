import { boardHeightMm, boardWidthMm } from "./prefab-board";
import type { ApertureProfile } from "../lib/cutout-aperture";

export const prefabBoardAperturesBySourceComponentId: Record<
	string,
	ApertureProfile
> = {
	src_j1: {
		shape: "rect",
		widthMm: 9,
		heightMm: 8.5,
		position: { z: 4.25 },
	},
	src_j2: {
		shape: "rect",
		widthMm: 8,
		heightMm: 4,
		position: { z: 2 },
	},
};

const mount = (id: string, x: number, y: number) => ({
	type: "pcb_hole",
	pcb_hole_id: id,
	hole_shape: "circle",
	hole_diameter: 3.2,
	x,
	y,
});

const platedPad = (
	id: string,
	pcbComponentId: string,
	x: number,
	y: number,
) => ({
	type: "pcb_plated_hole",
	shape: "circle",
	pcb_plated_hole_id: id,
	pcb_component_id: pcbComponentId,
	pcb_port_id: `${pcbComponentId}_port_${id}`,
	port_hints: [id],
	outer_diameter: 1.6,
	hole_diameter: 1,
	x,
	y,
	layers: ["top", "bottom"],
});

const smtPad = (id: string, pcbComponentId: string, x: number, y: number) => ({
	type: "pcb_smtpad",
	shape: "rect",
	pcb_smtpad_id: id,
	pcb_component_id: pcbComponentId,
	width: 1.2,
	height: 1.4,
	x,
	y,
	layer: "top",
});

/**
 * A compact, hand-authored Circuit JSON fixture matching `PrefabBoard` closely
 * enough to exercise board outline, mechanical-hole detection, component body
 * extraction, and edge-connector auto cutouts without importing @tscircuit/core.
 */
export const prefabBoardCircuitJson = [
	{
		type: "pcb_board",
		pcb_board_id: "board",
		center: { x: 0, y: 0 },
		width: boardWidthMm,
		height: boardHeightMm,
		thickness: 1.6,
		outline: [
			{ x: -boardWidthMm / 2, y: -boardHeightMm / 2 },
			{ x: boardWidthMm / 2, y: -boardHeightMm / 2 },
			{ x: boardWidthMm / 2, y: boardHeightMm / 2 },
			{ x: -boardWidthMm / 2, y: boardHeightMm / 2 },
		],
	},
	mount("MH1", boardWidthMm / 2 - 2.5, boardHeightMm / 2 - 2.5),
	mount("MH2", boardWidthMm / 2 - 2.5, -boardHeightMm / 2 + 2.5),
	mount("MH3", -boardWidthMm / 2 + 2.5, -boardHeightMm / 2 + 2.5),
	mount("MH4", -boardWidthMm / 2 + 2.5, boardHeightMm / 2 - 2.5),
	mount("MH5", 0, boardHeightMm / 2 - 2.5),
	{
		type: "source_component",
		source_component_id: "src_j1",
		name: "J1",
		ftype: "simple_pin_header",
	},
	{
		type: "pcb_component",
		pcb_component_id: "pcb_j1",
		source_component_id: "src_j1",
		center: { x: -boardWidthMm / 2 + 6, y: 0 },
		layer: "top",
		rotation: 90,
		insertion_direction: "from_left",
	},
	platedPad("J1_1", "pcb_j1", -boardWidthMm / 2 + 6, -3.81),
	platedPad("J1_2", "pcb_j1", -boardWidthMm / 2 + 6, -1.27),
	platedPad("J1_3", "pcb_j1", -boardWidthMm / 2 + 6, 1.27),
	platedPad("J1_4", "pcb_j1", -boardWidthMm / 2 + 6, 3.81),
	{
		type: "cad_component",
		cad_component_id: "cad_j1",
		pcb_component_id: "pcb_j1",
		source_component_id: "src_j1",
		position: { x: -boardWidthMm / 2 + 6, y: 0, z: 1.25 },
		size: { x: 10, y: 6, z: 2.5 },
		layer: "top",
	},
	{
		type: "source_component",
		source_component_id: "src_j2",
		name: "J2",
		ftype: "simple_connector",
	},
	{
		type: "pcb_component",
		pcb_component_id: "pcb_j2",
		source_component_id: "src_j2",
		center: { x: boardWidthMm / 2 - 6, y: 0 },
		layer: "top",
		rotation: 90,
	},
	platedPad("J2_1", "pcb_j2", boardWidthMm / 2 - 6, -1.27),
	platedPad("J2_2", "pcb_j2", boardWidthMm / 2 - 6, 1.27),
	{
		type: "cad_component",
		cad_component_id: "cad_j2",
		pcb_component_id: "pcb_j2",
		source_component_id: "src_j2",
		position: { x: boardWidthMm / 2 - 6, y: 0, z: 5.5 },
		size: { x: 6, y: 8, z: 11 },
		layer: "top",
	},
	{
		type: "source_component",
		source_component_id: "src_r1",
		name: "R1",
		ftype: "simple_resistor",
	},
	{
		type: "pcb_component",
		pcb_component_id: "pcb_r1",
		source_component_id: "src_r1",
		center: { x: 0, y: -10 },
		layer: "top",
	},
	smtPad("R1_1", "pcb_r1", -0.8, -10),
	smtPad("R1_2", "pcb_r1", 0.8, -10),
	{
		type: "source_component",
		source_component_id: "src_c1",
		name: "C1",
		ftype: "simple_capacitor",
	},
	{
		type: "pcb_component",
		pcb_component_id: "pcb_c1",
		source_component_id: "src_c1",
		center: { x: 6, y: -10 },
		layer: "top",
	},
	smtPad("C1_1", "pcb_c1", 5.2, -10),
	smtPad("C1_2", "pcb_c1", 6.8, -10),
];
