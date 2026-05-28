import { createFileRoute } from "@tanstack/react-router";
import { Forbidden } from "@/components/Guard";

export const Route = createFileRoute("/forbidden")({
  head: () => ({ meta: [{ title: "Accès refusé · PunkAstik" }] }),
  component: () => <Forbidden />,
});
