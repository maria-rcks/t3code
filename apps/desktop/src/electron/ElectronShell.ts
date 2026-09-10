import {
  REMOTE_CAPABLE_EDITOR_IDS,
  remoteLinkStyleForEditor,
  remoteSchemeForEditor,
  type EditorRemoteLinkStyle,
  type SystemSettingsPane,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as Electron from "electron";

/**
 * Deep links to individual System Settings panes. These are app-fixed, not
 * renderer-supplied, so they skip `parseSafeExternalUrl` — which exists to keep
 * arbitrary link schemes from reaching the OS handler — and open through their
 * own path below. The pane rather than the URL crosses the IPC boundary, so a
 * renderer can only ask for one of these known destinations.
 *
 * Full Disk Access uses the post-Ventura `PrivacySecurity.extension` anchor.
 */
const SYSTEM_SETTINGS_URLS: Record<SystemSettingsPane, string> = {
  "full-disk-access":
    "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
};

// Remote open-in-editor deep links (`vscode://vscode-remote/ssh-remote+…` and
// `zed://ssh/<host>/<path>`) must reach the OS handler; every other non-web
// scheme stays blocked. Each scheme only unlocks its own editor's link shape,
// so a Zed link cannot ride in on a VS Code scheme or the reverse.
const SAFE_WEB_PROTOCOLS = new Set(["http:", "https:"]);
const REMOTE_EDITOR_PROTOCOLS = new Map<string, EditorRemoteLinkStyle>(
  REMOTE_CAPABLE_EDITOR_IDS.flatMap((id) => {
    const scheme = remoteSchemeForEditor(id);
    const style = remoteLinkStyleForEditor(id);
    return scheme === undefined || style === undefined
      ? []
      : [[`${scheme}:`, style] as [string, EditorRemoteLinkStyle]];
  }),
);

// `zed://ssh/<host>/<path>`: a host segment plus a non-empty path.
const ZED_SSH_PATHNAME = /^\/[^/]+\/.+$/;

const isRemoteEditorUrl = (url: URL) => {
  const style = REMOTE_EDITOR_PROTOCOLS.get(url.protocol);
  if (style === undefined || url.username.length > 0 || url.password.length > 0) {
    return false;
  }
  if (style === "zed-ssh") {
    return url.host === "ssh" && ZED_SSH_PATHNAME.test(url.pathname);
  }
  return (
    url.host === "vscode-remote" &&
    url.pathname.startsWith("/ssh-remote+") &&
    url.pathname.length > "/ssh-remote+".length
  );
};

export function parseSafeExternalUrl(rawUrl: unknown): Option.Option<string> {
  if (typeof rawUrl !== "string") {
    return Option.none();
  }

  try {
    const url = new URL(rawUrl);
    return SAFE_WEB_PROTOCOLS.has(url.protocol) || isRemoteEditorUrl(url)
      ? Option.some(url.href)
      : Option.none();
  } catch {
    return Option.none();
  }
}

export class ElectronShell extends Context.Service<
  ElectronShell,
  {
    readonly openExternal: (rawUrl: unknown) => Effect.Effect<boolean>;
    /** Opens a known System Settings pane by identifier, not by URL. */
    readonly openSystemSettings: (pane: SystemSettingsPane) => Effect.Effect<boolean>;
    readonly copyText: (text: string) => Effect.Effect<void>;
  }
>()("@t3tools/desktop/electron/ElectronShell") {}

/** @public Service construction is part of the canonical Effect module API. */
export const make = ElectronShell.of({
  openExternal: (rawUrl) =>
    Option.match(parseSafeExternalUrl(rawUrl), {
      onNone: () => Effect.succeed(false),
      onSome: (externalUrl) =>
        Effect.promise(() =>
          Electron.shell.openExternal(externalUrl).then(
            () => true,
            () => false,
          ),
        ),
    }),
  openSystemSettings: (pane) =>
    Effect.promise(() =>
      Electron.shell.openExternal(SYSTEM_SETTINGS_URLS[pane]).then(
        () => true,
        () => false,
      ),
    ),
  copyText: (text) =>
    Effect.promise(() => Electron.clipboard.writeText(text).catch(() => undefined)),
});

export const layer = Layer.succeed(ElectronShell, make);
