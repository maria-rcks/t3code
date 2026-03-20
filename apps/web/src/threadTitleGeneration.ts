import {
  DEFAULT_GIT_TEXT_GENERATION_MODEL,
  type NativeApi,
  type ThreadId,
} from "@t3tools/contracts";

import { newCommandId } from "./lib/utils";

export async function generateAndRenameThreadTitle(input: {
  api: NativeApi;
  threadId: ThreadId;
  model?: string | null;
}): Promise<string> {
  const generated = await input.api.server.generateThreadTitle({
    threadId: input.threadId,
    model: input.model ?? DEFAULT_GIT_TEXT_GENERATION_MODEL,
  });

  await input.api.orchestration.dispatchCommand({
    type: "thread.meta.update",
    commandId: newCommandId(),
    threadId: input.threadId,
    title: generated.title,
    titleSummaryState: "generated",
  });

  return generated.title;
}
