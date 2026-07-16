import {
	assemblyDeviceProps,
	type AssemblyDevicePropsInput,
} from "@tscircuit/props";
import { createElement, type ReactElement, type ReactNode } from "react";
import { registerExternalElement } from "./register-external-react-element";

export const ASSEMBLY_DEVICE_ELEMENT = "assembly.device";

registerExternalElement(ASSEMBLY_DEVICE_ELEMENT, assemblyDeviceProps, {
	omitChildren: true,
	isRootContainer: true,
});

export interface AssemblyDeviceJsxProps extends AssemblyDevicePropsInput {
	children?: ReactNode;
}

const AssemblyDeviceElement = ({
	children,
	...props
}: AssemblyDeviceJsxProps): ReactElement =>
	createElement(ASSEMBLY_DEVICE_ELEMENT, props, children);

export const assembly = {
	device: AssemblyDeviceElement,
} as const;
