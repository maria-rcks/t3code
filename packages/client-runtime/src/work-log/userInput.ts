import {
  type OrchestrationThreadActivity,
  UserInputAttachmentAnswerPayload,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const isQuestionAnswer = Schema.is(UserInputAttachmentAnswerPayload);

function displayOptionAnswer(value: unknown, labels: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return labels.get(value) ?? value;
  if (Array.isArray(value)) return value.map((answer) => displayOptionAnswer(answer, labels));
  const nested = record(value);
  return nested && "answers" in nested
    ? { ...nested, answers: displayOptionAnswer(nested.answers, labels) }
    : value;
}

function questionFingerprint(
  turnId: string,
  questions: ReadonlyArray<unknown>,
): string | undefined {
  const texts = questions.map((question) => {
    const value = record(question);
    return typeof value?.question === "string" ? value.question.trim() : "";
  });
  return texts.length > 0 && texts.every(Boolean)
    ? JSON.stringify([turnId, texts.toSorted()])
    : undefined;
}

function withoutDuplicateQuestionTools(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ReadonlyArray<OrchestrationThreadActivity> {
  const questions = new Set<string>();
  for (const activity of activities) {
    if (activity.kind !== "user-input.answer-submitted" || !activity.turnId) continue;
    const payload = record(activity.payload);
    const texts = Object.values(record(payload?.questionTextById) ?? {});
    const fingerprint = questionFingerprint(
      activity.turnId,
      texts.map((question) => ({ question })),
    );
    if (fingerprint) questions.add(fingerprint);
  }
  if (questions.size === 0) return activities;
  const duplicateToolIds = new Set<string>();
  for (const activity of activities) {
    if (!activity.kind.startsWith("tool.") || !activity.turnId) continue;
    const payload = record(activity.payload);
    if (typeof payload?.toolCallId !== "string") continue;
    const data = record(payload.data);
    const item = record(data?.item);
    const name = data?.toolName ?? data?.tool ?? item?.tool ?? payload.title;
    if (typeof name !== "string") continue;
    const normalizedName = name
      .split(/__|[./]/)
      .at(-1)
      ?.replace(/[_\s]/g, "")
      .toLowerCase();
    if (
      normalizedName !== "askuserquestion" &&
      normalizedName !== "requestuserinput" &&
      normalizedName !== "requestuserinputasync" &&
      normalizedName !== "askquestion" &&
      normalizedName !== "question"
    )
      continue;
    const input = record(
      data?.input ?? data?.rawInput ?? record(data?.state)?.input ?? item?.arguments,
    );
    if (!Array.isArray(input?.questions)) continue;
    const fingerprint = questionFingerprint(activity.turnId, input.questions);
    if (fingerprint && questions.has(fingerprint)) {
      duplicateToolIds.add(JSON.stringify([activity.turnId, payload.toolCallId]));
    }
  }
  return activities.filter((activity) => {
    const toolCallId = record(activity.payload)?.toolCallId;
    return (
      !activity.kind.startsWith("tool.") ||
      typeof toolCallId !== "string" ||
      !duplicateToolIds.has(JSON.stringify([activity.turnId, toolCallId]))
    );
  });
}

/** Keep a question and its answer at the original tool position in the work log. */
export function foldUserInputActivities(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ReadonlyArray<OrchestrationThreadActivity> {
  const result: OrchestrationThreadActivity[] = [];
  const positions = new Map<string, number>();
  const submittedAnswers = new Map<string, Record<string, unknown>>();
  for (const activity of activities) {
    if (
      activity.kind !== "user-input.requested" &&
      activity.kind !== "user-input.resolved" &&
      activity.kind !== "user-input.answer-submitted"
    ) {
      result.push(activity);
      continue;
    }
    const payload = record(activity.payload);
    const requestId = payload?.requestId;
    if (!payload || typeof requestId !== "string" || requestId.length === 0) {
      result.push(activity);
      continue;
    }
    const position = positions.get(requestId);
    const previous = position === undefined ? undefined : result[position];
    const previousPayload = record(previous?.payload);
    const questionTextById = {
      ...record(previousPayload?.questionTextById),
      ...record(payload.questionTextById),
    };
    if (Array.isArray(payload.questions)) {
      for (const value of payload.questions) {
        const question = record(value);
        if (typeof question?.id === "string" && typeof question.question === "string") {
          questionTextById[question.id] = question.question;
        }
      }
    }
    const incomingAnswers = record(payload.answers);
    if (activity.kind === "user-input.answer-submitted" && incomingAnswers) {
      submittedAnswers.set(requestId, incomingAnswers);
    }
    const answers =
      submittedAnswers.get(requestId) ?? incomingAnswers ?? record(previousPayload?.answers) ?? {};
    const attachmentsByQuestionId = {
      ...record(previousPayload?.attachmentsByQuestionId),
      ...record(payload.attachmentsByQuestionId),
    };
    const questionAnswer = { requestId, questionTextById, answers, attachmentsByQuestionId };
    if (!isQuestionAnswer(questionAnswer)) {
      result.push(activity);
      continue;
    }
    const hasAnswer =
      Object.keys(answers).length > 0 || Object.keys(attachmentsByQuestionId).length > 0;
    const userInputStatus = hasAnswer
      ? "submitted"
      : activity.kind === "user-input.resolved"
        ? "dismissed"
        : (previousPayload?.userInputStatus ?? "pending");
    const folded: OrchestrationThreadActivity = {
      ...(previous ?? activity),
      kind: "user-input.answer-submitted",
      tone: "tool",
      summary:
        userInputStatus === "submitted"
          ? "User input submitted"
          : userInputStatus === "dismissed"
            ? "User input dismissed"
            : "User input requested",
      payload: { ...previousPayload, ...payload, ...questionAnswer, userInputStatus },
    };
    if (position === undefined) {
      positions.set(requestId, result.length);
      result.push(folded);
    } else {
      result[position] = folded;
    }
  }
  for (const position of positions.values()) {
    const activity = result[position]!;
    const payload = { ...record(activity.payload) };
    delete payload.detail;
    const answers = { ...record(payload.answers) };
    if (Array.isArray(payload.questions)) {
      for (const value of payload.questions) {
        const question = record(value);
        if (typeof question?.id !== "string" || !Array.isArray(question.options)) continue;
        const labels = new Map<string, string>();
        for (const value of question.options) {
          const option = record(value);
          if (typeof option?.value === "string" && typeof option.label === "string") {
            labels.set(option.value, option.label);
          }
        }
        if (question.id in answers) {
          answers[question.id] = displayOptionAnswer(answers[question.id], labels);
        }
      }
    }
    result[position] = { ...activity, payload: { ...payload, answers } };
  }
  return withoutDuplicateQuestionTools(result);
}

export function getQuestionAnswerText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(getQuestionAnswerText).filter(Boolean).join(", ");
  const nested = record(value);
  return nested ? getQuestionAnswerText(nested.answers) : "";
}

export function getQuestionAnswerPreview(answer: UserInputAttachmentAnswerPayload): string {
  const answers = Object.values(answer.answers).map(getQuestionAnswerText).filter(Boolean);
  const attachments = Object.values(answer.attachmentsByQuestionId)
    .flat()
    .map((attachment) => attachment.name);
  return (
    answers.length > 0
      ? answers.join(" · ")
      : attachments.length > 0
        ? attachments.join(", ")
        : Object.values(answer.questionTextById ?? {}).join(" · ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function hasQuestionAnswer(answer: UserInputAttachmentAnswerPayload): boolean {
  return (
    Object.values(answer.answers).some(getQuestionAnswerText) ||
    Object.values(answer.attachmentsByQuestionId).some((attachments) => attachments.length > 0)
  );
}
