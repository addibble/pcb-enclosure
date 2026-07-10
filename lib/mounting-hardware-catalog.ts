import { DEFAULT_DESIGN_RULES, type DesignRules } from "./design-rules";
import { toMm } from "./units";

/**
 * Data-driven PCB-mounting hardware catalog.
 *
 * The enclosure generator does **not** hardcode a fixed set of screw specs. All
 * mounting hardware — screws, heat-set/press-fit inserts, washers, nuts,
 * spacers, bushings — plus the *mounting stacks* that compose them, live in a
 * `MountingHardwareCatalog`. The built-in catalog (`BUILTIN_MOUNTING_HARDWARE_CATALOG`) is just a
 * set of generic presets expressed in this exact shape, so a user can add or
 * override hardware with data alone (no code change):
 *
 *   <enclosure mountingHardwareCatalog={myCatalog} anchor="my-m3-heatset-stack" />
 *
 * Two concerns are kept separate on purpose:
 *  - **geometry** — the printed boss/bore/head-recess dimensions the CSG needs;
 *  - **BOM identity** — the purchasable part (display value + manufacturer /
 *    supplier part numbers) each physical piece maps to.
 *
 * The same "M3 clearance" geometry can map to many different purchasable screws,
 * so a real bill of materials requires the catalog to carry procurement data,
 * not just a thread size. Generic built-ins are flagged `generic: true`; a
 * `bomMode: "strict"` enclosure can reject them.
 */

/** A length in millimetres, or a unit string (`"4mm"`, `"0.1in"`, ...). */
export type LengthValue = number | string;

const mm = (v: LengthValue): number => toMm(v, Number.NaN);
const optMm = (v: LengthValue | undefined): number | undefined =>
	v == null ? undefined : mm(v);

/** Roles a physical hardware instance can play in a mounting stack. */
export type HardwareRole =
	| "screw"
	| "insert"
	| "washer"
	| "nut"
	| "spacer"
	| "bushing";

/** Procurement identity for one purchasable hardware item. */
export interface HardwareBomInfo {
	/** Human-readable BOM line, e.g. "M3 × 10mm socket head cap screw". */
	displayValue: string;
	manufacturerPartNumber?: string;
	supplierPartNumbers?: Record<string, string[]>;
	/**
	 * True for a generic placeholder with no real procurement identity (the
	 * built-in presets). `bomMode: "strict"` flags these so a production design
	 * must map them to a real part.
	 */
	generic?: boolean;
}

/** A through screw (drops through the lid + column into the boss bore). */
export interface ScrewSpec {
	kind?: "screw";
	/** Nominal thread, e.g. "M3" (informational / grouping). */
	thread?: string;
	/** Clearance hole for the screw shank through the lid/column. */
	clearanceHoleDiameterMm: LengthValue;
	/** Clearance hole expected in the PCB (defaults to the shank clearance). */
	pcbClearanceHoleDiameterMm?: LengthValue;
	/** Head Ø — sizes the counterbore Ø / countersink sharp Ø. */
	headDiameterMm: LengthValue;
	/** Head height ≈ counterbore recess depth. */
	headHeightMm?: LengthValue;
	/** Pilot Ø when this screw self-taps straight into printed plastic. */
	selfTapPilotDiameterMm?: LengthValue;
	bom: HardwareBomInfo;
}

/** A threaded insert pressed / heat-staked into a printed boss. */
export interface InsertSpec {
	kind?: "insert";
	thread?: string;
	/** Nominal installation hole Ø in the printed boss. */
	installHoleDiameterMm: LengthValue;
	/** Insert length along the bore. */
	lengthMm: LengthValue;
	bom: HardwareBomInfo;
}

/** BOM-only hardware (washers / nuts) that ride along a mounting stack. */
export interface AccessorySpec {
	kind?: HardwareRole;
	thread?: string;
	bom: HardwareBomInfo;
}

/** How a mounting stack forms its PCB-supporting boss bore. */
export type BossSpec =
	| {
			type: "insert";
			/** Catalog key into `inserts`. */
			insert: string;
			/** Printed wall around the bore (defaults to `minInsertWallMm`). */
			wallThicknessMm?: LengthValue;
			/** Explicit boss OD (else derived: bore Ø + 2 × wall). */
			outerDiameterMm?: LengthValue;
	  }
	| {
			type: "self_tap";
			/** Boss OD (self-tap bosses aren't derivable from a simple rule). */
			outerDiameterMm: LengthValue;
			/** Pilot depth (defaults to `selfTapPilotDepthMm`). */
			pilotDepthMm?: LengthValue;
	  };

/** An extra per-mount BOM line beyond the screw + insert (washer, nut, ...). */
export interface StackBomRef {
	role: HardwareRole;
	/** `washers` / `nuts` / ... catalog key. */
	ref: string;
	/** Instances per mount (default 1). */
	quantity?: number;
}

/**
 * A complete PCB-fastening recipe: how the printed boss is bored, which screw
 * drops in, and any extra hardware (washers/nuts) that ships with it.
 */
export interface MountingStackSpec {
	description?: string;
	boss: BossSpec;
	/** Catalog key into `screws`. */
	screw: string;
	extraBom?: StackBomRef[];
}

export interface MountingHardwareCatalog {
	screws?: Record<string, ScrewSpec>;
	inserts?: Record<string, InsertSpec>;
	washers?: Record<string, AccessorySpec>;
	nuts?: Record<string, AccessorySpec>;
	spacers?: Record<string, AccessorySpec>;
	bushings?: Record<string, AccessorySpec>;
	mountingStacks?: Record<string, MountingStackSpec>;
}

/** A catalog key (into `mountingStacks`) or an inline stack spec. */
export type MountingStackRef = string;

// --- built-in generic presets (data, not special-cased code) -----------------

const GENERIC = (displayValue: string): HardwareBomInfo => ({
	displayValue,
	generic: true,
});

const socketCap = (
	thread: string,
	dims: {
		clearance: number;
		pcb: number;
		head: number;
		headHeight: number;
		pilot: number;
	},
): ScrewSpec => ({
	thread,
	clearanceHoleDiameterMm: dims.clearance,
	pcbClearanceHoleDiameterMm: dims.pcb,
	headDiameterMm: dims.head, // DIN 912 dk + seat / DIN 965 sharp Ø
	headHeightMm: dims.headHeight,
	selfTapPilotDiameterMm: dims.pilot,
	bom: GENERIC(`Generic ${thread} socket head cap screw`),
});

const flatHead = (
	thread: string,
	dims: {
		clearance: number;
		pcb: number;
		head: number;
		headHeight: number;
		pilot: number;
	},
): ScrewSpec => ({
	thread,
	clearanceHoleDiameterMm: dims.clearance,
	pcbClearanceHoleDiameterMm: dims.pcb,
	headDiameterMm: dims.head,
	headHeightMm: dims.headHeight,
	selfTapPilotDiameterMm: dims.pilot,
	bom: GENERIC(`Generic ${thread} flat head countersunk screw`),
});

export const BUILTIN_MOUNTING_HARDWARE_CATALOG: MountingHardwareCatalog = {
	screws: {
		"m2-flat-head": flatHead("M2", {
			clearance: 2.4,
			pcb: 2.2,
			head: 4,
			headHeight: 1.2,
			pilot: 1.6,
		}),
		"m2.5-flat-head": flatHead("M2.5", {
			clearance: 2.9,
			pcb: 2.7,
			head: 5,
			headHeight: 1.5,
			pilot: 2.1,
		}),
		"m3-flat-head": flatHead("M3", {
			clearance: 3.4,
			pcb: 3.2,
			head: 6,
			headHeight: 1.7,
			pilot: 2.5,
		}),
		"m2-socket-cap": socketCap("M2", {
			clearance: 2.4,
			pcb: 2.2,
			head: 4.4,
			headHeight: 2,
			pilot: 1.6,
		}),
		"m2.5-socket-cap": socketCap("M2.5", {
			clearance: 2.9,
			pcb: 2.7,
			head: 5.5,
			headHeight: 2.5,
			pilot: 2.1,
		}),
		"m3-socket-cap": socketCap("M3", {
			clearance: 3.4,
			pcb: 3.2,
			head: 6.5,
			headHeight: 3,
			pilot: 2.5,
		}),
	},
	inserts: {
		// short M3 heat-set insert: L 3.0, nominal installation hole Ø4.0 (e.g.
		// Ruthex / CNC-Kitchen short series) — the long 5.7mm insert does not fit
		// the default 4mm standoff + 2mm floor stack.
		"m3-heat-set-short": {
			thread: "M3",
			installHoleDiameterMm: 4.0,
			lengthMm: 3.0,
			bom: GENERIC("Generic M3 short heat-set insert"),
		},
		// M3 straight-knurl press-fit insert, OD ~4.0: 0.2mm interference hole.
		"m3-press-fit": {
			thread: "M3",
			installHoleDiameterMm: 3.8,
			lengthMm: 4.0,
			bom: GENERIC("Generic M3 press-fit insert"),
		},
	},
	mountingStacks: {
		"m3-heat-set": {
			description: "M3 heat-set insert in the floor boss (FDM default)",
			boss: { type: "insert", insert: "m3-heat-set-short" },
			screw: "m3-flat-head",
		},
		"m3-press-fit": {
			description: "M3 press-fit insert in the floor boss",
			boss: { type: "insert", insert: "m3-press-fit", outerDiameterMm: 8 },
			screw: "m3-flat-head",
		},
		"m3-self-tap": {
			description: "M3 screw self-tapping into a printed boss",
			boss: { type: "self_tap", outerDiameterMm: 6.5 },
			screw: "m3-flat-head",
		},
		"m2.5-self-tap": {
			description: "M2.5 screw self-tapping into a printed boss",
			boss: { type: "self_tap", outerDiameterMm: 5.5 },
			screw: "m2.5-flat-head",
		},
		"m2-self-tap": {
			description: "M2 screw self-tapping into a printed boss",
			boss: { type: "self_tap", outerDiameterMm: 4.5 },
			screw: "m2-flat-head",
		},
	},
};

/** Merge a user catalog over a base catalog (per-category, per-key override). */
export const mergeMountingHardwareCatalog = (
	base: MountingHardwareCatalog,
	override?: MountingHardwareCatalog,
): MountingHardwareCatalog => {
	if (!override) return base;
	const categories: Array<keyof MountingHardwareCatalog> = [
		"screws",
		"inserts",
		"washers",
		"nuts",
		"spacers",
		"bushings",
		"mountingStacks",
	];
	const out: MountingHardwareCatalog = {};
	for (const c of categories) {
		const merged = { ...(base[c] as any), ...(override[c] as any) };
		if (Object.keys(merged).length) (out as any)[c] = merged;
	}
	return out;
};

// --- resolution --------------------------------------------------------------

/** Printed-boss geometry the CSG needs, all resolved to millimetres. */
export interface ResolvedMountingGeometry {
	bossOuterDiameterMm: number;
	/** Hole bored into the boss from the PCB side (insert hole / self-tap pilot). */
	bossBoreDiameterMm: number;
	bossBoreDepthMm: number;
	boreType: "insert" | "self_tap";
	/** Clearance hole for the through screw. */
	screwClearanceDiameterMm: number;
	/** Clearance hole expected in the PCB. */
	pcbHoleDiameterMm: number;
	/** Head Ø for the lid counterbore / countersink. */
	headDiameterMm: number;
	/** Counterbore recess depth. */
	counterboreDepthMm: number;
}

/** One physical hardware piece required by a resolved mounting stack. */
export interface ResolvedHardwareBomItem {
	role: HardwareRole;
	/** Catalog key the item resolved from. */
	ref: string;
	/** Instances required per mount. */
	quantityPerMount: number;
	displayValue: string;
	manufacturerPartNumber?: string;
	supplierPartNumbers?: Record<string, string[]>;
	generic: boolean;
	/** Stable key for BOM aggregation (identical parts share it). */
	bomGroupKey: string;
}

/** A fully resolved mounting stack: geometry + the hardware it consumes. */
export interface ResolvedMountingHardware {
	stackRef: string;
	geometry: ResolvedMountingGeometry;
	bomItems: ResolvedHardwareBomItem[];
	/** True if any consumed item is generic (no procurement identity). */
	generic: boolean;
}

const bomGroupKey = (role: HardwareRole, ref: string, bom: HardwareBomInfo) =>
	bom.manufacturerPartNumber
		? `mpn:${bom.manufacturerPartNumber}`
		: `generic:${role}:${ref}`;

const bomItemFrom = (
	role: HardwareRole,
	ref: string,
	bom: HardwareBomInfo,
	quantityPerMount: number,
): ResolvedHardwareBomItem => ({
	role,
	ref,
	quantityPerMount,
	displayValue: bom.displayValue,
	manufacturerPartNumber: bom.manufacturerPartNumber,
	supplierPartNumbers: bom.supplierPartNumbers,
	generic: bom.generic ?? false,
	bomGroupKey: bomGroupKey(role, ref, bom),
});

const need = <T>(value: T | undefined, label: string): NonNullable<T> => {
	if (value == null)
		throw new Error(`[pcb-enclosure] hardware catalog is missing ${label}`);
	return value as NonNullable<T>;
};

/**
 * Resolve a mounting-stack reference (catalog key or inline spec) against a
 * catalog into printed-boss geometry + the hardware BOM it consumes.
 */
export const resolveMountingHardware = (
	anchor: MountingStackRef | MountingStackSpec,
	catalog: MountingHardwareCatalog = BUILTIN_MOUNTING_HARDWARE_CATALOG,
	rules: DesignRules = DEFAULT_DESIGN_RULES,
): ResolvedMountingHardware => {
	const stackRef = typeof anchor === "string" ? anchor : "(inline)";
	const stack: MountingStackSpec =
		typeof anchor === "string"
			? need(catalog.mountingStacks?.[anchor], `mounting stack "${anchor}"`)
			: anchor;

	const screw = need(catalog.screws?.[stack.screw], `screw "${stack.screw}"`);
	const screwClearanceDiameterMm = mm(screw.clearanceHoleDiameterMm);
	const pcbHoleDiameterMm =
		optMm(screw.pcbClearanceHoleDiameterMm) ?? screwClearanceDiameterMm;
	const headDiameterMm = mm(screw.headDiameterMm);
	const counterboreDepthMm = optMm(screw.headHeightMm) ?? headDiameterMm / 2;

	let bossOuterDiameterMm: number;
	let bossBoreDiameterMm: number;
	let bossBoreDepthMm: number;
	let boreType: "insert" | "self_tap";

	const bomItems: ResolvedHardwareBomItem[] = [];

	if (stack.boss.type === "insert") {
		const insert = need(
			catalog.inserts?.[stack.boss.insert],
			`insert "${stack.boss.insert}"`,
		);
		boreType = "insert";
		bossBoreDiameterMm = mm(insert.installHoleDiameterMm);
		bossBoreDepthMm = mm(insert.lengthMm) + rules.fastener.insertMeltReliefMm;
		const wall =
			optMm(stack.boss.wallThicknessMm) ?? rules.fastener.minInsertWallMm;
		bossOuterDiameterMm =
			optMm(stack.boss.outerDiameterMm) ?? bossBoreDiameterMm + 2 * wall;
		bomItems.push(bomItemFrom("insert", stack.boss.insert, insert.bom, 1));
	} else {
		boreType = "self_tap";
		bossBoreDiameterMm = mm(
			need(
				screw.selfTapPilotDiameterMm,
				`selfTapPilotDiameterMm on screw "${stack.screw}"`,
			),
		);
		bossBoreDepthMm =
			optMm(stack.boss.pilotDepthMm) ?? rules.fastener.selfTapPilotDepthMm;
		bossOuterDiameterMm = mm(stack.boss.outerDiameterMm);
	}

	// the through screw is always consumed
	bomItems.push(bomItemFrom("screw", stack.screw, screw.bom, 1));

	for (const extra of stack.extraBom ?? []) {
		const table = (catalog as any)[`${extra.role}s`] as
			| Record<string, AccessorySpec>
			| undefined;
		const item = need(table?.[extra.ref], `${extra.role} "${extra.ref}"`);
		bomItems.push(
			bomItemFrom(extra.role, extra.ref, item.bom, extra.quantity ?? 1),
		);
	}

	return {
		stackRef,
		geometry: {
			bossOuterDiameterMm,
			bossBoreDiameterMm,
			bossBoreDepthMm,
			boreType,
			screwClearanceDiameterMm,
			pcbHoleDiameterMm,
			headDiameterMm,
			counterboreDepthMm,
		},
		bomItems,
		generic: bomItems.some((b) => b.generic),
	};
};

/** One emitted BOM line instance (one physical piece) for the enclosure model. */
export interface HardwareBomItem {
	id: string;
	role: HardwareRole;
	displayValue: string;
	manufacturerPartNumber?: string;
	supplierPartNumbers?: Record<string, string[]>;
	generic: boolean;
	/** Identical pieces share this key so a BOM groups them by quantity. */
	bomGroupKey: string;
	/** The mount this piece belongs to (for debugging / traceability). */
	mountId?: string;
}

/**
 * Expand a resolved mounting stack into individual BOM line instances (one per
 * physical piece) for a single mount location.
 */
export const expandHardwareBom = (
	hardware: ResolvedMountingHardware,
	mountId: string,
): HardwareBomItem[] => {
	const out: HardwareBomItem[] = [];
	for (const item of hardware.bomItems) {
		for (let i = 0; i < item.quantityPerMount; i++) {
			out.push({
				id: `${mountId}:${item.role}:${item.ref}:${i}`,
				role: item.role,
				displayValue: item.displayValue,
				manufacturerPartNumber: item.manufacturerPartNumber,
				supplierPartNumbers: item.supplierPartNumbers,
				generic: item.generic,
				bomGroupKey: item.bomGroupKey,
				mountId,
			});
		}
	}
	return out;
};
