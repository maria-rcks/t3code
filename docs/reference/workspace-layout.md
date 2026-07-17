# Workspace layout

## Apps

- `/apps/server`: Node.js WebSocket server (`t3`). Wraps the provider CLIs, serves the built web app, and opens the browser on start.
- `/apps/web`: React + Vite UI. Session control, conversation, and provider event rendering. Connects to the server via WebSocket.
- `/apps/desktop`: Electron shell. Spawns a desktop-scoped `t3` backend process and loads the shared web app.
- `/apps/mobile`: Expo/React Native app. Connects to a paired T3 Code server over the network.
- `/apps/marketing`: Astro marketing site (landing, download, and legal pages).

## Packages

- `/packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types.
- `/packages/shared`: Shared runtime utilities consumed by both server and clients. Uses explicit subpath exports (e.g. `@t3tools/shared/git`, `@t3tools/shared/DrainableWorker`) — no barrel index.
- `/packages/client-runtime`: Shared client runtime (connection supervision, RPC client, state) used by web and mobile.
- `/packages/ssh`: SSH launch/tunneling utilities for desktop-managed remote environments.
- `/packages/tailscale`: Tailscale detection and Serve integration for remote access endpoints.
- `/packages/effect-acp`: Effect-based Agent Client Protocol (ACP) client used by ACP providers.
- `/packages/effect-codex-app-server`: Effect-based client for the Codex app-server JSON-RPC protocol.
