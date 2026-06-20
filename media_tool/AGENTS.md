<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Command UI (`src/lib/command/`)

Default route uses `CommandWorkspace` — `@`-directives parsed in `directives.ts`, routed
via `dispatch.ts` → `handlers.ts`. **Before adding commands**, read
**[docs/COMMAND_ARCHITECTURE.md](docs/COMMAND_ARCHITECTURE.md)**. Run `npm test` after parser changes.
