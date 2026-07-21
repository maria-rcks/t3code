import type { OrchestrationThreadShell } from "@t3tools/contracts";

export type ChangeRequestStateLike = "open" | "closed" | "merged";

const DAY_MS = 24 * 60 * 60 * 1_000;

export function threadLastActivityAt(shell: OrchestrationThreadShell): string | null {
  const candidates = [
    shell.latestUserMessageAt,
    shell.latestTurn?.requestedAt,
    shell.latestTurn?.startedAt,
    shell.latestTurn?.completedAt,
  ];
  let latest: string | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const timestamp = Date.parse(candidate);
    if (timestamp > latestTimestamp) {
      latest = candidate;
      latestTimestamp = timestamp;
    }
  }

  return latest;
}

/**
 * A thread may be settled (= archived) only when none of effectiveSettled's
 * activity blockers hold. This is deliberately the same list: anything the
 * partition refuses to CLASSIFY as settled must also be refused as a settle
 * TARGET, or settling would archive live work (stopping its provider
 * session) that would immediately render as active anyway.
 */
export function canSettle(
  shell: Pick<OrchestrationThreadShell, "hasPendingApprovals" | "hasPendingUserInput" | "session">,
): boolean {
  if (shell.hasPendingApprovals || shell.hasPendingUserInput) return false;
  if (shell.session?.status === "starting" || shell.session?.status === "running") return false;
  return true;
}

/**
 * Client-only settled resolution, backed by the pre-existing archive
 * lifecycle instead of dedicated settle commands — no server, protocol, or
 * database changes required. "Settled" here means: the user archived the
 * thread, its PR merged/closed, or it has been inactive past the auto-settle
 * window.
 *
 * Trade-offs vs the event-sourced settled model (kept on the main feature
 * branch): activity does not auto-un-settle an archived thread, and there is
 * no distinct "keep active" override — un-settling is just unarchiving.
 */
export function effectiveSettled(
  shell: OrchestrationThreadShell,
  options: {
    readonly now: string;
    readonly autoSettleAfterDays: number | null;
    readonly changeRequestState?: ChangeRequestStateLike | null;
  },
): boolean {
  // Blocked work must remain visible even when a user explicitly settled it.
  if (!canSettle(shell)) return false;
  if (shell.archivedAt !== null) return true;
  if (options.changeRequestState === "merged" || options.changeRequestState === "closed") {
    return true;
  }
  if (options.autoSettleAfterDays === null) return false;

  const lastActivityAt = threadLastActivityAt(shell);
  if (lastActivityAt === null) return false;

  // threadLastActivityAt only returns candidates whose Date.parse beat
  // -Infinity, so this parse is a real number; a malformed `now` yields NaN,
  // the comparison is false, and the thread stays active (never a surprise
  // auto-settle on bad input).
  return (
    Date.parse(lastActivityAt) < Date.parse(options.now) - options.autoSettleAfterDays * DAY_MS
  );
}
