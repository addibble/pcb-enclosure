import type { EnclosureCutoutChild } from "./children";
import {
	type ResolvedAperture,
	resolveCutoutAperture,
} from "./cutout-aperture";
import { DEFAULT_DESIGN_RULES, type DesignRules } from "./design-rules";
import type { ComponentBody, EnclosureFeatures, Face, XY } from "./types";

/**
 * The single cutout-resolution pipeline used by the artifact renderer.
 *
 * Policy:
 *  - **Auto placement** is **opt-in** (`autoCutouts: true`) and only considers
 *    components that deliberately declare an aperture. A part that mates
 *    from above
 *    (`insertion_direction: "from_above"`) opens the **lid**;
 *    otherwise the part must sit within `autoMaxEdgeDistanceMm` of a board edge
 *    and opens a **wall** (face from `insertion_direction` / inferred
 *    `cable_insertion_center`, else the nearest wall). Shape and size always come
 *    from the declared aperture. Body/CAD bounds never invent an opening.
 *  - **Explicit** cutouts (the default path): `direction` (axis projection) beats
 *    `face`; a `face` of "auto"/unset infers from placement/insertion;
 *    `shape`/size default from the matched aperture, then the component extents.
 *
 * We do **not** auto-cut arbitrary top-side parts (buttons, LEDs, displays).
 * Non-connectors opt in by carrying both aperture and mating-direction metadata.
 */

/** ftypes whose mating face exits sideways (candidates for auto wall cutouts). */
export const EDGE_MOUNT_FTYPES = new Set([
	"simple_connector",
	"simple_pin_header",
]);

type Bounds = EnclosureFeatures["bounds"];

export const distanceToNearestEdge = (c: XY, b: Bounds): number =>
	Math.min(c.x - b.minX, b.maxX - c.x, c.y - b.minY, b.maxY - c.y);

/** The wall face nearest to a board-plane point. */
export const nearestWall = (c: XY, b: Bounds): Face => {
	const d: Array<[Face, number]> = [
		["+x", b.maxX - c.x],
		["-x", c.x - b.minX],
		["+y", b.maxY - c.y],
		["-y", c.y - b.minY],
	];
	return d.sort((a, z) => a[1] - z[1])[0][0];
};

/** Distance from a point to the specific wall face it would open. */
export const distanceToFace = (c: XY, b: Bounds, face: Face): number => {
	switch (face) {
		case "+x":
			return b.maxX - c.x;
		case "-x":
			return c.x - b.minX;
		case "+y":
			return b.maxY - c.y;
		case "-y":
			return c.y - b.minY;
		default:
			return 0;
	}
};

/** Distance from a component's nearest body edge to a selected enclosure face. */
export const distanceFromBodyToFace = (
	body: Pick<ComponentBody, "center" | "lengthMm" | "widthMm">,
	bounds: Bounds,
	face: Face,
): number => {
	switch (face) {
		case "+x":
			return bounds.maxX - (body.center.x + body.lengthMm / 2);
		case "-x":
			return body.center.x - body.lengthMm / 2 - bounds.minX;
		case "+y":
			return bounds.maxY - (body.center.y + body.widthMm / 2);
		case "-y":
			return body.center.y - body.widthMm / 2 - bounds.minY;
		default:
			return 0;
	}
};

/** The enclosure wall an `insertion_direction` opens (its outward normal). */
export const faceFromInsertionDirection = (
	dir: ComponentBody["insertionDirection"],
): Face | undefined => {
	switch (dir) {
		case "from_left":
			return "-x";
		case "from_right":
			return "+x";
		case "from_front":
			return "-y";
		case "from_back":
			return "+y";
		case "from_above":
			return "top";
		default:
			return undefined;
	}
};

/** The wall a point offset from the body center points toward (its long axis). */
const faceFromOffset = (from: XY, center: XY): Face | undefined => {
	const dx = from.x - center.x;
	const dy = from.y - center.y;
	if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.1) return undefined;
	if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "+x" : "-x";
	return dy > 0 ? "+y" : "-y";
};

/**
 * The face an edge/top-mount body's opening cuts: a `from_above` connector opens
 * the lid (no edge proximity needed); otherwise prefer footprint insertion
 * metadata, then the inferred cable-insertion offset, then the nearest wall.
 * Returns null when a wall opening is wanted but the body is too far from any
 * edge to reach one.
 */
export const autoCutoutFace = (
	b: ComponentBody,
	bounds: Bounds,
	rules: DesignRules = DEFAULT_DESIGN_RULES,
	reachCenter: XY = b.cableInsertionCenter ?? b.center,
): Face | null => {
	const fromDir = faceFromInsertionDirection(b.insertionDirection);
	if (fromDir === "top") return "top"; // mates from above → open the lid
	const directionCenter = b.cableInsertionCenter ?? b.center;
	const face =
		fromDir ??
		faceFromOffset(directionCenter, b.center) ??
		nearestWall(b.center, bounds);
	const bodyDistance = distanceFromBodyToFace(b, bounds, face);
	const insertionDistance = distanceToFace(reachCenter, bounds, face);
	return Math.min(bodyDistance, insertionDistance) <=
		rules.cutout.autoMaxEdgeDistanceMm
		? face
		: null;
};

/**
 * Infer the face a cutout cuts from where the component sits: edge-mount
 * connectors close enough to a wall cut that wall; everything else (buttons,
 * switches, LEDs, displays, and unresolved `at` points) cuts the lid.
 */
export const inferFace = (
	center: XY | undefined,
	bounds: Bounds,
	ftype: string | undefined,
	rules: DesignRules = DEFAULT_DESIGN_RULES,
): Face => {
	if (
		center &&
		ftype &&
		EDGE_MOUNT_FTYPES.has(ftype) &&
		distanceToNearestEdge(center, bounds) <= rules.cutout.autoMaxEdgeDistanceMm
	) {
		return nearestWall(center, bounds);
	}
	return "top";
};

/** Map an axis-aligned projection direction to the enclosure face it cuts. */
export const faceFromDirection = (
	d: EnclosureCutoutChild["direction"],
): Face | undefined => {
	if (d === "+z") return "top";
	if (d === "-z") return "bottom";
	return d ?? undefined;
};

/**
 * A fully resolved opening, ready for a construction's face routing to turn
 * into a subtracted solid. `widthMm`/`heightMm` are the **final** opening
 * dimensions (margin included). They are face-relative: top/bottom openings
 * lie in the XY plane (width along x, height along y); a side opening takes its
 * in-plane width along the wall and its vertical height along z.
 */
export interface ResolvedCutout {
	/** Board component name this opening serves (for labels/debugging). */
	id?: string;
	/** Whether this opening was auto-detected or came from an explicit child. */
	origin: "auto" | "explicit";
	/** Opening center in board-plane coordinates. */
	center: XY;
	face: Face;
	shape: "rect" | "rounded_rect" | "circle" | "d_shape";
	widthMm: number;
	heightMm: number;
	/** Corner radius for `rounded_rect`. */
	cornerRadiusMm?: number;
	/** Flat distance from center (toward +vertical) for `d_shape`. */
	flatOffsetMm?: number;
	/** Opening center height above the PCB top surface (side faces only). */
	zCenterAboveBoardMm: number;
	/** True when no aperture profile matched and the housing bbox was used. */
}

const isSide = (f: Face) => f !== "top" && f !== "bottom";

/** Face-relative default opening size from a component's extents. */
const sizeDefaults = (
	face: Face,
	dims: { lengthMm?: number; widthMm?: number; heightMm?: number },
): { w?: number; h?: number } => {
	if (!isSide(face)) return { w: dims.lengthMm, h: dims.widthMm };
	if (face === "+x" || face === "-x")
		return { w: dims.widthMm, h: dims.heightMm };
	return { w: dims.lengthMm, h: dims.heightMm };
};

const FALLBACK_OPENING_MM = 6;

/** Body extents used to fill aperture dims the profile leaves unspecified. */
type BodyExtents = { lengthMm?: number; widthMm?: number; heightMm?: number };

/** Component-local z converted to a signed offset from the PCB top surface. */
const zCenterFromBoardTop = (
	body: ComponentBody,
	boardThicknessMm: number,
	bodyHeightMm: number = body.heightMm,
): number => {
	const localZ = (body.zOffsetMm ?? 0) + bodyHeightMm / 2;
	return body.side === "bottom" ? -boardThicknessMm - localZ : localZ;
};

/** Turn an explicit, fully dimensioned aperture into final opening dimensions. */
const apertureToCutout = (
	ap: ResolvedAperture,
	marginOverride?: number,
): Pick<
	ResolvedCutout,
	"shape" | "widthMm" | "heightMm" | "cornerRadiusMm" | "flatOffsetMm"
> => {
	const m = marginOverride ?? ap.marginMm;
	if (ap.shape === "circle") {
		if (ap.diameterMm == null)
			throw new Error("[pcb-enclosure] circle aperture requires a diameter");
		const d = ap.diameterMm + 2 * m;
		return { shape: "circle", widthMm: d, heightMm: d };
	}
	if (ap.shape === "d_shape") {
		if (ap.diameterMm == null)
			throw new Error("[pcb-enclosure] d_shape aperture requires a diameter");
		const d = ap.diameterMm + 2 * m;
		return {
			shape: "d_shape",
			widthMm: d,
			heightMm: d,
			flatOffsetMm: (ap.flatOffsetMm ?? ap.diameterMm / 2) + m,
		};
	}
	if (ap.widthMm == null || ap.heightMm == null) {
		throw new Error(
			`[pcb-enclosure] ${ap.shape} aperture requires width and height`,
		);
	}
	const w = ap.widthMm + 2 * m;
	const h = ap.heightMm + 2 * m;
	if (ap.shape === "rounded_rect") {
		return {
			shape: "rounded_rect",
			widthMm: w,
			heightMm: h,
			cornerRadiusMm:
				ap.cornerRadiusMm != null ? ap.cornerRadiusMm + m : Math.min(w, h) / 2,
		};
	}
	return { shape: "rect", widthMm: w, heightMm: h };
};

/** Auto cutout for one edge/top-mount component body (or null if not eligible). */
const autoCutoutFor = (
	b: ComponentBody,
	features: EnclosureFeatures,
	rules: DesignRules,
): ResolvedCutout | null => {
	if (!b.cutoutAperture) return null;
	const ap = resolveCutoutAperture(b.cutoutAperture, rules);
	if (!ap) return null;
	const center = b.cableInsertionCenter ?? b.center;
	const face = autoCutoutFace(b, features.bounds, rules, center);
	if (!face) return null;
	// aperture height only applies to a side wall; a lid/floor opening is planar
	const zFor = () =>
		isSide(face) ? zCenterFromBoardTop(b, features.boardThicknessMm) : 0;
	const dims = apertureToCutout(ap);
	return {
		id: b.id,
		origin: "auto",
		center,
		face,
		...dims,
		zCenterAboveBoardMm: zFor(),
	};
};

/** Options for `resolveCutouts`. */
export interface ResolveCutoutsOptions {
	/**
	 * Automatically place explicitly declared part apertures. This never infers
	 * aperture existence, shape, or dimensions from a component body.
	 */
	autoCutouts?: boolean;
	/** Injected manufacturing design rules (edge-distance gate, default margin). */
	designRules?: DesignRules;
}

/**
 * Resolve automatically placed declared apertures plus internal explicit
 * operands into final openings.
 */
export const resolveCutouts = (
	features: EnclosureFeatures,
	explicit: EnclosureCutoutChild[] = [],
	opts: ResolveCutoutsOptions = {},
): ResolvedCutout[] => {
	const rules = opts.designRules ?? DEFAULT_DESIGN_RULES;
	const out: ResolvedCutout[] = [];
	const explicitIds = new Set(
		explicit
			.filter((c) => !!c.at)
			.map((c) => c.resolvedId)
			.filter((id): id is string => !!id),
	);
	const bodyById = new Map(features.componentBodies.map((b) => [b.id, b]));

	if (opts.autoCutouts === true) {
		for (const b of features.componentBodies) {
			if (explicitIds.has(b.id)) continue;
			const auto = autoCutoutFor(b, features, rules);
			if (auto) out.push(auto);
		}
	}

	for (const c of explicit) {
		if (!c.at) continue; // unresolved: no `at`, and `for` matched nothing
		const body = c.resolvedId ? bodyById.get(c.resolvedId) : undefined;
		const bodyExtents: BodyExtents = {
			lengthMm: c.footprintLengthMm ?? body?.lengthMm,
			widthMm: c.footprintWidthMm ?? body?.widthMm,
			heightMm: c.bodyHeightMm ?? body?.heightMm,
		};
		const bodyHeightMm = bodyExtents.heightMm;

		// A matched aperture supplies shape/size defaults unless the child gives
		// an explicit shape or dimension.
		const ap =
			c.shape || c.width != null || c.height != null || c.diameter != null
				? null
				: body
					? resolveCutoutAperture(body.cutoutAperture, rules)
					: null;
		const center = c.at;
		const face =
			faceFromDirection(c.direction) ??
			(c.face && c.face !== "auto" ? c.face : undefined) ??
			(body
				? autoCutoutFace(body, features.bounds, rules, center)
				: undefined) ??
			inferFace(center, features.bounds, body?.ftype, rules);

		let resolved: Pick<
			ResolvedCutout,
			"shape" | "widthMm" | "heightMm" | "cornerRadiusMm" | "flatOffsetMm"
		>;
		if (ap) {
			resolved = apertureToCutout(ap, c.margin);
		} else {
			const margin = c.margin ?? rules.cutout.defaultMarginMm;
			const shape = c.shape === "circle" ? "circle" : "rect";
			if (shape === "circle") {
				const d =
					(c.diameter ?? c.width ?? c.height ?? FALLBACK_OPENING_MM) +
					2 * margin;
				resolved = { shape: "circle", widthMm: d, heightMm: d };
			} else {
				const s = sizeDefaults(face, bodyExtents);
				resolved = {
					shape: "rect",
					widthMm: (c.width ?? s.w ?? FALLBACK_OPENING_MM) + 2 * margin,
					heightMm: (c.height ?? s.h ?? FALLBACK_OPENING_MM) + 2 * margin,
				};
			}
		}

		out.push({
			id: c.resolvedId,
			origin: "explicit",
			center,
			face,
			...resolved,
			// a side opening resolved from a component defaults to the aperture
			// height, else the body's vertical middle (brackets the body)
			zCenterAboveBoardMm:
				c.zCenterAboveBoard ??
				(isSide(face) && body
					? zCenterFromBoardTop(body, features.boardThicknessMm, bodyHeightMm)
					: 0),
		});
	}
	return out;
};
