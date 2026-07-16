import { expect, test } from "bun:test";
import { Circuit } from "@tscircuit/core";
import { TypeC14pCc26 } from "../examples/parts/type-c-14p-cc-2-6";
import { assembly, collectEnclosureInputs, enclosure } from "pcb-enclosure";

const renderPart = (cutoutAperture?: {
	shape: "circle";
	radius: number;
	margin?: number | string;
}) => {
	const circuit = new Circuit();
	const globalWithCircuit = globalThis as typeof globalThis & {
		__tscircuit_circuit?: object;
	};
	const previousCircuit = globalWithCircuit.__tscircuit_circuit;
	globalWithCircuit.__tscircuit_circuit = circuit;
	try {
		circuit.add(
			<assembly.device>
				<board name="B1" width="20mm" height="20mm">
					<TypeC14pCc26 name="J1" pcbX={8} pcbY={0}>
						{cutoutAperture && (
							<enclosure.cutoutaperture
								shape={cutoutAperture.shape}
								radius={cutoutAperture.radius}
								margin={cutoutAperture.margin}
							/>
						)}
					</TypeC14pCc26>
				</board>
				<enclosure.fdm.box boardRef=".B1" autoCutouts />
			</assembly.device>,
		);
		circuit.render();
	} finally {
		globalWithCircuit.__tscircuit_circuit = previousCircuit;
	}
	const [input] = collectEnclosureInputs(circuit);
	return {
		aperture: Object.values(input.aperturesBySourceComponentId)[0],
		circuitJson: circuit.getCircuitJson(),
	};
};

test("library part supplies its default cutout aperture", () => {
	const rendered = renderPart();
	expect(rendered.aperture).toEqual({
		shape: "rounded_rect",
		widthMm: 3.66,
		heightMm: 8.34,
		cornerRadiusMm: 1.83,
	});
	expect(
		rendered.circuitJson.some(
			(element) =>
				element.type === "source_component" && "cutout_aperture" in element,
		),
	).toBe(false);
});

test("circuit can extend a library part with an aperture override", () => {
	expect(
		renderPart({
			shape: "circle",
			radius: 3.5,
			margin: "0.2mm",
		}).aperture,
	).toEqual({
		shape: "circle",
		diameterMm: 7,
		marginMm: 0.2,
	});
});
