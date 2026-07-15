import { enclosureCutoutApertureProps, point3 } from "@tscircuit/props";
import {
	registerExternalReactElement,
	type ExternalReactElementRegistration,
} from "@tscircuit/core";
import { createElement, type ReactElement } from "react";
import { z } from "zod";
import type { EnclosureProps } from "./enclosure-props";
import { enclosureProps } from "./enclosure-props";

export const ENCLOSURE_FDM_BOX_ELEMENT = "enclosure.fdm.box";
export const ENCLOSURE_CUTOUT_APERTURE_ELEMENT = "enclosure.cutoutaperture";

export const enclosureCutoutApertureJsxProps = enclosureCutoutApertureProps.and(
	z.object({
		position: point3.partial().optional(),
	}),
);

export type EnclosureCutoutApertureJsxProps = z.input<
	typeof enclosureCutoutApertureJsxProps
>;
export type ParsedEnclosureCutoutApertureJsxProps = z.output<
	typeof enclosureCutoutApertureJsxProps
>;

const register = (
	type: string,
	schema: { parse: (props: unknown) => Record<string, unknown> },
): void => {
	const registration: ExternalReactElementRegistration = {
		parseProps: (props) => schema.parse(props),
	};
	registerExternalReactElement(type, registration);
};

register(ENCLOSURE_FDM_BOX_ELEMENT, enclosureProps);
register(ENCLOSURE_CUTOUT_APERTURE_ELEMENT, enclosureCutoutApertureJsxProps);

const EnclosureFdmBoxElement = (props: EnclosureProps): ReactElement =>
	createElement(ENCLOSURE_FDM_BOX_ELEMENT, props);

const EnclosureCutoutApertureElement = (
	props: EnclosureCutoutApertureJsxProps,
): ReactElement => {
	if (props.shape === "circle")
		return createElement(ENCLOSURE_CUTOUT_APERTURE_ELEMENT, props);
	if (props.shape === "pill")
		return createElement(ENCLOSURE_CUTOUT_APERTURE_ELEMENT, props);
	return createElement(ENCLOSURE_CUTOUT_APERTURE_ELEMENT, props);
};

export const enclosure = {
	cutoutaperture: EnclosureCutoutApertureElement,
	fdm: {
		box: EnclosureFdmBoxElement,
	},
} as const;
