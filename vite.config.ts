// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

type DirectiveWarning = {
  code?: string;
  message?: string;
};

function ignoreUseClientDirectiveWarning(
  warning: DirectiveWarning,
  defaultHandler: (warning: DirectiveWarning) => void,
) {
  if (
    warning.code === "MODULE_LEVEL_DIRECTIVE" &&
    typeof warning.message === "string" &&
    warning.message.includes('"use client"')
  ) {
    return;
  }

  defaultHandler(warning);
}

export default defineConfig({
  nitro: {
    rollupConfig: {
      onwarn(warning: DirectiveWarning, defaultHandler: (warning: DirectiveWarning) => void) {
        ignoreUseClientDirectiveWarning(warning, defaultHandler);
      },
    },
  } as any,
  vite: {
    build: {
      rollupOptions: {
        onwarn(warning: DirectiveWarning, defaultHandler: (warning: DirectiveWarning) => void) {
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
