import { DEFAULT_DESIGN_RULES, type DesignRules } from "./design-rules";

export type ApertureShape = "rect" | "rounded_rect" | "circle" | "d_shape";

/** Aperture center in the owning component's local mounting frame. */
export interface AperturePosition {
	x?: number;
	y?: number;
	z?: number;
}

/** Nominal part-authored opening dimensions, in millimetres. */
export interface ApertureProfile {
	shape: ApertureShape;
	widthMm?: number;
	heightMm?: number;
	diameterMm?: number;
	cornerRadiusMm?: number;
	flatOffsetMm?: number;
	position?: AperturePosition;
	marginMm?: number;
}

export interface ResolvedAperture {
	shape: ApertureShape;
	widthMm?: number;
	heightMm?: number;
	diameterMm?: number;
	cornerRadiusMm?: number;
	flatOffsetMm?: number;
	position?: AperturePosition;
	marginMm: number;
}

export const resolveCutoutAperture = (
	profile: ApertureProfile | undefined,
	rules: DesignRules = DEFAULT_DESIGN_RULES,
): ResolvedAperture | null =>
	profile
		? {
				...profile,
				marginMm: profile.marginMm ?? rules.cutout.defaultMarginMm,
			}
		: null;
