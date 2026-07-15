import { Fragment, type ReactNode } from "react";
import { enclosure } from "../../lib/index";

const pinLabels = {
	pin1: ["VCC"],
	pin2: ["D_NEG"],
	pin3: ["D_POS"],
	pin4: ["GND"],
	pin5: ["SH1"],
	pin6: ["SH2"],
	pin7: ["SH3"],
	pin8: ["SH4"],
} as const;

const signalHoles = [
	["pin4", 0, -2.99974],
	["pin3", 0, -0.99822],
	["pin2", 0, 1.00076],
	["pin1", 0, 3.00228],
] as const;

const shellHoles = [
	["pin5", 2.75082, -3.50012],
	["pin6", 2.75082, 3.50012],
	["pin7", -2.75082, 3.50012],
	["pin8", -2.75082, -3.50012],
] as const;

const silkscreenRoutes = [
	[
		{ x: 3.549904, y: 15.150084 },
		{ x: 3.549904, y: -4.449826 },
	],
	[
		{ x: -3.549904, y: -4.45008 },
		{ x: 3.550158, y: -4.45008 },
	],
	[
		{ x: -3.549904, y: 15.14983 },
		{ x: -3.549904, y: -4.45008 },
	],
	[
		{ x: -3.549904, y: 15.150084 },
		{ x: 3.550158, y: 15.150084 },
	],
];

export interface UsbAfSideProps {
	name: string;
	pcbX: number;
	pcbY: number;
	pcbRotation?: number;
	children?: ReactNode;
}

export const UsbAfSide = ({
	name,
	pcbX,
	pcbY,
	pcbRotation,
	children,
}: UsbAfSideProps) => (
	<connector
		name={name}
		manufacturerPartNumber="USB_AF___"
		supplierPartNumbers={{ jlcpcb: ["C26235"] }}
		pinLabels={pinLabels}
		footprint={
			<footprint insertionDirection="from_back">
				{signalHoles.map(([pin, x, y]) => (
					<Fragment key={pin}>
						<platedhole
							portHints={[pin]}
							pcbX={x}
							pcbY={y}
							outerDiameter="1.6999966mm"
							holeDiameter="1.1000232mm"
							shape="circle"
						/>
					</Fragment>
				))}
				{shellHoles.map(([pin, x, y]) => (
					<Fragment key={pin}>
						<platedhole
							portHints={[pin]}
							pcbX={x}
							pcbY={y}
							outerDiameter="2.999994mm"
							holeDiameter="1.999996mm"
							shape="circle"
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
				"https://modelcdn.tscircuit.com/easyeda_models/download?uuid=3bd6558fce8e4714baff51bcd3febac1&pn=C26235",
			pcbRotationOffset: 0,
			modelOriginPosition: { x: 0.000013, y: -3.223993, z: -1.003761 },
			size: { x: 7.08584, y: 19, z: 18.103753 },
		}}
		allowOffBoard
		pcbX={pcbX}
		pcbY={pcbY}
		pcbRotation={pcbRotation}
	>
		{children ?? (
			<enclosure.cutoutaperture
				shape="rect"
				width={6}
				height={13.2}
				position={{ z: 7.5 }}
			/>
		)}
	</connector>
);
