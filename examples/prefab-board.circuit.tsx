import { assembly, enclosure } from "../lib/index";
import { Dc0055a20Smt } from "./parts/dc-005-5a-2-0-smt";
import { MicroXnj } from "./parts/micro-xnj";
import { Pj320d } from "./parts/pj-320d";
import { SmaKwe } from "./parts/sma-kwe";
import { TypeC14pCc26 } from "./parts/type-c-14p-cc-2-6";
import { UsbAfSide } from "./parts/usb-af-side";
import { UsbTypeC018 } from "./parts/usb-type-c-018";
import { boardHeightMm, boardWidthMm, PrefabBoard } from "./prefab-board";

export default () => (
	<assembly.device name="prefab-board-enclosure">
		<PrefabBoard>
			<UsbTypeC018 name="J1" pcbX={-18} pcbY={-boardHeightMm / 2 + 5} />
			<TypeC14pCc26
				name="J2"
				pcbX={boardWidthMm / 2 - 7.5}
				pcbY={-12}
				pcbRotation={90}
			/>
			<MicroXnj
				name="J3"
				pcbX={-18}
				pcbY={boardHeightMm / 2 - 5}
				pcbRotation={180}
			/>
			<UsbAfSide name="J4" pcbX={15} pcbY={boardHeightMm / 2 - 13} />
			<Dc0055a20Smt
				name="J5"
				pcbX={boardWidthMm / 2 - 5.3}
				pcbY={10}
				pcbRotation={180}
			/>
			<Pj320d
				name="J6"
				pcbX={10}
				pcbY={-boardHeightMm / 2 + 7}
				pcbRotation={90}
			/>
			<SmaKwe name="J7" pcbX={-boardWidthMm / 2 + 4} pcbY={-12} />
		</PrefabBoard>
		<enclosure.fdm.box name="EN1" boardRef=".B1" autoCutouts />
	</assembly.device>
);
