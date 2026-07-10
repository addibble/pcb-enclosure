// Registers the <enclosure /> tag with the tscircuit reconciler (side effect).
import "pcb-enclosure/register";

/**
 * A board that grows its own case: drop an `<enclosure />` beside the `<board />`
 * (referencing it with `boardRef`) and `tsci dev` / the GUI renders a base + lid
 * you can view in 3D and export to STL. Sizing is board-driven; `autoCutouts`
 * opens walls at edge connectors.
 */
export default () => (
	<group>
		<board name="B1" width="40mm" height="30mm">
			<hole pcbX={-16} pcbY={-11} diameter="2.2mm" />
			<hole pcbX={16} pcbY={-11} diameter="2.2mm" />
			<hole pcbX={16} pcbY={11} diameter="2.2mm" />
			<hole pcbX={-16} pcbY={11} diameter="2.2mm" />
			<resistor name="R1" resistance="10k" footprint="0805" pcbX={0} pcbY={0} />
		</board>

		<enclosure
			name="EN1"
			boardRef=".B1"
			wallThickness="2mm"
			standoffHeight="4mm"
			autoCutouts
		/>
	</group>
);
