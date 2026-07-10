import { expect, test } from "bun:test";
import { resolveCutouts } from "../lib/cutouts";
import { DEFAULT_DESIGN_RULES, type DesignRules } from "../lib/design-rules";
import {
	BUILTIN_MOUNTING_HARDWARE_CATALOG,
	resolveMountingHardware,
} from "../lib/mounting-hardware-catalog";
import { EnclosurePlacementSolver } from "../lib/placement-solver";
import type { ComponentBody, EnclosureFeatures } from "../lib/types";

const withRules = (patch: (r: DesignRules) => DesignRules): DesignRules =>
	patch(structuredClone(DEFAULT_DESIGN_RULES));

test("injected rules change derived mounting-boss geometry (minInsertWall)", () => {
	const stiff = withRules((r) => {
		r.fastener.minInsertWallMm = 3;
		return r;
	});
	const hw = resolveMountingHardware(
		"m3-heat-set",
		BUILTIN_MOUNTING_HARDWARE_CATALOG,
		stiff,
	);
	// insert install-hole 4.0 + 2 × 3.0 wall (was 4.0 + 2 × 2.0 = 8)
	expect(hw.geometry.bossOuterDiameterMm).toBeCloseTo(10);
});

const features = (bodies: ComponentBody[]): EnclosureFeatures => ({
	outline: [
		{ x: -30, y: -20 },
		{ x: 30, y: -20 },
		{ x: 30, y: 20 },
		{ x: -30, y: 20 },
	],
	bounds: { minX: -30, minY: -20, maxX: 30, maxY: 20 },
	boardThicknessMm: 1.6,
	boardCenter: { x: 0, y: 0 },
	mountPoints: [],
	componentBodies: bodies,
	topComponentHeightMm: 5,
	bottomComponentHeightMm: 0,
});

test("injected rules gate auto cutouts (autoMaxEdgeDistanceMm)", () => {
	const conn: ComponentBody = {
		id: "J1",
		center: { x: 18, y: 0 }, // body edge is 10mm from the +x edge
		lengthMm: 4,
		widthMm: 6,
		heightMm: 5,
		ftype: "simple_connector",
		insertionDirection: "from_right",
	};
	// default reach is 8mm → the body remains unreachable → no auto cutout
	expect(
		resolveCutouts(features([conn]), [], { autoCutouts: true }),
	).toHaveLength(0);
	// relax the reach to 12mm → now it opens a wall
	const relaxed = withRules((r) => {
		r.cutout.autoMaxEdgeDistanceMm = 12;
		return r;
	});
	expect(
		resolveCutouts(features([conn]), [], {
			autoCutouts: true,
			designRules: relaxed,
		}),
	).toHaveLength(1);
});

const cornerSolver = (factor?: number) => {
	const s = new EnclosurePlacementSolver({
		obstacles: [],
		mountPoints: [{ center: { x: 11, y: 7 } }], // 6mm from the (17,7) corner
		boardBounds: { minX: -20, minY: -10, maxX: 20, maxY: 10 },
		anchor: "m3-heat-set", // boss OD 8 → post radius 4
		clearanceMm: 1,
		cornerFasteners: true,
		cornerInsetMm: 3,
		designRules:
			factor == null
				? undefined
				: withRules((r) => {
						r.fastener.cornerCoverageRadiusFactor = factor;
						return r;
					}),
	});
	s.solve();
	return s.getOutput();
};

test("injected rules decide corner coverage (cornerCoverageRadiusFactor)", () => {
	// default factor 2 → coverage radius 8 > 6 → that corner is covered (3 ears)
	expect(cornerSolver().bosses).toHaveLength(3);
	// tighter factor 1 → coverage radius 4 < 6 → not covered (4 ears)
	expect(cornerSolver(1).bosses).toHaveLength(4);
});

test("injected rules also change placement post radius", () => {
	const stiff = withRules((r) => {
		r.fastener.minInsertWallMm = 3;
		return r;
	});
	const s = new EnclosurePlacementSolver({
		obstacles: [],
		mountPoints: [{ center: { x: 0, y: 0 } }],
		boardBounds: { minX: -10, minY: -10, maxX: 10, maxY: 10 },
		anchor: "m3-heat-set",
		clearanceMm: 1,
		cornerFasteners: false,
		cornerInsetMm: 3,
		designRules: stiff,
	});
	s.solve();
	// insert install-hole 4.0 + 2 × 3.0 wall = 10mm OD → 5mm radius
	expect(s.getOutput().posts[0].radiusMm).toBeCloseTo(5);
});
