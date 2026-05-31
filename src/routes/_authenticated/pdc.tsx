import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";

export const Route = createFileRoute("/_authenticated/pdc")({
  errorComponent: RouteError,
  head: () => ({ meta: [{ title: "Plans de coupe · PunkAstik" }] }),
});
