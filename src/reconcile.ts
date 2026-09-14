import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { loadModel } from "./model.js";
import { render } from "./render.js";
import { validate } from "./validate.js";
import { canonicalHash, hookPaths, outputHashes, readState, saveState } from "./state.js";

const reconcileUnlocked = async (root: string): Promise<"changed" | "noop" | "drift"> => {
  const currentHash = await canonicalHash(root);
  const previous = await readState(root);
  if (previous) {
    const currentOutputs = await outputHashes(root, Object.keys(previous.outputs));
    const drifted = Object.keys(previous.outputs).some((path) => currentOutputs[path] !== previous.outputs[path]);
    if (drifted) return "drift";
    if (previous.canonicalHash === currentHash) return "noop";
  }
  const model = await loadModel(root);
  const errors = await validate(model, false);
  if (errors.length) throw new Error(errors.join("\n"));
  const paths = await render(model, false, previous?.outputs);
  await saveState(root, [...paths, ...hookPaths]);
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
