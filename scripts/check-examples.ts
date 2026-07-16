import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as modeling from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import { Circuit } from "@tscircuit/core";
import type { CircuitJson } from "circuit-json";
import { createElement } from "react";
import PrefabBoardCircuit from "../examples/prefab-board.circuit";
import { collectEnclosureInputs } from "../lib/collect-enclosure-inputs";
import { renderEnclosureFromCircuitJson } from "../lib/render-enclosure";

interface ExampleCase {
	slug: string;
	expected: {
		posts: number;
		bosses: number;
		cutouts: number;
		hardwareInstances: number;
	};
}

const examples: ExampleCase[] = [
	{
		slug: "prefab-board",
		expected: {
			posts: 5,
			bosses: 0,
			cutouts: 7,
			hardwareInstances: 10,
		},
	},
];

for (const example of examples) {
	const builtCircuitJson = JSON.parse(
		readFileSync(`dist/examples/${example.slug}/circuit.json`, "utf8"),
	) as CircuitJson;
	assert.equal(
		builtCircuitJson.filter(
			(element) =>
				element.type === "source_component" &&
				element.source_component_id.startsWith("source_enclosure_"),
		).length,
		2 + example.expected.hardwareInstances,
		`${example.slug} synthetic enclosure source components`,
	);
	assert.equal(
		builtCircuitJson.filter(
			(element) =>
				element.type === "pcb_component" &&
				element.pcb_component_id.startsWith("pcb_enclosure_"),
		).length,
		2 + example.expected.hardwareInstances,
		`${example.slug} synthetic enclosure PCB components`,
	);
	assert.equal(
		builtCircuitJson.filter(
			(element) =>
				element.type === "cad_component" && element.model_jscad != null,
		).length,
		2 + example.expected.hardwareInstances,
		`${example.slug} enclosure CAD models`,
	);
	const circuit = new Circuit();
	const globalWithCircuit = globalThis as typeof globalThis & {
		__tscircuit_circuit?: object;
	};
	const previousCircuit = globalWithCircuit.__tscircuit_circuit;
	globalWithCircuit.__tscircuit_circuit = circuit;
	try {
		circuit.add(createElement(PrefabBoardCircuit));
		circuit.render();
	} finally {
		globalWithCircuit.__tscircuit_circuit = previousCircuit;
	}
	const [input] = collectEnclosureInputs(circuit);
	assert.ok(input, `${example.slug} produced no enclosure input`);
	const rendered = renderEnclosureFromCircuitJson(
		circuit.getCircuitJson(),
		input.props,
		{
			jscad: modeling,
			measureBounds: measureBoundingBox,
			extract: {
				aperturesBySourceComponentId: input.aperturesBySourceComponentId,
			},
		},
	);
	const { model } = rendered;
	assert.equal(
		model.meta.posts,
		example.expected.posts,
		`${example.slug} posts`,
	);
	assert.equal(
		model.meta.bosses,
		example.expected.bosses,
		`${example.slug} bosses`,
	);
	assert.equal(
		model.meta.cutouts,
		example.expected.cutouts,
		`${example.slug} cutouts`,
	);
	assert.deepEqual(model.parts.map((part) => part.id).sort(), ["base", "lid"]);
	assert.equal(model.hardware.length, example.expected.hardwareInstances);
	assert.deepEqual(model.warnings, []);

	console.log(
		`${example.slug}: ${model.meta.posts} posts, ${model.meta.bosses} ears, ${model.meta.cutouts} cutouts`,
	);
}
