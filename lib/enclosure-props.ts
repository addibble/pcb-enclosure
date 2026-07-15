import { enclosureFdmBoxProps } from "@tscircuit/props";
import { z } from "zod";
import { mountingStackRef } from "./children";
import { DEFAULT_PARAMS, type AnchorRef, type EnclosureParams } from "./types";
import { mm, toMm } from "./units";

export { mm, toMm } from "./units";
export type { EnclosureFdmBoxProps } from "@tscircuit/props";

/**
 * Props for `<enclosure.fdm.box />`. The upstream props contract supplies the
 * board reference plus optional outer dimensions and wall thickness. This
 * package extends it only with controls already implemented by the split-shell
 * generator.
 *
 * Every accepted prop is consumed; unknown props fail loudly.
 */
export const enclosureProps = enclosureFdmBoxProps
	.extend({
		name: z.string().optional(),
		floorThickness: mm.optional(),
		lidThickness: mm.optional(),
		boardClearance: mm.optional(),
		standoffHeight: mm.optional(),
		topHeadroom: mm.optional(),
		/** Depth of the friction lip nesting the lid into the base. */
		lidLipDepth: mm.optional(),
		/** PCB-mounting stack: a `mountingHardwareCatalog` key or an inline spec. */
		anchor: mountingStackRef.optional(),
		/** Automatically place apertures explicitly declared by parts (opt-in). */
		autoCutouts: z.boolean().optional(),
	})
	.strict();

export type EnclosureProps = z.input<typeof enclosureProps>;
export type ParsedEnclosureProps = z.output<typeof enclosureProps>;

/** Box mm prop → `EnclosureParams` field pairs, applied table-driven. */
const MM_PROPS = [
	["wallThickness", "wallThicknessMm"],
	["floorThickness", "floorThicknessMm"],
	["lidThickness", "lidThicknessMm"],
	["boardClearance", "boardClearanceMm"],
	["standoffHeight", "standoffHeightMm"],
	["topHeadroom", "topHeadroomMm"],
	["lidLipDepth", "lidLipDepthMm"],
] as const;

const OUTER_DIMENSION_PROPS = [
	["width", "widthMm"],
	["height", "heightMm"],
	["depth", "depthMm"],
] as const;

/**
 * Resolve `<enclosure.fdm.box>` props into `EnclosureParams` (pure; no
 * reconciler). Kept out of the component class so it can be unit-tested without
 * `@tscircuit/core`.
 */
export const resolveEnclosureParams = (
	props: EnclosureProps,
): EnclosureParams => {
	const params: EnclosureParams = { ...DEFAULT_PARAMS };
	for (const [prop, field] of MM_PROPS)
		params[field] = toMm(props[prop], DEFAULT_PARAMS[field]);
	for (const [prop, field] of OUTER_DIMENSION_PROPS) {
		const value = props[prop];
		if (value != null) params[field] = toMm(value, 0);
	}
	if (props.anchor != null) params.anchor = props.anchor as AnchorRef;
	if (props.autoCutouts != null) params.autoCutouts = props.autoCutouts;
	return params;
};
