import type {} from "@tscircuit/core";
import type { ReactNode } from "react";

/**
 * Example board adapted from tscircuit runframe example35-prefabricated-board:
 * a 75x55mm board with 5 corner mounting holes (no ports -> mechanical mounts).
 *
 * Used to test the mounting-hole / standoff path of the enclosure generator.
 */
export const boardWidthMm = 75;
export const boardHeightMm = 55;

export const PrefabBoard = ({ children }: { children?: ReactNode }) => (
	<board
		name="B1"
		width={`${boardWidthMm}mm`}
		height={`${boardHeightMm}mm`}
		borderRadius="2mm"
		routingDisabled
	>
		{/* M3 clearance holes become PCB-supporting heat-set bosses. */}
		<hole
			pcbX={boardWidthMm / 2 - 2.5}
			pcbY={boardHeightMm / 2 - 2.5}
			diameter="3.2mm"
		/>
		<hole
			pcbX={boardWidthMm / 2 - 2.5}
			pcbY={-boardHeightMm / 2 + 2.5}
			diameter="3.2mm"
		/>
		<hole
			pcbX={-boardWidthMm / 2 + 2.5}
			pcbY={-boardHeightMm / 2 + 2.5}
			diameter="3.2mm"
		/>
		<hole
			pcbX={-boardWidthMm / 2 + 2.5}
			pcbY={boardHeightMm / 2 - 2.5}
			diameter="3.2mm"
		/>
		<hole pcbX={0} pcbY={boardHeightMm / 2 - 2.5} diameter="3.2mm" />

		{children}
	</board>
);
