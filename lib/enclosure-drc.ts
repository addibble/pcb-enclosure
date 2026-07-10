/**
 * Render-time assembly DRC — a **mesh-free** collision + clearance check that runs
 * inside the eval worker (where `@jscad/modeling` is unavailable, so the
 * boolean-intersection check in `assembly-check.ts` can't run).
 *
 * It reasons over analytic primitives the build already exposes on the model:
 *  - `obstacles` — fasteners that intrude into the cavity (screw channels, lid
 *    retention columns, standoffs), each a cylinder in the model frame.
 *  - `interior`  — the usable cavity AABB; a component body outside it sits in a
 *    wall/cap.
 *
 * Checks, all in the model frame (board recentered to x=y=0, z as built), matching
 * how `assembly-check.ts` places its targets:
 *  1. clearance — a component body (or the PCB slab) that overlaps an obstacle, or
 *     clears it by less than `minClearanceMm`, is flagged (a screw channel/column
 *     a part fouls or nearly touches — e.g. a connector 0.4mm off a corner channel
 *     looks like a collision and leaves no assembly tolerance).
 *  2. containment — a component body outside `interior` sits in a wall.
 *
 * A face-to-face touch (a retention column resting on the PCB top; a standoff
 * meeting the board bottom) is *not* an intrusion, so those don't false-flag.
 *
 * The full mesh boolean check in `assembly-check.ts` stays the exhaustive source
 * of truth for the build scripts; this catches the common structural conflicts
 * early, at render time, and surfaces them like board DRC.
 */
import type { EnclosureModel } from "./build-enclosure";
import {
	componentBodyBoxes,
	type ComponentBodyBox,
} from "./component-body-boxes";
import { DEFAULT_DESIGN_RULES, type DesignRules } from "./design-rules";
import type {
	DrcCylinderObstacle,
	DrcObstacle,
	EnclosureFeatures,
} from "./types";

export interface AssemblyConflict {
	/** "PCB" or a board component id. */
	against: string;
	/** What it hits ("corner screw channel", "lid retention column", ...). */
	feature: string;
	/** Signed clearance (mm): < 0 is overlap depth, >= 0 is the remaining gap. */
	clearanceMm: number;
	severity: "collision" | "tight";
}

interface Box {
	name: string;
	center: [number, number, number];
	half: [number, number, number];
}

const asBox = (b: ComponentBodyBox): Box => ({
	name: b.name,
	center: b.center,
	half: b.half,
});

const axisIndex = (a: DrcCylinderObstacle["axis"]): 0 | 1 | 2 =>
	a === "x" ? 0 : a === "y" ? 1 : 2;

/**
 * Signed radial clearance of a box to a cylinder obstacle, when the box overlaps
 * the cylinder's axial span (<0 = penetration, >=0 = gap). Returns null when the
 * box is outside the axial span — a face-to-face touch is not an intrusion.
 */
const cylBoxRadialClearance = (
	o: DrcCylinderObstacle,
	b: Box,
	touchToleranceMm: number,
): number | null => {
	const A = axisIndex(o.axis);
	const axisOverlap =
		Math.min(o.center[A] + o.lengthMm / 2, b.center[A] + b.half[A]) -
		Math.max(o.center[A] - o.lengthMm / 2, b.center[A] - b.half[A]);
	if (axisOverlap <= touchToleranceMm) return null; // a face-to-face touch is not an intrusion
	let d2 = 0;
	for (let i = 0; i < 3; i++) {
		if (i === A) continue;
		const closest = Math.max(
			b.center[i] - b.half[i],
			Math.min(o.center[i], b.center[i] + b.half[i]),
		);
		const diff = o.center[i] - closest;
		d2 += diff * diff;
	}
	return Math.sqrt(d2) - o.radiusMm;
};

/** Signed clearance between two AABBs (<0 = penetration, >=0 = gap). */
const boxBoxClearance = (
	a: { center: [number, number, number]; half: [number, number, number] },
	b: Box,
): number => {
	let gap2 = 0;
	let minPenetration = Infinity;
	for (let i = 0; i < 3; i++) {
		const delta = Math.abs(a.center[i] - b.center[i]);
		const limit = a.half[i] + b.half[i];
		const sep = delta - limit;
		if (sep > 0) gap2 += sep * sep;
		else minPenetration = Math.min(minPenetration, limit - delta);
	}
	return gap2 > 0 ? Math.sqrt(gap2) : -minPenetration;
};

/** How far a box pokes outside the interior AABB (max over axes; >0 => a wall). */
const containmentOvershoot = (
	b: Box,
	interior: NonNullable<EnclosureModel["interior"]>,
): number => {
	let worst = 0;
	for (let i = 0; i < 3; i++) {
		const lo = b.center[i] - b.half[i];
		const hi = b.center[i] + b.half[i];
		worst = Math.max(worst, interior.min[i] - lo, hi - interior.max[i]);
	}
	return worst;
};

/**
 * Analytic assembly DRC. Returns at most one conflict per board target (the
 * tightest), so the same component doesn't spam multiple errors.
 */
export const checkEnclosureAssembly = (
	model: EnclosureModel,
	features: EnclosureFeatures,
	opts: { minClearanceMm?: number; designRules?: DesignRules } = {},
): AssemblyConflict[] => {
	const rules = opts.designRules ?? DEFAULT_DESIGN_RULES;
	const minClearance = opts.minClearanceMm ?? rules.drc.minClearanceMm;
	const obstacles = model.obstacles ?? [];
	const interior = model.interior;
	const boardBottomZ = model.pcb.boardBottomZ;
	const t = model.pcb.thicknessMm;
	const bb = features.bounds;
	const boardW = bb.maxX - bb.minX;
	const boardH = bb.maxY - bb.minY;

	// The PCB slab: checked against obstacles only (it may sit in card guides).
	const pcb: Box = {
		name: "PCB",
		center: [0, 0, boardBottomZ + t / 2],
		half: [boardW / 2, boardH / 2, t / 2],
	};
	const components = componentBodyBoxes(model, features).map(asBox);
	const cutoutComponentIds = new Set(model.cutoutComponentIds ?? []);

	// tightest conflict per target
	const worst = new Map<string, AssemblyConflict>();
	const record = (against: string, feature: string, clearanceMm: number) => {
		if (clearanceMm >= minClearance) return;
		const cur = worst.get(against);
		if (!cur || clearanceMm < cur.clearanceMm)
			worst.set(against, {
				against,
				feature,
				clearanceMm,
				severity: clearanceMm < 0 ? "collision" : "tight",
			});
	};

	for (const o of obstacles) {
		if (o.shape === "box") {
			const obstacle = { center: o.center, half: o.halfSizeMm };
			record("PCB", o.kind, boxBoxClearance(obstacle, pcb));
			for (const c of components) {
				if (o.kind === "lid lip" && cutoutComponentIds.has(c.name)) continue;
				record(c.name, o.kind, boxBoxClearance(obstacle, c));
			}
			continue;
		}
		const cp = cylBoxRadialClearance(o, pcb, rules.drc.touchToleranceMm);
		if (cp !== null) record("PCB", o.kind, cp);
		for (const c of components) {
			const cc = cylBoxRadialClearance(o, c, rules.drc.touchToleranceMm);
			if (cc !== null) record(c.name, o.kind, cc);
		}
	}
	if (interior)
		for (const c of components) {
			if (cutoutComponentIds.has(c.name)) continue;
			const over = containmentOvershoot(c, interior);
			if (over > rules.drc.containmentSlopMm)
				record(c.name, "enclosure wall", -over);
		}

	return [...worst.values()].sort((a, b) => a.clearanceMm - b.clearanceMm);
};
