import type { PreviewAutomationPressInput } from "@t3tools/contracts";

interface KeyDefinition {
  readonly code: string;
  readonly key: string;
  readonly keyCode: number;
  readonly text?: string;
  readonly location?: number;
  readonly shiftedKey?: string;
}

export interface PreviewAutomationKeyEvent extends Electron.KeyboardInputEvent {
  readonly skipIfUnhandled: true;
}

export interface PreviewAutomationKeySequence {
  readonly keyDown: PreviewAutomationKeyEvent;
  readonly char?: PreviewAutomationKeyEvent;
  readonly keyUp: PreviewAutomationKeyEvent;
  readonly commands?: ReadonlyArray<string>;
  readonly signal: {
    readonly kind: "key";
    readonly key: string;
    readonly code: string;
  };
}

const NAMED_KEYS: Readonly<Record<string, KeyDefinition>> = {
  Escape: { code: "Escape", key: "Escape", keyCode: 27 },
  Backspace: { code: "Backspace", key: "Backspace", keyCode: 8 },
  Tab: { code: "Tab", key: "Tab", keyCode: 9 },
  Enter: { code: "Enter", key: "Enter", keyCode: 13, text: "\r" },
  Shift: { code: "ShiftLeft", key: "Shift", keyCode: 16, location: 1 },
  Control: { code: "ControlLeft", key: "Control", keyCode: 17, location: 1 },
  Alt: { code: "AltLeft", key: "Alt", keyCode: 18, location: 1 },
  Meta: { code: "MetaLeft", key: "Meta", keyCode: 91, location: 1 },
  CapsLock: { code: "CapsLock", key: "CapsLock", keyCode: 20 },
  Space: { code: "Space", key: " ", keyCode: 32, text: " " },
  PageUp: { code: "PageUp", key: "PageUp", keyCode: 33 },
  PageDown: { code: "PageDown", key: "PageDown", keyCode: 34 },
  End: { code: "End", key: "End", keyCode: 35 },
  Home: { code: "Home", key: "Home", keyCode: 36 },
  ArrowLeft: { code: "ArrowLeft", key: "ArrowLeft", keyCode: 37 },
  ArrowUp: { code: "ArrowUp", key: "ArrowUp", keyCode: 38 },
  ArrowRight: { code: "ArrowRight", key: "ArrowRight", keyCode: 39 },
  ArrowDown: { code: "ArrowDown", key: "ArrowDown", keyCode: 40 },
  Insert: { code: "Insert", key: "Insert", keyCode: 45 },
  Delete: { code: "Delete", key: "Delete", keyCode: 46 },
};

const PRINTABLE_KEYS: ReadonlyArray<KeyDefinition> = [
  { code: "Backquote", key: "`", shiftedKey: "~", keyCode: 192 },
  { code: "Digit1", key: "1", shiftedKey: "!", keyCode: 49 },
  { code: "Digit2", key: "2", shiftedKey: "@", keyCode: 50 },
  { code: "Digit3", key: "3", shiftedKey: "#", keyCode: 51 },
  { code: "Digit4", key: "4", shiftedKey: "$", keyCode: 52 },
  { code: "Digit5", key: "5", shiftedKey: "%", keyCode: 53 },
  { code: "Digit6", key: "6", shiftedKey: "^", keyCode: 54 },
  { code: "Digit7", key: "7", shiftedKey: "&", keyCode: 55 },
  { code: "Digit8", key: "8", shiftedKey: "*", keyCode: 56 },
  { code: "Digit9", key: "9", shiftedKey: "(", keyCode: 57 },
  { code: "Digit0", key: "0", shiftedKey: ")", keyCode: 48 },
  { code: "Minus", key: "-", shiftedKey: "_", keyCode: 189 },
  { code: "Equal", key: "=", shiftedKey: "+", keyCode: 187 },
  { code: "Backslash", key: "\\", shiftedKey: "|", keyCode: 220 },
  { code: "BracketLeft", key: "[", shiftedKey: "{", keyCode: 219 },
  { code: "BracketRight", key: "]", shiftedKey: "}", keyCode: 221 },
  { code: "Semicolon", key: ";", shiftedKey: ":", keyCode: 186 },
  { code: "Quote", key: "'", shiftedKey: '"', keyCode: 222 },
  { code: "Comma", key: ",", shiftedKey: "<", keyCode: 188 },
  { code: "Period", key: ".", shiftedKey: ">", keyCode: 190 },
  { code: "Slash", key: "/", shiftedKey: "?", keyCode: 191 },
];

/**
 * Chromium does not infer macOS editing commands from synthetic Meta chords.
 * Keep the common browser editing/navigation shortcuts explicit so dispatched
 * key events behave like their physical-key equivalents.
 */
const MAC_EDITING_COMMANDS: Readonly<Record<string, string>> = {
  "Meta+Backspace": "deleteToBeginningOfLine",
  "Meta+ArrowUp": "moveToBeginningOfDocument",
  "Meta+ArrowDown": "moveToEndOfDocument",
  "Meta+ArrowLeft": "moveToLeftEndOfLine",
  "Meta+ArrowRight": "moveToRightEndOfLine",
  "Shift+Meta+ArrowUp": "moveToBeginningOfDocumentAndModifySelection",
  "Shift+Meta+ArrowDown": "moveToEndOfDocumentAndModifySelection",
  "Shift+Meta+ArrowLeft": "moveToLeftEndOfLineAndModifySelection",
  "Shift+Meta+ArrowRight": "moveToRightEndOfLineAndModifySelection",
  "Meta+KeyA": "selectAll",
  "Meta+KeyC": "copy",
  "Meta+KeyX": "cut",
  "Meta+KeyV": "paste",
  "Meta+KeyZ": "undo",
  "Shift+Meta+KeyZ": "redo",
};
const SHORTCUT_MODIFIER_ORDER = ["Shift", "Control", "Alt", "Meta"] as const;

const macEditingCommands = (
  code: string,
  modifiers: PreviewAutomationPressInput["modifiers"],
): ReadonlyArray<string> => {
  const shortcut = [
    ...SHORTCUT_MODIFIER_ORDER.filter((modifier) => modifiers?.includes(modifier)),
    code,
  ].join("+");
  const command = MAC_EDITING_COMMANDS[shortcut];
  return command ? [command] : [];
};

function resolveKeyDefinition(input: PreviewAutomationPressInput): KeyDefinition {
  const named = NAMED_KEYS[input.key === " " ? "Space" : input.key];
  if (named) return named;

  const functionKey = /^F([1-9]|1[0-2])$/.exec(input.key);
  if (functionKey) {
    const number = Number(functionKey[1]);
    return { code: input.key, key: input.key, keyCode: 111 + number };
  }

  if (/^[a-z]$/i.test(input.key)) {
    const upper = input.key.toUpperCase();
    const shifted = input.modifiers?.includes("Shift") ?? false;
    const key = shifted || input.key === upper ? upper : input.key;
    return { code: `Key${upper}`, key, keyCode: upper.charCodeAt(0), text: key };
  }

  const printable = PRINTABLE_KEYS.find(
    (definition) => definition.key === input.key || definition.shiftedKey === input.key,
  );
  if (printable) {
    const shifted = input.modifiers?.includes("Shift") ?? false;
    const key =
      printable.shiftedKey && (shifted || input.key === printable.shiftedKey)
        ? printable.shiftedKey
        : printable.key;
    return { ...printable, key, text: key };
  }

  return {
    code: input.key.length > 1 ? input.key : "",
    key: input.key,
    keyCode: 0,
    ...(input.key.length === 1 ? { text: input.key } : {}),
  };
}

/**
 * Send directly to the guest widget. CDP keyboard input resolves the embedder's
 * focused widget and can deliver a background preview's keys to the composer.
 */
export function makePreviewAutomationKeySequence(
  input: PreviewAutomationPressInput,
  options?: { readonly isMac?: boolean },
): PreviewAutomationKeySequence {
  const definition = resolveKeyDefinition(input);
  const modifiers = (input.modifiers ?? []).map((modifier) => {
    switch (modifier) {
      case "Alt":
        return "alt" as const;
      case "Control":
        return "control" as const;
      case "Meta":
        return "meta" as const;
      case "Shift":
        return "shift" as const;
    }
  });
  const suppressText = input.modifiers?.some((modifier) => modifier !== "Shift") ?? false;
  const text = suppressText ? "" : (definition.text ?? "");
  const commands = options?.isMac ? macEditingCommands(definition.code, input.modifiers) : [];
  const shared = {
    keyCode: definition.key.startsWith("Arrow") ? definition.key.slice(5) : definition.key,
    modifiers,
    skipIfUnhandled: true as const,
  };
  // Electron's accelerator parser lowercases letters unless Shift is explicit.
  // Unsupported character accelerators still insert text, but report an empty key.
  const nativeKey =
    definition.keyCode === 0 && definition.key.length === 1
      ? ""
      : /^[A-Z]$/.test(definition.key) && !modifiers.includes("shift")
        ? definition.key.toLowerCase()
        : definition.key;

  return {
    keyDown: {
      type: "keyDown",
      ...shared,
    },
    ...(text ? { char: { ...shared, type: "char" as const, keyCode: text } } : {}),
    keyUp: { type: "keyUp", ...shared },
    ...(commands.length > 0 ? { commands } : {}),
    signal: { kind: "key", key: nativeKey, code: definition.code },
  };
}

/** CDP is safe for child renderer targets, which cannot retarget keys to the desktop. */
export function makePreviewAutomationFrameKeySequence(
  input: PreviewAutomationPressInput,
  options?: { readonly isMac?: boolean },
) {
  const definition = resolveKeyDefinition(input);
  const modifiers = (input.modifiers ?? []).reduce(
    (mask, modifier) => mask | { Alt: 1, Control: 2, Meta: 4, Shift: 8 }[modifier],
    0,
  );
  const text = input.modifiers?.some((modifier) => modifier !== "Shift")
    ? ""
    : (definition.text ?? "");
  const commands = options?.isMac ? macEditingCommands(definition.code, input.modifiers) : [];
  const shared = {
    key: definition.key,
    code: definition.code,
    modifiers,
    windowsVirtualKeyCode: definition.keyCode,
  };
  return {
    keyDown: {
      type: text ? "keyDown" : "rawKeyDown",
      ...shared,
      ...(text ? { text, unmodifiedText: text } : {}),
      ...(commands.length ? { commands } : {}),
    },
    keyUp: { type: "keyUp", ...shared },
  };
}

/** Keep macOS editing shortcuts inside the target page without native focus. */
export function previewAutomationEditingCommandExpression(
  input: PreviewAutomationPressInput,
  sequence: PreviewAutomationKeySequence,
): string {
  const definition = resolveKeyDefinition(input);
  const event = {
    key: definition.key,
    code: definition.code,
    keyCode: definition.keyCode,
    which: definition.keyCode,
    location: definition.location ?? 0,
    altKey: input.modifiers?.includes("Alt") ?? false,
    ctrlKey: input.modifiers?.includes("Control") ?? false,
    metaKey: input.modifiers?.includes("Meta") ?? false,
    shiftKey: input.modifiers?.includes("Shift") ?? false,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  return `(() => {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    if (!element) return;
    const event = ${JSON.stringify(event)};
    try {
      if (!element.dispatchEvent(new KeyboardEvent("keydown", event))) return;
      for (const command of ${JSON.stringify(sequence.commands ?? [])}) {
        const inputType = command === "deleteToBeginningOfLine" ? "deleteSoftLineBackward"
          : command === "undo" ? "historyUndo"
          : command === "redo" ? "historyRedo" : null;
        // execCommand emits input without beforeinput. Let controlled editors
        // perform the edit before applying the browser's default operation.
        if (inputType && !element.dispatchEvent(new InputEvent("beforeinput", {
          inputType, bubbles: true, cancelable: true, composed: true,
        }))) continue;
        const selection = document.getSelection();
        if (command === "deleteToBeginningOfLine") {
          const collapsed = typeof element.selectionStart === "number"
            ? element.selectionStart === element.selectionEnd
            : selection?.isCollapsed;
          if (collapsed) selection?.modify("extend", "backward", "lineboundary");
          document.execCommand("delete");
        } else if (command.startsWith("moveTo")) {
          const selectionElement = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
            ? selection.anchorNode : selection?.anchorNode?.parentElement;
          const editable = element.isContentEditable || selectionElement?.isContentEditable ||
            (((element instanceof HTMLInputElement && element.selectionStart !== null) ||
              element instanceof HTMLTextAreaElement) &&
              !element.readOnly && !element.disabled);
          if (!editable && (command === "moveToBeginningOfDocument" || command === "moveToEndOfDocument")) {
            let scrollable = element === document.body ? selectionElement ?? element : element;
            while (scrollable && !(scrollable.scrollHeight > scrollable.clientHeight &&
              /^(auto|scroll|overlay)$/.test(getComputedStyle(scrollable).overflowY))) {
              scrollable = scrollable.parentElement ?? scrollable.getRootNode().host;
            }
            scrollable ??= document.scrollingElement;
            if (scrollable) scrollable.scrollTop = command === "moveToBeginningOfDocument"
              ? 0 : scrollable.scrollHeight;
            continue;
          }
          const direction = command.includes("Beginning") ? "backward"
            : command.includes("Left") ? "left"
            : command.includes("Right") ? "right" : "forward";
          selection?.modify(
            command.endsWith("AndModifySelection") ? "extend" : "move",
            direction,
            command.includes("Document") ? "documentboundary" : "lineboundary",
          );
          if (element instanceof HTMLInputElement && element.selectionStart !== null) {
            if (command.includes("Left") || command.includes("Beginning")) element.scrollLeft = 0;
            else element.scrollLeft = element.scrollWidth;
          }
          // Programmatic selection changes do not reveal the caret like native editing commands.
          if (editable && command.includes("Document")) {
            const beginning = command.includes("Beginning");
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
              element.scrollTop = beginning ? 0 : element.scrollHeight;
            } else {
              const caretElement = selection?.focusNode?.nodeType === Node.ELEMENT_NODE
                ? selection.focusNode : selection?.focusNode?.parentElement;
              caretElement?.scrollIntoView({ block: beginning ? "start" : "end", inline: "nearest" });
            }
          }
        } else {
          document.execCommand(command);
        }
      }
    } finally {
      element.dispatchEvent(new KeyboardEvent("keyup", event));
    }
  })()`;
}
