/**
 * Type model for the parametric enclosure generator.
 *
 * All lengths are millimetres. Coordinate frame matches Circuit JSON: x/y in the
 * board plane, z normal to the board (up). The generator recenters geometry so
 * the board's center sits at the XY origin and the enclosure's outer floor is at
 * z = 0.
 */
import type { ApertureProfile } from "./cutout-aperture";
import type { DesignRules } from "./design-rules";
import type {
	MountingHardwareCatalog,
	MountingStackRef,
	MountingStackSpec,
} from "./mounting-hardware-catalog";

/** A 2D point in the board plane (Circuit JSON convention). */
export interface XY {
	x: number;
	y: number;
}

/**
 * Enclosure faces, the single face vocabulary used everywhere (props, cutout
 * resolution, geometry routing). Sides are named by board-plane axis.
 */
export type Face = "top" | "bottom" | "+x" | "-x" | "+y" | "-y";
//                  lid     floor     right  left   back   front

/**
 * A PCB-fastening mounting stack: a catalog key into `MountingHardwareCatalog`'s
 * `mountingStacks`, or an inline stack spec. This replaces the old fixed anchor
 * enum — all hardware is data-driven (see `lib/mounting-hardware-catalog.ts`).
 */
export type AnchorRef = MountingStackRef | MountingStackSpec;

/** BOM emission mode for enclosure hardware. */
export type BomMode =
	| "off" // generate geometry only; emit no hardware BOM
	| "warn" // emit BOM where possible (best-effort)
	| "strict"; // warn about generic hardware lacking procurement identity

/** Finish of a screw hole in a panel/lid. */
export type LidHole =
	| "through" // plain clearance hole (only option for laser-cut stock)
	| "countersink" // conical recess for a flat-head screw
	| "counterbore"; // cylindrical recess for a socket-head cap screw

/**
 * One resolved PCB fastening point, built from the selected board's
 * auto-extracted mounting holes.
 */
export interface FastenerSpec {
	/** Board-plane center (Circuit JSON frame). */
	center: XY;
	/** Hole diameter on the PCB if known (validated against the stack clearance). */
	pcbHoleDiameterMm?: number;
	/** Per-fastener mounting-stack override (catalog key or inline spec). */
	anchor?: AnchorRef;
}

/** A component body mounted to one PCB side (drives interior clearance). */
export interface ComponentBody {
	id: string;
	/** Body center in board-plane coordinates. */
	center: XY;
	/**
	 * Component-local mounting frame projected into the board plane. Aperture
	 * positions use this origin and rotation; local z=0 is the component-side PCB
	 * surface and positive z points away from the board.
	 */
	componentFrame?: {
		origin: XY;
		rotationDeg: number;
		/** Bottom-side footprints mirror their local Y axis before rotation. */
		flipY?: boolean;
	};
	lengthMm: number; // axis-aligned extent along x
	widthMm: number; // axis-aligned extent along y
	/** Body height measured outward from the owning PCB surface. */
	heightMm: number;
	/** PCB side the body is mounted on. Defaults to top for legacy/manual data. */
	side?: "top" | "bottom";
	/**
	 * How far the part projects past the **opposite** PCB surface from where it's
	 * mounted (mm), measured **beyond that far face** — it excludes the board
	 * thickness the feature passes through (see `boardThicknessMm`). Examples:
	 * through-hole leads/solder tails, a keyswitch's mounting clips or alignment
	 * pegs. Drives clearance on the far side (e.g. standoff height so leads clear
	 * the floor). Undefined/0 for a flat SMT part.
	 */
	farSideProjectionMm?: number;
	/** Clearance between PCB surface and the lowest point of the body. */
	zOffsetMm?: number;
	/** Source ftype (simple_connector, simple_led, ...) for classification. */
	ftype?: string;
	/** Aperture metadata embedded directly in the source component. */
	cutoutAperture?: ApertureProfile;
	/**
	 * Mating-face direction from footprint metadata: the outward normal the
	 * connector opening faces. Preferred signal for auto-cutout face selection.
	 */
	insertionDirection?:
		| "from_left"
		| "from_right"
		| "from_front"
		| "from_back"
		| "from_above";
	/**
	 * Inferred cable-insertion point (`@tscircuit/infer-cable-insertion-point`),
	 * placed just outside the mating side — used to pick the wall + center the
	 * opening along it.
	 */
	cableInsertionCenter?: XY;
}

/** A mounting point where a standoff/boss should be generated. */
export interface MountPoint {
	center: XY;
	/** Hole diameter on the PCB if known (used to validate fit). */
	pcbHoleDiameterMm?: number;
	/** Where the standoff originates from. */
	side: "floor" | "lid";
}

/** Shared fields for an enclosure feature that protrudes into the cavity. */
interface DrcObstacleBase {
	/** Feature label for the DRC message, e.g. "screw channel", "lid column". */
	kind: string;
	/** Owning part id (base / lid). */
	partId: string;
	center: [number, number, number];
}

/** Cylindrical cavity obstacle (standoff, screw channel, lid column). */
export interface DrcCylinderObstacle extends DrcObstacleBase {
	shape?: "cylinder";
	axis: "x" | "y" | "z";
	radiusMm: number;
	/** Length along `axis`. */
	lengthMm: number;
}

/** Axis-aligned box cavity obstacle (lip/rib/bar features). */
export interface DrcBoxObstacle extends DrcObstacleBase {
	shape: "box";
	/** Half-size along x/y/z. */
	halfSizeMm: [number, number, number];
}

/**
 * An enclosure feature that protrudes into the interior cavity. Emitted by the
 * feature recipes in `build-enclosure.ts` for the mesh-free render-time assembly
 * DRC (`lib/enclosure-drc.ts`), which can't run the `@jscad/modeling` boolean
 * intersection the build-script DRC uses. Coordinates are in the **model frame**
 * (board recentered to x=y=0, z as built).
 */
export type DrcObstacle = DrcCylinderObstacle | DrcBoxObstacle;

/**
 * Everything the generator needs to know about a board, extracted from Circuit
 * JSON (board geometry) plus optional annotations the user supplies for features
 * Circuit JSON doesn't describe well yet (body heights).
 */
export interface EnclosureFeatures {
	/** Board outline as a closed polygon in board-plane coords. */
	outline: XY[];
	/** Axis-aligned board bbox (derived from outline). */
	bounds: { minX: number; minY: number; maxX: number; maxY: number };
	boardThicknessMm: number;
	/** Board center in original Circuit JSON coordinates (for recentering). */
	boardCenter: XY;
	mountPoints: MountPoint[];
	componentBodies: ComponentBody[];
	/**
	 * Tallest projection above the top (z+) surface and below the bottom (z-)
	 * surface. A through-hole part contributes its body to its mounted side and
	 * its `farSideProjectionMm` to the opposite side, so both can be non-zero.
	 */
	topComponentHeightMm: number;
	bottomComponentHeightMm: number;
}

/** Tunable parameters for the split_shell (base + lid) case. */
export interface EnclosureParams {
	/** Optional outer X dimension; inferred from the board when omitted. */
	widthMm?: number;
	/** Optional outer Y dimension; inferred from the board when omitted. */
	heightMm?: number;
	/** Optional total outer Z dimension; inferred from the component stack when omitted. */
	depthMm?: number;
	/** Outer shell wall thickness. */
	wallThicknessMm: number;
	/** Floor (base bottom) thickness. */
	floorThicknessMm: number;
	/** Lid top-plate thickness. */
	lidThicknessMm: number;
	/** XY gap between the board edge and the inner wall. */
	boardClearanceMm: number;
	/** Standoff height: gap between floor top and PCB bottom. */
	standoffHeightMm: number;
	/** Headroom above the tallest top-side component (under the lid). */
	topHeadroomMm: number;
	/** Default PCB mounting-hardware stack (catalog key or inline spec). */
	anchor: AnchorRef;
	/** Extra/override mounting-hardware definitions merged over the built-in catalog. */
	mountingHardwareCatalog?: MountingHardwareCatalog;
	/**
	 * Automatically place explicitly declared part apertures. **Opt-in**
	 * (default false); this never invents aperture existence or geometry.
	 */
	autoCutouts?: boolean;
	/** Injected manufacturing design rules; defaults to `DEFAULT_DESIGN_RULES`. */
	designRules?: DesignRules;
	/** How to emit the mounting-hardware BOM (default "warn"). */
	bomMode?: BomMode;
	/** Screw-hole finish for the lid (internal for now; a countersunk flat head). */
	lidHole: LidHole;
	/**
	 * When the board has no dedicated mounting holes, corner fasteners are placed
	 * inset from the board corners by this much.
	 */
	cornerStandoffInsetMm: number;
	/** Depth of the friction lip that nests the lid into the base opening. */
	lidLipDepthMm: number;
}

export const DEFAULT_PARAMS: EnclosureParams = {
	wallThicknessMm: 2,
	floorThicknessMm: 2,
	lidThicknessMm: 2,
	boardClearanceMm: 0.8,
	standoffHeightMm: 4,
	topHeadroomMm: 6,
	anchor: "m3-heat-set",
	bomMode: "warn",
	autoCutouts: false,
	lidHole: "countersink",
	cornerStandoffInsetMm: 4,
	lidLipDepthMm: 4,
};
