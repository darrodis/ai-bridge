export type Platform = "claude" | "codex";

export interface Rule {
  name: string;
  instruction: string;
}

export interface Skill {
  name: string;
  content: string;
}

export interface Agent {
  name: string;
  prompt: string;
}

export interface McpServer {
  name: string;
  config: Record<string, unknown>;
}

export interface CanonicalModel {
  root: string;
  projectInstructions?: string;
  rules: Rule[];
  skills: Skill[];
  agents: Agent[];
  mcpServers: McpServer[];
}

export interface SetupOptions {
  root: string;
  from?: Platform;
  dryRun: boolean;
  force: boolean;
}
