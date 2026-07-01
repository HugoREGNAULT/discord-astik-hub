import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Guard } from "@/components/Guard";

export const Route = createFileRoute("/_authenticated/projets")({
  component: () => (
    <Guard perm="profile.self">
      <Outlet />
    </Guard>
  ),
});
