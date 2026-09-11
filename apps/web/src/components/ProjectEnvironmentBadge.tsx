import type { EnvironmentId, EnvironmentMachineKind } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import type { SidebarProjectSnapshot } from "~/sidebarProjectGrouping";
import { EnvironmentMachineIcon } from "./EnvironmentMachineIcon";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

/**
 * Machine icon for a project picker row whose group has a member on another
 * environment, with the environment names in a tooltip. Projects that only
 * live on this device render nothing, the same rule thread rows use. Callers
 * render it only while the catalog spans environments (see
 * projectGroupsSpanEnvironments), so single-machine users see no change.
 */
export function ProjectEnvironmentBadge(props: {
  readonly group: Pick<SidebarProjectSnapshot, "memberProjects">;
  readonly primaryEnvironmentId: EnvironmentId | null;
  readonly machineByEnvironmentId: ReadonlyMap<EnvironmentId, EnvironmentMachineKind>;
  readonly className?: string;
}) {
  const remoteMembers = props.group.memberProjects.filter(
    (member) => member.environmentId !== props.primaryEnvironmentId,
  );
  const first = remoteMembers[0];
  if (!first) return null;
  const labels = remoteMembers
    .map((member) => member.environmentLabel ?? "Remote")
    .filter((label, index, all) => all.indexOf(label) === index)
    .join(", ");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={`Remote environment: ${labels}`}
            className={cn(
              "ml-auto inline-flex shrink-0 items-center text-muted-foreground",
              props.className,
            )}
          />
        }
      >
        <EnvironmentMachineIcon
          aria-hidden
          kind={props.machineByEnvironmentId.get(first.environmentId) ?? "server"}
          className="size-3.5"
        />
      </TooltipTrigger>
      <TooltipPopup side="top">{labels}</TooltipPopup>
    </Tooltip>
  );
}
