import * as core from "@tscircuit/core";
import { Enclosure } from "./Enclosure";
import type { EnclosureProps } from "./enclosure-props";

/**
 * Register `<enclosure />` with the tscircuit reconciler. Import this module for
 * its side effect to make the tag usable in any .tsx alongside `<board />`:
 *
 *   import "pcb-enclosure/register";
 *   ...
 *   <board name="B1"> ... </board>
 *   <enclosure wallThickness="2mm" />
 *
 * Kept out of the package's main entry (`pcb-enclosure`) so the pure analysis /
 * geometry API stays free of the `@tscircuit/core` runtime. Requires core to
 * export `extendCatalogue`; the guard keeps this safe against older cores.
 */
const extendCatalogue = (core as any).extendCatalogue as
	| undefined
	| ((o: object) => void);
if (extendCatalogue) {
	extendCatalogue({ Enclosure });
} else if (typeof console !== "undefined") {
	console.warn(
		"[pcb-enclosure] @tscircuit/core does not export extendCatalogue; rebuild core to enable <enclosure>.",
	);
}

export { Enclosure };

/**
 * JSX intrinsic typing for `<enclosure>` — derived from the zod prop schema, so
 * `.tsx` authors get completion and type errors on every prop.
 *
 * tscircuit's built-in intrinsics (`<board>`, `<group>`, ...) are declared by
 * `@tscircuit/core` as augmentations of the `react` and `react/jsx-runtime`
 * modules' `JSX` namespace — the lookup path TypeScript uses under
 * `jsx: "react-jsx"`. We augment the same module targets so `<enclosure>`
 * type-checks in `.tsx`.
 */
interface EnclosureIntrinsicElements {
	enclosure: EnclosureProps & { children?: any; key?: any };
}

declare module "react" {
	namespace JSX {
		interface IntrinsicElements extends EnclosureIntrinsicElements {}
	}
}

declare module "react/jsx-runtime" {
	namespace JSX {
		interface IntrinsicElements extends EnclosureIntrinsicElements {}
	}
}
