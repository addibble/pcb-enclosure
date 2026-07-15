import { readFileSync, writeFileSync } from "node:fs";

const standalonePath = "../runframe/dist/standalone.min.js";
const workerPath = "../eval/dist/webworker/entrypoint.js";
const outputPath = "../runframe/dist/standalone.local.min.js";

const standalone = readFileSync(standalonePath, "utf8");
const worker = readFileSync(workerPath, "utf8");
const workerBase64 = Buffer.from(worker).toString("base64");
const workerExpression = `URL.createObjectURL(new Blob([atob("${workerBase64}")],{type:"application/javascript"}))`;
const output = standalone.replace(
	/"<--INJECT_TSCIRCUIT_EVAL_WEB_WORKER_BLOB_URL-->"/g,
	workerExpression,
);
writeFileSync(outputPath, output);
console.log(`prepared local RunFrame bundle at ${outputPath}`);
