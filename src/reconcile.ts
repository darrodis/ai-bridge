import { createHash } from "node:crypto";
import { mkdir, open, readdir, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { exists, readText, writeTextAtomic } from "./fs.js";
import { loadModel } from "./model.js";
import { render } from "./render.js";
import { validate } from "./validate.js";

interface ReconcileState {
  canonicalHash: string;
  outputs: Record<string, string>;
}

const statePath = (root: string): string => join(root, ".ai-bridge", "state.json");

const digest = (value: Uint8Array | string): string => createHash("sha256").update(value).digest("hex");

const canonicalFiles = async (root: string): Promise<string[]> => {
  const result: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else result.push(relative(root, path));
    }
  };
  const directory = join(root, ".ai");
  if (await exists(directory)) await visit(directory);
  return result.sort();
};

const canonicalHash = async (root: string): Promise<string> => {
  const hash = createHash("sha256");
  for (const path of await canonicalFiles(root)) hash.update(path).update("\0").update(await readFile(join(root, path))).update("\0");
  return hash.digest("hex");
};

const outputHashes = async (root: string, paths: string[]): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  for (const path of paths) if (await exists(join(root, path))) result[path] = digest(await readFile(join(root, path)));
  return result;
};

const readState = async (root: string): Promise<ReconcileState | undefined> => {
  const path = statePath(root);
  if (!(await exists(path))) return undefined;
  return JSON.parse(await readText(path)) as ReconcileState;
};

export const saveState = async (root: string, paths: string[]): Promise<void> => {
  await writeTextAtomic(statePath(root), `${JSON.stringify({ canonicalHash: await canonicalHash(root), outputs: await outputHashes(root, paths) }, null, 2)}\n`);
};

const reconcileUnlocked = async (root: string): Promise<"changed" | "noop" | "drift"> => {
  const currentHash = await canonicalHash(root);
  const previous = await readState(root);
  if (previous?.canonicalHash === currentHash) {
    const currentOutputs = await outputHashes(root, Object.keys(previous.outputs));
    const drifted = Object.keys(previous.outputs).some((path) => currentOutputs[path] !== previous.outputs[path]);
    if (drifted) return "drift";
    return "noop";
  }
  const model = await loadModel(root);
  const errors = await validate(model);
  if (errors.length) throw new Error(errors.join("\n"));
  const paths = await render(model, true);
  await saveState(root, [...paths, ".claude/settings.json", ".codex/config.toml"]);
  return "changed";
};

export const reconcile = async (root: string): Promise<"changed" | "noop" | "drift"> => {
  const lock = join(root, ".ai-bridge", "reconcile.lock");
  await mkdir(join(root, ".ai-bridge"), { recursive: true });
  let handle;
  try { handle = await open(lock, "wx"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return "noop";
    throw error;
  }
  try { return await reconcileUnlocked(root); }
  finally { await handle.close(); await rm(lock, { force: true }); }
};
