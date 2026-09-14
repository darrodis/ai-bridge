# Architecture

`.ai/` is the only editable source. Project-level instructions live in `.ai/instructions/project.md`; root `CLAUDE.md` and `AGENTS.md` are generated copies. The pipeline is:

1. discover existing canonical or native Claude/Codex files;
2. import only when there is one unambiguous source (or `--from` is supplied);
3. load and validate the typed canonical model;
4. render Claude and Codex outputs with generated markers;
5. remove stale generated outputs only when their previous managed state and marker prove ownership;
6. validate rendered content and generated entry points.

The CLI does not change global Claude or Codex configuration. Claude MCP is rendered to project `.mcp.json`; Codex MCP is rendered to `.codex/mcp.toml` as a reviewable, version-aware output because project-scoped loading differs across Codex versions.
