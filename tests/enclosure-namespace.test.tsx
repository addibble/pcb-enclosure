import { expect, test } from "bun:test";
import { Circuit } from "@tscircuit/core";
import { assembly, collectEnclosureInputs, enclosure } from "pcb-enclosure";
import { renderEnclosureFromCircuitJson } from "pcb-enclosure/renderer";

test("assembly.device emits enclosure JSCAD through existing CAD records", () => {
	const circuit = new Circuit();
	const globalWithCircuit = globalThis as typeof globalThis & {
		__tscircuit_circuit?: object;
	};
	const previousCircuit = globalWithCircuit.__tscircuit_circuit;
	globalWithCircuit.__tscircuit_circuit = circuit;
	try {
		circuit.add(
			<assembly.device name="controller">
				<board name="B1" width="30mm" height="20mm" />
				<enclosure.fdm.box boardRef=".B1" />
			</assembly.device>,
		);
		circuit.render();
	} finally {
		globalWithCircuit.__tscircuit_circuit = previousCircuit;
	}

	const circuitJson = circuit.getCircuitJson();
	expect(
		"externalReactElementType" in circuit.firstChild! &&
			circuit.firstChild.externalReactElementType,
	).toBe("assembly.device");
	expect(
		circuitJson.filter((element) => element.type === "source_group"),
	).toHaveLength(1);
	expect(circuitJson.some((element) => element.type === "pcb_group")).toBe(
		false,
	);
	expect(
		circuitJson.filter(
			(element) =>
				element.type === "source_component" &&
				element.source_component_id.startsWith("source_enclosure_"),
		),
	).toHaveLength(10);
	expect(
		circuitJson.filter(
			(element) =>
				element.type === "pcb_component" &&
				element.pcb_component_id.startsWith("pcb_enclosure_") &&
				element.obstructs_within_bounds === false,
		),
	).toHaveLength(10);
	expect(
		circuitJson.filter(
			(element) =>
				element.type === "cad_component" && element.model_jscad != null,
		),
	).toHaveLength(10);

	const [input] = collectEnclosureInputs(circuit);
	expect(input.props.boardRef).toBe(".B1");
	const rendered = renderEnclosureFromCircuitJson(circuitJson, input.props, {
		extract: {
			aperturesBySourceComponentId: input.aperturesBySourceComponentId,
		},
	});
	expect(rendered.model.parts).toHaveLength(2);
});
