import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const publicRoot = path.join(root, "public");
const manifest = JSON.parse(
  await readFile(path.join(root, "assets", "runtime-manifest.json"), "utf8"),
);

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkSize(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    bytes += entry.isDirectory() ? await walkSize(filePath) : (await stat(filePath)).size;
  }
  return bytes;
}

async function walkFiles(directory, relative = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryRelative = path.posix.join(relative, entry.name);
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(filePath, entryRelative));
    else files.push(entryRelative);
  }
  return files;
}

const failures = [];
for (const relativePath of manifest.requiredFiles) {
  if (!await exists(path.join(publicRoot, relativePath))) {
    failures.push(`missing runtime file: public/${relativePath}`);
  }
}

for (const requirement of manifest.requiredDirectories) {
  const directory = path.join(publicRoot, requirement.path);
  if (!await exists(directory)) {
    failures.push(`missing runtime directory: public/${requirement.path}`);
    continue;
  }
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile()).length;
  if (files < requirement.minimumFiles) {
    failures.push(
      `runtime directory public/${requirement.path} has ${files} files; expected at least ${requirement.minimumFiles}`,
    );
  }
}

for (const relativePath of manifest.sourceOnlyPaths) {
  if (await exists(path.join(publicRoot, relativePath))) {
    failures.push(`source-only asset would be deployed: public/${relativePath}`);
  }
}

const allowedDirectories = (manifest.allowedDirectories ?? [])
  .map((directory) => directory.replaceAll("\\", "/").replace(/\/$/, ""));
for (const relativePath of await walkFiles(publicRoot)) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!allowedDirectories.includes(path.posix.dirname(normalized))) {
    failures.push(`unregistered runtime asset: public/${normalized}`);
  }
}

const publicBytes = await walkSize(publicRoot);
if (publicBytes > manifest.publicByteBudget) {
  failures.push(
    `public assets use ${publicBytes.toLocaleString()} bytes; budget is ${manifest.publicByteBudget.toLocaleString()} bytes`,
  );
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  `Runtime asset check passed: ${publicBytes.toLocaleString()} / ${manifest.publicByteBudget.toLocaleString()} bytes.`,
);
