import { PrimitiveComponent } from "@tscircuit/core";
import { buildEnclosure } from "./build-enclosure";
import { checkEnclosureAssembly } from "./enclosure-drc";
import {
	type EnclosureProps,
	enclosureProps,
	resolveEnclosureParams,
} from "./enclosure-props";
import { extractEnclosureFeatures } from "./extract-features";
import { jscadPlan } from "./jscad-plan";
import { EnclosurePlacementSolver } from "./placement-solver";

/**
 * `<enclosure />` — an assembly-level tscircuit component (sibling to `<board />`).
 *
 * Runs in the CadModelRender phase, by which point the board is fully rendered
 * in `root.db`. It extracts the board's mounting features, places fasteners, and
 * builds the base + lid as **jscad-planner plans** — the same
 * `cad_component.model_jscad` form the tscircuit 3D viewer renders and the
 * runframe STL exporter serializes.
 *
 * This is the minimal, board-driven element: sizing + anchor + opt-in auto
 * cutouts, no child element vocabulary yet. Each part is emitted as a
 * `cad_component` tagged with `enclosure_part_id`, attached to a synthetic
 * mechanical source+pcb component.
 */
export class Enclosure extends PrimitiveComponent<typeof enclosureProps> {
	get config() {
		return { componentName: "Enclosure", zodProps: enclosureProps };
	}

	/**
	 * All board components in the tree (walked from the top; the selector engine
	 * isn't reliably available in the CAD render phase).
	 */
	private allBoards(): any[] {
		let top: any = this;
		while (top?.parent) top = top.parent;
		const boards: any[] = [];
		const walk = (n: any) => {
			if (!n) return;
			if (n.lowercaseComponentName === "board") boards.push(n);
			for (const c of n.children ?? []) walk(c);
		};
		walk(top);
		return boards;
	}

	/**
	 * The board this enclosure wraps: `boardRef` (a selector, e.g. ".B1") resolved
	 * via the selector engine when available, else matched by name against the
	 * board tree; the single/first board when `boardRef` is omitted. An explicit
	 * `boardRef` miss returns null (never silently encloses a different board).
	 */
	private resolveBoard(): any | null {
		const boardRef = (this._parsedProps as EnclosureProps).boardRef;
		const boards = this.allBoards();
		if (!boardRef) return boards[0] ?? null;
		const scope: any = this.root ?? this;
		try {
			const matched = scope?.selectOne?.(boardRef);
			if (matched?.lowercaseComponentName === "board") return matched;
		} catch {}
		const wantName = boardRef.replace(/^[.#]/, "");
		return boards.find((b) => b.name === wantName) ?? null;
	}

	/** Board-scope selector for feature extraction (see `ExtractOptions`). */
	private boardScopeFor(board: any): {
		pcbBoardId?: string;
		subcircuitId?: string;
	} {
		return {
			pcbBoardId: board?.pcb_board_id ?? undefined,
			subcircuitId: board?.subcircuit_id ?? undefined,
		};
	}

	private emitFatalPlacementError(message: string): void {
		(this.root as any)?.db?.pcb_placement_error.insert({
			error_type: "pcb_placement_error",
			is_fatal: true,
			message,
		} as any);
	}

	doInitialCadModelRender(): void {
		const root: any = this.root;
		if (!root || root.pcbDisabled) return;
		const db: any = root.db;
		const circuitJson = db.toArray();

		// no board (yet) → nothing to enclose. Checked explicitly so real
		// extraction bugs surface instead of being swallowed.
		if (!circuitJson.some((e: any) => e.type === "pcb_board")) return;

		const selectedBoard = this.resolveBoard();
		if (!selectedBoard) {
			const boardRef = (this._parsedProps as EnclosureProps).boardRef;
			if (boardRef)
				this.emitFatalPlacementError(
					`[enclosure] boardRef=${JSON.stringify(boardRef)} matched no board; not building enclosure.`,
				);
			return;
		}

		const features = extractEnclosureFeatures(
			circuitJson,
			this.boardScopeFor(selectedBoard),
		);
		const params = resolveEnclosureParams(this._parsedProps as EnclosureProps);

		// PCB mounting bosses go at the board's mounting holes; corners with no
		// hole get an external ear so the case still closes.
		const solver = new EnclosurePlacementSolver({
			obstacles: features.componentBodies.map((b) => ({
				id: b.id,
				cx: b.center.x,
				cy: b.center.y,
				w: b.lengthMm,
				h: b.widthMm,
			})),
			mountPoints: features.mountPoints.map((m) => ({
				center: m.center,
				pcbHoleDiameterMm: m.pcbHoleDiameterMm,
			})),
			boardBounds: features.bounds,
			anchor: params.anchor,
			mountingHardwareCatalog: params.mountingHardwareCatalog,
			designRules: params.designRules,
			clearanceMm: 1,
			cornerFasteners: true,
			cornerInsetMm: params.cornerStandoffInsetMm,
		});
		solver.solve();
		const placement = solver.getOutput();

		// Stash the resolved inputs so dev tooling can rebuild the enclosure in
		// mesh mode and run the exhaustive assembly DRC on exactly what we built.
		(this as any)._enclosureBuild = { features, placement, params };

		// build with jscad-planner → serializable model_jscad plans (auto cutouts
		// are opt-in via params.autoCutouts; no explicit children in this layer)
		const model = buildEnclosure(features, placement, params, [], jscadPlan);

		const name = (this._parsedProps as EnclosureProps).name ?? "EN1";

		// Build warnings (insert-hole clamped, boss collisions) surface as
		// non-fatal placement errors so `tsci dev` users see them.
		for (const w of model.warnings) {
			db.pcb_placement_error.insert({
				error_type: "pcb_placement_error",
				is_fatal: false,
				message: `[enclosure ${name}] warning: ${w}`,
			} as any);
		}

		// Assembly DRC: mesh-free collision + clearance check (the mesh boolean
		// version needs @jscad/modeling, unavailable in the eval worker). Flags a
		// component/PCB that overlaps — or nearly touches — a screw channel /
		// retention column, or a component in a wall, surfaced like board DRC.
		for (const cf of checkEnclosureAssembly(model, features)) {
			const subject =
				cf.against === "PCB" ? "The PCB" : `Component ${cf.against}`;
			let what: string;
			if (cf.severity === "tight")
				what = `has only ${cf.clearanceMm.toFixed(2)}mm clearance to the ${cf.feature} (min 0.5mm) — too tight to assemble reliably`;
			else if (cf.feature === "enclosure wall")
				what = `sits in the enclosure wall (${(-cf.clearanceMm).toFixed(1)}mm past the cavity)`;
			else
				what = `collides with the ${cf.feature} (${(-cf.clearanceMm).toFixed(1)}mm overlap)`;
			db.pcb_placement_error.insert({
				error_type: "pcb_placement_error",
				is_fatal: cf.severity === "collision",
				message: `[enclosure ${name}] ${subject} ${what}. Move the part/mount, add clearance, or change retention.`,
			} as any);
		}

		const insertBomComponent = ({
			designator,
			displayValue,
			manufacturerPartNumber,
			supplierPartNumbers,
		}: {
			designator: string;
			displayValue: string;
			manufacturerPartNumber?: string;
			supplierPartNumbers?: Record<string, string[]>;
		}) => {
			const source = db.source_component.insert({
				name: designator,
				ftype: "simple_chip",
				display_value: displayValue,
				manufacturer_part_number: manufacturerPartNumber,
				supplier_part_numbers: supplierPartNumbers,
			} as any);
			const pcb = db.pcb_component.insert({
				source_component_id: source.source_component_id,
				center: features.boardCenter,
				width: 0,
				height: 0,
				rotation: 0,
				layer: "top",
			} as any);
			return {
				sourceComponentId: source.source_component_id,
				pcbComponentId: pcb.pcb_component_id,
			};
		};

		// align the model's board plane (z = boardBottomZ in the model) to z = 0
		const z0 = -(model.pcb.boardBottomZ + features.boardThicknessMm / 2);
		const position = {
			x: features.boardCenter.x,
			y: features.boardCenter.y,
			z: z0,
		};
		const partLabel = (id: string) =>
			id
				.split("_")
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(" ");
		for (const part of model.parts) {
			const assemblyLabel =
				part.id === "base" ? "BOTTOM" : part.id === "lid" ? "TOP" : part.id;
			const bomComponent = insertBomComponent({
				designator: `${name}_${assemblyLabel.toUpperCase()}`,
				displayValue: `FDM enclosure ${partLabel(part.id).toLowerCase()}`,
			});
			db.cad_component.insert({
				source_component_id: bomComponent.sourceComponentId,
				pcb_component_id: bomComponent.pcbComponentId,
				position,
				rotation: { x: 0, y: 0, z: 0 },
				model_jscad: part.geom,
				// Tag as a controllable enclosure part so the 3D viewer lists it
				// (Board + each part, own opacity) and runframe can export its STL.
				name: `${name} ${partLabel(part.id)}`,
				enclosure_part_id: part.id,
				enclosure_explode_z_offset_mm: part.explodeZOffsetMm ?? 0,
			} as any);
		}

		const hardwareGroups = new Map<
			string,
			{ item: (typeof model.bomItems)[number]; quantity: number }
		>();
		for (const item of model.bomItems) {
			const group = hardwareGroups.get(item.bomGroupKey);
			if (group) group.quantity += 1;
			else hardwareGroups.set(item.bomGroupKey, { item, quantity: 1 });
		}

		const roleLabel = (role: (typeof model.bomItems)[number]["role"]) => {
			if (role === "insert" || role === "bushing") return "BUSHINGS";
			if (role === "screw") return "SCREWS";
			if (role === "washer") return "WASHERS";
			if (role === "nut") return "NUTS";
			if (role === "spacer") return "SPACERS";
			return "HARDWARE";
		};
		const roleOccurrences = new Map<string, number>();
		for (const { item, quantity } of hardwareGroups.values()) {
			const label = roleLabel(item.role);
			const occurrence = (roleOccurrences.get(label) ?? 0) + 1;
			roleOccurrences.set(label, occurrence);
			const suffix = occurrence > 1 ? `_${occurrence}` : "";
			const bomComponent = insertBomComponent({
				designator: `${name}_${label}${suffix}_X${quantity}`,
				displayValue: `${quantity}x ${item.displayValue}`,
				manufacturerPartNumber: item.manufacturerPartNumber,
				supplierPartNumbers: item.supplierPartNumbers,
			});
			const hardwareInstances = model.hardware.filter(
				(instance) => instance.bomGroupKey === item.bomGroupKey,
			);
			for (const [index, instance] of hardwareInstances.entries()) {
				db.cad_component.insert({
					source_component_id: bomComponent.sourceComponentId,
					pcb_component_id: bomComponent.pcbComponentId,
					position,
					rotation: { x: 0, y: 0, z: 0 },
					model_jscad: instance.geom,
					name: `${name} ${partLabel(instance.role)} ${index + 1}`,
					enclosure_hardware_role: instance.role,
					enclosure_explode_z_offset_mm: instance.explodeZOffsetMm,
				} as any);
			}
		}
	}
}
