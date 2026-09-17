import { build } from "esbuild";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { stdio: "inherit" });
await rm(".vercel/output", { recursive: true, force: true });
await mkdir(".vercel/output/functions/render.func", { recursive: true });
await cp("dist/client", ".vercel/output/static", { recursive: true });
await build({ entryPoints: ["vercel-entry.ts"], bundle: true, platform: "node", target: "node22", format: "esm", outfile: ".vercel/output/functions/render.func/index.mjs" });
await writeFile(".vercel/output/functions/render.func/.vc-config.json", JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", supportsResponseStreaming: true }));
await writeFile(".vercel/output/config.json", JSON.stringify({ version: 3, routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/render" }] }));
