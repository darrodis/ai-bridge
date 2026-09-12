import { join } from "node:path";
import { exists, listDirectories, listFiles, readText, writeText } from "./fs.js";
import type { Platform } from "./types.js";

const stripMarker = (value: string): string => value.replace(/^<!-- ai-bridge:generated[^\n]*-->\n?/, "");

export const detectSources = async (root: string): Promise<Platform[]> => {
  const claude = await exists(join(root, ".claude")) || await exists(join(root, "CLAUDE.md"));
  const codex = await exists(join(root, ".agents")) || await exists(join(root, "AGENTS.md"));
  return [claude && "claude", codex && "codex"].filter(Boolean) as Platform[];
};

export const importPlatform = async (root: string, platform: Platform): Promise<void> => {
  const prefix = platform === "claude" ? ".claude" : ".agents";
  const rulesPath = join(root, prefix, "rules");
  const skillsPath = join(root, prefix, "skills");
  const agentsPath = platform === "claude" ? join(root, ".claude", "agents") : join(root, ".codex", "agents");
  for (const file of await listFiles(rulesPath, ".md")) await writeText(join(root, ".ai", "rules", file.replace(/\.md$/, ""), "instruction.md"), stripMarker(await readText(join(rulesPath, file))));
  for (const name of await listDirectories(skillsPath)) {
    const source = join(skillsPath, name, "SKILL.md");
    if (await exists(source)) await writeText(join(root, ".ai", "skills", name, "SKILL.md"), stripMarker(await readText(source)));
  }
  for (const file of await listFiles(agentsPath, ".md")) await writeText(join(root, ".ai", "agents", file.replace(/\.md$/, ""), "prompt.md"), stripMarker(await readText(join(agentsPath, file))));
};
