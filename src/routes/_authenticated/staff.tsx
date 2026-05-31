import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/components/RouteError";

type SortKey = "date" | "audience" | "status";
type SortDir = "asc" | "desc";
type StaffSearch = { bdmSort: SortKey; bdmDir: SortDir };

export const Route = createFileRoute("/_authenticated/staff")({
  errorComponent: RouteError,
  head: () => ({ meta: [{ title: "Dashboard staff · PunkAstik" }] }),
  validateSearch: (search: Record<string, unknown>): StaffSearch => {
    const sort = search.bdmSort;
    const dir = search.bdmDir;
    return {
      bdmSort: sort === "audience" || sort === "status" ? sort : "date",
      bdmDir: dir === "asc" ? "asc" : "desc",
    };
  },
});
