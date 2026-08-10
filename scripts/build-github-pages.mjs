import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const repository = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "nhh-2026-hackathon";
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? `/${repository}`;

const build = spawnSync(
  process.execPath,
  [path.join("node_modules", "next", "dist", "bin", "next"), "build"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GITHUB_PAGES: "true",
      GITHUB_PAGES_BASE_PATH: basePath,
    },
    stdio: "inherit",
  },
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const outputDirectory = path.join(process.cwd(), "out");
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".txt", ".webmanifest", ".xml"]);

async function rewritePublicAssetPaths(directory) {
  for (const entry of await readdir(directory)) {
    const filePath = path.join(directory, entry);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      await rewritePublicAssetPaths(filePath);
      continue;
    }

    if (!textExtensions.has(path.extname(entry))) {
      continue;
    }

    const source = await readFile(filePath, "utf8");
    const rewritten = source.replaceAll("/assets/", `${basePath}/assets/`);

    if (rewritten !== source) {
      await writeFile(filePath, rewritten, "utf8");
    }
  }
}

await rewritePublicAssetPaths(outputDirectory);
await writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8");

console.log(`GitHub Pages static export ready in out${basePath}/`);
