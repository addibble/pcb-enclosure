import type { EnclosureCutoutChild } from "./children";
import { resolveCutouts, type ResolvedCutout } from "./cutouts";
import { DEFAULT_DESIGN_RULES, type DesignRules } from "./design-rules";
import {
	BUILTIN_MOUNTING_HARDWARE_CATALOG,
	expandHardwareBom,
	type HardwareBomItem,
	mergeMountingHardwareCatalog,
	resolveMountingHardware,
	type ResolvedMountingHardware,
} from "./mounting-hardware-catalog";
import { screwHoleCut } from "./hole-finish";
import type {
	DrcObstacle,
	EnclosureFeatures,
	EnclosureParams,
	Face,
	XY,
} from "./types";
import { DEFAULT_PARAMS } from "./types";
import type { EnclosurePlacementOutput, PlacedPost } from "./placement-solver";

/** Optional bounding-box measurement (only the mesh/STL path needs it). */
export type MeasureBounds = (geom: any) => [number[], number[]];

/**
 * Geometry helpers bound to a jscad implementation. Pass `@jscad/modeling` to
 * get a mesh for STL, or `jscad-planner`'s `jscadPlanner` to get a serializable
 * artifact plan. Positioning uses `translate` (not the `center` option) so both
 * implementations behave the same. The implementation is **injected** so this
 * module does not hard-depend on @jscad/modeling; the plan path used while
 * collecting board output loads no heavy CSG kernel.
 */
const mk = (jscad: any) => {
	const { cuboid, cylinder } = jscad.primitives;
	const { subtract, union } = jscad.booleans;
	const { translate, rotate } = jscad.transforms;
	const hull = jscad.hulls?.hull ?? jscad.booleans?.hull; // modeling vs planner
	const colorize = jscad.colors?.colorize;
	return {
		subtract,
		union,
		color: (color: [number, number, number], geom: any) =>
			colorize ? colorize(color, geom) : geom,
		/** Convex hull of two solids (chain for more, keeping planner 2-arg safe). */
		hull: (a: any, b: any) => hull(a, b),
		box: (
			sx: number,
			sy: number,
			sz: number,
			x: number,
			y: number,
			z: number,
		) => translate([x, y, z], cuboid({ size: [sx, sy, sz] })),
		cyl: (r: number, h: number, x: number, y: number, z: number) =>
			translate([x, y, z], cylinder({ radius: r, height: h, segments: 64 })),
		// axis-aligned cylinders via the generic `rotate` (recorded by
		// jscad-planner and replayed through @jscad/modeling) so they work in
		// both mesh and plan mode.
		cylX: (r: number, h: number, x: number, y: number, z: number) =>
			translate(
				[x, y, z],
				rotate(
					[0, Math.PI / 2, 0],
					cylinder({ radius: r, height: h, segments: 48 }),
				),
			),
		cylY: (r: number, h: number, x: number, y: number, z: number) =>
			translate(
				[x, y, z],
				rotate(
					[Math.PI / 2, 0, 0],
					cylinder({ radius: r, height: h, segments: 48 }),
				),
			),
	};
};
type Mk = ReturnType<typeof mk>;

export interface EnclosurePart {
	id: string;
	geom: any;
	bounds: { min: [number, number, number]; max: [number, number, number] };
	/** Viewer-only Z translation applied while exploded view is enabled. */
	explodeZOffsetMm?: number;
}

export interface EnclosureHardwareInstance {
	id: string;
	role: "bushing" | "screw";
	geom: any;
	bounds: { min: [number, number, number]; max: [number, number, number] };
	bomGroupKey: string;
	displayValue: string;
	/** Viewer-only Z translation applied while exploded view is enabled. */
	explodeZOffsetMm: number;
}

export interface EnclosureModel {
	parts: EnclosurePart[];
	warnings: string[];
	meta: Record<string, number>;
	/**
	 * Mounting-hardware bill of materials: one entry per physical piece (screw,
	 * insert, washer, ...) the built enclosure requires. Identical pieces share a
	 * `bomGroupKey` so a BOM groups them into one line with a quantity.
	 */
	bomItems: HardwareBomItem[];
	/** Visible purchased hardware rendered in assembled/exploded enclosure views. */
	hardware: EnclosureHardwareInstance[];
	/** Components intentionally passing through a resolved enclosure aperture. */
	cutoutComponentIds?: string[];
	/** PCB placement for the viewer (board slab center z + size). */
	pcb: { boardBottomZ: number; outline: XY[]; thicknessMm: number; center: XY };
	/**
	 * Usable interior cavity AABB in the model frame. Component bodies must fit
	 * inside it (outside = a wall/cap).
	 */
	interior?: { min: [number, number, number]; max: [number, number, number] };
	/** Cavity-intruding fasteners, for the render-time assembly DRC. */
	obstacles?: DrcObstacle[];
}

// ---------------------------------------------------------------------------
// Contribution model
// ---------------------------------------------------------------------------

/**
 * What one feature recipe contributes to the enclosure. A recipe never touches
 * part geometry directly; it declares solids to fuse into / cut out of *named*
 * parts, brand-new standalone parts (assembly hardware), the DRC obstacles its
 * geometry creates, and any warnings. Contributions are applied **in order**
 * (each one unions its adds, then subtracts its cuts), so a recipe's hole is
 * always cut after its own boss is fused, exactly like hand-ordered CSG.
 */
export interface Contribution {
	adds?: Array<{ part: string; geom: any }>;
	subtracts?: Array<{ part: string; geom: any }>;
	newParts?: EnclosurePart[];
	obstacles?: DrcObstacle[];
	bomItems?: HardwareBomItem[];
	hardware?: EnclosureHardwareInstance[];
	warnings?: string[];
}

/**
 * Per-face geometry closures: which part(s) a face's openings cut, plus oriented
 * primitive builders (box / cylinder / flat-cut) in that face's frame. `along`
 * is the wall-parallel in-plane coordinate, `vert` the vertical one (world z on
 * a side wall, world y on the lid/floor). One `FaceGeom` per face lets the
 * aperture recipe below stay face-agnostic across rect / rounded / circle / D.
 */
type FaceGeom = {
	parts: string[];
	along: (c: ResolvedCutout) => number;
	vert: (c: ResolvedCutout) => number;
	box: (alongMm: number, vertMm: number, along0: number, vert0: number) => any;
	cyl: (r: number, along0: number, vert0: number) => any;
	flatCut: (along0: number, vertFlat: number) => any;
};

const APERTURE_BIG = 1000;

/** Build the subtracted solid for one resolved opening in its face's frame. */
const apertureSolid = (m: Mk, fg: FaceGeom, c: ResolvedCutout): any => {
	const a0 = fg.along(c);
	const v0 = fg.vert(c);
	if (c.shape === "circle") return fg.cyl(c.widthMm / 2, a0, v0);
	if (c.shape === "d_shape") {
		const flat = c.flatOffsetMm ?? c.widthMm / 2;
		return m.subtract(fg.cyl(c.widthMm / 2, a0, v0), fg.flatCut(a0, v0 + flat));
	}
	if (c.shape === "rounded_rect") {
		const r = Math.max(
			0,
			Math.min(
				c.cornerRadiusMm ?? 0,
				Math.min(c.widthMm, c.heightMm) / 2 - 0.01,
			),
		);
		if (r <= 0.05) return fg.box(c.widthMm, c.heightMm, a0, v0);
		const aw = c.widthMm / 2 - r;
		const vh = c.heightMm / 2 - r;
		// hull the 4 corner cylinders (pairwise so a 2-arg hull suffices)
		return m.hull(
			m.hull(fg.cyl(r, a0 - aw, v0 - vh), fg.cyl(r, a0 + aw, v0 - vh)),
			m.hull(fg.cyl(r, a0 + aw, v0 + vh), fg.cyl(r, a0 - aw, v0 + vh)),
		);
	}
	return fg.box(c.widthMm, c.heightMm, a0, v0); // rect
};

/** The one cutout recipe: route a resolved opening to its face's part(s). */
const cutoutContribution = (
	m: Mk,
	faceGeom: Record<Face, FaceGeom>,
	c: ResolvedCutout,
): Contribution => {
	const fg = faceGeom[c.face];
	const geom = apertureSolid(m, fg, c);
	return { subtracts: fg.parts.map((part) => ({ part, geom })) };
};

/** Apply contributions to the named part blanks, in order. */
const applyContributions = (
	m: Mk,
	blanks: Array<{ id: string; geom: any }>,
	contributions: Contribution[],
): {
	geoms: Map<string, any>;
	newParts: EnclosurePart[];
	obstacles: DrcObstacle[];
	bomItems: HardwareBomItem[];
	hardware: EnclosureHardwareInstance[];
	warnings: string[];
} => {
	const geoms = new Map(blanks.map((b) => [b.id, b.geom]));
	const newParts: EnclosurePart[] = [];
	const obstacles: DrcObstacle[] = [];
	const bomItems: HardwareBomItem[] = [];
	const hardware: EnclosureHardwareInstance[] = [];
	const warnings: string[] = [];
	for (const c of contributions) {
		for (const a of c.adds ?? [])
			geoms.set(a.part, m.union(geoms.get(a.part), a.geom));
		for (const s of c.subtracts ?? [])
			geoms.set(s.part, m.subtract(geoms.get(s.part), s.geom));
		newParts.push(...(c.newParts ?? []));
		obstacles.push(...(c.obstacles ?? []));
		bomItems.push(...(c.bomItems ?? []));
		hardware.push(...(c.hardware ?? []));
		warnings.push(...(c.warnings ?? []));
	}
	return { geoms, newParts, obstacles, bomItems, hardware, warnings };
};

/** Bounds-measuring part wrapper (B-rep path only; plans stay at zero bounds). */
const mkPartOf =
	(measureBounds: MeasureBounds | null) =>
	(id: string, geom: any): EnclosurePart => {
		let bounds = {
			min: [0, 0, 0] as [number, number, number],
			max: [0, 0, 0] as [number, number, number],
		};
		if (measureBounds) {
			try {
				const m = measureBounds(geom);
				bounds = {
					min: m[0] as [number, number, number],
					max: m[1] as [number, number, number],
				};
			} catch {
				// plans (jscad-planner) can't be measured; bounds left at zero
			}
		}
		return { id, bounds, geom };
	};

/** Build a board-plane recenter helper + axis-aligned board dims. */
const boardFrame = (features: EnclosureFeatures) => {
	const bb = features.bounds;
	const bcx = (bb.minX + bb.maxX) / 2;
	const bcy = (bb.minY + bb.maxY) / 2;
	return {
		boardW: bb.maxX - bb.minX,
		boardH: bb.maxY - bb.minY,
		center: { x: bcx, y: bcy },
		rc: (p: XY): XY => ({ x: p.x - bcx, y: p.y - bcy }),
	};
};

// ---------------------------------------------------------------------------
// split_shell + PCB mounting bosses  (base + lid)
// ---------------------------------------------------------------------------

/** Shared frame for the split-shell recipes. */
interface SplitShellFrame {
	m: Mk;
	jscad: any;
	params: EnclosureParams;
	rules: DesignRules;
	outerW: number;
	outerH: number;
	innerW: number;
	innerH: number;
	wall: number;
	floorT: number;
	lidT: number;
	standoffH: number;
	boardBottomZ: number;
	boardTopZ: number;
	seamZ: number;
	totalH: number;
}

const bushingHardware = ({
	id,
	center,
	topZ,
	lengthMm,
	hardware,
	bomItem,
	m,
}: {
	id: string;
	center: XY;
	topZ: number;
	lengthMm: number;
	hardware: ResolvedMountingHardware;
	bomItem: HardwareBomItem;
	m: Mk;
}): EnclosureHardwareInstance => {
	const g = hardware.geometry;
	const length = Math.max(0.8, lengthMm);
	const outerR = g.bossBoreDiameterMm * 0.48;
	const innerR = Math.min(
		outerR - 0.3,
		Math.max(0.5, g.screwClearanceDiameterMm * 0.36),
	);
	const centerZ = topZ - length / 2;
	const geom = m.color(
		[0.82, 0.56, 0.16],
		m.subtract(
			m.cyl(outerR, length, center.x, center.y, centerZ),
			m.cyl(innerR, length + 0.4, center.x, center.y, centerZ),
		),
	);
	return {
		id,
		role: "bushing",
		geom,
		bounds: {
			min: [center.x - outerR, center.y - outerR, topZ - length],
			max: [center.x + outerR, center.y + outerR, topZ],
		},
		bomGroupKey: bomItem.bomGroupKey,
		displayValue: bomItem.displayValue,
		explodeZOffsetMm: 0,
	};
};

const screwHardware = ({
	id,
	center,
	topZ,
	bottomZ,
	hardware,
	bomItem,
	m,
	finish,
}: {
	id: string;
	center: XY;
	topZ: number;
	bottomZ: number;
	hardware: ResolvedMountingHardware;
	bomItem: HardwareBomItem;
	m: Mk;
	finish: EnclosureParams["lidHole"];
}): EnclosureHardwareInstance => {
	const g = hardware.geometry;
	const headR = g.headDiameterMm * 0.46;
	const shankR = g.screwClearanceDiameterMm * 0.4;
	const headH =
		finish === "countersink"
			? Math.max(0.8, headR - shankR)
			: Math.max(1, g.counterboreDepthMm);
	const headBottomZ = topZ - headH;
	const shankBottomZ = Math.min(bottomZ, headBottomZ - 0.5);
	const shankH = headBottomZ - shankBottomZ + 0.2;
	const head =
		finish === "countersink"
			? m.hull(
					m.cyl(headR, 0.2, center.x, center.y, topZ - 0.1),
					m.cyl(shankR, 0.2, center.x, center.y, headBottomZ + 0.1),
				)
			: m.cyl(headR, headH, center.x, center.y, topZ - headH / 2);
	const geom = m.color(
		[0.35, 0.38, 0.42],
		m.union(
			m.cyl(shankR, shankH, center.x, center.y, shankBottomZ + shankH / 2),
			head,
		),
	);
	return {
		id,
		role: "screw",
		geom,
		bounds: {
			min: [center.x - headR, center.y - headR, shankBottomZ],
			max: [center.x + headR, center.y + headR, topZ],
		},
		bomGroupKey: bomItem.bomGroupKey,
		displayValue: bomItem.displayValue,
		explodeZOffsetMm: 0,
	};
};

/**
 * One PCB mounting boss at an existing board mounting hole: a floor boss that
 * supports the PCB, the insert/pilot bore its screw needs, and a lid column that
 * clamps the PCB top — one long screw from the lid top bores through the column
 * and the PCB mounting hole into the base insert/pilot ("recessed column"
 * retention).
 */
const pcbMountingBossFastener = (
	post: PlacedPost,
	p: XY, // recentered
	fr: SplitShellFrame,
	hw: ResolvedMountingHardware,
): Contribution => {
	const { m, jscad, params } = fr;
	const spec = post.spec ?? { center: post.center };
	const g = hw.geometry;
	const headFinish = {
		finish: params.lidHole,
		headR: g.headDiameterMm / 2,
		counterboreDepth: g.counterboreDepthMm,
	};
	const bossR = g.bossOuterDiameterMm / 2;
	const eps = fr.rules.cutOvershootMm;
	const out: Required<Pick<Contribution, "adds" | "subtracts">> & Contribution =
		{ adds: [], subtracts: [], obstacles: [], warnings: [] };

	// floor boss supporting the PCB
	out.adds.push({
		part: "base",
		geom: m.cyl(bossR, fr.standoffH, p.x, p.y, fr.floorT + fr.standoffH / 2),
	});
	out.obstacles!.push({
		kind: "standoff",
		partId: "base",
		axis: "z",
		center: [p.x, p.y, fr.floorT + fr.standoffH / 2],
		radiusMm: bossR,
		lengthMm: fr.standoffH,
	});

	// Bore depth is clamped so the hole never breaks through the outer floor.
	// If that leaves too little depth for an insert, the insert can't fully
	// seat — warn (screw pilots just get fewer threads, which is fine).
	const availableDepth =
		fr.standoffH + fr.floorT - fr.rules.fastener.minFloorUnderBoreMm;
	const boreDepth = Math.min(g.bossBoreDepthMm, availableDepth);
	if (g.boreType === "insert" && boreDepth < g.bossBoreDepthMm) {
		out.warnings!.push(
			`PCB mounting boss at (${spec.center.x.toFixed(1)},${spec.center.y.toFixed(1)}): insert hole clamped to ${boreDepth.toFixed(1)}mm (needs ${g.bossBoreDepthMm.toFixed(1)}mm incl. melt relief) — increase standoffHeight or floorThickness`,
		);
	}

	// insert / self-tap pilot drilled into the boss from the PCB side
	out.subtracts.push({
		part: "base",
		geom: m.cyl(
			g.bossBoreDiameterMm / 2,
			boreDepth + eps,
			p.x,
			p.y,
			fr.boardBottomZ - boreDepth / 2,
		),
	});

	// printed/molded column reaches down to the PCB top and clamps it
	const colH = fr.seamZ - fr.boardTopZ;
	if (colH > 0.2) {
		out.adds.push({
			part: "lid",
			geom: m.cyl(bossR, colH, p.x, p.y, fr.boardTopZ + colH / 2),
		});
		out.obstacles!.push({
			kind: "lid retention column",
			partId: "lid",
			axis: "z",
			center: [p.x, p.y, fr.boardTopZ + colH / 2],
			radiusMm: bossR,
			lengthMm: colH,
		});
	}
	// one long screw from the lid top bores through the column into the
	// base insert; finish the head seat in the lid top.
	out.subtracts.push({
		part: "lid",
		geom: screwHoleCut(jscad, {
			center: [p.x, p.y, fr.totalH],
			axis: "+z",
			clearanceR: g.screwClearanceDiameterMm / 2,
			boreDepth: fr.totalH - fr.boardTopZ + eps,
			...headFinish,
		}),
	});
	const mountId = `post_${spec.center.x.toFixed(1)}_${spec.center.y.toFixed(1)}`;
	out.bomItems = expandHardwareBom(hw, mountId);
	out.hardware = [];
	const bushingBom = out.bomItems.find(
		(item) => item.role === "insert" || item.role === "bushing",
	);
	if (g.boreType === "insert" && bushingBom) {
		out.hardware.push(
			bushingHardware({
				id: `${mountId}:bushing`,
				center: p,
				topZ: fr.boardBottomZ,
				lengthMm: Math.min(
					boreDepth,
					Math.max(
						0.8,
						g.bossBoreDepthMm - fr.rules.fastener.insertMeltReliefMm,
					),
				),
				hardware: hw,
				bomItem: bushingBom,
				m,
			}),
		);
	}
	const screwBom = out.bomItems.find((item) => item.role === "screw");
	if (screwBom) {
		out.hardware.push(
			screwHardware({
				id: `${mountId}:screw`,
				center: p,
				topZ: fr.totalH,
				bottomZ: fr.boardBottomZ - boreDepth,
				hardware: hw,
				bomItem: screwBom,
				m,
				finish: params.lidHole,
			}),
		);
	}
	return out;
};

/**
 * A corner fastener with no mounting hole becomes an external corner mounting
 * **ear**: a solid tab just outside the cavity at the corner's quadrant, so the
 * screw column never passes through the PCB slab. The tab overlaps the wall
 * corner (fused to the shell) and extends outward.
 */
const cornerEar = (
	target: XY, // recentered corner target; only its quadrant matters
	fr: SplitShellFrame,
	hw: ResolvedMountingHardware,
): Contribution => {
	const { m, jscad, params } = fr;
	const g = hw.geometry;
	const headFinish = {
		finish: params.lidHole,
		headR: g.headDiameterMm / 2,
		counterboreDepth: g.counterboreDepthMm,
	};
	const eps = fr.rules.cutOvershootMm;
	const tabSize = g.bossOuterDiameterMm + fr.rules.fastener.earPadMm;
	const cx = (target.x >= 0 ? 1 : -1) * (fr.innerW / 2 + tabSize / 2);
	const cy = (target.y >= 0 ? 1 : -1) * (fr.innerH / 2 + tabSize / 2);
	const mountId = `ear_${cx.toFixed(1)}_${cy.toFixed(1)}`;
	const bomItems = expandHardwareBom(hw, mountId);
	const hardware: EnclosureHardwareInstance[] = [];
	const bushingBom = bomItems.find(
		(item) => item.role === "insert" || item.role === "bushing",
	);
	if (g.boreType === "insert" && bushingBom) {
		hardware.push(
			bushingHardware({
				id: `${mountId}:bushing`,
				center: { x: cx, y: cy },
				topZ: fr.seamZ,
				lengthMm: Math.max(
					0.8,
					g.bossBoreDepthMm - fr.rules.fastener.insertMeltReliefMm,
				),
				hardware: hw,
				bomItem: bushingBom,
				m,
			}),
		);
	}
	const screwBom = bomItems.find((item) => item.role === "screw");
	if (screwBom) {
		hardware.push(
			screwHardware({
				id: `${mountId}:screw`,
				center: { x: cx, y: cy },
				topZ: fr.totalH,
				bottomZ: fr.seamZ - g.bossBoreDepthMm,
				hardware: hw,
				bomItem: screwBom,
				m,
				finish: params.lidHole,
			}),
		);
	}
	return {
		adds: [
			{
				part: "base",
				geom: m.box(tabSize, tabSize, fr.seamZ, cx, cy, fr.seamZ / 2),
			},
			{
				part: "lid",
				geom: m.box(tabSize, tabSize, fr.lidT, cx, cy, fr.seamZ + fr.lidT / 2),
			},
		],
		subtracts: [
			{
				part: "base",
				geom: m.cyl(
					g.bossBoreDiameterMm / 2,
					g.bossBoreDepthMm + eps,
					cx,
					cy,
					fr.seamZ - g.bossBoreDepthMm / 2,
				),
			},
			{
				part: "lid",
				geom: screwHoleCut(jscad, {
					center: [cx, cy, fr.totalH],
					axis: "+z",
					clearanceR: g.screwClearanceDiameterMm / 2,
					boreDepth: fr.lidT + 2 * eps,
					...headFinish,
				}),
			},
		],
		bomItems,
		hardware,
	};
};

/** Friction lip: a ring under the lid that nests into the base opening. */
const lidLip = (fr: SplitShellFrame, headroom: number): Contribution => {
	const { m, params } = fr;
	const fit = fr.rules.fit.slidingFitMm;
	const lipTh = Math.min(fr.wall * 0.7, 1.5);
	const lipDepth = Math.min(params.lidLipDepthMm, headroom - 1);
	if (lipDepth <= 0) return {};
	const outerX = fr.innerW - fit;
	const outerY = fr.innerH - fit;
	const innerX = outerX - 2 * lipTh;
	const innerY = outerY - 2 * lipTh;
	const z = fr.seamZ - lipDepth / 2;
	const ring = m.subtract(
		m.box(outerX, outerY, lipDepth, 0, 0, z),
		m.box(innerX, innerY, lipDepth + fr.rules.cutOvershootMm, 0, 0, z),
	);
	return {
		adds: [{ part: "lid", geom: ring }],
		obstacles: [
			{
				kind: "lid lip",
				partId: "lid",
				shape: "box" as const,
				center: [innerX / 2 + lipTh / 2, 0, z],
				halfSizeMm: [lipTh / 2, outerY / 2, lipDepth / 2],
			},
			{
				kind: "lid lip",
				partId: "lid",
				shape: "box" as const,
				center: [-(innerX / 2 + lipTh / 2), 0, z],
				halfSizeMm: [lipTh / 2, outerY / 2, lipDepth / 2],
			},
			{
				kind: "lid lip",
				partId: "lid",
				shape: "box" as const,
				center: [0, innerY / 2 + lipTh / 2, z],
				halfSizeMm: [innerX / 2, lipTh / 2, lipDepth / 2],
			},
			{
				kind: "lid lip",
				partId: "lid",
				shape: "box" as const,
				center: [0, -(innerY / 2 + lipTh / 2), z],
				halfSizeMm: [innerX / 2, lipTh / 2, lipDepth / 2],
			},
		],
	};
};

/**
 * Build the split_shell (base + lid) enclosure: part blanks + an ordered list
 * of feature contributions (PCB mounting bosses at the board's mounting holes,
 * corner ears where a corner has no hole, the friction lip, and every resolved
 * opening routed to the part that forms its face).
 */
export const buildEnclosure = (
	features: EnclosureFeatures,
	placement: EnclosurePlacementOutput,
	params: EnclosureParams = DEFAULT_PARAMS,
	cutouts: EnclosureCutoutChild[] = [],
	jscad: any,
	measureBounds: MeasureBounds | null = null,
): EnclosureModel => {
	const m = mk(jscad);
	const partOf = mkPartOf(measureBounds);
	const { boardW, boardH, center, rc } = boardFrame(features);

	const wall = params.wallThicknessMm;
	const floorT = params.floorThicknessMm;
	const lidT = params.lidThicknessMm;
	const cl = params.boardClearanceMm;
	const boardT = features.boardThicknessMm;

	const rules = params.designRules ?? DEFAULT_DESIGN_RULES;
	const minBottomGap =
		features.bottomComponentHeightMm > 0
			? features.bottomComponentHeightMm + rules.drc.minClearanceMm
			: 0;
	const standoffH = Math.max(params.standoffHeightMm, minBottomGap);
	const standoffWarnings =
		standoffH > params.standoffHeightMm
			? [
					`standoffHeight raised to ${standoffH.toFixed(1)}mm to clear bottom-side component/lead projection (${features.bottomComponentHeightMm.toFixed(1)}mm + ${rules.drc.minClearanceMm.toFixed(1)}mm clearance)`,
				]
			: [];

	const minimumOuterW = boardW + 2 * cl + 2 * wall;
	const minimumOuterH = boardH + 2 * cl + 2 * wall;
	const resolveOuterDimension = (
		prop: "width" | "height" | "depth",
		requested: number | undefined,
		minimum: number,
	): number => {
		if (requested == null) return minimum;
		if (!Number.isFinite(requested) || requested < minimum) {
			throw new Error(
				`[pcb-enclosure] ${prop} ${requested}mm is too small; minimum is ${minimum.toFixed(2)}mm for the selected board and clearances`,
			);
		}
		return requested;
	};
	const outerW = resolveOuterDimension("width", params.widthMm, minimumOuterW);
	const outerH = resolveOuterDimension(
		"height",
		params.heightMm,
		minimumOuterH,
	);
	const innerW = outerW - 2 * wall;
	const innerH = outerH - 2 * wall;

	const minimumHeadroom = Math.max(
		params.topHeadroomMm,
		features.topComponentHeightMm + rules.headroomOverTallestMm,
	);
	const boardBottomZ = floorT + standoffH;
	const boardTopZ = boardBottomZ + boardT;
	const minimumTotalH = boardTopZ + minimumHeadroom + lidT;
	const totalH = resolveOuterDimension("depth", params.depthMm, minimumTotalH);
	const seamZ = totalH - lidT;
	const headroom = seamZ - boardTopZ;

	const fr: SplitShellFrame = {
		m,
		jscad,
		params,
		rules,
		outerW,
		outerH,
		innerW,
		innerH,
		wall,
		floorT,
		lidT,
		standoffH,
		boardBottomZ,
		boardTopZ,
		seamZ,
		totalH,
	};

	// part blanks: the base tub and the lid plate
	const blanks = [
		{
			id: "base",
			geom: m.subtract(
				m.box(outerW, outerH, seamZ, 0, 0, seamZ / 2),
				m.box(
					innerW,
					innerH,
					seamZ - floorT + 2,
					0,
					0,
					floorT + (seamZ - floorT + 2) / 2,
				),
			),
		},
		{ id: "lid", geom: m.box(outerW, outerH, lidT, 0, 0, seamZ + lidT / 2) },
	];

	// per-face geometry: side walls cut base + lid; the lid/floor cut their plate
	const zc = (c: ResolvedCutout) => boardTopZ + c.zCenterAboveBoardMm;
	const wallCutDepth = wall * 4;
	const plateEps = 2;
	const sideX = (x0: number): FaceGeom => ({
		parts: ["base", "lid"],
		along: (c) => rc(c.center).y,
		vert: (c) => zc(c),
		box: (aw, vh, a0, v0) => m.box(wallCutDepth, aw, vh, x0, a0, v0),
		cyl: (r, a0, v0) => m.cylX(r, wallCutDepth, x0, a0, v0),
		flatCut: (a0, vFlat) =>
			m.box(
				wallCutDepth + 0.2,
				APERTURE_BIG,
				APERTURE_BIG,
				x0,
				a0,
				vFlat + APERTURE_BIG / 2,
			),
	});
	const sideY = (y0: number): FaceGeom => ({
		parts: ["base", "lid"],
		along: (c) => rc(c.center).x,
		vert: (c) => zc(c),
		box: (aw, vh, a0, v0) => m.box(aw, wallCutDepth, vh, a0, y0, v0),
		cyl: (r, a0, v0) => m.cylY(r, wallCutDepth, a0, y0, v0),
		flatCut: (a0, vFlat) =>
			m.box(
				APERTURE_BIG,
				wallCutDepth + 0.2,
				APERTURE_BIG,
				a0,
				y0,
				vFlat + APERTURE_BIG / 2,
			),
	});
	const faceGeom: Record<Face, FaceGeom> = {
		top: {
			parts: ["lid"],
			along: (c) => rc(c.center).x,
			vert: (c) => rc(c.center).y,
			box: (aw, vh, a0, v0) =>
				m.box(aw, vh, lidT + plateEps, a0, v0, seamZ + lidT / 2),
			cyl: (r, a0, v0) => m.cyl(r, lidT + plateEps, a0, v0, seamZ + lidT / 2),
			flatCut: (a0, vFlat) =>
				m.box(
					APERTURE_BIG,
					APERTURE_BIG,
					lidT + plateEps + 0.2,
					a0,
					vFlat + APERTURE_BIG / 2,
					seamZ + lidT / 2,
				),
		},
		bottom: {
			parts: ["base"],
			along: (c) => rc(c.center).x,
			vert: (c) => rc(c.center).y,
			box: (aw, vh, a0, v0) =>
				m.box(aw, vh, floorT + plateEps, a0, v0, floorT / 2),
			cyl: (r, a0, v0) => m.cyl(r, floorT + plateEps, a0, v0, floorT / 2),
			flatCut: (a0, vFlat) =>
				m.box(
					APERTURE_BIG,
					APERTURE_BIG,
					floorT + plateEps + 0.2,
					a0,
					vFlat + APERTURE_BIG / 2,
					floorT / 2,
				),
		},
		"+x": sideX(outerW / 2),
		"-x": sideX(-outerW / 2),
		"+y": sideY(outerH / 2),
		"-y": sideY(-outerH / 2),
	};

	// contributions, in build order: lip, fasteners, ears, then all openings
	const catalog = mergeMountingHardwareCatalog(
		BUILTIN_MOUNTING_HARDWARE_CATALOG,
		params.mountingHardwareCatalog,
	);
	const contributions: Contribution[] = [lidLip(fr, headroom)];
	const okPosts = placement.posts.filter((p) => p.ok);
	for (const post of okPosts) {
		const hw = resolveMountingHardware(
			post.spec?.anchor ?? params.anchor,
			catalog,
			rules,
		);
		contributions.push(pcbMountingBossFastener(post, rc(post.center), fr, hw));
	}
	const cornerHw = resolveMountingHardware(params.anchor, catalog, rules);
	for (const boss of placement.bosses)
		contributions.push(cornerEar(rc(boss.target), fr, cornerHw));
	const allCutouts = resolveCutouts(features, cutouts, {
		autoCutouts: params.autoCutouts,
		designRules: rules,
	});
	for (const c of allCutouts)
		contributions.push(cutoutContribution(m, faceGeom, c));

	const applied = applyContributions(m, blanks, contributions);

	// BOM emission mode: "off" drops the hardware BOM entirely; "strict" warns
	// about generic hardware that has no manufacturer/supplier part number.
	const bomMode = params.bomMode ?? "warn";
	const bomItems = bomMode === "off" ? [] : applied.bomItems;
	const hardware = bomMode === "off" ? [] : applied.hardware;
	const bomWarnings: string[] = [];
	if (bomMode === "strict") {
		const seen = new Set<string>();
		for (const item of bomItems) {
			if (!item.generic || seen.has(item.bomGroupKey)) continue;
			seen.add(item.bomGroupKey);
			bomWarnings.push(
				`BOM (strict): "${item.displayValue}" is generic hardware with no manufacturer/supplier part number — provide a real part in mountingHardwareCatalog`,
			);
		}
	}

	const explodeGap = Math.max(6, Math.min(15, totalH * 0.3));
	const lidExplodeZ = explodeGap;
	let explodedTopZ = totalH + lidExplodeZ;
	const placeExplodedHardware = (
		role: EnclosureHardwareInstance["role"],
	): void => {
		const instances = hardware.filter((item) => item.role === role);
		if (instances.length === 0) return;
		const minZ = Math.min(...instances.map((item) => item.bounds.min[2]));
		const maxZ = Math.max(...instances.map((item) => item.bounds.max[2]));
		const offset = explodedTopZ + explodeGap - minZ;
		for (const item of instances) item.explodeZOffsetMm = offset;
		explodedTopZ = maxZ + offset;
	};
	placeExplodedHardware("bushing");
	placeExplodedHardware("screw");

	return {
		parts: [
			partOf("base", applied.geoms.get("base")),
			{
				...partOf("lid", applied.geoms.get("lid")),
				explodeZOffsetMm: lidExplodeZ,
			},
			...applied.newParts,
		],
		warnings: [
			...placement.warnings,
			...standoffWarnings,
			...applied.warnings,
			...bomWarnings,
		],
		bomItems,
		hardware,
		cutoutComponentIds: allCutouts
			.map((cutout) => cutout.id)
			.filter((id): id is string => id != null),
		interior: {
			min: [-innerW / 2, -innerH / 2, floorT],
			max: [innerW / 2, innerH / 2, seamZ],
		},
		obstacles: applied.obstacles,
		meta: {
			outerW,
			outerH,
			totalH,
			seamZ,
			boardBottomZ,
			boardTopZ,
			headroom,
			posts: okPosts.length,
			bosses: placement.bosses.length,
			cutouts: allCutouts.length,
			explodedHeight: explodedTopZ,
		},
		pcb: {
			boardBottomZ,
			outline: features.outline,
			thicknessMm: boardT,
			center,
		},
	};
};
