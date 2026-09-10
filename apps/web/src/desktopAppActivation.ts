import type {
  DesktopAppActivationFailure,
  DesktopAppActivationRequest,
  DesktopAppActivationResponse,
  EnvironmentId,
  ExecutionEnvironmentPlatformOs,
  ProjectId,
  ScopedProjectRef,
  ThreadId,
} from "@t3tools/contracts";
import { normalizeProjectPathForComparison } from "@t3tools/shared/path";

export interface DesktopAppActivationProject {
  readonly id: ProjectId;
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string;
}

export interface DesktopAppActivationTarget {
  readonly environmentId: EnvironmentId;
  readonly platform: ExecutionEnvironmentPlatformOs;
}

export interface DesktopAppActivationDependencies {
  readonly getTarget: () => DesktopAppActivationTarget | null;
  readonly findProject: (
    environmentId: EnvironmentId,
    workspaceRoot: string,
  ) => DesktopAppActivationProject | null;
  readonly createProject: (
    environmentId: EnvironmentId,
    workspaceRoot: string,
  ) => Promise<ProjectId>;
  readonly waitForProject: (projectRef: ScopedProjectRef) => Promise<void>;
  readonly openThread: (
    projectRef: ScopedProjectRef,
  ) => Promise<{ readonly threadId: ThreadId } | null>;
}

function failure(
  requestId: string,
  code: DesktopAppActivationFailure["code"],
  message: string,
): DesktopAppActivationFailure {
  return { version: 1, requestId, ok: false, code, message };
}

function desktopPlatformToEnvironmentOs(
  platform: DesktopAppActivationRequest["platform"],
): ExecutionEnvironmentPlatformOs {
  return platform === "win32" ? "windows" : platform;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

/**
 * Activation requests can overlap: the broker re-dispatches after a renderer
 * blip and the coordinator's queue restarts with the component, so two requests
 * for one workspace root can reach here before the projection shows the first
 * create. Sharing the in-flight create keeps the server from rejecting the
 * second one with its "already exists" invariant.
 */
const inFlightCreates = new Map<string, Promise<ProjectId>>();

function createProjectOnce(
  dependencies: DesktopAppActivationDependencies,
  environmentId: EnvironmentId,
  workspaceRoot: string,
): Promise<ProjectId> {
  const key = JSON.stringify([environmentId, normalizeProjectPathForComparison(workspaceRoot)]);
  const inFlight = inFlightCreates.get(key);
  if (inFlight !== undefined) return inFlight;
  const created = dependencies
    .createProject(environmentId, workspaceRoot)
    .finally(() => inFlightCreates.delete(key));
  inFlightCreates.set(key, created);
  return created;
}

export async function handleDesktopAppActivationRequest(
  request: DesktopAppActivationRequest,
  dependencies: DesktopAppActivationDependencies,
): Promise<DesktopAppActivationResponse> {
  const target = dependencies.getTarget();
  if (target === null) {
    return failure(
      request.requestId,
      "environment-unavailable",
      "The desktop app's primary local environment is not connected.",
    );
  }

  const requestPlatform = desktopPlatformToEnvironmentOs(request.platform);
  if (requestPlatform !== target.platform) {
    return failure(
      request.requestId,
      "platform-mismatch",
      `The command path is for ${requestPlatform}, but the desktop app's primary environment uses ${target.platform}. Cross-platform path mapping is not supported.`,
    );
  }

  let projectId = dependencies.findProject(target.environmentId, request.workspaceRoot)?.id ?? null;
  if (projectId === null) {
    try {
      projectId = await createProjectOnce(
        dependencies,
        target.environmentId,
        request.workspaceRoot,
      );
      await dependencies.waitForProject({ environmentId: target.environmentId, projectId });
    } catch (error) {
      // An earlier activation for this root may have created the project already.
      const existing =
        dependencies.findProject(target.environmentId, request.workspaceRoot)?.id ?? null;
      if (existing === null) {
        return failure(
          request.requestId,
          "project-create-failed",
          errorMessage(error, "T3 Code could not add the project."),
        );
      }
      projectId = existing;
    }
  }

  try {
    const opened = await dependencies.openThread({
      environmentId: target.environmentId,
      projectId,
    });
    if (opened === null) {
      return failure(
        request.requestId,
        "thread-open-failed",
        "T3 Code could not open a new thread for the project.",
      );
    }
    return {
      version: 1,
      requestId: request.requestId,
      ok: true,
      projectId,
      threadId: opened.threadId,
    };
  } catch (error) {
    return failure(
      request.requestId,
      "thread-open-failed",
      errorMessage(error, "T3 Code could not open a new thread for the project."),
    );
  }
}
