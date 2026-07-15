import { expect, test } from "bun:test";
import { Circuit } from "@tscircuit/core";
import { enclosure, renderEnclosurePreviewArtifacts } from "pcb-enclosure";

test("the imported box spec renders a GLB outside canonical Circuit JSON", async () => {
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
	const artifacts = await renderEnclosurePreviewArtifacts({
		circuit,
		circuitJson,
	});

	expect(circuitJson.some((element) => element.type === "cad_component")).toBe(
		false,
	);
	expect(artifacts).toHaveLength(1);
	expect(artifacts[0]?.glb.byteLength).toBeGreaterThan(1000);
});
