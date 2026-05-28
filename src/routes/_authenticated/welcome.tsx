import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { completeOnboarding, getMyOverview } from "@/lib/data/me.functions";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({
    meta: [
      { title: "Bienvenue · PunkAstik" },
      {
        name: "description",
        content: "Configure ton pseudo Minecraft et tes comptes alts pour rejoindre la faction PunkAstik.",
      },
    ],
  }),
  component: WelcomePage,
});

type AltRow = { altName: string; altDiscordId: string };

function WelcomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getOverview = useServerFn(getMyOverview);
  const submit = useServerFn(completeOnboarding);

  const { data } = useQuery({ queryKey: ["me-overview"], queryFn: () => getOverview() });

  const [igName, setIgName] = useState("");
  const [alts, setAlts] = useState<AltRow[]>([]);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          igName: igName.trim(),
          alts: alts
            .map((a) => ({
              altName: a.altName.trim() || null,
              altDiscordId: a.altDiscordId.trim() || null,
            }))
            .filter((a) => a.altName || a.altDiscordId),
        },
      }),
    onSuccess: () => {
      toast.success("Profil enregistré, bienvenue dans la faction !");
      queryClient.invalidateQueries({ queryKey: ["me-overview"] });
      navigate({ to: "/me" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Déjà onboardé → on renvoie sur /me
  if (data && !data.needsOnboarding) {
    navigate({ to: "/me", replace: true });
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
          <Sparkles className="size-3.5" /> Première connexion
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Bienvenue sur PunkAstik</h1>
        <p className="text-muted-foreground mt-2">
          Renseigne ton pseudo Minecraft pour qu'on puisse afficher ton skin et te lier à la faction.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (igName.trim().length < 3) {
            toast.error("Pseudo Minecraft requis");
            return;
          }
          mutation.mutate();
        }}
        className="space-y-6 bg-card border border-border rounded-lg p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="ig">
            Pseudo Minecraft <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ig"
            value={igName}
            onChange={(e) => setIgName(e.target.value)}
            placeholder="ex: Notch"
            maxLength={16}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Vérifié via l'API Mojang — utilise ton vrai pseudo en jeu.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Comptes alternatifs (optionnel)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tes autres pseudos MC ou comptes Discord secondaires.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAlts((a) => [...a, { altName: "", altDiscordId: "" }])}
            >
              <Plus className="size-4 mr-1" /> Ajouter
            </Button>
          </div>

          {alts.map((alt, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Pseudo MC</Label>
                <Input
                  value={alt.altName}
                  onChange={(e) =>
                    setAlts((arr) => arr.map((x, j) => (i === j ? { ...x, altName: e.target.value } : x)))
                  }
                  placeholder="Pseudo alt"
                  maxLength={16}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">ID Discord</Label>
                <Input
                  value={alt.altDiscordId}
                  onChange={(e) =>
                    setAlts((arr) =>
                      arr.map((x, j) => (i === j ? { ...x, altDiscordId: e.target.value } : x)),
                    )
                  }
                  placeholder="123456789012345678"
                  inputMode="numeric"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setAlts((arr) => arr.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Enregistrement…" : "Continuer"}
        </Button>
      </form>
    </div>
  );
}
