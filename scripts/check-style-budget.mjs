import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const budget = JSON.parse(await readFile(resolve(root, "assets/style-budget.json"), "utf8"));
const failures = [];

for (const [relativePath, limits] of Object.entries(budget.files)) {
  const source = await readFile(resolve(root, relativePath), "utf8");
  const lines = source.replace(/\r?\n$/, "").split(/\r?\n/).length;
  const important = source.match(/!important/g)?.length ?? 0;
  if (lines > limits.maxLines) {
    failures.push(`${relativePath}: ${lines} lines exceeds ${limits.maxLines}`);
  }
  if (important > limits.maxImportant) {
    failures.push(`${relativePath}: ${important} !important rules exceeds ${limits.maxImportant}`);
  }
}

if (failures.length > 0) {
  console.error("Style budget check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Style budget check passed for ${Object.keys(budget.files).length} files.`);
}
