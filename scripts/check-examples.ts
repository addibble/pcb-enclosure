import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as modeling from "@jscad/modeling";
import measureBoundingBox from "@jscad/modeling/src/measurements/measureBoundingBox";
import {
	checkAssemblyCollisions,
	checkInsertionCollisions,
} from "../lib/assembly-check";
import { buildEnclosure } from "../lib/build-enclosure";
import {
	type EnclosureProps,
	resolveEnclosureParams,
} from "../lib/enclosure-props";
import { extractEnclosureFeatures } from "../lib/extract-features";
import { EnclosurePlacementSolver } from "../lib/placement-solver";

interface ExampleCase {
	slug: string;
	props: EnclosureProps;
	expected: {
		posts: number;
		bosses: number;
		cutouts: number;
		hardwareCadComponents: number;
		enclosureBomDesignators: string[];
	};
}

const examples: ExampleCase[] = [
	{
		slug: "prefab-board",
		props: { autoCutouts: true },
		expected: {
			posts: 5,
			bosses: 0,
			cutouts: 7,
			hardwareCadComponents: 10,
			enclosureBomDesignators: [
				"EN1_BOTTOM",
				"EN1_BUSHINGS_X5",
				"EN1_SCREWS_X5",
				"EN1_TOP",
			],
		},
	},
];

for (const example of examples) {
	const circuitJson = JSON.parse(
		readFileSync(`dist/examples/${example.slug}/circuit.json`, "utf8"),
	);
	const emittedPartIds = circuitJson
		.filter(
			(element: any) =>
				element.type === "cad_component" && element.enclosure_part_id,
		)
		.map((element: any) => element.enclosure_part_id)
		.sort();
	assert.deepEqual(emittedPartIds, ["base", "lid"]);
	const hardwareCadComponents = circuitJson.filter(
		(element: any) =>
			element.type === "cad_component" && element.enclosure_hardware_role,
	);
	assert.equal(
		hardwareCadComponents.length,
		example.expected.hardwareCadComponents,
	);
	assert.equal(
		hardwareCadComponents.every(
			(element: any) => element.enclosure_explode_z_offset_mm > 0,
		),
		true,
	);
	const enclosureBomDesignators = circuitJson
		.filter(
			(element: any) =>
				element.type === "source_component" && element.name?.startsWith("EN1_"),
		)
		.map((element: any) => element.name)
		.sort();
	assert.deepEqual(
		enclosureBomDesignators,
		example.expected.enclosureBomDesignators,
	);
	const features = extractEnclosureFeatures(circuitJson);
	const params = resolveEnclosureParams(example.props);
	const solver = new EnclosurePlacementSolver({
		obstacles: features.componentBodies.map((body) => ({
			id: body.id,
			cx: body.center.x,
			cy: body.center.y,
			w: body.lengthMm,
			h: body.widthMm,
		})),
		mountPoints: features.mountPoints.map((mount) => ({
			center: mount.center,
			pcbHoleDiameterMm: mount.pcbHoleDiameterMm,
		})),
		boardBounds: features.bounds,
		anchor: params.anchor,
		mountingHardwareCatalog: params.mountingHardwareCatalog,
		designRules: params.designRules,
		clearanceMm: 1,
		cornerFasteners: true,
		cornerInsetMm: params.cornerStandoffInsetMm,
	});
	solver.solve();

	const model = buildEnclosure(
		features,
		solver.getOutput(),
		params,
		[],
		modeling,
		measureBoundingBox,
	);
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
	assert.deepEqual(model.warnings, []);
	assert.deepEqual(checkAssemblyCollisions(model, features), []);
	assert.deepEqual(checkInsertionCollisions(model, features, params), []);

	console.log(
		`${example.slug}: ${model.meta.posts} posts, ${model.meta.bosses} ears, ${model.meta.cutouts} cutouts`,
	);
}
