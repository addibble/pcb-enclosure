import { Fragment, type ReactNode } from "react";
import { enclosure } from "../../lib/index";

const pinLabels = {
	pin1: ["1"],
	pin2: ["2"],
	pin3: ["3"],
	pin4: ["4"],
} as const;

const pads = [
	["pin1", 4.82495225, -3.499993],
	["pin2", -3.57508175, 3.499993],
	["pin3", -0.57508775, 3.499993],
	["pin4", 3.42490425, 3.499993],
] as const;

const silkscreenRoutes = [
	[
		{ x: -6.77494835, y: -3.000121 },
		{ x: 3.84372485, y: -3.000121 },
	],
	[
		{ x: 5.32502745, y: 2.999867 },
		{ x: 5.32502745, y: -1.768856 },
	],
	[
		{ x: 4.40592845, y: 2.999867 },
		{ x: 5.32502745, y: 2.999867 },
	],
	[
		{ x: 0.40593645, y: 2.999867 },
		{ x: 2.44365145, y: 2.999867 },
	],
	[
		{ x: -2.59405755, y: 2.999867 },
		{ x: -1.55634055, y: 2.999867 },
	],
	[
		{ x: -6.77494835, y: 2.999867 },
		{ x: -4.55633455, y: 2.999867 },
	],
	[
		{ x: -8.77519835, y: -2.499995 },
		{ x: -6.77520235, y: -2.499995 },
	],
	[
		{ x: -6.77520235, y: 2.4999442 },
		{ x: -8.77519835, y: 2.4999442 },
		{ x: -8.77519835, y: -2.500122 },
	],
	[
		{ x: -6.77494835, y: 2.999867 },
		{ x: -6.77494835, y: -3.000121 },
	],
];

export interface Pj320dProps {
	name: string;
	pcbX: number;
	pcbY: number;
	pcbRotation?: number;
	children?: ReactNode;
}

export const Pj320d = ({
	name,
	pcbX,
	pcbY,
	pcbRotation,
	children,
}: Pj320dProps) => (
	<connector
		name={name}
		manufacturerPartNumber="PJ_320D"
		supplierPartNumbers={{ jlcpcb: ["C431535"] }}
		pinLabels={pinLabels}
		footprint={
			<footprint insertionDirection="from_right">
				<hole pcbX={-5.07495175} pcbY={-0.000127} diameter="0.999998mm" />
				<hole pcbX={1.92503425} pcbY={-0.000127} diameter="0.999998mm" />
				{pads.map(([pin, x, y]) => (
					<Fragment key={pin}>
						<smtpad
							portHints={[pin]}
							pcbX={x}
							pcbY={y}
							width="1.499997mm"
							height="2.999994mm"
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
				"https://modelcdn.tscircuit.com/easyeda_models/download?uuid=7178d96b87ee4d73a30dddb4c856adc2&pn=C431535",
			pcbRotationOffset: 0,
			modelOriginPosition: { x: 7.27506, y: 0, z: -2.550001 },
			size: { x: 14.1, y: 8, z: 5.84998 },
		}}
		allowOffBoard
		pcbX={pcbX}
		pcbY={pcbY}
		pcbRotation={pcbRotation}
	>
		{children ?? <enclosure.cutoutaperture shape="circle" radius={3.25} />}
	</connector>
);
