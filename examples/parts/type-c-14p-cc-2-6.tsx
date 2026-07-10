import { Fragment, type ReactNode } from "react";

const pinLabels = {
	pin1: ["A12", "GND1"],
	pin2: ["A9", "VBUS1"],
	pin3: ["A7", "DN1"],
	pin4: ["A6", "DP1"],
	pin5: ["A5", "CC1"],
	pin6: ["A4", "VBUS2"],
	pin7: ["A1", "GND2"],
	pin8: ["B12", "GND3"],
	pin9: ["B7", "DN2"],
	pin10: ["B6", "DP2"],
	pin11: ["B5", "CC2"],
	pin12: ["B4", "VBUS3"],
	pin13: ["B1", "GND4"],
	pin14: ["SH21"],
	pin15: ["SH22"],
	pin16: ["SH11"],
	pin17: ["SH12"],
	pin18: ["B9", "VBUS4"],
} as const;

const signalPins = [
	["pin1", -0.374904, 2.925191],
	["pin2", -0.374904, 2.025015],
	["pin3", -0.374904, 0.675005],
	["pin4", -0.374904, -0.224917],
	["pin5", -0.374904, -1.124839],
	["pin6", -0.374904, -2.025015],
	["pin7", -0.374904, -2.925191],
	["pin8", 0.375158, -2.925191],
	["pin9", 0.375158, -0.675005],
	["pin10", 0.375158, 0.225171],
	["pin11", 0.375158, 1.125093],
	["pin12", 0.375158, 2.025015],
	["pin13", 0.375158, 2.925191],
	["pin18", 0.375158, -2.025015],
] as const;

const shellPins = [
	["pin14", -1.43002, -2.374773],
	["pin15", -1.43002, 2.425573],
	["pin16", 1.43002, -2.374773],
	["pin17", 1.43002, 2.425319],
] as const;

const silkscreenRoutes = [
	[
		{ x: 1.599997, y: -1.215263 },
		{ x: 1.599997, y: 1.265707 },
	],
	[
		{ x: -1.599997, y: -1.215263 },
		{ x: -1.599997, y: 1.266063 },
	],
	[
		{ x: -1.599997, y: -3.524758 },
		{ x: -1.599997, y: -9.924771 },
		{ x: 1.599997, y: -9.924771 },
		{ x: 1.599997, y: -3.524758 },
	],
	[
		{ x: -1.849984, y: 4.075201 },
		{ x: -1.849984, y: 3.523488 },
	],
	[
		{ x: -1.849984, y: 4.075201 },
		{ x: 1.850009, y: 4.075201 },
		{ x: 1.850009, y: 3.523132 },
	],
];

export interface TypeC14pCc26Props {
	name: string;
	pcbX: number;
	pcbY: number;
	pcbRotation?: number;
	children?: ReactNode;
}

/**
 * JLCPCB C5187475 / SHOU HAN TYPE-C 14P CC-2.6 flag-mount receptacle.
 * Footprint and CAD metadata are sourced from the JLCPCB/EasyEDA parts engine.
 */
export const TypeC14pCc26 = ({
	name,
	pcbX,
	pcbY,
	pcbRotation,
	children,
}: TypeC14pCc26Props) => (
	<connector
		name={name}
		standard="usb_c"
		pinLabels={pinLabels}
		supplierPartNumbers={{ jlcpcb: ["C5187475"] }}
		manufacturerPartNumber="TYPE-C 14P CC-2.6"
		footprint={
			<footprint>
				{signalPins.map(([pin, x, y]) => (
					<Fragment key={pin}>
						<platedhole
							portHints={[pin]}
							pcbX={x}
							pcbY={y}
							shape="pill"
							holeWidth="0.4mm"
							holeHeight="0.55mm"
							outerWidth="0.55mm"
							outerHeight="0.7mm"
						/>
					</Fragment>
				))}
				{shellPins.map(([pin, x, y]) => (
					<Fragment key={pin}>
						<platedhole
							portHints={[pin]}
							pcbX={x}
							pcbY={y}
							shape="pill"
							holeWidth="0.5mm"
							holeHeight="1.5mm"
							outerWidth="0.9mm"
							outerHeight="1.9mm"
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
				"https://modelcdn.tscircuit.com/easyeda_models/download?uuid=fd858e85fa2e485f931f37c89f3b47bc&pn=C5187475",
			modelOriginPosition: { x: 0, y: 2.9750258, z: -2.330004 },
			size: { x: 3.66, y: 14, z: 13.270001 },
		}}
		allowOffBoard
		pcbX={pcbX}
		pcbY={pcbY}
		pcbRotation={pcbRotation}
	>
		{children ?? (
			<cutoutaperture
				shape="rounded_rect"
				widthMm={3.66}
				heightMm={8.34}
				cornerRadiusMm={1.83}
				zCenterAboveBoardMm={6.75}
			/>
		)}
	</connector>
);
