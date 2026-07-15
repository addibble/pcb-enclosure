import { Fragment, type ReactNode } from "react";
import { enclosure } from "../../lib/index";

const pinLabels = {
	pin1: ["1"],
	pin2: ["2"],
	pin3: ["3"],
	pin4: ["1_ALT"],
} as const;

const pads = [
	["pin1", -3.049905, 5.50037],
	["pin2", -3.049905, -5.50037],
	["pin3", 3.049905, -5.50037],
	["pin4", 3.049905, 5.50037],
] as const;

const silkscreenRoutes = [
	[
		{ x: -4.8260762, y: 5.0803556 },
		{ x: -8.1280762, y: 5.0803556 },
		{ x: -8.1280762, y: -5.0796444 },
		{ x: -4.8260762, y: -5.0796444 },
	],
	[
		{ x: -1.2700762, y: -5.0796444 },
		{ x: 1.2699238, y: -5.0796444 },
	],
	[
		{ x: 4.8259238, y: -5.0796444 },
		{ x: 7.1119238, y: -5.0796444 },
		{ x: 7.1119238, y: 5.0803556 },
		{ x: 4.8259238, y: 5.0803556 },
	],
	[
		{ x: -7.3660762, y: 5.0803556 },
		{ x: -7.3660762, y: -5.0796444 },
	],
	[
		{ x: -1.2700762, y: 5.0803556 },
		{ x: 1.2699238, y: 5.0803556 },
	],
];

export interface Dc0055a20SmtProps {
	name: string;
	pcbX: number;
	pcbY: number;
	pcbRotation?: number;
	children?: ReactNode;
}

export const Dc0055a20Smt = ({
	name,
	pcbX,
	pcbY,
	pcbRotation,
	children,
}: Dc0055a20SmtProps) => (
	<connector
		name={name}
		manufacturerPartNumber="DC_005_5A_2_0_SMT"
		supplierPartNumbers={{ jlcpcb: ["C319134"] }}
		pinLabels={pinLabels}
		footprint={
			<footprint insertionDirection="from_left">
				<hole pcbX={1.449959} pcbY={0.000254} diameter="1.999996mm" />
				<hole pcbX={-3.050159} pcbY={0.000254} diameter="1.7999964mm" />
				{pads.map(([pin, x, y]) => (
					<Fragment key={pin}>
						<smtpad
							portHints={[pin]}
							pcbX={x}
							pcbY={y}
							width="2.7999944mm"
							height="2.7999944mm"
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
				"https://modelcdn.tscircuit.com/easyeda_models/download?uuid=1551b649d4464827bef52168672fd5ab&pn=C319134",
			pcbRotationOffset: 270,
			modelOriginPosition: { x: 5.75, y: -3.049988, z: 0.099997 },
			size: { x: 12.6, y: 14.799999, z: 12.4 },
		}}
		allowOffBoard
		pcbX={pcbX}
		pcbY={pcbY}
		pcbRotation={pcbRotation}
	>
		{children ?? (
			<enclosure.cutoutaperture
				shape="rect"
				width={8.5}
				height={10}
				position={{ z: 5.5 }}
			/>
		)}
	</connector>
);
