import * as modeling from "@jscad/modeling";
import {
	convertJscadModelToGltf,
	type JscadRenderedGeometry,
} from "jscad-to-gltf";
import {
	executeJscadOperations,
	type JscadImplementation,
	type JscadOperation,
} from "jscad-planner";
import type { EnclosureModel } from "./build-enclosure";

const jscadImplementation = modeling as unknown as JscadImplementation<
	unknown,
	number
>;

const executePlan = (
	plan: unknown,
	color: [number, number, number],
): JscadRenderedGeometry[] => {
	const rendered = executeJscadOperations(
		jscadImplementation,
		plan as JscadOperation,
	);
	const geometries = Array.isArray(rendered) ? rendered : [rendered];
	return geometries.map((geom) => ({
		geom: geom as JscadRenderedGeometry["geom"],
		color,
	}));
};

export const exportEnclosureModelToGlb = async (
	model: EnclosureModel,
): Promise<ArrayBuffer> => {
	const geometries = [
		...model.parts.flatMap((part) =>
			executePlan(
				part.geom,
				part.id === "lid" ? [0.36, 0.55, 0.94] : [0.62, 0.65, 0.68],
			),
		),
		...model.hardware.flatMap((hardware) =>
			executePlan(
				hardware.geom,
				hardware.role === "bushing" ? [0.76, 0.5, 0.2] : [0.55, 0.57, 0.6],
			),
		),
	];
	if (geometries.length === 0) {
		throw new Error("[pcb-enclosure] cannot export an empty enclosure model");
	}
	const result = await convertJscadModelToGltf(
		{ geometries },
		{
			format: "glb",
			meshName: "TscircuitEnclosure",
			axisTransform: "none",
		},
	);
	if (!(result.data instanceof ArrayBuffer)) {
		throw new Error("[pcb-enclosure] GLB exporter returned non-binary data");
	}
	return result.data;
};
