import { Fragment, type ReactNode } from "react";
import { enclosure } from "../../lib/index";

const pinLabels = {
	pin1: ["VBUS"],
	pin2: ["D_NEG"],
	pin3: ["D_POS"],
	pin4: ["ID"],
	pin5: ["GND"],
	pin6: ["SH1"],
	pin7: ["SH2"],
	pin8: ["SH3"],
	pin9: ["SH4"],
} as const;

const signalPins = [
	["pin5", 1.299972],
	["pin4", 0.649986],
	["pin3", 0],
	["pin2", -0.649986],
	["pin1", -1.299972],
] as const;

const silkscreenRoutes = [
	[
		{ x: -2.9999432, y: -3.9225664 },
		{ x: -2.9999432, y: -4.4225654 },
		{ x: 3.090037, y: -4.4524358 },
		{ x: 3.1000192, y: -3.9225664 },
	],
	[
		{ x: 3.7900864, y: -2.9193426 },
		{ x: 3.7900864, y: -3.5117976 },
	],
	[
		{ x: 3.2737806, y: 1.1024934 },
		{ x: 3.7900864, y: 1.1024934 },
		{ x: 3.7900864, y: -0.6884098 },
	],
	[
		{ x: -3.7454586, y: -0.6809676 },
		{ x: -3.7454586, y: 1.1024934 },
		{ x: -3.2736028, y: 1.1024934 },
	],
	[
		{ x: -3.7454586, y: -3.5226942 },
		{ x: -3.7454586, y: -2.9266578 },
	],
	[
		{ x: -2.9999432, y: -3.9225664 },
		{ x: -3.4499042, y: -3.9424546 },
		{ x: -3.8699694, y: -4.4375768 },
		{ x: -3.7454586, y: -3.5226942 },
	],
	[
		{ x: -2.9999432, y: -3.9225664 },
		{ x: 3.1000192, y: -3.9225664 },
		{ x: 3.4000948, y: -3.9225664 },
		{ x: 3.9299896, y: -4.3974956 },
		{ x: 3.8000178, y: -3.5117976 },
	],
];

export interface MicroXnjProps {
	name: string;
	pcbX: number;
	pcbY: number;
	pcbRotation?: number;
	children?: ReactNode;
}

export const MicroXnj = ({
	name,
	pcbX,
	pcbY,
	pcbRotation,
	children,
}: MicroXnjProps) => (
	<connector
		name={name}
		manufacturerPartNumber="MicroXNJ"
		supplierPartNumbers={{ jlcpcb: ["C404969"] }}
		pinLabels={pinLabels}
		footprint={
			<footprint insertionDirection="from_front">
				<hole pcbX={-2.899918} pcbY={0.905612} diameter="0.7500118mm" />
				<hole pcbX={2.899918} pcbY={0.905612} diameter="0.7500118mm" />
				<platedhole
					portHints={["pin6"]}
					pcbX={2.424938}
					pcbY={0.869042}
					outerDiameter="1.2999974mm"
					holeDiameter="0.700024mm"
					shape="circle"
				/>
				<platedhole
					portHints={["pin9"]}
					pcbX={-2.424938}
					pcbY={0.869042}
					outerDiameter="1.2999974mm"
					holeDiameter="0.700024mm"
					shape="circle"
				/>
				<platedhole
					portHints={["pin8"]}
					pcbX={-3.624834}
					pcbY={-1.811166}
					holeWidth="0.700024mm"
					holeHeight="1.200023mm"
					outerWidth="1.2999974mm"
					outerHeight="1.7999964mm"
					shape="pill"
				/>
				<platedhole
					portHints={["pin7"]}
					pcbX={3.624834}
					pcbY={-1.811166}
					holeWidth="0.700024mm"
					holeHeight="1.200023mm"
					outerWidth="1.2999974mm"
					outerHeight="1.7999964mm"
					shape="pill"
				/>
				{signalPins.map(([pin, x]) => (
					<Fragment key={pin}>
						<smtpad
							portHints={[pin]}
							pcbX={x}
							pcbY={0.861168}
							width="0.3999992mm"
							height="1.999996mm"
							shape="rect"
						/>
					</Fragment>
				))}
				{silkscreenRoutes.map((route, index) => (
					<Fragment key={index}>
						<silkscreenpath route={route} />
					</Fragment>
				))}
			</footprint>
		}
		cadModel={{
			objUrl:
				"https://modelcdn.tscircuit.com/easyeda_models/download?uuid=a2b1a9114fe84000a47b1a073321bc87&pn=C404969",
			pcbRotationOffset: 0,
			modelOriginPosition: { x: 0, y: -1.03103, z: -1.829854 },
			size: { x: 8, y: 5.964184, z: 3.66 },
		}}
		allowOffBoard
		pcbX={pcbX}
		pcbY={pcbY}
		pcbRotation={pcbRotation}
	>
		{children ?? (
			<enclosure.cutoutaperture
				shape="pill"
				width={8}
				height={3}
				position={{ z: 1.5 }}
			/>
		)}
	</connector>
);
