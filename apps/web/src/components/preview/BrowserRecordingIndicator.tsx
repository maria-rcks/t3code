import type { ScopedThreadRef } from "@t3tools/contracts";

import { useActiveBrowserRecordingTabIds } from "~/browser/browserRecording";

export function BrowserRecordingIndicator({ threadRef }: { threadRef: ScopedThreadRef }) {
  const recordingTabIds = useActiveBrowserRecordingTabIds(threadRef);

  if (recordingTabIds.size === 0) return null;

  return (
    <span
      role="status"
      aria-label="Preview recording in progress"
      className="inline-flex min-w-0 items-center gap-1.5 text-xs font-normal text-muted-foreground"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full bg-red-500 motion-safe:animate-status-pulse"
      />
      <span className="truncate">Recording</span>
    </span>
  );
}
