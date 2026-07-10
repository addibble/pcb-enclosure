import { expect, test } from "bun:test";
import { Circuit } from "@tscircuit/core";
import { TypeC14pCc26 } from "../examples/parts/type-c-14p-cc-2-6";

const renderPart = (cutoutAperture?: {
	shape: "circle";
	diameterMm: number;
	zCenterAboveBoardMm: number;
}) => {
	const circuit = new Circuit();
	circuit.add(
		<board name="B1" width="20mm" height="20mm">
			<TypeC14pCc26 name="J1" pcbX={8} pcbY={0}>
				{cutoutAperture && (
					<cutoutaperture
						shape={cutoutAperture.shape}
						diameterMm={cutoutAperture.diameterMm}
						zCenterAboveBoardMm={cutoutAperture.zCenterAboveBoardMm}
					/>
				)}
			</TypeC14pCc26>
		</board>,
	);
	circuit.render();
	return circuit.db.source_component
		.list()
		.find((source) => source.name === "J1");
};

test("library part supplies its default cutout aperture", () => {
	expect(renderPart()?.cutout_aperture).toEqual({
		shape: "rounded_rect",
		width_mm: 3.66,
		height_mm: 8.34,
		corner_radius_mm: 1.83,
		z_center_above_board_mm: 6.75,
	});
});

test("circuit can extend a library part with an aperture override", () => {
	expect(
		renderPart({
			shape: "circle",
			diameterMm: 7,
			zCenterAboveBoardMm: 4,
		})?.cutout_aperture,
	).toEqual({
		shape: "circle",
		diameter_mm: 7,
		z_center_above_board_mm: 4,
	});
});
