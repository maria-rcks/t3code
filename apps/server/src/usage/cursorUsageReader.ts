// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeCrypto from "node:crypto";
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
    // One request can produce several distinct token-bearing assistant bubbles.
    dedupeKey: `cursor:${key}`,
  };
}

export interface CursorUsageReadResult {
  readonly files: readonly { readonly path: string; readonly records: readonly UsageRecord[] }[];
  readonly missing: boolean;
  readonly error: boolean;
}

export interface CursorAccountUsageReadResult {
  readonly accountKey: string | null;
  readonly records: readonly UsageRecord[];
  readonly missing: boolean;
  readonly error: string | null;
}

const accountHash = (value: string) => NodeCrypto.createHash("sha256").update(value).digest("hex");

/** Dashboard usage includes headless agents and reports fresh input separately from cache reads. */
export async function readCursorAccountUsage(
  authPath: string,
  sinceMs: number,
  endDate: number,
  request: (url: string, init: RequestInit) => Promise<Response> = globalThis.fetch,
): Promise<CursorAccountUsageReadResult> {
  let auth: Record<string, unknown>;
  try {
    auth = object(JSON.parse(await NodeFSP.readFile(authPath, "utf8")));
  } catch (cause) {
    const missing = object(cause).code === "ENOENT";
    return {
      accountKey: null,
      records: [],
      missing,
      error: missing ? null : "Cursor credentials could not be read.",
    };
  }
  if (typeof auth.accessToken !== "string" || !auth.accessToken) {
    return { accountKey: null, records: [], missing: true, error: null };
  }
  let accountKey: string | null = null;
  try {
    const payload = auth.accessToken.split(".")[1];
    const subject = object(
      JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8")),
    ).sub;
    if (typeof subject !== "string" || !subject) throw new Error("Invalid authentication");
    const userId = subject.split("|").at(-1);
    if (!userId) throw new Error("Invalid authentication");
    accountKey = accountHash(subject);
    if (!Number.isFinite(sinceMs) || sinceMs < 0 || sinceMs > endDate)
      throw new Error("Invalid date window");
    const signal = AbortSignal.timeout(10_000);
    const records: UsageRecord[] = [];
    const occurrences = new Map<string, number>();
    const pages = new Set<string>();
    const pageSize = 1000;
    let total: number | undefined;
    let received = 0;
    for (let page = 1; page <= 100; page++) {
      const response = await request("https://cursor.com/api/dashboard/get-filtered-usage-events", {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          "Content-Type": "application/json",
          Origin: "https://cursor.com",
          Cookie: `WorkosCursorSessionToken=${encodeURIComponent(`${userId}::${auth.accessToken}`)}`,
        },
        body: JSON.stringify({
          page,
          pageSize,
          startDate: String(sinceMs),
          endDate: String(endDate),
        }),
      });
      if (response.status === 401 || response.status === 403) {
        return {
          accountKey,
          records: [],
          missing: false,
          error: "Sign in to Cursor again to read account usage.",
        };
      }
      if (!response.ok) throw new Error("Account usage request failed");
      const body = object(await response.json());
      const count = body.totalUsageEventsCount;
      const events = body.usageEventsDisplay;
      if (
        typeof count !== "number" ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        count > pageSize * 100 ||
        (total !== undefined && count !== total) ||
        !Array.isArray(events) ||
        events.length !== Math.min(pageSize, count - received)
      ) {
        throw new Error("Inconsistent account usage page");
      }
      total = count;
      const signature = accountHash(JSON.stringify(events));
      if (pages.has(signature)) throw new Error("Repeated account usage page");
      pages.add(signature);
      for (const raw of events) {
        const event = object(raw);
        const usage = object(event.tokenUsage);
        if (event.tokenUsage === undefined || event.tokenUsage === null) continue;
        for (const key of [
          "inputTokens",
          "outputTokens",
          "cacheReadTokens",
          "cacheWriteTokens",
          "totalCents",
        ]) {
          const value = usage[key];
          if (
            value !== undefined &&
            (typeof value !== "number" || !Number.isFinite(value) || value < 0)
          ) {
            throw new Error("Invalid account usage totals");
          }
        }
        const timestampMs =
          typeof event.timestamp === "string" && event.timestamp.trim() !== ""
            ? Number(event.timestamp)
            : event.timestamp;
        if (
          typeof timestampMs !== "number" ||
          !Number.isFinite(timestampMs) ||
          typeof event.model !== "string" ||
          !event.model
        )
          throw new Error("Invalid account usage event");
        if (timestampMs < sinceMs || timestampMs > endDate) continue;
        const totals = {
          uncachedInputTokens: tokens(usage.inputTokens),
          cachedInputTokens: tokens(usage.cacheReadTokens),
          cacheCreationTokens: tokens(usage.cacheWriteTokens),
          outputTokens: tokens(usage.outputTokens),
          reasoningTokens: 0,
        };
        const reportedCostUsd =
          typeof usage.totalCents === "number" ? usage.totalCents / 100 : null;
        const sessionId = typeof event.conversationId === "string" ? event.conversationId : "";
        // No event ID is provided. Preserve identical billed rows with an occurrence index.
        const key = accountHash(
          JSON.stringify([timestampMs, event.model, sessionId, totals, reportedCostUsd]),
        );
        const occurrence = occurrences.get(key) ?? 0;
        occurrences.set(key, occurrence + 1);
        records.push({
          provider: "cursor",
          timestampMs,
          model: event.model,
          sessionId,
          totals,
          reportedCostUsd,
          dedupeKey: `cursor-account:${accountKey}:${key}:${occurrence}`,
        });
      }
      received += events.length;
      if (received === total) return { accountKey, records, missing: false, error: null };
    }
    throw new Error("Account usage page limit exceeded");
  } catch {
    return {
      accountKey,
      records: [],
      missing: false,
      error: "Cursor account usage could not be read.",
    };
  }
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
