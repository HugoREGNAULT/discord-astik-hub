/**
 * Carte « Vérification en jeu » — confirme que le compte Minecraft lié appartient
 * bien au membre, via un code à valider sur Discord (le bot confirme).
 * Démarre startMcLink, affiche le code, puis polle verifyMcLink jusqu'à confirmation.
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { startMcLink, verifyMcLink } from "@/lib/data/mc-link.functions";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function McVerifyCard({ igName, mcUuid }: { igName: string | null; mcUuid: string | null }) {
  const queryClient = useQueryClient();
  const startF = useServerFn(startMcLink);
  const verifyF = useServerFn(verifyMcLink);
  const [code, setCode] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["me", "mc-verify"],
    queryFn: () => verifyF(),
    enabled: !!mcUuid,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return code || s === "pending" ? 4000 : false;
    },
  });

  const verified = data?.status === "verified";

  useEffect(() => {
    if (verified && code) {
      setCode(null);
      toast.success("Compte vérifié en jeu 🎉");
      queryClient.invalidateQueries({ queryKey: ["me", "overview"] });
    }
  }, [verified, code, queryClient]);

  const startMut = useMutation({
    mutationFn: () => startF({ data: { mcName: igName! } }),
    onSuccess: (r) => {
      setCode(r.code);
      toast.success(r.dm_sent ? "Code envoyé en MP Discord" : "Code généré");
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  if (!mcUuid) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BadgeCheck className="size-4 text-primary" /> Vérification en jeu
        </CardTitle>
      </CardHeader>
      <CardContent>
        {verified ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden /> Vérifié en jeu
            </Badge>
            {data?.verified_at && (
              <span className="text-xs text-muted-foreground">
                le {new Date(data.verified_at).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        ) : code ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Tape cette commande sur le Discord (salon de vérification) :
            </p>
            <div className="font-mono text-lg font-bold tracking-widest bg-muted rounded-md px-3 py-2 text-center select-all">
              !link {code}
            </div>
            <p className="text-xs text-muted-foreground">
              En attente de la confirmation du bot… (le code expire au bout de 15 min)
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Confirme que ce compte t'appartient en validant un code sur Discord.
            </p>
            <Button
              size="sm"
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending || !igName}
            >
              {startMut.isPending ? "Génération…" : "Vérifier en jeu"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
