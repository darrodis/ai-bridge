import { join } from "node:path";
import { exists, listDirectories, listFiles, readText, writeText } from "./fs.js";
import { digest } from "./state.js";
import type { Platform } from "./types.js";

const stripMarker = (value: string): string => value.replace(/^<!-- ai-bridge:generated[^\n]*-->\n?/, "");

export const detectSources = async (root: string): Promise<Platform[]> => {
  const claude = await exists(join(root, ".claude")) || await exists(join(root, "CLAUDE.md"));
  const codex = await exists(join(root, ".agents")) || await exists(join(root, "AGENTS.md"));
  return [claude && "claude", codex && "codex"].filter(Boolean) as Platform[];
};

export const importPlatform = async (root: string, platform: Platform): Promise<Record<string, string>> => {
  const imported: Record<string, string> = {};
  const importFile = async (source: string, target: string, strip = true): Promise<void> => {
    const content = await readText(join(root, source));
    await writeText(join(root, ".ai", target), strip ? stripMarker(content) : content);
    imported[source] = digest(content);
  };
  const prefix = platform === "claude" ? ".claude" : ".agents";
  const rulesPath = join(root, prefix, "rules");
  const skillsPath = join(root, prefix, "skills");
  const agentsPath = platform === "claude" ? join(root, ".claude", "agents") : join(root, ".codex", "agents");
  const instructionsPath = platform === "claude" ? "CLAUDE.md" : "AGENTS.md";
  if (await exists(join(root, instructionsPath))) {
    const instructions = await readText(join(root, instructionsPath));
    if (!instructions.startsWith("<!-- ai-bridge:generated")) await importFile(instructionsPath, join("instructions", "project.md"), false);
  }
  for (const file of await listFiles(rulesPath, ".md")) await importFile(join(prefix, "rules", file), join("rules", file.replace(/\.md$/, ""), "instruction.md"));
  for (const name of await listDirectories(skillsPath)) {
    const source = join(skillsPath, name, "SKILL.md");
    if (await exists(source)) await importFile(join(prefix, "skills", name, "SKILL.md"), join("skills", name, "SKILL.md"));
  }
  for (const file of await listFiles(agentsPath, ".md")) await importFile(join(platform === "claude" ? ".claude" : ".codex", "agents", file), join("agents", file.replace(/\.md$/, ""), "prompt.md"));
  if (platform === "claude") {
    const mcpPath = join(root, ".mcp.json");
    if (await exists(mcpPath)) {
      const content = await readText(mcpPath);
      const parsed = JSON.parse(content) as { mcpServers?: Record<string, unknown> };
      for (const [name, config] of Object.entries(parsed.mcpServers ?? {})) await writeText(join(root, ".ai", "mcp", name, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
      imported[".mcp.json"] = digest(content);
    }
  }
  return imported;
};
