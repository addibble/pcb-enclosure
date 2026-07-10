import { z } from "zod";
import { mountingStackRef } from "./children";
import { DEFAULT_PARAMS, type AnchorRef, type EnclosureParams } from "./types";
import { mm, toMm } from "./units";

export { mm, toMm } from "./units";

/**
 * Props for the `<enclosure />` element. Every prop here is consumed — props
 * whose implementation hasn't landed are omitted from the schema (so they fail
 * loudly rather than silently doing nothing).
 *
 * This is the minimal, board-driven surface: overall wall/floor/lid/standoff
 * sizing, the PCB-mounting anchor (a mounting-stack catalog key or inline spec),
 * and the opt-in auto-cutout toggle. Explicit `<enclosurecutout>` and the other
 * child vocabularies are a later layer.
 */
export const enclosureProps = z
	.object({
		name: z.string().optional(),
		/** Selector of the board to enclose (e.g. ".B1"); the single board if omitted. */
		boardRef: z.string().optional(),
		wallThickness: mm.optional(),
		floorThickness: mm.optional(),
		lidThickness: mm.optional(),
		boardClearance: mm.optional(),
		standoffHeight: mm.optional(),
		topHeadroom: mm.optional(),
		/** Depth of the friction lip nesting the lid into the base. */
		lidLipDepth: mm.optional(),
		/** PCB-mounting stack: a `mountingHardwareCatalog` key or an inline spec. */
		anchor: mountingStackRef.optional(),
		/** Auto-detect wall/lid openings at edge/top connectors (opt-in). */
		autoCutouts: z.boolean().optional(),
	})
	.strict();

export type EnclosureProps = z.input<typeof enclosureProps>;

/** `<enclosure>` mm prop → `EnclosureParams` field pairs, applied table-driven. */
const MM_PROPS = [
	["wallThickness", "wallThicknessMm"],
	["floorThickness", "floorThicknessMm"],
	["lidThickness", "lidThicknessMm"],
	["boardClearance", "boardClearanceMm"],
	["standoffHeight", "standoffHeightMm"],
	["topHeadroom", "topHeadroomMm"],
	["lidLipDepth", "lidLipDepthMm"],
] as const;

/**
 * Resolve `<enclosure>` props into `EnclosureParams` (pure; no reconciler). Kept
 * out of the component class so it can be unit-tested without `@tscircuit/core`.
 */
export const resolveEnclosureParams = (
	props: EnclosureProps,
): EnclosureParams => {
	const params: EnclosureParams = { ...DEFAULT_PARAMS };
	for (const [prop, field] of MM_PROPS)
		params[field] = toMm(props[prop], DEFAULT_PARAMS[field]);
	if (props.anchor != null) params.anchor = props.anchor as AnchorRef;
	if (props.autoCutouts != null) params.autoCutouts = props.autoCutouts;
	return params;
};
