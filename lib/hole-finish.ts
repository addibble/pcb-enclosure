import type { LidHole } from "./types";

/**
 * Reusable screw-hole CSG, generalized over hole finish **and** orientation.
 *
 * `screwHoleCut` returns a single solid to **subtract** from a plate/boss to cut
 * a finished fastener hole: a clearance bore plus, for `countersink` /
 * `counterbore`, a head recess at the seat. It is built in a canonical frame
 * (head at the origin, seat facing +z, bore running toward -z) and then rotated
 * to the outward `axis` and translated to `center`, so the same recipe finishes
 * a hole on any face (a lid top, a base bottom, an end cap). Uses only ops
 * `jscad-planner` can record (`cylinder`, `hull`, `transforms.rotate`), with the
 * `hull` namespace resolved for either injected implementation (`@jscad/modeling`
 * exposes `hulls.hull`; `jscad-planner` exposes `booleans.hull`).
 */

/** Outward face normal the fastener head seats against. */
export type HoleAxis = "+z" | "-z" | "+x" | "-x" | "+y" | "-y";

export interface ScrewHoleSpec {
	/** Head-seat point on the outer plate surface (board-plane frame). */
	center: [number, number, number];
	/** Outward face normal: the head sits on this face, the bore runs opposite. */
	axis: HoleAxis;
	/** Screw-shaft clearance radius (the through bore). */
	clearanceR: number;
	/** How deep the clearance bore runs into the material from the seat. */
	boreDepth: number;
	/** Hole finish. */
	finish: LidHole;
	/** Fastener head radius (countersink top radius / counterbore radius). */
	headR: number;
	/** Counterbore recess depth (ignored for `through` / `countersink`). */
	counterboreDepth: number;
}

/** Euler rotation taking the canonical +z seat to the outward `axis`. */
const rotationForAxis = (axis: HoleAxis): [number, number, number] => {
	switch (axis) {
		case "+z":
			return [0, 0, 0];
		case "-z":
			return [Math.PI, 0, 0];
		case "+x":
			return [0, Math.PI / 2, 0];
		case "-x":
			return [0, -Math.PI / 2, 0];
		case "+y":
			return [-Math.PI / 2, 0, 0];
		case "-y":
			return [Math.PI / 2, 0, 0];
	}
};

export const screwHoleCut = (jscad: any, spec: ScrewHoleSpec): any => {
	const { primitives, booleans, transforms, hulls } = jscad;
	const { cylinder } = primitives;
	const { union } = booleans;
	const { rotate, translate } = transforms;
	const hull = hulls?.hull ?? booleans?.hull; // modeling vs jscad-planner
	const eps = 0.2;
	const seg = 48;

	// clearance bore: from just proud of the seat down through the material
	let cut = translate(
		[0, 0, (eps - spec.boreDepth) / 2],
		cylinder({
			radius: spec.clearanceR,
			height: spec.boreDepth + eps,
			segments: seg,
		}),
	);

	if (spec.finish === "counterbore") {
		const depth = Math.min(spec.counterboreDepth, spec.boreDepth - 0.4);
		if (depth > 0.1) {
			cut = union(
				cut,
				translate(
					[0, 0, (eps - depth) / 2],
					cylinder({ radius: spec.headR, height: depth + eps, segments: seg }),
				),
			);
		}
	} else if (spec.finish === "countersink" && hull) {
		// 90° flat-head cone: widens from clearanceR (deep) to headR (at the seat)
		const depth = Math.min(
			Math.max(0, spec.headR - spec.clearanceR),
			spec.boreDepth - 0.2,
		);
		if (depth > 0.1) {
			const top = translate(
				[0, 0, eps / 2],
				cylinder({ radius: spec.headR, height: eps, segments: seg }),
			);
			const bottom = translate(
				[0, 0, -depth],
				cylinder({ radius: spec.clearanceR, height: eps, segments: seg }),
			);
			cut = union(cut, hull(top, bottom));
		}
	}

	return translate(spec.center, rotate(rotationForAxis(spec.axis), cut));
};
