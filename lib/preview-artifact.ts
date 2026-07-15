import type { CircuitJson } from "circuit-json";
import { collectEnclosureInputs } from "./collect-enclosure-inputs";
import { exportEnclosureModelToGlb } from "./export-glb";
import { renderEnclosureFromCircuitJson } from "./render-enclosure";

export interface CadGlbPreviewArtifact {
	artifact_type: "cad_glb";
	artifact_id: string;
	name: string;
	glb: ArrayBuffer;
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number };
	diagnostics?: Array<{
		severity: "warning" | "error";
		message: string;
	}>;
}

export interface PreviewArtifactHost {
	providers: Map<
		string,
		(input: {
			circuit?: object;
			circuitJson: CircuitJson;
		}) => Promise<CadGlbPreviewArtifact[]>
	>;
	getPreviewArtifacts(input: {
		circuit?: object;
		circuitJson: CircuitJson;
	}): Promise<CadGlbPreviewArtifact[]>;
}

export const PREVIEW_ARTIFACT_HOST_SYMBOL = Symbol.for(
	"tscircuit.preview-artifact-host.v1",
);

const artifactId = (name: string, boardRef: string): string =>
	`enclosure_${name}_${boardRef}`.replace(/[^a-zA-Z0-9_-]/g, "_");

export const renderEnclosurePreviewArtifacts = async ({
	circuit,
	circuitJson,
}: {
	circuit?: object;
	circuitJson: CircuitJson;
}): Promise<CadGlbPreviewArtifact[]> => {
	if (!circuit) return [];
	const specs = collectEnclosureInputs(circuit);
	const artifacts: CadGlbPreviewArtifact[] = [];
	for (const spec of specs) {
		const rendered = renderEnclosureFromCircuitJson(circuitJson, spec.props, {
			extract: {
				aperturesBySourceComponentId: spec.aperturesBySourceComponentId,
			},
		});
		const boardMidZ =
			rendered.model.pcb.boardBottomZ + rendered.features.boardThicknessMm / 2;
		const diagnostics: NonNullable<CadGlbPreviewArtifact["diagnostics"]> = [
			...rendered.model.warnings.map((message) => ({
				severity: "warning" as const,
				message,
			})),
			...rendered.conflicts.map((conflict) => ({
				severity:
					conflict.severity === "collision"
						? ("error" as const)
						: ("warning" as const),
				message: `${conflict.against} ${conflict.severity} with ${conflict.feature}`,
			})),
		];
		artifacts.push({
			artifact_type: "cad_glb",
			artifact_id: artifactId(rendered.name, spec.props.boardRef),
			name: rendered.name,
			glb: await exportEnclosureModelToGlb(rendered.model),
			position: {
				x: rendered.features.boardCenter.x,
				y: rendered.features.boardCenter.y,
				z: -boardMidZ,
			},
			rotation: { x: 0, y: 0, z: 0 },
			...(diagnostics.length > 0 ? { diagnostics } : {}),
		});
	}
	return artifacts;
};

const getOrCreatePreviewHost = (): PreviewArtifactHost => {
	const globalWithHost = globalThis as typeof globalThis & {
		[PREVIEW_ARTIFACT_HOST_SYMBOL]?: PreviewArtifactHost;
	};
	if (!globalWithHost[PREVIEW_ARTIFACT_HOST_SYMBOL]) {
		const providers = new Map<
			string,
			PreviewArtifactHost["providers"] extends Map<string, infer Provider>
				? Provider
				: never
		>();
		globalWithHost[PREVIEW_ARTIFACT_HOST_SYMBOL] = {
			providers,
			async getPreviewArtifacts(input) {
				const results = await Promise.all(
					[...providers.values()].map((provider) => provider(input)),
				);
				return results.flat();
			},
		};
	}
	return globalWithHost[PREVIEW_ARTIFACT_HOST_SYMBOL];
};

getOrCreatePreviewHost().providers.set(
	"pcb-enclosure",
	renderEnclosurePreviewArtifacts,
);
