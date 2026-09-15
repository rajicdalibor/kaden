import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";

/**
 * Bundle Cloud Functions → čist staging folder `deploy/` koji se deploy-uje.
 * Workspace paketi (@kaden/*) i čisti-JS deps (fit-file-parser) se INLINE-uju.
 * `deploy/package.json` sadrži SAMO prave npm deps — nula `workspace:*`, pa cloud
 * `npm install` prolazi. Lokalni discovery razrešava externals iz functions/node_modules.
 */
const OUT = "deploy";
mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: ["src/index.ts"],
  outfile: `${OUT}/index.js`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external: ["firebase-functions", "firebase-admin", "@anthropic-ai/sdk", "zod"],
  banner: {
    js: "import{createRequire as __cr}from'module';import{fileURLToPath as __ftu}from'url';import{dirname as __dn}from'path';const require=__cr(import.meta.url);const __filename=__ftu(import.meta.url);const __dirname=__dn(__filename);",
  },
  logLevel: "info",
});

writeFileSync(`${OUT}/package.json`, JSON.stringify({
  name: "kaden-functions",
  version: "0.0.0",
  type: "module",
  main: "index.js",
  engines: { node: "22" },
  dependencies: {
    "@anthropic-ai/sdk": "^0.32.1",
    "firebase-admin": "^13.0.1",
    "firebase-functions": "^6.1.1",
    "zod": "^3.23.8",
  },
}, null, 2) + "\n");

console.log(`✓ ${OUT}/index.js + ${OUT}/package.json (čist, bez workspace:)`);
