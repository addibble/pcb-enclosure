import { expect, test } from "bun:test";
import { extractEnclosureFeatures } from "../lib/extract-features";

/** A through-hole part: body above its side, leads/clips past the far surface. */
const throughHolePinHeader = (layer: "top" | "bottom") => [
	{
		type: "pcb_board",
		center: { x: 0, y: 0 },
		width: 30,
		height: 20,
		thickness: 1.6,
	},
	{
		type: "source_component",
		source_component_id: "src_j1",
		name: "J1",
		ftype: "simple_pin_header",
	},
	{
		type: "pcb_component",
		pcb_component_id: "pcb_j1",
		source_component_id: "src_j1",
		center: { x: 0, y: 0 },
		layer,
	},
	{
		type: "pcb_plated_hole",
		shape: "circle",
		pcb_component_id: "pcb_j1",
		pcb_port_id: "port_1",
		outer_diameter: 1.6,
		hole_diameter: 1,
		x: -1.27,
		y: 0,
		layers: ["top", "bottom"],
	},
	{
		type: "pcb_plated_hole",
		shape: "circle",
		pcb_component_id: "pcb_j1",
		pcb_port_id: "port_2",
		outer_diameter: 1.6,
		hole_diameter: 1,
		x: 1.27,
		y: 0,
		layers: ["top", "bottom"],
	},
];

test("a top-mounted through-hole part contributes to BOTH top and bottom height", () => {
	const f = extractEnclosureFeatures(throughHolePinHeader("top"));
	const body = f.componentBodies[0];

	expect(body.side).toBe("top");
	expect(body.heightMm).toBeCloseTo(8.5); // pin-header body above the board
	expect(body.farSideProjectionMm).toBeGreaterThan(0); // leads poke out the bottom

	expect(f.topComponentHeightMm).toBeCloseTo(8.5);
	expect(f.bottomComponentHeightMm).toBeCloseTo(body.farSideProjectionMm!);
});

test("a bottom-mounted through-hole part's far-side projection lands on top", () => {
	const f = extractEnclosureFeatures(throughHolePinHeader("bottom"));
	const body = f.componentBodies[0];

	expect(body.side).toBe("bottom");
	expect(f.bottomComponentHeightMm).toBeCloseTo(8.5); // body below the board
	expect(f.topComponentHeightMm).toBeCloseTo(body.farSideProjectionMm!); // leads up top
});

test("farSideProjection override models a non-lead feature (e.g. keyswitch clips)", () => {
	const f = extractEnclosureFeatures(throughHolePinHeader("top"), {
		overrides: { J1: { heightMm: 12, farSideProjectionMm: 4 } },
	});
	const body = f.componentBodies[0];

	expect(body.heightMm).toBe(12);
	expect(body.farSideProjectionMm).toBe(4);
	expect(f.topComponentHeightMm).toBeCloseTo(12);
	expect(f.bottomComponentHeightMm).toBeCloseTo(4);
});

test("a flat SMT part has no far-side projection", () => {
	const f = extractEnclosureFeatures([
		{
			type: "pcb_board",
			center: { x: 0, y: 0 },
			width: 20,
			height: 10,
			thickness: 1.6,
		},
		{
			type: "source_component",
			source_component_id: "s",
			name: "R1",
			ftype: "simple_resistor",
		},
		{
			type: "pcb_component",
			pcb_component_id: "c",
			source_component_id: "s",
			center: { x: 0, y: 0 },
			layer: "top",
		},
		{
			type: "pcb_smtpad",
			shape: "rect",
			pcb_component_id: "c",
			x: -0.8,
			y: 0,
			width: 1,
			height: 1,
		},
		{
			type: "pcb_smtpad",
			shape: "rect",
			pcb_component_id: "c",
			x: 0.8,
			y: 0,
			width: 1,
			height: 1,
		},
	]);
	expect(f.componentBodies[0].farSideProjectionMm).toBeUndefined();
	expect(f.bottomComponentHeightMm).toBe(0);
});
