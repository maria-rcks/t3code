# Provider architecture

The clients (web, desktop, mobile) communicate with the server over WebSocket using Effect RPC.
The RPC surface is defined schema-first in `packages/contracts/src/rpc.ts` (`WS_METHODS` plus the
orchestration methods from `ORCHESTRATION_WS_METHODS`), so requests, results, errors, and streamed
events are all schema-validated at the transport boundary.

## Built-in providers

Providers are implemented as `ProviderDriver`s in `apps/server/src/provider/Drivers/` and
registered in `builtInDrivers.ts`. The built-in drivers are:

- **Codex** — wraps `codex app-server` (JSON-RPC over stdio)
- **Claude** — wraps the Claude Code CLI
- **Cursor** — wraps `cursor-agent` via ACP
- **Grok** — wraps the Grok CLI via ACP (`grok agent stdio`)
- **OpenCode** — wraps the OpenCode CLI

Each driver probes its CLI on `PATH`, reports an availability/auth snapshot, and adapts the
provider's runtime events into the shared orchestration model.

## Client transport

`packages/client-runtime` owns the client connection stack: `connection/supervisor.ts` manages
per-environment connection lifecycle (connect, retry with backoff, reconnect on wakeups), and
`rpc/client.ts` exposes typed RPC access on top of it. Outbound requests fail fast or wait for a
live session depending on the call site; inbound payloads are decoded against the contracts
schemas at the boundary.

## Server-side orchestration layers

Provider runtime events flow through queue-based workers:

1. **ProviderRuntimeIngestion** — consumes provider runtime streams, emits orchestration commands
2. **ProviderCommandReactor** — reacts to orchestration intent events, dispatches provider calls
3. **CheckpointReactor** — captures git checkpoints on turn start/complete, publishes runtime receipts

All three use `DrainableWorker` internally and expose `drain()` for deterministic test synchronization.
