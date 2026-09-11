import type { EnvironmentId, EnvironmentMachineKind } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import type { SidebarProjectSnapshot } from "~/sidebarProjectGrouping";
import { EnvironmentMachineIcon } from "./EnvironmentMachineIcon";

/**
 * Machine icon for a project group's row: the first non-primary member's
 * machine, or none when the group only lives on this device. Matches the
 * thread rows and command palette, which draw an icon for remote work only.
 */
export function resolveProjectGroupMachine(input: {
  readonly group: Pick<SidebarProjectSnapshot, "memberProjects">;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly machineByEnvironmentId: ReadonlyMap<EnvironmentId, EnvironmentMachineKind>;
}): EnvironmentMachineKind | null {
  const remoteMember = input.group.memberProjects.find(
    (member) => member.environmentId !== input.primaryEnvironmentId,
  );
  return remoteMember
    ? (input.machineByEnvironmentId.get(remoteMember.environmentId) ?? null)
    : null;
}

/**
 * Muted "where this project lives" suffix for a project picker row. Callers
 * render it only while the catalog spans environments (see
 * projectGroupsSpanEnvironments), so single-machine users see no change.
 */
export function ProjectEnvironmentLabel(props: {
  readonly labels: readonly string[];
  readonly machine: EnvironmentMachineKind | null;
  readonly className?: string;
}) {
  if (props.labels.length === 0) return null;
  return (
    <span
      className={cn(
        "ml-auto flex min-w-0 max-w-[40%] shrink-0 items-center gap-1 font-normal text-muted-foreground text-xs",
        props.className,
      )}
    >
      {props.machine ? (
        <EnvironmentMachineIcon aria-hidden kind={props.machine} className="size-3 shrink-0" />
      ) : null}
      <span className="truncate">{props.labels.join(" · ")}</span>
    </span>
  );
}
