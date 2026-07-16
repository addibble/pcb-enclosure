import { expect, test } from "bun:test";
import { extractEnclosureFeatures } from "../lib/extract-features";

test("extracts source-component cutout aperture metadata", () => {
	const features = extractEnclosureFeatures(
		[
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
			},
			{
				type: "pcb_component",
				pcb_component_id: "pcb_j1",
				source_component_id: "source_j1",
				center: { x: 8, y: 0 },
				layer: "top",
				rotation: 90,
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
		],
		{
			aperturesBySourceComponentId: {
				source_j1: {
					shape: "rounded_rect",
					widthMm: 3.66,
					heightMm: 8.34,
					cornerRadiusMm: 1.83,
				},
			},
		},
	);

	expect(features.componentBodies[0].cutoutAperture).toEqual({
		shape: "rounded_rect",
		widthMm: 3.66,
		heightMm: 8.34,
		cornerRadiusMm: 1.83,
	});
});
