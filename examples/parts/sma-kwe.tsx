import { Fragment, type ReactNode } from "react";

const pinLabels = {
	pin1: ["GND1", "SH1"],
	pin2: ["GND2", "SH2"],
	pin3: ["GND3", "SH3"],
	pin4: ["GND4", "SH4"],
	pin5: ["SIGNAL", "RF"],
} as const;

const holes = [
	["pin1", -2.480056, -2.520061],
	["pin2", -2.519934, 2.520061],
	["pin3", 2.519934, 2.479929],
	["pin4", 2.519934, -2.520061],
	["pin5", 0.019812, -0.019939],
] as const;

const silkscreenRoutes = [
	[
		{ x: -3.8558724, y: -3.0679644 },
		{ x: -11.6640356, y: -3.0679644 },
		{ x: -11.6640356, y: 3.0280356 },
		{ x: -3.8558724, y: 3.0280356 },
	],
	[
		{ x: -3.1550356, y: 1.1619484 },
		{ x: -3.1550356, y: -1.2018772 },
	],
	[
		{ x: -1.1041888, y: 3.0280356 },
		{ x: 1.1441176, y: 3.0280356 },
	],
	[
		{ x: 1.1441176, y: -3.0679644 },
		{ x: -1.1041888, y: -3.0679644 },
	],
	[
		{ x: 3.0679644, y: 1.1041888 },
		{ x: 3.0679644, y: -1.1441176 },
	],
];

export interface SmaKweProps {
	name: string;
	pcbX: number;
	pcbY: number;
	pcbRotation?: number;
	children?: ReactNode;
}

export const SmaKwe = ({
	name,
	pcbX,
	pcbY,
	pcbRotation,
	children,
}: SmaKweProps) => (
	<connector
		name={name}
		manufacturerPartNumber="SMA_KWE"
		supplierPartNumbers={{ jlcpcb: ["C7498154"] }}
		pinLabels={pinLabels}
		footprint={
			<footprint insertionDirection="from_left">
				{holes.map(([pin, x, y]) => (
					<Fragment key={pin}>
						<platedhole
							portHints={[pin]}
							pcbX={x}
							pcbY={y}
							shape="circle"
							holeDiameter="1.5000224mm"
							outerDiameter="2.499995mm"
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
				"https://modelcdn.tscircuit.com/easyeda_models/download?uuid=1336fc9149094e62873de2825f05e8fb&pn=C7498154",
			pcbRotationOffset: 0,
			modelOriginPosition: { x: 4.283905, y: 1.233896, z: 1.499994 },
			size: { x: 14.600001, y: 6.01, z: 13 },
		}}
		allowOffBoard
		pcbX={pcbX}
		pcbY={pcbY}
		pcbRotation={pcbRotation}
	>
		{children ?? (
			<cutoutaperture shape="circle" diameterMm={6.5} zCenterAboveBoardMm={7} />
		)}
	</connector>
);
