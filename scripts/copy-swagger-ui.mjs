import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(projectRoot, "node_modules", "swagger-ui-dist");
const targetDir = path.join(projectRoot, "dist", "swagger-ui");
const assets = [
  "LICENSE",
  "NOTICE",
  "favicon-32x32.png",
  "swagger-ui.css",
  "swagger-ui-bundle.js",
  "swagger-ui-bundle.js.LICENSE.txt",
  "swagger-ui-standalone-preset.js",
  "swagger-ui-standalone-preset.js.LICENSE.txt",
];

await fs.mkdir(targetDir, { recursive: true });
await Promise.all(
  assets.map((asset) => fs.copyFile(path.join(sourceDir, asset), path.join(targetDir, asset))),
);

console.log("Copied Swagger UI assets into dist/swagger-ui.");
