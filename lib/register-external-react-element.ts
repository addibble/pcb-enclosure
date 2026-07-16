import {
	registerExternalReactElement,
	type ExternalReactElementRegistration,
} from "@tscircuit/core";

export const registerExternalElement = (
	type: string,
	schema: { parse: (props: unknown) => Record<string, unknown> },
	options: { omitChildren?: boolean; isRootContainer?: boolean } = {},
): void => {
	const registration: ExternalReactElementRegistration = {
		isRootContainer: options.isRootContainer,
		parseProps: (props) => {
			if (
				options.omitChildren &&
				props != null &&
				typeof props === "object" &&
				"children" in props
			) {
				const { children: _children, ...propsWithoutChildren } = props;
				return schema.parse(propsWithoutChildren);
			}
			return schema.parse(props);
		},
	};
	registerExternalReactElement(type, registration);
};
