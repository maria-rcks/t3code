import { describe, expect, it } from "vite-plus/test";

import { makePreviewAutomationKeySequence } from "./PreviewKeyboard.ts";

describe("preview keyboard packets", () => {
  it("sends Enter directly to the guest with its character event", () => {
    expect(makePreviewAutomationKeySequence({ key: "Enter" })).toEqual({
      keyDown: {
        type: "keyDown",
        keyCode: "Enter",
        modifiers: [],
        skipIfUnhandled: true,
      },
      char: {
        type: "char",
        keyCode: "\r",
        modifiers: [],
        skipIfUnhandled: true,
      },
      keyUp: {
        type: "keyUp",
        keyCode: "Enter",
        modifiers: [],
        skipIfUnhandled: true,
      },
      signal: { kind: "key", key: "Enter", code: "Enter" },
    });
  });

  it("sends printable text separately from keydown", () => {
    const sequence = makePreviewAutomationKeySequence({ key: "z" });
    expect(sequence.keyDown).toMatchObject({ type: "keyDown", keyCode: "z" });
    expect(sequence.char).toMatchObject({ type: "char", keyCode: "z" });
    expect(sequence.keyUp).toMatchObject({ type: "keyUp", keyCode: "z" });
  });

  it("suppresses text for shortcuts and retains macOS editing commands", () => {
    const sequence = makePreviewAutomationKeySequence(
      { key: "a", modifiers: ["Meta"] },
      { isMac: true },
    );
    expect(sequence.keyDown).toEqual({
      type: "keyDown",
      keyCode: "a",
      modifiers: ["meta"],
      skipIfUnhandled: true,
    });
    expect(sequence.char).toBeUndefined();
    expect(sequence.commands).toEqual(["selectAll"]);
  });

  it("maps common macOS editing shortcuts without changing other platforms", () => {
    expect(
      makePreviewAutomationKeySequence({ key: "z", modifiers: ["Shift", "Meta"] }, { isMac: true })
        .commands,
    ).toEqual(["redo"]);
    expect(
      makePreviewAutomationKeySequence({ key: "a", modifiers: ["Meta"] }).commands,
    ).toBeUndefined();
  });

  it.each([
    ["ArrowLeft", "Left"],
    ["ArrowRight", "Right"],
    ["ArrowUp", "Up"],
    ["ArrowDown", "Down"],
  ])("maps %s to Electron's %s accelerator", (key, keyCode) => {
    const sequence = makePreviewAutomationKeySequence({ key });
    expect(sequence.keyDown.keyCode).toBe(keyCode);
    expect(sequence.keyUp.keyCode).toBe(keyCode);
    expect(sequence.signal.key).toBe(key);
    expect(sequence.char).toBeUndefined();
  });

  it("resolves shifted printable keys to their browser values", () => {
    const sequence = makePreviewAutomationKeySequence({ key: "1", modifiers: ["Shift"] });
    expect(sequence.keyDown).toMatchObject({ keyCode: "!", modifiers: ["shift"] });
    expect(sequence.char).toMatchObject({ keyCode: "!" });
    expect(sequence.signal).toEqual({ kind: "key", key: "!", code: "Digit1" });
  });

  it("keeps shifted key values while suppressing text for modified chords", () => {
    const sequence = makePreviewAutomationKeySequence({
      key: "1",
      modifiers: ["Control", "Shift"],
    });
    expect(sequence.keyDown).toEqual({
      type: "keyDown",
      keyCode: "!",
      modifiers: ["control", "shift"],
      skipIfUnhandled: true,
    });
    expect(sequence.char).toBeUndefined();
    expect(sequence.signal).toEqual({ kind: "key", key: "!", code: "Digit1" });
  });
});
