import type { CircuitJson } from "circuit-json";
import {
	buildEnclosure,
	type EnclosureModel,
	type MeasureBounds,
} from "./build-enclosure";
import { checkEnclosureAssembly, type AssemblyConflict } from "./enclosure-drc";
import {
	type EnclosureProps,
	enclosureProps,
	type ParsedEnclosureProps,
	resolveEnclosureParams,
} from "./enclosure-props";
import {
	extractEnclosureFeatures,
	type ExtractOptions,
} from "./extract-features";
import { jscadPlan } from "./jscad-plan";
import {
	type EnclosurePlacementOutput,
	EnclosurePlacementSolver,
} from "./placement-solver";
import type { EnclosureFeatures, EnclosureParams } from "./types";

type CircuitElement = CircuitJson[number];
type PcbBoardElement = Extract<CircuitElement, { type: "pcb_board" }> & {
	source_board_id?: string;
};

export interface EnclosureBoardScope {
	pcbBoardId: string;
	subcircuitId?: string;
}

const selectorName = (selector: string): string =>
	selector.replace(/^[.#]/, "");

export const resolveEnclosureBoardScope = (
	circuitJson: CircuitJson,
	boardRef: string,
): EnclosureBoardScope => {
	const name = selectorName(boardRef);
	const boards = circuitJson.filter(
		(element): element is PcbBoardElement => element.type === "pcb_board",
	);

	const directBoard = boards.find(
		(board) => board.pcb_board_id === boardRef || board.pcb_board_id === name,
	);
	if (directBoard) {
		return {
			pcbBoardId: directBoard.pcb_board_id,
			subcircuitId: directBoard.subcircuit_id,
		};
	}

	const sourceGroups = circuitJson.filter(
		(element): element is Extract<CircuitElement, { type: "source_group" }> =>
			element.type === "source_group",
	);
	const sourceBoards = circuitJson.filter(
		(element): element is Extract<CircuitElement, { type: "source_board" }> =>
			element.type === "source_board",
	);
	const sourceGroup = sourceGroups.find((group) => group.name === name);
	const sourceBoard = sourceBoards.find(
		(board) =>
			board.title === name ||
			(sourceGroup != null &&
				board.source_group_id === sourceGroup.source_group_id),
	);
	const board = sourceBoard
		? boards.find(
				(candidate) =>
					candidate.source_board_id === sourceBoard.source_board_id,
			)
		: undefined;
	if (!board) {
		throw new Error(
			`[pcb-enclosure] boardRef=${JSON.stringify(boardRef)} matched no pcb_board`,
		);
	}
	const group = sourceGroups.find(
		(candidate) => candidate.source_group_id === sourceBoard?.source_group_id,
	);
	return {
		pcbBoardId: board.pcb_board_id,
		subcircuitId: board.subcircuit_id ?? group?.subcircuit_id,
	};
};

export interface RenderEnclosureOptions {
	extract?: Omit<ExtractOptions, "pcbBoardId" | "subcircuitId">;
	jscad?: unknown;
	measureBounds?: MeasureBounds;
}

export interface RenderedEnclosure {
	name: string;
	props: ParsedEnclosureProps;
	params: EnclosureParams;
	features: EnclosureFeatures;
	placement: EnclosurePlacementOutput;
	model: EnclosureModel;
	conflicts: AssemblyConflict[];
}

export const renderEnclosureFromCircuitJson = (
	circuitJson: CircuitJson,
	rawProps: EnclosureProps,
	options: RenderEnclosureOptions = {},
): RenderedEnclosure => {
	const props = enclosureProps.parse(rawProps);
	const scope = resolveEnclosureBoardScope(circuitJson, props.boardRef);
	const features = extractEnclosureFeatures(circuitJson, {
		...options.extract,
		...scope,
	});
	const params = resolveEnclosureParams(props);
	const solver = new EnclosurePlacementSolver({
		obstacles: features.componentBodies.map((body) => ({
			id: body.id,
			cx: body.center.x,
			cy: body.center.y,
			w: body.lengthMm,
			h: body.widthMm,
		})),
		mountPoints: features.mountPoints.map((mount) => ({
			center: mount.center,
			pcbHoleDiameterMm: mount.pcbHoleDiameterMm,
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
	if (solver.failed) {
		throw new Error(
			`[pcb-enclosure] placement failed: ${solver.error ?? "unknown error"}`,
		);
	}
	const placement = solver.getOutput();
	const model = buildEnclosure(
		features,
		placement,
		params,
		[],
		options.jscad ?? jscadPlan,
		options.measureBounds ?? null,
	);
	return {
		name: props.name ?? "EN1",
		props,
		params,
		features,
		placement,
		model,
		conflicts: checkEnclosureAssembly(model, features),
	};
};
