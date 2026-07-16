import { DEFAULT_DESIGN_RULES, type DesignRules } from "./design-rules";
import type { ApertureProfile } from "./cutout-aperture";
import type { ComponentBody, EnclosureFeatures, MountPoint, XY } from "./types";

type El = Record<string, any>;
type Aabb = { minX: number; minY: number; maxX: number; maxY: number };

const getEls = (cj: any): El[] => (Array.isArray(cj) ? cj : cj?.elements || []);
const by = (els: El[], t: string) => els.filter((e) => e.type === t);
const hasOwn = (o: El, k: string): boolean =>
	Object.prototype.hasOwnProperty.call(o, k);
const asNumber = (v: unknown): number | undefined =>
	typeof v === "number" && Number.isFinite(v) ? v : undefined;
const positive = (v: unknown): number | undefined => {
	const n = asNumber(v);
	return n != null && n > 0 ? n : undefined;
};
const maxDefined = (values: Array<number | undefined>): number | undefined => {
	const nums = values.filter(
		(v): v is number => v != null && Number.isFinite(v),
	);
	return nums.length > 0 ? Math.max(...nums) : undefined;
};
/** A board-plane point, if both coordinates are finite. */
const xyOf = (p: any): XY | undefined =>
	asNumber(p?.x) != null && asNumber(p?.y) != null
		? { x: p.x, y: p.y }
		: undefined;

// ---------------------------------------------------------------------------
// Axis-aligned bounding boxes (pads / holes → footprint extents)
// ---------------------------------------------------------------------------

const rotatedAabbSize = (
	width: number,
	height: number,
	rotDeg: unknown,
): { width: number; height: number } => {
	const t = ((asNumber(rotDeg) ?? 0) * Math.PI) / 180; // Circuit JSON: degrees
	const c = Math.abs(Math.cos(t));
	const s = Math.abs(Math.sin(t));
	return { width: width * c + height * s, height: width * s + height * c };
};

const aabbFromCenterSize = (
	cx: number,
	cy: number,
	width: number,
	height: number,
	rotDeg: unknown = 0,
): Aabb => {
	const r = rotatedAabbSize(width, height, rotDeg);
	return {
		minX: cx - r.width / 2,
		maxX: cx + r.width / 2,
		minY: cy - r.height / 2,
		maxY: cy + r.height / 2,
	};
};

const pointsAabb = (points: any[] | undefined): Aabb | undefined => {
	if (!Array.isArray(points) || points.length === 0) return undefined;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		const x = asNumber(p?.x);
		const y = asNumber(p?.y);
		if (x == null || y == null) continue;
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
	}
	return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : undefined;
};

const includeAabb = (a: Aabb | undefined, b: Aabb): Aabb =>
	a
		? {
				minX: Math.min(a.minX, b.minX),
				minY: Math.min(a.minY, b.minY),
				maxX: Math.max(a.maxX, b.maxX),
				maxY: Math.max(a.maxY, b.maxY),
			}
		: { ...b };

const aabbCenter = (a: Aabb): XY => ({
	x: (a.minX + a.maxX) / 2,
	y: (a.minY + a.maxY) / 2,
});

/** First positive of a list of candidate diameter/size fields on a pad. */
const firstSize = (p: El, keys: string[]): number | undefined => {
	for (const k of keys) {
		const v = positive(p[k]);
		if (v != null) return v;
	}
	const r = positive(p.radius);
	return r != null ? r * 2 : undefined;
};

/** Axis-aligned bounds for one pad/hole in board coordinates. */
const padAabb = (p: El): Aabb => {
	const cx = asNumber(p.x) ?? 0;
	const cy = asNumber(p.y) ?? 0;

	const outline =
		p.shape === "polygon" ? (p.points ?? p.pad_outline) : p.pad_outline;
	const polyBounds = pointsAabb(outline);
	if (polyBounds) return polyBounds;

	if (p.shape === "circle" || p.hole_shape === "circle") {
		const d = firstSize(p, ["outer_diameter", "hole_diameter"]) ?? 1;
		return aabbFromCenterSize(cx, cy, d, d);
	}

	const width =
		firstSize(p, [
			"width",
			"outer_width",
			"outer_diameter",
			"rect_pad_width",
			"hole_width",
			"hole_diameter",
		]) ?? 1;
	const height =
		firstSize(p, [
			"height",
			"outer_height",
			"outer_diameter",
			"rect_pad_height",
			"hole_height",
			"hole_diameter",
		]) ?? width;
	return aabbFromCenterSize(
		cx,
		cy,
		width,
		height,
		p.ccw_rotation ?? p.rect_ccw_rotation ?? p.hole_ccw_rotation,
	);
};

const padBounds = (pads: El[]): Aabb | undefined =>
	pads.reduce<Aabb | undefined>(
		(b, p) => includeAabb(b, padAabb(p)),
		undefined,
	);

// ---------------------------------------------------------------------------
// Board outline + bounds
// ---------------------------------------------------------------------------

/** Board outline polygon (or a rectangle from width/height) + its bbox. */
const extractOutline = (
	board: El,
	center: XY,
): { outline: XY[]; bounds: Aabb } => {
	let outline: XY[];
	if (Array.isArray(board.outline) && board.outline.length >= 3) {
		outline = board.outline.map((p: XY) => ({ x: p.x, y: p.y }));
	} else {
		const w = asNumber(board.width) ?? 50;
		const h = asNumber(board.height) ?? 50;
		outline = [
			{ x: center.x - w / 2, y: center.y - h / 2 },
			{ x: center.x + w / 2, y: center.y - h / 2 },
			{ x: center.x + w / 2, y: center.y + h / 2 },
			{ x: center.x - w / 2, y: center.y + h / 2 },
		];
	}
	const bounds = outline.reduce<Aabb>(
		(a, p) => ({
			minX: Math.min(a.minX, p.x),
			minY: Math.min(a.minY, p.y),
			maxX: Math.max(a.maxX, p.x),
			maxY: Math.max(a.maxY, p.y),
		}),
		{ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
	);
	return { outline, bounds };
};

// ---------------------------------------------------------------------------
// Mounting points (board-level mechanical holes)
// ---------------------------------------------------------------------------

/**
 * A mount point is a hole with no electrical role (no port) that belongs to the
 * board itself, not to a footprint: holes inside a component footprint (e.g. a
 * keyswitch's alignment pegs) carry a `pcb_component_id` and must not grow
 * standoffs.
 */
const isBoardMountHole = (h: El): boolean =>
	!h.pcb_component_id &&
	!h.pcb_port_id &&
	(!h.port_hints || h.port_hints.length === 0);

const extractMountPoints = (els: El[]): MountPoint[] =>
	[...by(els, "pcb_plated_hole"), ...by(els, "pcb_hole")]
		.filter(isBoardMountHole)
		.map((h) => ({
			center: { x: h.x, y: h.y },
			pcbHoleDiameterMm:
				positive(h.hole_diameter) ??
				maxDefined([positive(h.hole_width), positive(h.hole_height)]),
			side: "floor" as const,
		}));

// ---------------------------------------------------------------------------
// Component bodies
// ---------------------------------------------------------------------------

/**
 * Built-in fallback body-height table (mm above the PCB surface) keyed by source
 * ftype, used only when the component's `cad_component` carries no `size`.
 * Extend/override per-board via `ExtractOptions.ftypeHeights`.
 */
const FTYPE_HEIGHT_MM: Record<string, number> = {
	simple_resistor: 0.6,
	simple_capacitor: 1.2,
	simple_diode: 1.1,
	simple_led: 1.0,
	simple_chip: 1.2,
	simple_resonator: 3,
	simple_pin_header: 8.5,
	simple_connector: 11,
	simple_push_button: 5,
	simple_switch: 6,
};
const DEFAULT_BODY_HEIGHT_MM = 3;

/**
 * Resolved body-modeling heuristics for one extraction: the ftype height table
 * (built-ins + user overrides), the fallback height, and the through-hole
 * far-side lead projection (a *design rule*, injected). Body-height data is
 * user-overridable (the user knows their parts); the lead projection is a
 * craft/manufacturing rule (IPC class), so it lives in `DesignRules`.
 */
interface BodyHeuristics {
	ftypeHeights: Record<string, number>;
	defaultBodyHeightMm: number;
	throughHoleLeadProjectionMm: number;
}

const resolveBodyHeuristics = (opts: ExtractOptions): BodyHeuristics => ({
	ftypeHeights: { ...FTYPE_HEIGHT_MM, ...(opts.ftypeHeights ?? {}) },
	defaultBodyHeightMm: opts.defaultBodyHeightMm ?? DEFAULT_BODY_HEIGHT_MM,
	throughHoleLeadProjectionMm: (opts.designRules ?? DEFAULT_DESIGN_RULES)
		.component.throughHoleLeadProjectionMm,
});

/** Per-component lookup tables built once for the whole board. */
interface ComponentIndex {
	padsByComp: Record<string, El[]>;
	srcById: Record<string, El>;
	cadByComp: Record<string, El>;
}

const indexComponents = (els: El[]): ComponentIndex => {
	const padsByComp: Record<string, El[]> = {};
	for (const p of [...by(els, "pcb_smtpad"), ...by(els, "pcb_plated_hole")]) {
		if (p.pcb_component_id) (padsByComp[p.pcb_component_id] ||= []).push(p);
	}
	const srcById = Object.fromEntries(
		by(els, "source_component").map((s) => [s.source_component_id, s]),
	);
	const cadByComp: Record<string, El> = {};
	for (const c of by(els, "cad_component")) {
		// enclosure parts tag themselves with enclosure_part_id; skip them so a
		// re-render never treats the shell as a board component
		if (c.pcb_component_id && !c.enclosure_part_id)
			cadByComp[c.pcb_component_id] = c;
	}
	return { padsByComp, srcById, cadByComp };
};

/** Footprint-frame CAD body size, rotated into the board frame. */
const cadFootprint = (comp: El, cad: El | undefined) => {
	const size = cad?.size;
	if (positive(size?.x) == null || positive(size?.y) == null) return undefined;
	return rotatedAabbSize(size.x, size.y, cad?.rotation?.z ?? comp.rotation);
};

/**
 * XY footprint extents (mm), preferring the largest of the pad bbox, the CAD
 * body, and the `pcb_component` bbox per axis — a connector housing is often
 * wider than its pads. Returns null when the component carries no body evidence
 * at all (nothing to enclose).
 */
const footprintExtents = (
	comp: El,
	cad: El | undefined,
	pb: Aabb | undefined,
): { lengthMm: number; widthMm: number } | null => {
	const compWidth = positive(comp.width);
	const compHeight = positive(comp.height);
	if (!pb && !cad?.size && compWidth == null && compHeight == null) return null;
	const cadXY = cadFootprint(comp, cad);
	return {
		lengthMm:
			maxDefined([pb && pb.maxX - pb.minX, cadXY?.width, compWidth]) ?? 1,
		widthMm:
			maxDefined([pb && pb.maxY - pb.minY, cadXY?.height, compHeight]) ?? 1,
	};
};

/** Body height above the PCB: override → CAD size.z → ftype table → default. */
const bodyHeight = (
	override: { heightMm?: number },
	cad: El | undefined,
	ftype: string | undefined,
	h: BodyHeuristics,
): number =>
	override.heightMm ??
	positive(cad?.size?.z) ??
	h.ftypeHeights[ftype ?? ""] ??
	h.defaultBodyHeightMm;

/** Body center: CAD position → pcb_component center → pad bbox → board center. */
const bodyCenter = (
	comp: El,
	cad: El | undefined,
	pb: Aabb | undefined,
	boardCenter: XY,
): XY =>
	xyOf(cad?.position) ??
	xyOf(comp.center) ??
	(pb ? aabbCenter(pb) : boardCenter);

/** Which PCB side the body sits on (from cad/pcb layer, then CAD z sign). */
const bodySide = (comp: El, cad: El | undefined): "top" | "bottom" => {
	const layer = String(cad?.layer ?? comp.layer ?? "top").toLowerCase();
	const cadZ = asNumber(cad?.position?.z);
	return layer === "bottom" || (layer !== "top" && cadZ != null && cadZ < 0)
		? "bottom"
		: "top";
};

/**
 * Projection past the opposite PCB surface (mm): explicit override, else a
 * default through-hole lead/tail projection when the part has plated holes, else
 * none. Not lead-specific — an override models any far-side feature (keyswitch
 * clips, alignment pegs, ...).
 */
const farSideProjection = (
	override: { farSideProjectionMm?: number },
	throughHole: boolean,
	h: BodyHeuristics,
): number | undefined => {
	const v =
		override.farSideProjectionMm ??
		(throughHole ? h.throughHoleLeadProjectionMm : 0);
	return v > 0 ? v : undefined;
};

/** Assemble one `ComponentBody`, or null if the component has no body. */
const componentBody = (
	comp: El,
	index: ComponentIndex,
	overrides: NonNullable<ExtractOptions["overrides"]>,
	aperturesBySourceComponentId: NonNullable<
		ExtractOptions["aperturesBySourceComponentId"]
	>,
	boardCenter: XY,
	h: BodyHeuristics,
): ComponentBody | null => {
	const cad = index.cadByComp[comp.pcb_component_id];
	const pads = index.padsByComp[comp.pcb_component_id] ?? [];
	const pb = padBounds(pads);
	const extents = footprintExtents(comp, cad, pb);
	if (!extents) return null;

	const src = index.srcById[comp.source_component_id];
	const ftype: string | undefined = src?.ftype;
	const name: string = src?.name ?? comp.pcb_component_id;
	const ov = overrides[name] ?? {};
	const throughHole = pads.some((p) => p.type === "pcb_plated_hole");
	const center = bodyCenter(comp, cad, pb, boardCenter);
	const side = bodySide(comp, cad);

	return {
		id: name,
		center,
		lengthMm: extents.lengthMm,
		widthMm: extents.widthMm,
		heightMm: bodyHeight(ov, cad, ftype, h),
		side,
		farSideProjectionMm: farSideProjection(ov, throughHole, h),
		zOffsetMm: ov.zOffsetMm,
		ftype,
		cutoutAperture: aperturesBySourceComponentId[comp.source_component_id],
		insertionDirection: comp.insertion_direction,
		cableInsertionCenter: xyOf(comp.cable_insertion_center),
	};
};

const extractComponentBodies = (
	els: El[],
	boardCenter: XY,
	opts: ExtractOptions,
): {
	componentBodies: ComponentBody[];
	topComponentHeightMm: number;
	bottomComponentHeightMm: number;
} => {
	const index = indexComponents(els);
	const overrides = opts.overrides ?? {};
	const aperturesBySourceComponentId = opts.aperturesBySourceComponentId ?? {};
	const h = resolveBodyHeuristics(opts);
	const componentBodies: ComponentBody[] = [];
	let topComponentHeightMm = 0;
	let bottomComponentHeightMm = 0;
	for (const comp of by(els, "pcb_component")) {
		const body = componentBody(
			comp,
			index,
			overrides,
			aperturesBySourceComponentId,
			boardCenter,
			h,
		);
		if (!body) continue;
		componentBodies.push(body);
		// the body rises from its mounted surface; through-hole leads / clips / pegs
		// project past the opposite surface, so a part can add to both totals
		const mountSideHeight = body.heightMm + (body.zOffsetMm ?? 0);
		const farSideHeight = body.farSideProjectionMm ?? 0;
		if (body.side === "bottom") {
			bottomComponentHeightMm = Math.max(
				bottomComponentHeightMm,
				mountSideHeight,
			);
			topComponentHeightMm = Math.max(topComponentHeightMm, farSideHeight);
		} else {
			topComponentHeightMm = Math.max(topComponentHeightMm, mountSideHeight);
			bottomComponentHeightMm = Math.max(
				bottomComponentHeightMm,
				farSideHeight,
			);
		}
	}
	return { componentBodies, topComponentHeightMm, bottomComponentHeightMm };
};

// ---------------------------------------------------------------------------

export interface ExtractOptions {
	/**
	 * Select the board to extract. If omitted, the first `pcb_board` is used for
	 * backwards compatibility. All board-owned physical elements are then scoped to
	 * that board's `subcircuit_id` / `pcb_board_id` when those identifiers exist.
	 */
	pcbBoardId?: string;
	/** Alternate board selector for subcircuit-authored boards. */
	subcircuitId?: string;
	/** Ephemeral part apertures collected from imported enclosure TSX. */
	aperturesBySourceComponentId?: Record<string, ApertureProfile>;
	/**
	 * Per-component body overrides keyed by source component name (e.g. "J1").
	 * Use this to set real body heights until every footprint carries a sized
	 * `cad_component`.
	 */
	overrides?: Record<
		string,
		Partial<
			Pick<ComponentBody, "heightMm" | "zOffsetMm" | "farSideProjectionMm">
		>
	>;
	/** Extend/override the built-in ftype → body-height fallback table (mm). */
	ftypeHeights?: Record<string, number>;
	/** Fallback body height (mm) when nothing else applies (default 3). */
	defaultBodyHeightMm?: number;
	/** Injected design rules (through-hole far-side lead projection default). */
	designRules?: DesignRules;
}

const selectBoard = (els: El[], opts: ExtractOptions): El => {
	const boards = by(els, "pcb_board");
	const board = opts.pcbBoardId
		? boards.find((b) => b.pcb_board_id === opts.pcbBoardId)
		: opts.subcircuitId
			? boards.find((b) => boardSubcircuitId(els, b) === opts.subcircuitId)
			: boards[0];
	if (!board) {
		const selector = opts.pcbBoardId
			? `pcb_board_id=${opts.pcbBoardId}`
			: opts.subcircuitId
				? `subcircuit_id=${opts.subcircuitId}`
				: "any pcb_board";
		throw new Error(`No pcb_board found in circuit json (${selector})`);
	}
	return board;
};

/**
 * `pcb_board` does not always carry `subcircuit_id` in rendered Circuit JSON.
 * Recover it through pcb_board -> source_board -> source_group so board-level
 * primitives such as mounting holes can still be scoped to the selected board.
 */
const boardSubcircuitId = (els: El[], board: El): string | undefined => {
	if (board.subcircuit_id != null) return board.subcircuit_id;
	const sourceBoard = by(els, "source_board").find(
		(candidate) => candidate.source_board_id === board.source_board_id,
	);
	if (!sourceBoard?.source_group_id) return undefined;
	return by(els, "source_group").find(
		(group) => group.source_group_id === sourceBoard.source_group_id,
	)?.subcircuit_id;
};

const elementBelongsToBoard = (
	e: El,
	board: El,
	subcircuitId: string | undefined,
): boolean => {
	// Source components are metadata indexed by id; keep all of them so a scoped
	// pcb_component can still resolve its name/ftype even if the source element is
	// not stamped with a board/subcircuit id.
	if (e.type === "source_component") return true;
	if (e.type === "pcb_board") return e === board;

	const boardId = board.pcb_board_id;
	if (boardId && e.positioned_relative_to_pcb_board_id != null)
		return e.positioned_relative_to_pcb_board_id === boardId;

	const sub = subcircuitId;
	if (sub != null) {
		// Board-owned Circuit JSON elements in subcircuits carry `subcircuit_id`.
		// If an element lacks it, include it only when it also lacks explicit board
		// ownership metadata (legacy/single-board JSON).
		return e.subcircuit_id === sub || !hasOwn(e, "subcircuit_id");
	}

	// First-board backwards compatibility: for an unscoped board, ignore elements
	// explicitly assigned to a different subcircuit/board, but keep legacy unscoped
	// elements.
	if (e.subcircuit_id != null) return false;
	if (boardId && e.positioned_relative_to_pcb_board_id != null)
		return e.positioned_relative_to_pcb_board_id === boardId;
	return true;
};

const scopeElementsToBoard = (els: El[], board: El): El[] =>
	els.filter((e) =>
		elementBelongsToBoard(e, board, boardSubcircuitId(els, board)),
	);

/**
 * Turn Circuit JSON into the facts the enclosure generator needs: board outline
 * + bounds, board-level mounting holes, and component bodies (extents, heights,
 * side). Pure — no CSG, no React.
 */
export const extractEnclosureFeatures = (
	circuitJson: any,
	opts: ExtractOptions = {},
): EnclosureFeatures => {
	const els = getEls(circuitJson);
	const board = selectBoard(els, opts);
	const scopedEls = scopeElementsToBoard(els, board);

	const boardCenter: XY = board.center ?? { x: 0, y: 0 };
	const { outline, bounds } = extractOutline(board, boardCenter);
	const mountPoints = extractMountPoints(scopedEls);
	const { componentBodies, topComponentHeightMm, bottomComponentHeightMm } =
		extractComponentBodies(scopedEls, boardCenter, opts);

	return {
		outline,
		bounds,
		boardThicknessMm: board.thickness ?? 1.6,
		boardCenter,
		mountPoints,
		componentBodies,
		topComponentHeightMm,
		bottomComponentHeightMm,
	};
};
