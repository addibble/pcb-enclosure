import { expect, test } from "bun:test";
import { extractEnclosureFeatures } from "../lib/extract-features";

test("extracts source-component cutout aperture metadata", () => {
	const features = extractEnclosureFeatures([
		{
			type: "pcb_board",
			pcb_board_id: "board",
			center: { x: 0, y: 0 },
			width: 20,
			height: 10,
		},
		{
			type: "source_component",
			source_component_id: "source_j1",
			name: "J1",
			ftype: "simple_connector",
			cutout_aperture: {
				shape: "rounded_rect",
				width_mm: 3.66,
				height_mm: 8.34,
				corner_radius_mm: 1.83,
				z_center_above_board_mm: 6.75,
			},
		},
		{
			type: "pcb_component",
			pcb_component_id: "pcb_j1",
			source_component_id: "source_j1",
			center: { x: 8, y: 0 },
			layer: "top",
			insertion_direction: "from_right",
		},
		{
			type: "pcb_smtpad",
			pcb_component_id: "pcb_j1",
			shape: "rect",
			x: 8,
			y: 0,
			width: 2,
			height: 1,
			layer: "top",
		},
	]);

	expect(features.componentBodies[0].cutoutAperture).toEqual({
		shape: "rounded_rect",
		widthMm: 3.66,
		heightMm: 8.34,
		cornerRadiusMm: 1.83,
		zCenterAboveBoardMm: 6.75,
	});
});
