import { join } from "node:path";
import { exists, readText } from "./fs.js";
import type { CanonicalModel } from "./types.js";

export const validate = async (model: CanonicalModel): Promise<string[]> => {
  const errors: string[] = [];
  if (!(await exists(join(model.root, ".ai")))) errors.push(".ai/ does not exist");
  for (const collection of [model.rules, model.skills, model.agents, model.mcpServers]) {
    for (const item of collection) if (!/^[a-z0-9][a-z0-9-]*$/.test(item.name)) errors.push(`invalid name: ${item.name}`);
  }
  const claude = join(model.root, "CLAUDE.md");
  const codex = join(model.root, "AGENTS.md");
  for (const path of [claude, codex]) if (!(await exists(path)) || !(await readText(path)).startsWith("<!-- ai-bridge:generated")) errors.push(`missing generated marker: ${path}`);
  return errors;
};
