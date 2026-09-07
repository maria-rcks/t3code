import {
  PROVIDER_SEND_TURN_MAX_FILE_BYTES,
  type DesktopPreviewRecordingArtifact,
  type EnvironmentId,
} from "@t3tools/contracts";
import { resolveAssetUrl } from "@t3tools/client-runtime/state/assets";
import { runAttachmentUploadCycle } from "@t3tools/client-runtime/state/attachments";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { attachmentEnvironment } from "~/state/attachments";
import { readPreparedConnection } from "~/state/session";

/** Sends the finished encoded file once; capture frames never cross the environment connection. */
export async function uploadBrowserRecording(
  environmentId: EnvironmentId,
  artifact: DesktopPreviewRecordingArtifact,
  blob: Blob,
): Promise<string> {
  if (blob.size > PROVIDER_SEND_TURN_MAX_FILE_BYTES) {
    throw new Error(`Recording exceeds the 50 MiB transfer limit. Desktop copy: ${artifact.path}`);
  }
  const result = await runAttachmentUploadCycle({
    registry: appAtomRegistry,
    createUploadUrl: attachmentEnvironment.createUploadUrl,
    remove: attachmentEnvironment.remove,
    environmentId,
    upload: {
      type: "file",
      name: artifact.path.split(/[\\/]/).at(-1) ?? artifact.id,
      mimeType: artifact.mimeType,
      sizeBytes: blob.size,
    },
    resolveUploadUrl: (relativeUrl) => {
      const connection = readPreparedConnection(environmentId);
      return connection ? resolveAssetUrl(connection.httpBaseUrl, relativeUrl) : null;
    },
    transport: (url) => {
      const controller = new AbortController();
      return {
        abort: () => controller.abort(),
        done: fetch(url, {
          method: "POST",
          headers: { "Content-Type": artifact.mimeType },
          body: blob,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(110_000)]),
        }).then((response) => {
          if (!response.ok) throw new Error(`Recording upload rejected (${response.status}).`);
        }),
      };
    },
  });
  if (result.status !== "uploaded") {
    throw new Error(`Recording transfer failed. Desktop copy: ${artifact.path}`, {
      cause: result.status === "failed" ? result.error : undefined,
    });
  }
  return result.attachmentId;
}
