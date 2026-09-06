import { type CSSProperties, useEffect, useRef, useState } from "react";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import {
  persistClientSettingsUpdate,
  useClientSettings,
  useUpdatePrimarySettings,
} from "../../hooks/useSettings";
import { compressImageForStash, MAX_COMPRESSIBLE_SOURCE_BYTES } from "../../lib/imageCompression";
import { TimelineBackgroundImage } from "../chat/ChatTimelineBackground";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SettingsRow, SettingsSection } from "./settingsLayout";

export function TimelineBackgroundSettings() {
  const image = useClientSettings((settings) => settings.timelineBackgroundImage);
  const opacity = useClientSettings((settings) => settings.timelineBackgroundOpacity);
  const blur = useClientSettings((settings) => settings.timelineBackgroundBlur);
  const updateSettings = useUpdatePrimarySettings();
  const [draft, setDraft] = useState({ image, url: image.startsWith("http") ? image : "" });
  const url = draft.image === image ? draft.url : image.startsWith("http") ? image : "";
  const setUrl = (value: string) => setDraft({ image, url: value });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null);
  const [blurDraft, setBlurDraft] = useState<number | null>(null);
  const previewOpacity = opacityDraft ?? opacity;
  const previewBlur = blurDraft ?? blur;
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  function saveOpacity(value: number) {
    setOpacityDraft(null);
    if (value !== opacity) updateSettings({ timelineBackgroundOpacity: value });
  }

  function saveBlur(value: number) {
    setBlurDraft(null);
    if (value !== blur) updateSettings({ timelineBackgroundBlur: value });
  }

  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  async function applyImage(source: string | File) {
    const generation = ++request.current;
    setBusy(true);
    setError("");
    try {
      let nextImage: string;
      if (typeof source === "string") {
        const parsed = new URL(source.trim());
        if (!["https:", "http:"].includes(parsed.protocol)) {
          throw new Error("Use an http or https image URL, or choose a local file.");
        }
        nextImage = parsed.href;
      } else {
        if (!source.type.startsWith("image/") || source.size > MAX_COMPRESSIBLE_SOURCE_BYTES) {
          throw new Error("Choose an image smaller than 50 MB.");
        }
        const result = await compressImageForStash(source);
        if (!result.ok) throw new Error("This image could not be saved. Try a smaller image.");
        nextImage = result.image.dataUrl;
      }
      await new Promise<void>((resolve, reject) => {
        const probe = new Image();
        const timeout = window.setTimeout(() => finish(false), 15000);
        function finish(loaded: boolean) {
          window.clearTimeout(timeout);
          probe.removeEventListener("load", onLoad);
          probe.removeEventListener("error", onError);
          if (loaded) resolve();
          else
            reject(new Error("Could not load this image. Check the URL or choose another file."));
        }
        const onLoad = () => finish(true);
        const onError = () => finish(false);
        probe.addEventListener("load", onLoad);
        probe.addEventListener("error", onError);
        probe.src = nextImage;
      });
      if (generation !== request.current) return;
      try {
        await persistClientSettingsUpdate((current) =>
          generation === request.current
            ? { ...current, timelineBackgroundImage: nextImage }
            : current,
        );
      } catch {
        throw new Error(
          "Could not save this image. Client storage may be full. Try a smaller image.",
        );
      }
    } catch (cause) {
      if (generation === request.current) {
        setError(
          cause instanceof TypeError
            ? "Enter a full image URL, or choose a local file."
            : cause instanceof Error
              ? cause.message
              : "Could not load this image.",
        );
      }
    } finally {
      if (generation === request.current) setBusy(false);
    }
  }

  return (
    <SettingsSection
      id="timeline-background"
      title="Chat background"
      description="An image behind the chat timeline. Saved on this client."
      onPaste={(event) => {
        const file = Array.from(event.clipboardData.files).find((item) =>
          item.type.startsWith("image/"),
        );
        if (!file) return;
        event.preventDefault();
        void applyImage(file);
      }}
    >
      <SettingsRow
        title="Background image"
        description="Use an image URL, choose a local file, or paste an image here."
      >
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void applyImage(url);
          }}
        >
          <Input
            aria-label="Background image URL"
            placeholder="https://example.com/background.jpg"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="min-w-40 flex-1"
          />
          <Button type="submit" variant="outline" disabled={busy || !url.trim()}>
            Apply URL
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Choose image
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Choose background image"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void applyImage(file);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={!image && !busy}
            onClick={() => {
              request.current++;
              setBusy(false);
              setError("");
              setUrl("");
              updateSettings({
                timelineBackgroundImage: "",
                timelineBackgroundOpacity: DEFAULT_CLIENT_SETTINGS.timelineBackgroundOpacity,
                timelineBackgroundBlur: DEFAULT_CLIENT_SETTINGS.timelineBackgroundBlur,
              });
            }}
          >
            Remove
          </Button>
        </form>
        {busy && (
          <p role="status" className="text-xs text-muted-foreground">
            Loading image…
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </SettingsRow>
      <SettingsRow
        title="Opacity"
        control={
          <div className="flex w-full items-center gap-3 sm:w-52">
            <output
              htmlFor="timeline-background-opacity"
              className="min-w-12 text-center font-mono text-xs"
            >
              {previewOpacity}%
            </output>
            <input
              id="timeline-background-opacity"
              aria-label="Background opacity"
              type="range"
              min={0}
              max={100}
              step={1}
              value={previewOpacity}
              style={
                {
                  "--settings-slider-progress": `${previewOpacity}%`,
                  "--settings-slider-fill-offset": `${0.5 - previewOpacity / 100}rem`,
                } as CSSProperties
              }
              disabled={!image}
              className="settings-slider min-w-0 flex-1"
              onChange={(event) => setOpacityDraft(Number(event.target.value))}
              onPointerUp={(event) => saveOpacity(Number(event.currentTarget.value))}
              onPointerCancel={() => setOpacityDraft(null)}
              onKeyUp={(event) => saveOpacity(Number(event.currentTarget.value))}
              onBlur={(event) => saveOpacity(Number(event.currentTarget.value))}
            />
          </div>
        }
      />
      <SettingsRow
        title="Blur"
        control={
          <div className="flex w-full items-center gap-3 sm:w-52">
            <output
              htmlFor="timeline-background-blur"
              className="min-w-12 text-center font-mono text-xs"
            >
              {previewBlur}px
            </output>
            <input
              id="timeline-background-blur"
              aria-label="Background blur"
              type="range"
              min={0}
              max={30}
              step={1}
              value={previewBlur}
              style={
                {
                  "--settings-slider-progress": `${(previewBlur / 30) * 100}%`,
                  "--settings-slider-fill-offset": `${0.5 - previewBlur / 30}rem`,
                } as CSSProperties
              }
              disabled={!image}
              className="settings-slider min-w-0 flex-1"
              onChange={(event) => setBlurDraft(Number(event.target.value))}
              onPointerUp={(event) => saveBlur(Number(event.currentTarget.value))}
              onPointerCancel={() => setBlurDraft(null)}
              onKeyUp={(event) => saveBlur(Number(event.currentTarget.value))}
              onBlur={(event) => saveBlur(Number(event.currentTarget.value))}
            />
          </div>
        }
      />
      {image && (
        <div
          className="relative isolate m-4 flex h-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-background"
          aria-label="Chat background preview"
        >
          <TimelineBackgroundImage image={image} opacity={previewOpacity} blur={previewBlur} />
          <p className="text-sm text-foreground">Chat background preview</p>
        </div>
      )}
    </SettingsSection>
  );
}
