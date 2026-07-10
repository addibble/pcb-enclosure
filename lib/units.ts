import { z } from "zod";

/**
 * Length props: a number (mm) or a unit string. Unit strings are converted with
 * the same unit set circuit-json's `length` accepts ("2mm", "0.1in", "50mil"),
 * so enclosure props behave like every other tscircuit distance prop.
 * (Implemented inline rather than importing circuit-json to keep the eval-worker
 * module graph lean — the conversion table is the contract, not the code.)
 */
const UNIT_TO_MM: Record<string, number> = {
	mm: 1,
	cm: 10,
	m: 1000,
	um: 1e-3,
	µm: 1e-3,
	nm: 1e-6,
	in: 25.4,
	inch: 25.4,
	mil: 0.0254,
	thou: 0.0254,
	ft: 304.8,
};
const LENGTH_RE =
	/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµ]*)\s*$/i;

export const toMm = (
	v: number | string | undefined | null,
	dflt: number,
): number => {
	if (v == null) return dflt;
	if (typeof v === "number") return v;
	const m = LENGTH_RE.exec(v);
	const factor = m ? UNIT_TO_MM[(m[2] || "mm").toLowerCase()] : undefined;
	if (!m || factor == null) {
		throw new Error(
			`[pcb-enclosure] unsupported length "${v}" (use a number or ${Object.keys(UNIT_TO_MM).join("/")})`,
		);
	}
	return Number(m[1]) * factor;
};

/** mm value: number or a unit string; validated so `toMm` can never fail later. */
export const mm = z.union([
	z.number(),
	z.string().refine(
		(s) => {
			const m = LENGTH_RE.exec(s);
			return !!m && UNIT_TO_MM[(m[2] || "mm").toLowerCase()] != null;
		},
		{ message: 'expected a length like "2mm", "0.1in", or "50mil"' },
	),
]);
