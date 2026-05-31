import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/tools/ToolsUi";
import { Guard } from "@/components/Guard";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Send, Megaphone, AlertTriangle } from "lucide-react";
import {
  generateAnnouncement,
  publishAnnouncement,
  ANNOUNCE_TONES,
  type AnnounceTone,
} from "@/lib/data/announce.functions";

export const Route = createFileRoute("/_authenticated/staff/announce")({
  head: () => ({ meta: [{ title: "Annonces IA · PunkAstik" }] }),
  component: () => (
    <Guard perm="config.manage">
      <AnnouncePage />
    </Guard>
  ),
});

function AnnouncePage() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<AnnounceTone>("officiel");
  const [draft, setDraft] = useState("");
  const [channel, setChannel] = useState("");

  const genFn = useServerFn(generateAnnouncement);
  const pubFn = useServerFn(publishAnnouncement);

  const mGen = useMutation({
    mutationFn: () => genFn({ data: { topic: topic.trim(), tone } }),
    onSuccess: (res) => {
      setDraft(res.draft);
      toast.success("Brouillon généré — relis et édite avant publication.");
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const mPub = useMutation({
    mutationFn: () => pubFn({ data: { text: draft.trim(), channel: channel.trim() } }),
    onSuccess: () => toast.success("Annonce publiée sur Discord."),
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Annonces assistées par IA"
        description="Génère un brouillon, édite-le, puis publie manuellement sur Discord. L'IA ne publie jamais seule."
        icon={Megaphone}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> 1. Sujet & ton
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-topic">Sujet</Label>
            <Textarea
              id="ann-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              placeholder="Ex : annonce du nouvel event PvP samedi 21h, inscriptions via #events…"
            />
          </div>
          <div className="space-y-2">
            <Label>Ton</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as AnnounceTone)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANNOUNCE_TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => mGen.mutate()}
            disabled={topic.trim().length < 3 || mGen.isPending}
          >
            <Sparkles className="size-4 mr-2" />
            {mGen.isPending ? "Génération…" : "Générer le brouillon"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            2. Aperçu éditable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={14}
            placeholder="Le brouillon généré apparaîtra ici. Édite-le librement avant publication."
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Aucune publication automatique : seul un clic humain envoie le message.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4 text-primary" /> 3. Publier sur Discord
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ann-channel">ID du salon Discord</Label>
            <Input
              id="ann-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="1510047242646454272"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              Active le mode développeur Discord puis clic droit sur le salon →
              « Copier l'identifiant ».
            </p>
          </div>
          <Button
            onClick={() => mPub.mutate()}
            disabled={
              draft.trim().length < 2 ||
              !/^\d{15,25}$/.test(channel.trim()) ||
              mPub.isPending
            }
          >
            <Send className="size-4 mr-2" />
            {mPub.isPending ? "Publication…" : "Publier maintenant"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
