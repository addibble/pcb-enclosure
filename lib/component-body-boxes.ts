import type { EnclosureModel } from "./build-enclosure";
import type { ComponentBody, EnclosureFeatures } from "./types";

/** Axis-aligned board-assembly body in the enclosure model frame. */
export interface ComponentBodyBox {
	/** Board component id/name. Far-side projections share the same name. */
	name: string;
	center: [number, number, number];
	half: [number, number, number];
	min: [number, number, number];
	max: [number, number, number];
}

const boxFromMinMax = (
	name: string,
	min: [number, number, number],
	max: [number, number, number],
): ComponentBodyBox => ({
	name,
	min,
	max,
	center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
	half: [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2],
});

/**
 * Convert extracted component bodies to model-frame AABBs for DRC.
 *
 * `heightMm` extends outward from the component's mounted PCB side, `zOffsetMm`
 * is the gap from that PCB surface to the nearest face of the body, and
 * `farSideProjectionMm` models through-hole leads/clips past the opposite PCB
 * surface. The mesh and analytic DRCs share this helper so bottom-side and
 * through-hole geometry is treated consistently.
 */
export const componentBodyBoxes = (
	model: EnclosureModel,
	features: EnclosureFeatures,
	opts: { minHeightMm?: number } = {},
): ComponentBodyBox[] => {
	const minHeight = opts.minHeightMm ?? 0.05;
	const cx = model.pcb.center.x;
	const cy = model.pcb.center.y;
	const boardBottomZ = model.pcb.boardBottomZ;
	const boardTopZ = boardBottomZ + model.pcb.thicknessMm;
	const out: ComponentBodyBox[] = [];

	for (const b of features.componentBodies) {
		const x0 = b.center.x - cx - b.lengthMm / 2;
		const x1 = b.center.x - cx + b.lengthMm / 2;
		const y0 = b.center.y - cy - b.widthMm / 2;
		const y1 = b.center.y - cy + b.widthMm / 2;
		const zOffset = b.zOffsetMm ?? 0;

		if (b.heightMm > minHeight) {
			if ((b.side ?? "top") === "bottom") {
				const z1 = boardBottomZ - zOffset;
				const z0 = z1 - b.heightMm;
				out.push(boxFromMinMax(b.id, [x0, y0, z0], [x1, y1, z1]));
			} else {
				const z0 = boardTopZ + zOffset;
				const z1 = z0 + b.heightMm;
				out.push(boxFromMinMax(b.id, [x0, y0, z0], [x1, y1, z1]));
			}
		}

		const far = b.farSideProjectionMm ?? 0;
		if (far > minHeight) {
			if ((b.side ?? "top") === "bottom") {
				out.push(
					boxFromMinMax(b.id, [x0, y0, boardTopZ], [x1, y1, boardTopZ + far]),
				);
			} else {
				out.push(
					boxFromMinMax(
						b.id,
						[x0, y0, boardBottomZ - far],
						[x1, y1, boardBottomZ],
					),
				);
			}
		}
	}

	return out;
};
