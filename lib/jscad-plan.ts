/**
 * Browser-safe recorder for the JSCAD operations used by split-shell geometry.
 * The emitted plain objects are internal artifact plans consumed by the GLB and
 * manufacturing exporters.
 */
type Plan = Record<string, unknown>;

const shapes =
	(type: string) =>
	(...items: Plan[]): Plan => ({
		type,
		shapes: items,
	});

export const jscadPlan = {
	booleans: {
		intersect: shapes("intersect"),
		subtract: shapes("subtract"),
		union: shapes("union"),
	},
	hulls: {
		hull: shapes("hull"),
	},
	colors: {
		colorize: (color: [number, number, number], shape: Plan): Plan => ({
			type: "colorize",
			color,
			shape,
		}),
	},
	primitives: {
		cuboid: (options: { size: [number, number, number] }): Plan => ({
			type: "cuboid",
			...options,
		}),
		cylinder: (options: {
			radius: number;
			height: number;
			segments?: number;
		}): Plan => ({
			type: "cylinder",
			...options,
		}),
	},
	transforms: {
		rotate: (angles: number[], shape: Plan): Plan => ({
			type: "rotate",
			angles,
			shape,
		}),
		translate: (vector: number[], shape: Plan): Plan => ({
			type: "translate",
			vector,
			shape,
		}),
	},
};
