import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as modeling from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import { Circuit } from "@tscircuit/core";
import type { CircuitJson } from "circuit-json";
import { createElement } from "react";
import PrefabBoardCircuit from "../examples/prefab-board.circuit";
import {
	checkAssemblyCollisions,
	checkInsertionCollisions,
} from "../lib/assembly-check";
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
		builtCircuitJson.some(
			(element) =>
				element.type === "cad_component" && "enclosure_part_id" in element,
		),
		false,
		`${example.slug} canonical Circuit JSON contains enclosure topology`,
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
	const { model, features, params } = rendered;
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
	assert.deepEqual(checkAssemblyCollisions(model, features), []);
	assert.deepEqual(checkInsertionCollisions(model, features, params), []);

	console.log(
		`${example.slug}: ${model.meta.posts} posts, ${model.meta.bosses} ears, ${model.meta.cutouts} cutouts`,
	);
}
