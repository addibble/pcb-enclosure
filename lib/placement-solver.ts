import { BaseSolver, type GraphicsObject } from "./base-solver";
import { DEFAULT_DESIGN_RULES, type DesignRules } from "./design-rules";
import {
	BUILTIN_MOUNTING_HARDWARE_CATALOG,
	type MountingHardwareCatalog,
	type ResolvedMountingHardware,
	mergeMountingHardwareCatalog,
	resolveMountingHardware,
} from "./mounting-hardware-catalog";
import type { AnchorRef, FastenerSpec, XY } from "./types";

/** Axis-aligned obstacle box in board-plane coordinates. */
export interface ObstacleBox {
	id: string;
	cx: number;
	cy: number;
	w: number;
	h: number;
}

/** A PCB mounting boss/post validated at a board mounting hole. */
export interface PlacedPost {
	kind: "post";
	center: XY;
	radiusMm: number;
	ok: boolean;
	collidesWith: string[];
	/** The fastener spec this post was validated for (per-fastener overrides). */
	spec?: FastenerSpec;
	/** Why the PCB hole cannot accept this mounting stack, if applicable. */
	fitError?: string;
}

/**
 * A corner fastener with no board mounting hole. The geometry renders it as an
 * **external corner mounting ear** (a tab just outside the cavity at the
 * corner's quadrant), so only the corner target is needed — ears never occupy
 * board interior space and need no free-space search.
 */
export interface PlacedBoss {
	kind: "boss";
	/** The corner target (board-plane) whose quadrant the ear occupies. */
	target: XY;
}

export interface EnclosurePlacementOutput {
	posts: PlacedPost[];
	bosses: PlacedBoss[];
	warnings: string[];
}

export interface EnclosurePlacementParams {
	/**
	 * Component obstacle boxes (board-plane), from
	 * `extractEnclosureFeatures(cj).componentBodies`.
	 */
	obstacles: ObstacleBox[];
	/** Fastener specs at board mounting holes (PCB mounting boss candidates). */
	mountPoints: FastenerSpec[];
	/** Board axis-aligned bounds (for corner targets + interior limits). */
	boardBounds: { minX: number; minY: number; maxX: number; maxY: number };
	/** Default mounting stack (per-fastener `spec.anchor` overrides validation). */
	anchor: AnchorRef;
	/** Extra/override mounting-hardware definitions merged over the built-in catalog. */
	mountingHardwareCatalog?: MountingHardwareCatalog;
	/** Injected manufacturing design rules (corner-coverage factor). */
	designRules?: DesignRules;
	/** Clearance kept between a post/boss wall and any obstacle. */
	clearanceMm: number;
	/**
	 * Request a fastener at each corner. Corners already covered by a mounting
	 * hole use that PCB mounting boss; uncovered corners become external ears.
	 */
	cornerFasteners: boolean;
	/** How far a corner target sits inside the board edge. */
	cornerInsetMm: number;
}

const rectFromObstacle = (o: ObstacleBox) => ({
	x0: o.cx - o.w / 2,
	y0: o.cy - o.h / 2,
	x1: o.cx + o.w / 2,
	y1: o.cy + o.h / 2,
});

/** Distance from a circle center to an AABB; <0 means inside. */
const circleRectGap = (cx: number, cy: number, o: ObstacleBox): number => {
	const r = rectFromObstacle(o);
	const nx = Math.max(r.x0, Math.min(cx, r.x1));
	const ny = Math.max(r.y0, Math.min(cy, r.y1));
	return Math.hypot(cx - nx, cy - ny);
};

/**
 * Validates PCB mounting bosses/posts at board mounting holes against the
 * board's component obstacles and collects the corner targets that need
 * fallback ears.
 *
 * Steppable (BaseSolver): each _step() resolves one fastener, so the solver can
 * be animated in a graphics-debug debugger.
 */
export class EnclosurePlacementSolver extends BaseSolver {
	params: EnclosurePlacementParams;
	obstacles: ObstacleBox[] = [];
	posts: PlacedPost[] = [];
	bosses: PlacedBoss[] = [];
	warnings: string[] = [];

	private queue: Array<
		{ type: "post"; spec: FastenerSpec } | { type: "boss"; target: XY }
	> = [];
	private catalog: MountingHardwareCatalog = BUILTIN_MOUNTING_HARDWARE_CATALOG;
	private rules: DesignRules = DEFAULT_DESIGN_RULES;

	constructor(params: EnclosurePlacementParams) {
		super();
		this.params = params;
		this.catalog = mergeMountingHardwareCatalog(
			BUILTIN_MOUNTING_HARDWARE_CATALOG,
			params.mountingHardwareCatalog,
		);
		this.rules = params.designRules ?? DEFAULT_DESIGN_RULES;
	}

	override getConstructorParams() {
		return this.params;
	}

	private hardware(spec: FastenerSpec): ResolvedMountingHardware {
		return resolveMountingHardware(
			spec.anchor ?? this.params.anchor,
			this.catalog,
			this.rules,
		);
	}

	private postRadius(spec: FastenerSpec): number {
		return this.hardware(spec).geometry.bossOuterDiameterMm / 2;
	}

	private pcbHoleFitError(spec: FastenerSpec): string | undefined {
		if (spec.pcbHoleDiameterMm == null) return undefined;
		const required = this.hardware(spec).geometry.pcbHoleDiameterMm;
		if (spec.pcbHoleDiameterMm + 0.01 >= required) return undefined;
		return `PCB hole is Ø${spec.pcbHoleDiameterMm.toFixed(2)}mm but ${
			typeof (spec.anchor ?? this.params.anchor) === "string"
				? `"${spec.anchor ?? this.params.anchor}"`
				: "the inline mounting stack"
		} requires Ø${required.toFixed(2)}mm clearance`;
	}

	override _setup() {
		this.obstacles = this.params.obstacles;

		for (const spec of this.params.mountPoints) {
			this.queue.push({ type: "post", spec });
		}
		if (this.params.cornerFasteners) {
			const { boardBounds: b, cornerInsetMm: inset } = this.params;
			const corners: XY[] = [
				{ x: b.minX + inset, y: b.minY + inset },
				{ x: b.maxX - inset, y: b.minY + inset },
				{ x: b.maxX - inset, y: b.maxY - inset },
				{ x: b.minX + inset, y: b.maxY - inset },
			];
			for (const corner of corners) {
				// Already covered by a nearby mounting hole? Then that PCB mounting
				// boss serves this corner (no separate ear needed). "Nearby" =
				// within the design-rule coverage radius (× the post radius).
				const covered = this.params.mountPoints.some(
					(mp) =>
						!this.pcbHoleFitError(mp) &&
						Math.hypot(mp.center.x - corner.x, mp.center.y - corner.y) <
							this.postRadius(mp) *
								this.rules.fastener.cornerCoverageRadiusFactor,
				);
				if (!covered) this.queue.push({ type: "boss", target: corner });
			}
		}
	}

	override _step() {
		const task = this.queue.shift();
		if (!task) {
			this.solved = true;
			return;
		}
		if (task.type === "post") {
			this.resolvePost(task.spec);
		} else {
			this.bosses.push({ kind: "boss", target: task.target });
		}
		if (this.queue.length === 0) this.solved = true;
	}

	private collisions(cx: number, cy: number, radiusMm: number): string[] {
		const need = radiusMm + this.params.clearanceMm;
		return this.obstacles
			.filter((o) => circleRectGap(cx, cy, o) < need)
			.map((o) => o.id);
	}

	private resolvePost(spec: FastenerSpec) {
		const radiusMm = this.postRadius(spec);
		const collidesWith = this.collisions(
			spec.center.x,
			spec.center.y,
			radiusMm,
		);
		const fitError = this.pcbHoleFitError(spec);
		const ok = collidesWith.length === 0 && !fitError;
		this.posts.push({
			kind: "post",
			center: spec.center,
			radiusMm,
			ok,
			collidesWith,
			spec,
			fitError,
		});
		if (collidesWith.length > 0)
			this.warnings.push(
				`PCB mounting boss at (${spec.center.x.toFixed(1)},${spec.center.y.toFixed(1)}) overlaps ${collidesWith.join(", ")} — move the mounting hole or reduce boss OD`,
			);
		if (fitError)
			this.warnings.push(
				`PCB mounting boss at (${spec.center.x.toFixed(1)},${spec.center.y.toFixed(1)}) cannot use this hole: ${fitError}`,
			);
	}

	override getOutput(): EnclosurePlacementOutput {
		return { posts: this.posts, bosses: this.bosses, warnings: this.warnings };
	}

	override visualize(): GraphicsObject {
		const g: GraphicsObject = { points: [], lines: [], rects: [], circles: [] };
		// obstacles
		for (const o of this.obstacles)
			g.rects!.push({
				center: { x: o.cx, y: o.cy },
				width: o.w,
				height: o.h,
				fill: "rgba(120,120,120,0.25)",
				stroke: "gray",
				label: o.id,
			});
		// board bounds
		const b = this.params.boardBounds;
		g.rects!.push({
			center: { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
			width: b.maxX - b.minX,
			height: b.maxY - b.minY,
			fill: "transparent",
			stroke: "green",
			label: "board",
		});
		// posts
		for (const p of this.posts)
			g.circles!.push({
				center: p.center,
				radius: p.radiusMm,
				fill: p.ok ? "rgba(0,160,0,0.5)" : "rgba(220,0,0,0.5)",
				stroke: p.ok ? "green" : "red",
				label: p.ok ? "post" : "post!collision",
			});
		// ear targets
		for (const bo of this.bosses)
			g.points!.push({ x: bo.target.x, y: bo.target.y, label: "ear" });
		return g;
	}
}
