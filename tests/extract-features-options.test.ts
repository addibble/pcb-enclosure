import { expect, test } from "bun:test";
import { DEFAULT_DESIGN_RULES } from "../lib/design-rules";
import { extractEnclosureFeatures } from "../lib/extract-features";

const smtPart = (ftype: string | undefined) => [
	{
		type: "pcb_board",
		center: { x: 0, y: 0 },
		width: 20,
		height: 10,
		thickness: 1.6,
	},
	{ type: "source_component", source_component_id: "s", name: "X1", ftype },
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
		x: -1,
		y: 0,
		width: 1,
		height: 1,
	},
	{
		type: "pcb_smtpad",
		shape: "rect",
		pcb_component_id: "c",
		x: 1,
		y: 0,
		width: 1,
		height: 1,
	},
];

const throughHolePart = () => [
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
		name: "J1",
		ftype: "simple_pin_header",
	},
	{
		type: "pcb_component",
		pcb_component_id: "c",
		source_component_id: "s",
		center: { x: 0, y: 0 },
		layer: "top",
	},
	{
		type: "pcb_plated_hole",
		shape: "circle",
		pcb_component_id: "c",
		pcb_port_id: "p1",
		outer_diameter: 1.6,
		hole_diameter: 1,
		x: 0,
		y: 0,
		layers: ["top", "bottom"],
	},
];

test("ftypeHeights extends/overrides the built-in body-height table", () => {
	const f = extractEnclosureFeatures(smtPart("simple_resistor"), {
		ftypeHeights: { simple_resistor: 5 },
	});
	expect(f.componentBodies[0].heightMm).toBe(5); // built-in 0.6 overridden
	expect(f.topComponentHeightMm).toBeCloseTo(5);
});

test("defaultBodyHeightMm overrides the fallback for unknown parts", () => {
	const f = extractEnclosureFeatures(smtPart(undefined), {
		defaultBodyHeightMm: 9,
	});
	expect(f.componentBodies[0].heightMm).toBe(9); // built-in default 3 overridden
});

test("through-hole lead projection comes from injected design rules", () => {
	// default: IPC Class 2 (2.5mm)
	expect(
		extractEnclosureFeatures(throughHolePart()).bottomComponentHeightMm,
	).toBeCloseTo(DEFAULT_DESIGN_RULES.component.throughHoleLeadProjectionMm);

	// inject Class 3 (high-reliability, 1.5mm)
	const class3 = structuredClone(DEFAULT_DESIGN_RULES);
	class3.component.throughHoleLeadProjectionMm = 1.5;
	expect(
		extractEnclosureFeatures(throughHolePart(), { designRules: class3 })
			.bottomComponentHeightMm,
	).toBeCloseTo(1.5);
});
