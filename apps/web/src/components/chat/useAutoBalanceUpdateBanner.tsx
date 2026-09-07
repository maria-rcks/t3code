import { useAtomValue } from "@effect/atom-react";
import type { ServerUpdateState } from "@t3tools/client-runtime/state/server";
import { Atom } from "effect/unstable/reactivity";
import { useMemo, useState } from "react";

import type { EnvironmentPresentation } from "~/state/environments";
import { serverEnvironment } from "~/state/server";
import {
  buildVersionMismatchDismissalKey,
  dismissServerUpdateFailure,
  dismissVersionMismatch,
  isServerUpdateFailureDismissed,
  isVersionMismatchDismissed,
  resolveServerConfigVersionMismatch,
  resolveServerSelfUpdateCapability,
  supportsDesktopAppUpdate,
  supportsServerUpdateThreadContinuation,
} from "~/versionSkew";
import {
  ServerUpdateAction,
  ServerUpdateProgress,
  ServerUpdatesAction,
} from "../ServerUpdateAction";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";
import { ComposerServerUpdateIcon } from "./ComposerServerUpdateStatus";

/** Keep every machine's update visible while auto balance has no single update target. */
export function useAutoBalanceUpdateBanner(
  environments: readonly EnvironmentPresentation[],
): ComposerBannerStackItem | null {
  const statesAtom = useMemo(
    () =>
      Atom.make((get) =>
        environments.map((environment) => ({
          environment,
          state: get(serverEnvironment.updateStateAtom(environment.environmentId)),
        })),
      ),
    [environments],
  );
  const states = useAtomValue(statesAtom);
  const [dismissedNotices, setDismissedNotices] = useState<ReadonlySet<string | ServerUpdateState>>(
    () => new Set(),
  );
  const machines = states.flatMap(({ environment, state }) => {
    const mismatch = resolveServerConfigVersionMismatch(environment.serverConfig);
    const dismissKey = mismatch
      ? buildVersionMismatchDismissalKey(environment.environmentId, mismatch)
      : null;
    if (
      state.status === "idle"
        ? !mismatch ||
          (dismissKey !== null && dismissedNotices.has(dismissKey)) ||
          isVersionMismatchDismissed(dismissKey)
        : dismissedNotices.has(state) || isServerUpdateFailureDismissed(state)
    )
      return [];
    const selfUpdate = resolveServerSelfUpdateCapability(environment.serverConfig);
    const desktopAppUpdate = supportsDesktopAppUpdate(environment.serverConfig);
    return [
      {
        environmentId: environment.environmentId,
        serverLabel: environment.label,
        selfUpdate,
        desktopAppUpdate,
        threadContinuation: supportsServerUpdateThreadContinuation(environment.serverConfig),
        continueThreadsAfterServerUpdate:
          environment.serverConfig?.settings.continueThreadsAfterServerUpdate ?? false,
        targetVersion: state.status === "idle" ? mismatch!.clientVersion : state.targetVersion,
        connected: environment.connection.phase === "connected",
        remoteUpdate: selfUpdate !== null && (selfUpdate !== "desktop-managed" || desktopAppUpdate),
        state,
        dismissKey,
      },
    ];
  });
  if (machines.length === 0) return null;

  const running = machines.filter((machine) => machine.state.status === "running");
  const failed = machines.filter((machine) => machine.state.status === "failed");
  const manual = machines.filter((machine) => !machine.remoteUpdate);
  const targets = machines.filter(
    (machine) => machine.connected && machine.remoteUpdate && machine.state.status !== "running",
  );
  const title =
    running.length > 0
      ? `Updating ${running.length} ${running.length === 1 ? "machine" : "machines"}`
      : failed.length > 0
        ? `Could not update ${failed.length} ${failed.length === 1 ? "machine" : "machines"}`
        : `Update available for ${machines.length} ${machines.length === 1 ? "machine" : "machines"}`;
  return {
    id: "auto-balance-server-updates",
    variant: failed.length > 0 ? "error" : "default",
    priority: running.length > 0 ? "urgent" : "notice",
    icon: (
      <ComposerServerUpdateIcon
        status={running.length > 0 ? "running" : failed.length > 0 ? "failed" : "idle"}
      />
    ),
    title: (
      <Popover>
        <PopoverTrigger
          className="block max-w-full truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${title}. View machines`}
        >
          {title}
        </PopoverTrigger>
        <PopoverPopup side="top" align="start" className="w-80 max-w-[calc(100vw-2rem)]">
          <div className="space-y-3 text-xs">
            {machines.map((machine) => (
              <div key={machine.environmentId} className="space-y-1">
                <div className="font-medium">{machine.serverLabel}</div>
                {machine.state.status !== "idle" ? (
                  <ServerUpdateProgress state={machine.state} />
                ) : !machine.remoteUpdate ? (
                  <>
                    <div className="text-muted-foreground">Manual update required</div>
                    <ServerUpdateAction {...machine} />
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    {machine.connected
                      ? `Ready to update to ${machine.targetVersion}`
                      : "Reconnect this machine to update"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </PopoverPopup>
      </Popover>
    ),
    description:
      manual.length > 0
        ? `${manual.length} ${manual.length === 1 ? "needs" : "need"} a manual update`
        : undefined,
    actions:
      running.length === 0 && targets.length > 0 ? (
        <ServerUpdatesAction
          targets={targets}
          variant="ghost"
          label={
            failed.length > 0
              ? "Retry"
              : targets.length === machines.length
                ? "Update all"
                : `Update ${targets.length} ${targets.length === 1 ? "machine" : "machines"}`
          }
        />
      ) : undefined,
    ...(running.length > 0
      ? {}
      : {
          dismissLabel: "Dismiss update notice",
          onDismiss: () => {
            for (const machine of machines) {
              dismissServerUpdateFailure(machine.state);
              dismissVersionMismatch(machine.dismissKey);
            }
            setDismissedNotices((current) => {
              const next = new Set(current);
              for (const machine of machines) {
                if (machine.dismissKey) next.add(machine.dismissKey);
                if (machine.state.status === "failed") next.add(machine.state);
              }
              return next;
            });
          },
        }),
  };
}
