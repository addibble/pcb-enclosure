import { copyFileSync, mkdirSync, rmSync } from "node:fs";

const slugs = ["prefab-board"];
const outputDir = ".tscircuit/web-examples";

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const slug of slugs) {
	copyFileSync(
		`dist/examples/${slug}/circuit.json`,
		`${outputDir}/${slug}.circuit.json`,
	);
}

console.log(`prepared ${slugs.length} web examples in ${outputDir}`);
