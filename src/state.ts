import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { exists, inside, readText, writeTextAtomic } from "./fs.js";

export interface ReconcileState {
  canonicalHash: string;
  outputs: Record<string, string>;
}

export const hookPaths = [join(".claude", "settings.json"), join(".codex", "config.toml")];
const statePath = (root: string): string => join(root, ".ai-bridge", "state.json");
export const digest = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex");

export const canonicalHash = async (root: string): Promise<string> => {
  const paths: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else paths.push(relative(root, path));
    }
  };
  if (await exists(join(root, ".ai"))) await visit(join(root, ".ai"));
  const hash = createHash("sha256");
  for (const path of paths.sort()) hash.update(path).update("\0").update(await readFile(join(root, path))).update("\0");
  return hash.digest("hex");
};

export const outputHashes = async (root: string, paths: string[]): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  for (const path of paths) {
    if (!inside(root, join(root, path))) throw new Error(`invalid generated path: ${path}`);
    if (await exists(join(root, path))) result[path] = digest(await readFile(join(root, path)));
  }
  return result;
};

export const readState = async (root: string): Promise<ReconcileState | undefined> => {
  if (!(await exists(statePath(root)))) return undefined;
  const state = JSON.parse(await readText(statePath(root))) as ReconcileState;
  if (!state || typeof state.canonicalHash !== "string" || !state.outputs || typeof state.outputs !== "object" || Array.isArray(state.outputs)) throw new Error("invalid ai-bridge state");
  for (const [path, hash] of Object.entries(state.outputs)) {
    if (!inside(root, join(root, path)) || typeof hash !== "string") throw new Error(`invalid generated path in state: ${path}`);
  }
  return state;
};

export const saveState = async (root: string, paths: string[]): Promise<void> => {
  await writeTextAtomic(statePath(root), `${JSON.stringify({ canonicalHash: await canonicalHash(root), outputs: await outputHashes(root, paths) }, null, 2)}\n`);
};
