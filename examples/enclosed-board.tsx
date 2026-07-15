import { enclosure } from "../lib/index";

/**
 * A board that grows its own case: drop an `<enclosure.fdm.box />` beside the
 * `<board />` and `tsci dev` / the GUI renders a base + lid.
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

		<enclosure.fdm.box
			name="EN1"
			boardRef=".B1"
			wallThickness="2mm"
			standoffHeight="4mm"
			autoCutouts
		/>
	</group>
);
