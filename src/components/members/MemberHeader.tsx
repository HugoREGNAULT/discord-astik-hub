import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonoLabel } from "@/components/tools/ToolsUi";
import type { MemberRow } from "./types";

interface Props {
  member: MemberRow;
  isSelf: boolean;
  canShowDiscordId: boolean;
}

export function MemberHeader({ member, isSelf, canShowDiscordId }: Props) {
  return (
    <>
      <div className="flex items-center gap-4">
        {member.avatar_url ? (
          <img src={member.avatar_url} className="size-16 rounded-full" alt="" />
        ) : (
          <div className="size-16 rounded-full bg-muted" />
        )}
        <div>
          <div className="text-primary mb-1">
            <MonoLabel>// member</MonoLabel>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk'" }}>
            {member.ig_name ?? member.discord_username}
          </h1>
          <p className="text-sm text-muted-foreground">
            @{member.discord_username}
            {canShowDiscordId && ` · ${member.discord_id}`}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {isSelf && <Badge variant="outline">Toi</Badge>}
          <Badge variant="secondary">{member.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="AstikPoints" value={member.astik_points} accent />
        <Stat label="Grade" value={member.current_grade ?? "—"} />
        <Stat label="Arrivée" value={member.arrival_date ?? "—"} />
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
