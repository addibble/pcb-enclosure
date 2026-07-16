import { type JscadImplementation, type JscadOperation } from "jscad-planner";
import type {
	convertJscadModelToGltf,
	JscadRenderedGeometry,
} from "jscad-to-gltf";
import type { EnclosureModel } from "./build-enclosure";

type DynamicModule = Record<string, unknown> & { default?: unknown };
type DynamicImporter = (specifier: string) => Promise<DynamicModule>;

const evalDynamicImporter = (
	globalThis as typeof globalThis & {
		__tscircuit_dynamic_import?: DynamicImporter;
	}
).__tscircuit_dynamic_import;

const dynamicImport: DynamicImporter =
	evalDynamicImporter ??
	(async (specifier) => (await import(specifier)) as DynamicModule);

interface JscadRuntime {
	implementation: JscadImplementation<unknown, number>;
	executeJscadOperations: (
		implementation: JscadImplementation<unknown, number>,
		operation: JscadOperation,
	) => unknown;
	convertJscadModelToGltf: typeof convertJscadModelToGltf;
}

let runtimePromise: Promise<JscadRuntime> | undefined;

const loadJscadRuntime = (): Promise<JscadRuntime> => {
	runtimePromise ??= Promise.all([
		dynamicImport("@jscad/modeling"),
		dynamicImport("jscad-planner"),
		dynamicImport("jscad-to-gltf"),
	]).then(([modelingModule, plannerModule, gltfModule]) => {
		if (typeof plannerModule.executeJscadOperations !== "function") {
			throw new Error("[pcb-enclosure] jscad-planner runtime is invalid");
		}
		if (typeof gltfModule.convertJscadModelToGltf !== "function") {
			throw new Error("[pcb-enclosure] jscad-to-gltf runtime is invalid");
		}
		return {
			implementation: (modelingModule.default ??
				modelingModule) as JscadImplementation<unknown, number>,
			executeJscadOperations:
				plannerModule.executeJscadOperations as JscadRuntime["executeJscadOperations"],
			convertJscadModelToGltf:
				gltfModule.convertJscadModelToGltf as typeof convertJscadModelToGltf,
		};
	});
	return runtimePromise;
};

const executePlan = (
	plan: unknown,
	color: [number, number, number],
	runtime: JscadRuntime,
): JscadRenderedGeometry[] => {
	const rendered = runtime.executeJscadOperations(
		runtime.implementation,
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
	const runtime = await loadJscadRuntime();
	const geometries = [
		...model.parts.flatMap((part) =>
			executePlan(
				part.geom,
				part.id === "lid" ? [0.36, 0.55, 0.94] : [0.62, 0.65, 0.68],
				runtime,
			),
		),
		...model.hardware.flatMap((hardware) =>
			executePlan(
				hardware.geom,
				hardware.role === "bushing" ? [0.76, 0.5, 0.2] : [0.55, 0.57, 0.6],
				runtime,
			),
		),
	];
	if (geometries.length === 0) {
		throw new Error("[pcb-enclosure] cannot export an empty enclosure model");
	}
	const result = await runtime.convertJscadModelToGltf(
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
