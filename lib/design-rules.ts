/**
 * Externalized design rules: every manufacturing tolerance, fit clearance, and
 * heuristic threshold the generator uses, in one coherent, swappable interface.
 *
 * These are *rules of the craft*, not user-facing parameters — a designer tunes
 * `wallThickness` on `<enclosure.fdm.box>`; a process engineer tunes `slidingFitMm`
 * here. The rules are **injected** (passed in), never imported at the point of
 * use, so a future per-process profile (FDM vs SLS vs molded) can swap the whole
 * `DesignRules` set. `DEFAULT_DESIGN_RULES` is the FDM-tuned default every
 * entry point falls back to when nothing is injected.
 *
 * All values are millimetres unless noted.
 */
export interface DesignRules {
	fit: {
		/**
		 * Clearance for parts that must slide/nest by hand: the lid lip into the
		 * base opening, the PCB edge into a card-guide slot. Tuned for FDM
		 * (typical XY over-extrusion ~0.1–0.15 per side).
		 */
		slidingFitMm: number;
	};
	cutout: {
		/** Slack added on every side of an opening when the design gives none. */
		defaultMarginMm: number;
		/**
		 * Auto-cutout gate: an edge-mount connector only gets an automatic wall
		 * opening when its center is within this distance of a board edge.
		 */
		autoMaxEdgeDistanceMm: number;
	};
	fastener: {
		/**
		 * Minimum printed wall around a pressed/heat-set insert hole. Below ~2mm
		 * the boss bulges or splits during insert installation. A derived boss OD
		 * satisfies (bossOD - boreD) / 2 >= this.
		 */
		minInsertWallMm: number;
		/**
		 * Extra hole depth below a heat-set insert: displaced melt needs somewhere
		 * to go and the screw tip must not bottom out.
		 */
		insertMeltReliefMm: number;
		/** Default pilot-hole depth for a screw self-tapping into a printed boss. */
		selfTapPilotDepthMm: number;
		/**
		 * Minimum material between the bottom of a boss bore and the outer floor
		 * face, so the hole never breaks through.
		 */
		minFloorUnderBoreMm: number;
		/** External corner-ear tab size = boss OD + this pad on each side. */
		earPadMm: number;
		/**
		 * A requested corner fastener counts as "already covered" by a mounting
		 * hole when a hole sits within `postRadius × this` of the corner target
		 * (so the two features would merge rather than each get their own boss).
		 */
		cornerCoverageRadiusFactor: number;
	};
	drc: {
		/** Below this gap to a screw channel / column, assembly is unreliable. */
		minClearanceMm: number;
		/**
		 * Axial overlap under this is a face-to-face touch (a column resting on
		 * the PCB top), not an intrusion — the classic false positive.
		 */
		touchToleranceMm: number;
		/** A body must poke past the cavity by more than this to flag a wall hit. */
		containmentSlopMm: number;
	};
	component: {
		/**
		 * Default projection of through-hole leads/solder tails past the far PCB
		 * surface — the IPC-A-610 **Class 2** maximum lead protrusion. A
		 * high-reliability **Class 3** build is ~1.5mm; a taller far-side feature
		 * (keyswitch clips) is set per-part via `ExtractOptions.overrides`.
		 */
		throughHoleLeadProjectionMm: number;
	};
	/** Headroom kept above the tallest top-side component when unconstrained. */
	headroomOverTallestMm: number;
	/** Overshoot added to subtracted tools so booleans never leave zero-thickness skins. */
	cutOvershootMm: number;
}

/** FDM-tuned default rule set (injected wherever nothing else is supplied). */
export const DEFAULT_DESIGN_RULES: DesignRules = {
	fit: { slidingFitMm: 0.3 },
	cutout: { defaultMarginMm: 0.5, autoMaxEdgeDistanceMm: 8 },
	fastener: {
		minInsertWallMm: 2.0,
		insertMeltReliefMm: 1.0,
		selfTapPilotDepthMm: 6,
		minFloorUnderBoreMm: 0.8,
		earPadMm: 2,
		cornerCoverageRadiusFactor: 2,
	},
	drc: { minClearanceMm: 0.5, touchToleranceMm: 0.05, containmentSlopMm: 0.3 },
	component: { throughHoleLeadProjectionMm: 2.5 },
	headroomOverTallestMm: 2,
	cutOvershootMm: 0.2,
};
