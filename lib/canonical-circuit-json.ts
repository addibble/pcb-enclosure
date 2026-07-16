import { registerCircuitJsonPostprocessor } from "@tscircuit/core";
import type {
	AnyCircuitElement,
	CadComponent,
	PcbComponent,
	SourceSimpleChip,
} from "circuit-json";
import { collectEnclosureInputs } from "./collect-enclosure-inputs";
import { renderEnclosureFromCircuitJson } from "./render-enclosure";

const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_");

export const appendEnclosureToCircuitJson = ({
	circuit,
	circuitJson,
}: {
	circuit: object;
	circuitJson: AnyCircuitElement[];
}): AnyCircuitElement[] => {
	const specs = collectEnclosureInputs(circuit);
	if (specs.length === 0) return circuitJson;

	const additions: AnyCircuitElement[] = [];
	for (const spec of specs) {
		const rendered = renderEnclosureFromCircuitJson(circuitJson, spec.props, {
			extract: {
				aperturesBySourceComponentId: spec.aperturesBySourceComponentId,
			},
		});
		const boardMidZ =
			rendered.model.pcb.boardBottomZ + rendered.features.boardThicknessMm / 2;
		const position = {
			x: rendered.features.boardCenter.x,
			y: rendered.features.boardCenter.y,
			z: -boardMidZ,
		};
		const addPart = ({
			id,
			plan,
			translucent = false,
			displayValue,
		}: {
			id: string;
			plan: unknown;
			translucent?: boolean;
			displayValue?: string;
		}) => {
			const syntheticId = safeId(`${rendered.name}_${id}`);
			const sourceComponentId = `source_enclosure_${syntheticId}`;
			const pcbComponentId = `pcb_enclosure_${syntheticId}`;
			additions.push({
				type: "source_component",
				ftype: "simple_chip",
				source_component_id: sourceComponentId,
				name: `${rendered.name}.${id}`,
				...(displayValue ? { display_value: displayValue } : {}),
			} satisfies SourceSimpleChip);
			additions.push({
				type: "pcb_component",
				pcb_component_id: pcbComponentId,
				source_component_id: sourceComponentId,
				center: rendered.features.boardCenter,
				layer: "top",
				rotation: 0,
				width: 0,
				height: 0,
				do_not_place: true,
				is_allowed_to_be_off_board: true,
				obstructs_within_bounds: false,
			} satisfies PcbComponent);
			additions.push({
				type: "cad_component",
				cad_component_id: `cad_${syntheticId}`,
				source_component_id: sourceComponentId,
				pcb_component_id: pcbComponentId,
				position,
				rotation: { x: 0, y: 0, z: 0 },
				model_jscad: plan,
				show_as_translucent_model: translucent,
				model_object_fit: "contain_within_bounds",
				anchor_alignment: "center",
			} satisfies CadComponent);
		};

		for (const part of rendered.model.parts) {
			addPart({
				id: part.id,
				plan: part.geom,
				translucent: part.id === "lid",
			});
		}
		for (const hardware of rendered.model.hardware) {
			addPart({
				id: hardware.id,
				plan: hardware.geom,
				displayValue: hardware.displayValue,
			});
		}
	}

	return [...circuitJson, ...additions];
};

registerCircuitJsonPostprocessor("pcb-enclosure", ({ circuit, circuitJson }) =>
	appendEnclosureToCircuitJson({ circuit, circuitJson }),
);
