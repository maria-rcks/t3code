import { preloadPatchFile } from "@pierre/diffs/ssr";
import type { Plugin } from "vite-plus";

import { DIFF_SURFACE_THEME_UNSAFE_CSS } from "../src/lib/diffRendering";
import { PREFERRED_HIGHLIGHTER } from "../src/lib/syntaxHighlighting";

/** Ship Pierre's finished sample instead of starting a worker pool when settings opens. */
export function diffColorsPreviewPlugin(): Plugin {
  const id = "virtual:diff-colors-preview";
  return {
    name: "t3code:diff-colors-preview",
    resolveId(source) {
      return source === id ? `\0${id}` : undefined;
    },
    async load(source) {
      if (source !== `\0${id}`) return;
      const files = await preloadPatchFile({
        patch:
          "diff --git a/greeting.ts b/greeting.ts\n--- a/greeting.ts\n+++ b/greeting.ts\n@@ -1 +1 @@\n-console.log('Hi');\n+console.log('Hello');\n",
        options: {
          diffStyle: "unified",
          disableFileHeader: true,
          overflow: "scroll",
          theme: { light: "pierre-light", dark: "pierre-dark" },
          preferredHighlighter: PREFERRED_HIGHLIGHTER,
          unsafeCSS: DIFF_SURFACE_THEME_UNSAFE_CSS,
        },
      });
      return `export default ${JSON.stringify(files.map((file) => file.prerenderedHTML).join(""))};`;
    },
  };
}
