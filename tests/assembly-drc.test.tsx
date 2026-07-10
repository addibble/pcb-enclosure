import { expect, test } from "bun:test";
import { checkEnclosureAssembly } from "../lib/enclosure-drc";

const baseModel = () =>
	({
		parts: [{ id: "base" }, { id: "lid" }],
		warnings: [],
		meta: {},
		pcb: {
			center: { x: 0, y: 0 },
			boardBottomZ: 10,
			thicknessMm: 1.4,
			outline: [],
		},
	}) as any;

const feats = (bodies: any[]) =>
	({
		bounds: { minX: -30, maxX: 30, minY: -20, maxY: 20 },
		componentBodies: bodies,
	}) as any;

const body = (id: string, x: number, y: number, heightMm: number) => ({
	id,
	center: { x, y },
	lengthMm: 4,
	widthMm: 4,
	heightMm,
});

// A screw channel running along x at cross-section (y=15, z=25).
const channel = {
	kind: "corner screw channel",
	partId: "base",
	axis: "x",
	center: [0, 15, 25],
	radiusMm: 3,
	lengthMm: 60,
};

test("assembly DRC: overlap is a collision, near-miss is tight, far is clean", () => {
	const model = { ...baseModel(), obstacles: [channel] };

	// tall body reaching into the channel -> hard collision
	const hit = checkEnclosureAssembly(model, feats([body("HIT", 0, 14, 16)]));
	expect(hit).toHaveLength(1);
	expect(hit[0].against).toBe("HIT");
	expect(hit[0].severity).toBe("collision");
	expect(hit[0].clearanceMm).toBeLessThan(0);

	// body ~0.3mm from the channel surface -> tight-clearance warning
	const near = checkEnclosureAssembly(model, feats([body("NEAR", 0, 9.7, 16)]));
	expect(near[0]?.against).toBe("NEAR");
	expect(near[0]?.severity).toBe("tight");
	expect(near[0]?.clearanceMm).toBeGreaterThan(0);
	expect(near[0]?.clearanceMm).toBeLessThan(0.5);

	// short body well clear of the channel -> nothing
	expect(
		checkEnclosureAssembly(model, feats([body("FAR", 0, 0, 2)])),
	).toHaveLength(0);
});

test("assembly DRC: a component in the wall, and a column resting on the PCB top", () => {
	// component pokes past the interior cavity -> a wall intrusion
	const wall = checkEnclosureAssembly(
		{
			...baseModel(),
			obstacles: [],
			interior: { min: [-30, -18, 2], max: [30, 18, 30] },
		},
		feats([body("EDGE", 0, 17, 2)]),
	);
	expect(wall[0]?.feature).toBe("enclosure wall");
	expect(wall[0]?.severity).toBe("collision");

	// a retention column standing on the PCB top touches it face-to-face: NOT a
	// collision (the classic false positive this check must avoid).
	const boardTop = 11.4;
	const column = {
		kind: "lid retention column",
		partId: "lid",
		axis: "z",
		center: [10, 0, boardTop + 5],
		radiusMm: 3,
		lengthMm: 10,
	};
	expect(
		checkEnclosureAssembly({ ...baseModel(), obstacles: [column] }, feats([])),
	).toHaveLength(0);
});

test("assembly DRC respects bottom-side bodies and z offsets", () => {
	const bottomHit = checkEnclosureAssembly(
		{
			...baseModel(),
			obstacles: [],
			interior: { min: [-30, -20, 8], max: [30, 20, 30] },
		},
		feats([{ ...body("BOT", 0, 0, 3), side: "bottom" }]),
	);
	expect(bottomHit[0]?.against).toBe("BOT");
	expect(bottomHit[0]?.feature).toBe("enclosure wall");

	const elevated = checkEnclosureAssembly(
		{
			...baseModel(),
			obstacles: [
				{
					kind: "screw channel",
					partId: "lid",
					axis: "x",
					center: [0, 0, 20],
					radiusMm: 3,
					lengthMm: 60,
				},
			],
		},
		feats([{ ...body("ZOFF", 0, 0, 2), zOffsetMm: 8 }]),
	);
	expect(elevated[0]?.against).toBe("ZOFF");
	expect(elevated[0]?.severity).toBe("collision");
});

test("assembly DRC checks box obstacles such as the lid lip", () => {
	const lip = {
		kind: "lid lip",
		partId: "lid",
		shape: "box" as const,
		center: [0, 18, 20] as [number, number, number],
		halfSizeMm: [20, 1, 2] as [number, number, number],
	};
	const hit = checkEnclosureAssembly(
		{ ...baseModel(), obstacles: [lip] },
		feats([body("EDGE_TALL", 0, 17, 10)]),
	);
	expect(hit[0]?.against).toBe("EDGE_TALL");
	expect(hit[0]?.feature).toBe("lid lip");
	expect(hit[0]?.severity).toBe("collision");
});

test("components with resolved cutouts may pass through the wall and lid lip", () => {
	const passThrough = body("PORT", 0, 17, 10);
	const conflicts = checkEnclosureAssembly(
		{
			...baseModel(),
			cutoutComponentIds: ["PORT"],
			interior: { min: [-30, -18, 2], max: [30, 18, 30] },
			obstacles: [
				{
					kind: "lid lip",
					partId: "lid",
					shape: "box",
					center: [0, 18, 20],
					halfSizeMm: [20, 1, 2],
				},
			],
		},
		feats([passThrough]),
	);
	expect(conflicts).toEqual([]);
});
