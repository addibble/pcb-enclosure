import { z } from "zod";
import type { Face, XY } from "./types";

/**
 * The enclosure child vocabulary — **single source of truth**.
 *
 * This file holds the shared enums (face / direction) and the resolved *operand*
 * shape a `<enclosurecutout>` lowers to. The per-tag zod prop schemas and the
 * package-private collectors that consume them feed the artifact renderer; the
 * analysis and geometry layers only need the operand type below. Mounting-hardware
 * selection is a catalog key (or inline spec) validated against
 * `MountingHardwareCatalog` — see `lib/mounting-hardware-catalog.ts`.
 */

// --- shared enums (used by package-private explicit operand adapters) ----------
/** A mounting-stack reference: a catalog key or an inline stack spec. */
export const mountingStackRef = z.union([z.string(), z.record(z.any())]);
export const faceEnum = z.enum(["top", "bottom", "+x", "-x", "+y", "-y"]);
export const directionEnum = z.enum(["+x", "-x", "+y", "-y", "+z", "-z"]);

// --- resolved operand shapes (build inputs, not user-facing props) -----------

/**
 * An `<enclosurecutout>` child with its `for` selector resolved: lengths in mm,
 * position as an absolute board-plane point, plus the resolved component's
 * footprint extents / body height for face-relative default sizing.
 */
export interface EnclosureCutoutChild {
	kind: "enclosurecutout";
	for?: string;
	at?: XY;
	face?: Face | "auto";
	direction?: z.infer<typeof directionEnum>;
	shape?: "rect" | "circle";
	width?: number;
	height?: number;
	diameter?: number;
	margin?: number;
	zCenterAboveBoard?: number;
	/** Board component name the `for` selector resolved to (suppresses the auto cutout). */
	resolvedId?: string;
	/** Footprint bbox extent along x (mm) of the resolved `for` component. */
	footprintLengthMm?: number;
	/** Footprint bbox extent along y (mm) of the resolved `for` component. */
	footprintWidthMm?: number;
	/** Estimated body height above the PCB (mm), for side-face vertical sizing. */
	bodyHeightMm?: number;
}
