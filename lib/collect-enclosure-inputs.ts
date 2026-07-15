import type { ApertureProfile } from "./cutout-aperture";
import {
	ENCLOSURE_CUTOUT_APERTURE_ELEMENT,
	ENCLOSURE_FDM_BOX_ELEMENT,
	type ParsedEnclosureCutoutApertureJsxProps,
} from "./enclosure-namespace";
import type { ParsedEnclosureProps } from "./enclosure-props";

interface CoreTreeNode {
	externalReactElementType?: string;
	_parsedProps?: Record<string, unknown>;
	children?: CoreTreeNode[];
	parent?: CoreTreeNode | null;
	source_component_id?: string | null;
	getParentNormalComponent?: () => {
		source_component_id?: string | null;
	} | null;
}

export interface CollectedEnclosureInput {
	props: ParsedEnclosureProps;
	aperturesBySourceComponentId: Record<string, ApertureProfile>;
}

const toApertureProfile = (
	props: ParsedEnclosureCutoutApertureJsxProps,
): ApertureProfile => {
	const common = {
		position: props.position,
		marginMm: props.margin,
	};
	if (props.shape === "circle") {
		return {
			...common,
			shape: "circle",
			diameterMm: props.radius * 2,
		};
	}
	if (props.shape === "pill") {
		return {
			...common,
			shape: "rounded_rect",
			widthMm: props.width,
			heightMm: props.height,
			cornerRadiusMm: Math.min(props.width, props.height) / 2,
		};
	}
	return {
		...common,
		shape: "rect",
		widthMm: props.width,
		heightMm: props.height,
	};
};

const getSourceComponentId = (node: CoreTreeNode): string | undefined => {
	const normalParent = node.getParentNormalComponent?.();
	if (normalParent?.source_component_id)
		return normalParent.source_component_id;
	let parent = node.parent;
	while (parent) {
		if (parent.source_component_id) return parent.source_component_id;
		parent = parent.parent;
	}
	return undefined;
};

export const collectEnclosureInputs = (circuit: {
	children?: CoreTreeNode[];
	externalReactElements?: CoreTreeNode[];
}): CollectedEnclosureInput[] => {
	const boxes: ParsedEnclosureProps[] = [];
	const aperturesBySourceComponentId: Record<string, ApertureProfile> = {};
	const visited = new Set<CoreTreeNode>();
	const processNode = (node: CoreTreeNode): void => {
		if (
			node.externalReactElementType === ENCLOSURE_FDM_BOX_ELEMENT &&
			node._parsedProps
		) {
			boxes.push(node._parsedProps as ParsedEnclosureProps);
		}
		if (
			node.externalReactElementType === ENCLOSURE_CUTOUT_APERTURE_ELEMENT &&
			node._parsedProps
		) {
			const sourceComponentId = getSourceComponentId(node);
			if (!sourceComponentId) {
				throw new Error(
					"[pcb-enclosure] enclosure.cutoutaperture must be nested in a source component",
				);
			}
			aperturesBySourceComponentId[sourceComponentId] = toApertureProfile(
				node._parsedProps as ParsedEnclosureCutoutApertureJsxProps,
			);
		}
	};
	const walk = (node: CoreTreeNode): void => {
		if (visited.has(node)) return;
		visited.add(node);
		processNode(node);
		for (const child of node.children ?? []) walk(child);
	};
	for (const child of circuit.children ?? []) walk(child);
	// Isolated/cached subcircuits expose their external elements here even when
	// the live children tree no longer contains them.
	for (const external of circuit.externalReactElements ?? []) walk(external);
	return boxes.map((props) => ({
		props,
		aperturesBySourceComponentId,
	}));
};
