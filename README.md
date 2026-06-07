# Dota Spectator Tools Electron

Local-first desktop application for hosting browser-based streaming overlays.

## Stack

- Electron for the desktop shell
- SvelteKit and TypeScript for the management UI
- Vite for local development and builds
- SQLite for local persistence
- ESLint with the project rules in `linterrulesetc.txt`

## Project Layout

```text
src/
  electron/     Electron main and preload processes
  lib/          Svelte UI helpers and shared client modules
  persistence/  SQLite access boundary
  routes/       SvelteKit application routes
  runtime/      Local overlay HTTP hosting runtime
  shared/       Cross-process domain types
static/         Static assets served by SvelteKit
```

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

The first runnable goal is to start the SvelteKit management UI and launch the Electron shell against it. Overlay hosting will live behind the runtime boundary in `src/runtime`.

