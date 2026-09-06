// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeSqlite from "node:sqlite";
import * as NodeTimersPromises from "node:timers/promises";

import type { UsageRecord } from "./usageTranscripts.ts";

function object(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function tokens(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

/** Only recorded token counts count as usage; text length and context meters do not. */
export function parseCursorBubble(key: string, source: string): UsageRecord | null {
  const match = /^bubbleId:([^:]+):(.+)$/.exec(key);
  if (match === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  const bubble = object(parsed);
  if (bubble.type !== 2) return null;
  const usage = object(bubble.tokenCount);
  const inputTokens = tokens(usage.inputTokens);
  const outputTokens = tokens(usage.outputTokens);
  if (inputTokens + outputTokens === 0) return null;
  const timestampMs =
    typeof bubble.createdAt === "number"
      ? bubble.createdAt
      : typeof bubble.createdAt === "string"
        ? Date.parse(bubble.createdAt)
        : NaN;
  if (!Number.isFinite(timestampMs)) return null;
  const modelName = object(bubble.modelInfo).modelName;
  const model =
    typeof modelName === "string" && modelName && modelName !== "default"
      ? modelName
      : "cursor-auto";
  const requestId = typeof bubble.requestId === "string" ? bubble.requestId : "";
  return {
    provider: "cursor",
    timestampMs,
    model,
    sessionId: match[1] ?? "",
    totals: {
      uncachedInputTokens: inputTokens,
      cachedInputTokens: 0,
      cacheCreationTokens: 0,
      outputTokens,
      reasoningTokens: 0,
    },
    reportedCostUsd: null,
    dedupeKey: requestId ? `cursor:request:${requestId}` : `cursor:${key}`,
  };
}

export interface CursorUsageReadResult {
  readonly files: readonly { readonly path: string; readonly records: readonly UsageRecord[] }[];
  readonly missing: boolean;
  readonly error: boolean;
}

/** Cursor's desktop store only exposes counts for some versions and requests. */
export async function readCursorUsage(
  dbPath: string,
  sinceMs: number,
): Promise<CursorUsageReadResult> {
  try {
    await NodeFSP.stat(dbPath);
  } catch (cause) {
    const missing = object(cause).code === "ENOENT";
    return { files: [], missing, error: !missing };
  }
  const records: UsageRecord[] = [];
  const files = [{ path: dbPath, records }];
  const seen = new Set<string>();
  let database: NodeSqlite.DatabaseSync | undefined;
  try {
    database = new NodeSqlite.DatabaseSync(dbPath, { readOnly: true });
    database.exec("PRAGMA busy_timeout = 100");
    const statement = database.prepare(
      "SELECT key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'",
    );
    let count = 0;
    for (const row of statement.iterate()) {
      const source =
        typeof row.value === "string"
          ? row.value
          : row.value instanceof Uint8Array
            ? Buffer.from(row.value).toString("utf8")
            : "";
      const record = parseCursorBubble(typeof row.key === "string" ? row.key : "", source);
      if (record !== null && record.timestampMs >= sinceMs) {
        if (record.dedupeKey === null || !seen.has(record.dedupeKey)) {
          if (record.dedupeKey !== null) seen.add(record.dedupeKey);
          records.push(record);
        }
      }
      if (++count % 256 === 0) await NodeTimersPromises.setImmediate();
    }
    return { files, missing: false, error: false };
  } catch {
    return { files, missing: false, error: true };
  } finally {
    database?.close();
  }
}
