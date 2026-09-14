import { join } from "node:path";
import { exists, readText } from "./fs.js";
import { renderPlan, marker } from "./render.js";
import { digest, hookPaths, readState } from "./state.js";
import type { CanonicalModel } from "./types.js";

export const validate = async (model: CanonicalModel, checkGenerated = true): Promise<string[]> => {
  const errors: string[] = [];
  if (!(await exists(join(model.root, ".ai")))) errors.push(".ai/ does not exist");
  for (const collection of [model.rules, model.skills, model.agents, model.mcpServers]) {
    for (const item of collection) if (!/^[a-z0-9][a-z0-9-]*$/.test(item.name)) errors.push(`invalid name: ${item.name}`);
  }
  if (!checkGenerated) return errors;
  const plan = renderPlan(model);
  for (const [relative, expected] of Object.entries(plan)) {
    const path = join(model.root, relative);
    if (!(await exists(path))) errors.push(`missing generated file: ${relative}`);
    else if (await readText(path) !== expected) errors.push(`generated file drift: ${relative}`);
  }
  const state = await readState(model.root);
  if (state) {
    for (const relative of Object.keys(state.outputs)) {
      const path = join(model.root, relative);
      if (hookPaths.includes(relative)) {
        if (!(await exists(path)) || digest(await readText(path)) !== state.outputs[relative]) errors.push(`generated hook configuration drift: ${relative}`);
      } else if (!(relative in plan) && await exists(path)) {
        const managed = (await readText(path)).startsWith(marker);
        errors.push(`${managed ? "orphan generated file" : "manual file conflicts with removed output"}: ${relative}`);
      }
    }
  }
  return errors;
};
