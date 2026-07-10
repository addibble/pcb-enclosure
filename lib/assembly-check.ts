import * as modeling from "@jscad/modeling";
import type { EnclosureModel } from "./build-enclosure";
import { componentBodyBoxes } from "./component-body-boxes";
import type { EnclosureFeatures, EnclosureParams } from "./types";

const { booleans, primitives, measurements } = modeling;

export interface AssemblyCollision {
	partId: string;
	/** "PCB" or a component id. */
	against: string;
	overlapMm3: number;
}

type AABB = { min: [number, number, number]; max: [number, number, number] };
const aabbOverlap = (a: AABB, b: AABB): boolean =>
	a.min[0] < b.max[0] &&
	a.max[0] > b.min[0] &&
	a.min[1] < b.max[1] &&
	a.max[1] > b.min[1] &&
	a.min[2] < b.max[2] &&
	a.max[2] > b.min[2];

interface Target {
	name: string;
	geom: any;
	bbox: AABB;
}
const mkTarget = (name: string, geom: any): Target => {
	const m = measurements.measureBoundingBox(geom) as [number[], number[]];
	return { name, geom, bbox: { min: m[0] as any, max: m[1] as any } };
};

/** Intersect every part with every target; report overlaps above the threshold. */
const intersectParts = (
	parts: EnclosureModel["parts"],
	targets: Target[],
	minVol: number,
): AssemblyCollision[] => {
	const collisions: AssemblyCollision[] = [];
	for (const part of parts) {
		const pbb: AABB = { min: part.bounds.min, max: part.bounds.max };
		for (const tgt of targets) {
			if (!aabbOverlap(pbb, tgt.bbox)) continue;
			const v = measurements.measureVolume(
				booleans.intersect(part.geom, tgt.geom),
			);
			if (v > minVol)
				collisions.push({ partId: part.id, against: tgt.name, overlapMm3: v });
		}
	}
	return collisions;
};

/**
 * Assembled-collision check ("assembly DRC"): in the *seated* state, no part may
 * intrude into the PCB volume or a component body. Parts that merely touch
 * produce ~0 volume and are ignored.
 */
export const checkAssemblyCollisions = (
	model: EnclosureModel,
	features: EnclosureFeatures,
	opts: { minVolumeMm3?: number } = {},
): AssemblyCollision[] => {
	const minVol = opts.minVolumeMm3 ?? 1.0;
	const boardBottomZ = model.pcb.boardBottomZ;
	const t = model.pcb.thicknessMm;
	const bb = features.bounds;
	const boardW = bb.maxX - bb.minX;
	const boardH = bb.maxY - bb.minY;

	const targets: Target[] = [
		mkTarget(
			"PCB",
			primitives.cuboid({
				size: [boardW, boardH, t],
				center: [0, 0, boardBottomZ + t / 2],
			}),
		),
	];
	const cutoutComponentIds = new Set(model.cutoutComponentIds ?? []);
	for (const b of componentBodyBoxes(model, features)) {
		if (cutoutComponentIds.has(b.name)) continue;
		targets.push(
			mkTarget(
				b.name,
				primitives.cuboid({
					size: [2 * b.half[0], 2 * b.half[1], 2 * b.half[2]],
					center: b.center,
				}),
			),
		);
	}
	return intersectParts(model.parts, targets, minVol);
};

/**
 * Swept-insertion check: the board and everything it carries (its components)
 * must clear every feature along the **whole placement travel**, not just at the
 * seated position. The board is dropped down (`z`) onto the standoffs *before*
 * the lid goes on. So we sweep each cross-section from its seated extent to the
 * open end (the seam) and test it against only the part that is present during
 * placement (the base).
 *
 * Catches features that foul the board mid-placement even when the seated state
 * is collision-free (e.g. a boss in the board's drop path).
 */
export const checkInsertionCollisions = (
	model: EnclosureModel,
	features: EnclosureFeatures,
	params: EnclosureParams,
	opts: { minVolumeMm3?: number } = {},
): AssemblyCollision[] => {
	const minVol = opts.minVolumeMm3 ?? 1.0;

	// axis (0=x,1=y,2=z), the open-end coordinate the board enters from, and the
	// part that is fixed while the board is placed.
	let axis: 0 | 1 | 2;
	let openEnd: number;
	let receivingId: string;
	if (model.meta.seamZ != null) {
		axis = 2; // drop-in along +z onto the standoffs
		openEnd = model.meta.seamZ;
		receivingId = "base";
	} else {
		return [];
	}
	const parts = model.parts.filter((p) => p.id === receivingId);
	if (parts.length === 0) return [];

	const boardBottomZ = model.pcb.boardBottomZ;
	const t = model.pcb.thicknessMm;
	const boardTopZ = boardBottomZ + t;
	const bb = features.bounds;
	const boardW = bb.maxX - bb.minX;
	const boardH = bb.maxY - bb.minY;

	// sweep a seated box [lo,hi] to the open end along `axis` (entry from + side)
	const sweep = (
		name: string,
		lo: [number, number, number],
		hi: [number, number, number],
	): Target => {
		const h2: [number, number, number] = [hi[0], hi[1], hi[2]];
		h2[axis] = Math.max(hi[axis], openEnd);
		const size: [number, number, number] = [
			h2[0] - lo[0],
			h2[1] - lo[1],
			h2[2] - lo[2],
		];
		const center: [number, number, number] = [
			(lo[0] + h2[0]) / 2,
			(lo[1] + h2[1]) / 2,
			(lo[2] + h2[2]) / 2,
		];
		return mkTarget(name, primitives.cuboid({ size, center }));
	};

	const targets: Target[] = [
		sweep(
			"PCB(swept)",
			[-boardW / 2, -boardH / 2, boardBottomZ],
			[boardW / 2, boardH / 2, boardTopZ],
		),
	];
	const cutoutComponentIds = new Set(model.cutoutComponentIds ?? []);
	for (const b of componentBodyBoxes(model, features)) {
		if (cutoutComponentIds.has(b.name)) continue;
		targets.push(sweep(`${b.name}(swept)`, b.min, b.max));
	}
	return intersectParts(parts, targets, minVol);
};
