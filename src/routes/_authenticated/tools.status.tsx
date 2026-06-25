import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tools/status")({
  beforeLoad: () => {
    throw redirect({ to: "/tools" });
  },
  component: () => null,
});
