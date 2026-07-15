import { expect, test } from "bun:test";
import { Circuit } from "@tscircuit/core";
import { collectEnclosureInputs, enclosure } from "pcb-enclosure";
import { renderEnclosureFromCircuitJson } from "pcb-enclosure/renderer";

test("enclosure.fdm.box registers an ephemeral spec without mutating Circuit JSON", () => {
	const circuit = new Circuit();
	const globalWithCircuit = globalThis as typeof globalThis & {
		__tscircuit_circuit?: object;
	};
	const previousCircuit = globalWithCircuit.__tscircuit_circuit;
	globalWithCircuit.__tscircuit_circuit = circuit;
	try {
		circuit.add(
			<group>
				<board name="B1" width="30mm" height="20mm" />
				<enclosure.fdm.box boardRef=".B1" />
			</group>,
		);
		circuit.render();
	} finally {
		globalWithCircuit.__tscircuit_circuit = previousCircuit;
	}

	const circuitJson = circuit.getCircuitJson();
	expect(
		circuitJson.filter(
			(element) =>
				element.type === "cad_component" && "enclosure_part_id" in element,
		),
	).toHaveLength(0);

	const [input] = collectEnclosureInputs(circuit);
	expect(input.props.boardRef).toBe(".B1");
	const rendered = renderEnclosureFromCircuitJson(circuitJson, input.props, {
		extract: {
			aperturesBySourceComponentId: input.aperturesBySourceComponentId,
		},
	});
	expect(rendered.model.parts).toHaveLength(2);
});
