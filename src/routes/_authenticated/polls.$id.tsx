import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/polls/$id")({
  head: () => ({ meta: [{ title: "Sondage · PunkAstik" }] }),
});
