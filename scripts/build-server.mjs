import { build } from "esbuild";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(projectRoot, "server-dist");

await fs.mkdir(outdir, { recursive: true });

await build({
  entryPoints: [path.join(projectRoot, "server/http.mjs")],
  outfile: path.join(outdir, "http.mjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  external: ["fsevents"],
  sourcemap: false,
});

console.log("Generated Node backend bundle at server-dist/http.mjs.");
