import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

function Shell({
  className,
  contextStrip,
  ...props
}: ComponentProps<"div"> & { contextStrip?: boolean }) {
  return (
    <div
      data-slot="composer-shell"
      data-with-context={contextStrip || undefined}
      className={cn(
        "@container/composer-surface group/composer-surface relative isolate mx-auto w-full max-w-3xl",
        // Banners, the command menu, and the context strip sit flush with the frame, so one
        // rounded backdrop covers the whole stack and no drawer geometry is needed.
        "[--chat-composer-drawer-inset:0rem] [--chat-composer-radius:var(--radius)] [--chat-composer-glass-surface:var(--card)] [--chat-composer-outline:var(--border)]",
        "dark:[--chat-composer-glass-surface:var(--surface-raised)] dark:[--chat-composer-highlight:rgb(255_255_255/3%)] dark:[--chat-composer-outline:color-mix(in_srgb,var(--color-white)_5%,transparent)]",
        "[html[data-theme-id]_&]:[--chat-composer-glass-surface:var(--app-theme-surface-raised)] [html[data-theme-id]_&]:[--chat-composer-outline:var(--app-theme-toolbar-border)]",
        "dark:[html[data-theme-id]:not([data-theme-id=t3-chat])_&]:[--chat-composer-highlight:color-mix(in_srgb,var(--app-theme-input)_12%,transparent)] dark:[html[data-theme-id]:not([data-theme-id=t3-chat])_&]:[--chat-composer-outline:color-mix(in_srgb,var(--app-theme-input)_30%,var(--background))]",
        "dark:[html[data-theme-id=t3-chat]_&]:[--chat-composer-highlight:color-mix(in_srgb,#432d48_12%,transparent)] dark:[html[data-theme-id=t3-chat]_&]:[--chat-composer-outline:#241e28]",
        "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-(--chat-composer-radius) before:bg-[color-mix(in_srgb,var(--chat-composer-glass-surface)_var(--glass-opacity),transparent)] before:backdrop-blur-(--glass-blur) before:backdrop-saturate-(--glass-saturation)",
        "not-supports-[((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:before:bg-(--chat-composer-glass-surface)",
        "has-data-[composer-banner-surface=attached]:before:hidden",
        className,
      )}
      {...props}
    />
  );
}

const outlineClasses =
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:border-(--chat-composer-outline) dark:after:shadow-[inset_0_1px_var(--chat-composer-highlight)]";

// The context strip continues the outline below, so the frame ends in a straight seam.
const contextSeamClasses =
  "group-data-with-context/composer-surface:rounded-b-none group-data-with-context/composer-surface:after:border-b-0";

function Host({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-host"
      className={cn(
        "relative z-10 w-full rounded-(--chat-composer-radius) shadow-[0_2px_8px_-4px_rgb(0_0_0/12%)] after:z-1 dark:shadow-none",
        outlineClasses,
        contextSeamClasses,
        "group-has-data-[composer-banner-surface=attached]/composer-surface:shadow-none group-has-data-[composer-banner-surface=attached]/composer-surface:after:hidden",
        className,
      )}
      {...props}
    />
  );
}

function Main({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-chat-composer-main-surface="true"
      className={cn(
        "group relative z-10 rounded-(--chat-composer-radius) p-px transition-colors duration-200",
        outlineClasses,
        contextSeamClasses,
        "after:z-20 after:hidden group-has-data-[composer-banner-surface=attached]/composer-surface:after:block",
        "group-has-data-[composer-banner-surface=attached]/composer-surface:bg-[color-mix(in_srgb,var(--chat-composer-glass-surface)_var(--glass-opacity),transparent)] group-has-data-[composer-banner-surface=attached]/composer-surface:backdrop-blur-(--glass-blur) group-has-data-[composer-banner-surface=attached]/composer-surface:backdrop-saturate-(--glass-saturation)",
        "group-has-data-[composer-banner-surface=attached]/composer-surface:shadow-[0_2px_8px_-4px_rgb(0_0_0/12%)] dark:group-has-data-[composer-banner-surface=attached]/composer-surface:shadow-none",
        "not-supports-[((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:group-has-data-[composer-banner-surface=attached]/composer-surface:bg-(--chat-composer-glass-surface)",
        "group-has-data-[composer-banner-surface=attached]/composer-surface:**:data-[chat-composer-mobile-collapsed=true]:min-h-[calc(1rem+1px)]",
        className,
      )}
      {...props}
    />
  );
}

function ContextStrip({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-context-strip"
      className={cn(
        "group/composer-context relative isolate flex w-full items-center gap-2 overflow-x-clip overflow-y-visible px-1.5 py-1",
        // Full-width footer row: the frame's side and bottom edges continue here and the
        // top edge doubles as the divider from the prompt area.
        "before:absolute before:inset-0 before:-z-1 before:rounded-b-(--chat-composer-radius) before:border before:border-(--chat-composer-outline) before:shadow-[0_2px_8px_-4px_rgb(0_0_0/12%)]",
        "dark:before:border-white/7 dark:before:shadow-none",
        "after:pointer-events-none after:absolute after:inset-px after:top-0 after:-z-1 after:rounded-b-[calc(var(--chat-composer-radius)-1px)] after:bg-[color-mix(in_srgb,var(--contrast-foreground)_2%,transparent)]",
        "group-has-data-[composer-banner-surface=attached]/composer-surface:before:bg-[color-mix(in_srgb,var(--chat-composer-glass-surface)_var(--glass-opacity),transparent)] group-has-data-[composer-banner-surface=attached]/composer-surface:before:backdrop-blur-(--glass-blur) group-has-data-[composer-banner-surface=attached]/composer-surface:before:backdrop-saturate-(--glass-saturation)",
        className,
      )}
      {...props}
    />
  );
}

export const ComposerSurface = { Shell, Host, Main, ContextStrip };
