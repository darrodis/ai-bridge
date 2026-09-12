import { join } from "node:path";
import { exists, listDirectories, listFiles, readText } from "./fs.js";
import type { Agent, CanonicalModel, McpServer, Rule, Skill } from "./types.js";

export const loadModel = async (root: string): Promise<CanonicalModel> => {
  const rules: Rule[] = [];
  for (const name of await listDirectories(join(root, ".ai", "rules"))) {
    const path = join(root, ".ai", "rules", name, "instruction.md");
    if (await exists(path)) rules.push({ name, instruction: await readText(path) });
  }
  const skills: Skill[] = [];
  for (const name of await listDirectories(join(root, ".ai", "skills"))) {
    const path = join(root, ".ai", "skills", name, "SKILL.md");
    if (await exists(path)) skills.push({ name, content: await readText(path) });
  }
  const agents: Agent[] = [];
  for (const name of await listDirectories(join(root, ".ai", "agents"))) {
    const path = join(root, ".ai", "agents", name, "prompt.md");
    if (await exists(path)) agents.push({ name, prompt: await readText(path) });
  }
  const mcpServers: McpServer[] = [];
  for (const name of await listDirectories(join(root, ".ai", "mcp"))) {
    const path = join(root, ".ai", "mcp", name, "config.json");
    if (await exists(path)) mcpServers.push({ name, config: JSON.parse(await readText(path)) as Record<string, unknown> });
  }
  return { root, rules, skills, agents, mcpServers };
};
