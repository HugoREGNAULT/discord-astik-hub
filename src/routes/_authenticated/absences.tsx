import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { Plane } from "lucide-react";
import { listAbsences } from "@/lib/data/absences.functions";
import { hasPerm, useCurrentUser } from "@/lib/auth/use-current-user";
import {
  toISODate,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  type AbsenceRow,
} from "@/components/absences/types";
import { StatsBar } from "@/components/absences/StatsBar";
import { MonthCalendar } from "@/components/absences/MonthCalendar";
import {
  FiltersBar,
  applyFilters,
  ALL_TYPES_SET,
  type AbsencesFilters,
} from "@/components/absences/FiltersBar";
import { AbsenceListView } from "@/components/absences/AbsenceListView";
import { CreateOrEditDialog } from "@/components/absences/CreateOrEditDialog";

export const Route = createFileRoute("/_authenticated/absences")({
  head: () => ({ meta: [{ title: "Absences · PunkAstik" }] }),
  component: AbsencesPage,
});

function AbsencesPage() {
  const { data: me } = useCurrentUser();
  const canManageAll = hasPerm(me, "members.edit");
  const qc = useQueryClient();

  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [filters, setFilters] = useState<AbsencesFilters>({
    types: new Set(ALL_TYPES_SET),
    search: "",
    onlyActive: false,
  });

  // En vue calendrier, on charge la grille du mois (avec semaines de débordement).
  // En vue liste, on prend une fenêtre large autour d'aujourd'hui pour couvrir
  // les absences en cours et à venir sans surcharger.
  const range = useMemo(() => {
    if (view === "calendar") {
      return {
        from: toISODate(startOfWeek(startOfMonth(cursor))),
        to: toISODate(endOfWeek(endOfMonth(cursor))),
      };
    }
    const today = new Date();
    const past = new Date(today);
    past.setDate(past.getDate() - 30);
    const future = new Date(today);
    future.setDate(future.getDate() + 180);
    return { from: toISODate(past), to: toISODate(future) };
  }, [view, cursor]);

  const listFn = useServerFn(listAbsences);
  const { data, isLoading } = useQuery({
    queryKey: ["absences", view, range.from, range.to],
    queryFn: () => listFn({ data: { from: range.from, to: range.to } }),
  });

  const absences = (data?.absences ?? []) as AbsenceRow[];
  const myId = data?.myDiscordId;
  const filtered = useMemo(() => applyFilters(absences, filters), [absences, filters]);
  const myAbsences = useMemo(
    () => absences.filter((a) => a.member_discord_id === myId),
    [absences, myId],
  );

  const onChanged = () => qc.invalidateQueries({ queryKey: ["absences"] });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          code="// absences"
          title="Calendrier des absences"
          description="Vue globale des absences déclarées par les membres de la faction."
        />
        <CreateOrEditDialog mode="create" onDone={onChanged} />
      </div>

      <StatsBar absences={absences} />

      <FiltersBar filters={filters} onChange={setFilters} />

      <Tabs value={view} onValueChange={(v) => setView(v as "calendar" | "list")}>
        <TabsList>
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <MonthCalendar absences={filtered} cursor={cursor} onCursorChange={setCursor} />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {filters.onlyActive ? "Absences en cours" : "Absences à venir et en cours"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : (
                <AbsenceListView
                  absences={filtered}
                  canManage={canManageAll}
                  myDiscordId={myId}
                  onChanged={onChanged}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes absences</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : myAbsences.length === 0 ? (
            <EmptyState
              icon={Plane}
              title="Aucune absence déclarée"
              description="Ajoute une absence pour prévenir le reste de la faction."
            />
          ) : (
            <AbsenceListView
              absences={myAbsences}
              canManage
              myDiscordId={myId}
              onChanged={onChanged}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
