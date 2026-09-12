# Future features / Будущие возможности

## Global settings sync

Project `.ai/` is the v1 scope. A later design may introduce a separate canonical global profile and adapters for Claude and Codex user-level settings. It must be opt-in, diffable, reversible, and must never overwrite secrets, auth, state, or caches by default.

Проектный `.ai/` входит в v1. Позже можно спроектировать отдельный канонический глобальный профиль и адаптеры для пользовательских настроек Claude и Codex. Функция должна быть opt-in, показывать diff, поддерживать откат и по умолчанию не перезаписывать секреты, auth, state и cache.

## Watch mode

An opt-in watcher may regenerate outputs after changes, but only after resolving the ownership and data-loss risks documented in the plan.
