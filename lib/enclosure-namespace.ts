import {
	enclosureCutoutApertureProps,
	type EnclosureCutoutApertureProps,
	type ParsedEnclosureCutoutApertureProps,
} from "@tscircuit/props";
import { createElement, type ReactElement } from "react";
import type { EnclosureProps } from "./enclosure-props";
import { enclosureProps } from "./enclosure-props";
import { registerExternalElement } from "./register-external-react-element";

export const ENCLOSURE_FDM_BOX_ELEMENT = "enclosure.fdm.box";
export const ENCLOSURE_CUTOUT_APERTURE_ELEMENT = "enclosure.cutoutaperture";

export const enclosureCutoutApertureJsxProps = enclosureCutoutApertureProps;

export type EnclosureCutoutApertureJsxProps = EnclosureCutoutApertureProps;
export type ParsedEnclosureCutoutApertureJsxProps =
	ParsedEnclosureCutoutApertureProps;

registerExternalElement(ENCLOSURE_FDM_BOX_ELEMENT, enclosureProps);
registerExternalElement(
	ENCLOSURE_CUTOUT_APERTURE_ELEMENT,
	enclosureCutoutApertureJsxProps,
);

const EnclosureFdmBoxElement = (props: EnclosureProps): ReactElement =>
	createElement(ENCLOSURE_FDM_BOX_ELEMENT, props);

const EnclosureCutoutApertureElement = (
	props: EnclosureCutoutApertureJsxProps,
): ReactElement => {
	if (props.shape === "circle") {
		return createElement(ENCLOSURE_CUTOUT_APERTURE_ELEMENT, props);
	}
	if (props.shape === "pill") {
		return createElement(ENCLOSURE_CUTOUT_APERTURE_ELEMENT, props);
	}
	return createElement(ENCLOSURE_CUTOUT_APERTURE_ELEMENT, props);
};

export const enclosure = {
	cutoutaperture: EnclosureCutoutApertureElement,
	fdm: {
		box: EnclosureFdmBoxElement,
	},
} as const;
