import stlSerializer from "@jscad/stl-serializer";
import type { Geom3 } from "@jscad/modeling/src/geometries/types";

/** Serialize a JSCAD solid to ASCII STL. */
export const toStl = (geom: Geom3): string => {
	const out = stlSerializer.serialize({ binary: false }, geom) as string[];
	return out.join("");
};
