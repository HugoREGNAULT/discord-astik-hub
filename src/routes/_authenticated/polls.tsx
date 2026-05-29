import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/polls")({
  component: PollsLayout,
});

function PollsLayout() {
  return <Outlet />;
}
