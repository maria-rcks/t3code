import { type CodexReasoningEffort, ProviderModelOptions } from "@t3tools/contracts";
import { normalizeModelSlug } from "@t3tools/shared/model";
import { Schema } from "effect";
import { useCallback } from "react";
import { useLocalStorage } from "./hooks/useLocalStorage";

const STICKY_COMPOSER_SETTINGS_STORAGE_KEY = "t3code:sticky-composer-settings:v1";

const StickyComposerSettingsStorageSchema = Schema.Struct({
  model: Schema.NullOr(Schema.String),
  modelOptions: ProviderModelOptions,
});

type StickyComposerSettingsStorage = typeof StickyComposerSettingsStorageSchema.Type;

export interface StickyComposerSettings {
  model: string | null;
  effort: CodexReasoningEffort | null;
  codexFastMode: boolean;
}

const DEFAULT_STICKY_COMPOSER_SETTINGS_STORAGE: StickyComposerSettingsStorage = {
  model: null,
  modelOptions: {},
};

function normalizeStickyComposerSettings(
  value: Partial<StickyComposerSettings> | StickyComposerSettings,
): StickyComposerSettings {
  return {
    model: normalizeModelSlug(value.model, "codex") ?? null,
    effort: value.effort ?? null,
    codexFastMode: value.codexFastMode === true,
  };
}

function stickyComposerSettingsFromStorage(
  value: StickyComposerSettingsStorage,
): StickyComposerSettings {
  return normalizeStickyComposerSettings({
    model: value.model,
    effort: value.modelOptions.codex?.reasoningEffort ?? null,
    codexFastMode: value.modelOptions.codex?.fastMode ?? false,
  });
}

function stickyComposerSettingsToStorage(
  value: StickyComposerSettings,
): StickyComposerSettingsStorage {
  const normalized = normalizeStickyComposerSettings(value);
  const codexModelOptions = {
    ...(normalized.effort ? { reasoningEffort: normalized.effort } : {}),
    ...(normalized.codexFastMode ? { fastMode: true } : {}),
  };

  return {
    model: normalized.model,
    modelOptions: Object.keys(codexModelOptions).length > 0 ? { codex: codexModelOptions } : {},
  };
}

export function useStickyComposerSettings() {
  const [storedSettings, setStoredSettings] = useLocalStorage(
    STICKY_COMPOSER_SETTINGS_STORAGE_KEY,
    DEFAULT_STICKY_COMPOSER_SETTINGS_STORAGE,
    StickyComposerSettingsStorageSchema,
  );
  const settings = stickyComposerSettingsFromStorage(storedSettings);

  const updateSettings = useCallback(
    (patch: Partial<StickyComposerSettings>) => {
      setStoredSettings((previous) =>
        stickyComposerSettingsToStorage(
          normalizeStickyComposerSettings({
            ...stickyComposerSettingsFromStorage(previous),
            ...patch,
          }),
        ),
      );
    },
    [setStoredSettings],
  );

  return {
    settings,
    updateSettings,
  } as const;
}
