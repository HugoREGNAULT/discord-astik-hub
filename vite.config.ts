// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { RollupLog, WarningHandlerWithDefault } from "rollup";
import { visualizer } from "rollup-plugin-visualizer";
import { createLogger } from "vite";

const IGNORED_WARNING_CODES = new Set([
  "MODULE_LEVEL_DIRECTIVE",
  "UNUSED_EXTERNAL_IMPORT",
  "EMPTY_BUNDLE",
  "SOURCEMAP_ERROR",
]);

const IGNORED_VITE_WARNING_SNIPPETS = [
  'Module level directives cause errors when bundled, "use client"',
  "Generated an empty chunk",
];

function shouldIgnoreRollupWarning(warning: RollupLog) {
  return !!(warning.code && IGNORED_WARNING_CODES.has(warning.code));
}

function shouldIgnoreViteWarning(message: string) {
  return IGNORED_VITE_WARNING_SNIPPETS.some((snippet) => message.includes(snippet));
}

const viteLogger = createLogger("info", { allowClearScreen: false });
const defaultWarn = viteLogger.warn.bind(viteLogger);

viteLogger.warn = (message, options) => {
  if (shouldIgnoreViteWarning(message)) {
    return;
  }

  defaultWarn(message, options);
};

function ignoreUseClientDirectiveWarning(
  warning: RollupLog,
  defaultHandler: Parameters<WarningHandlerWithDefault>[1],
) {
  if (shouldIgnoreRollupWarning(warning)) {
    return;
  }

  defaultHandler(warning);
}

export default defineConfig({
  nitro: {
    rollupConfig: {
      onwarn(warning: RollupLog, defaultHandler: Parameters<WarningHandlerWithDefault>[1]) {
        ignoreUseClientDirectiveWarning(warning, defaultHandler);
      },
    },
  } as any,
  vite: {
    customLogger: viteLogger,
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        onwarn(warning: RollupLog, defaultHandler: Parameters<WarningHandlerWithDefault>[1]) {
          ignoreUseClientDirectiveWarning(warning, defaultHandler);
        },
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
