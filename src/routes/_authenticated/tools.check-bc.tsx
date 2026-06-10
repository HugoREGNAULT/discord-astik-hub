import { createFileRoute, redirect } from "@tanstack/react-router";

// Check BC est devenu une page autonome (hors layout Outils Paladium).
// On garde cette route pour rediriger les anciens bookmarks / liens Discord.
export const Route = createFileRoute("/_authenticated/tools/check-bc")({
  beforeLoad: () => {
    throw redirect({ to: "/check-bc" });
  },
});
