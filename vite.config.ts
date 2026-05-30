// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { RollupLog, WarningHandlerWithDefault } from "rollup";

function ignoreUseClientDirectiveWarning(
  warning: RollupLog,
  defaultHandler: Parameters<WarningHandlerWithDefault>[1],
) {
  if (
    warning.code === "MODULE_LEVEL_DIRECTIVE" &&
    warning.message.includes('"use client"')
  ) {
    return;
  }

  defaultHandler(warning);
}

export default defineConfig({
  nitro: {
    cloudflare: {
      nodeCompat: false,
    },
    rollupConfig: {
      onwarn(warning: RollupLog, defaultHandler: Parameters<WarningHandlerWithDefault>[1]) {
        ignoreUseClientDirectiveWarning(warning, defaultHandler);
      },
    },
  } as any,
  vite: {
    build: {
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
