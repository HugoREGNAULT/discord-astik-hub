import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { ArrowLeft, LogIn, Send, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { submitApplication, getMyApplication } from "@/lib/data/applications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/candidature")({
  head: () => ({
    meta: [
      { title: "Candidature · PunkAstik" },
      {
        name: "description",
        content: "Postule pour rejoindre la PunkAstik. Connexion Discord requise.",
      },
    ],
  }),
  component: CandidaturePage,
});

const COUNTRIES = ["Belgique", "France", "Canada", "Outre-Mer", "Autre"] as const;
const GRADES = ["Aucun", "Héros", "Légende", "Divinité", "Staff", "Affilié"] as const;

function CandidaturePage() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <Shell>
        <div className="text-center text-zinc-500 py-20">Chargement…</div>
      </Shell>
    );
  }

  if (!user) return <LoginGate />;

  return <ApplicationForm />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#5865F2 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <header className="relative max-w-4xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm uppercase tracking-wider"
          style={{ fontFamily: "'Space Mono'" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="w-8 h-8 rounded-sm border border-pink-500/40" />
          <span
            className="font-bold uppercase tracking-tight"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            PunkAstik <span className="text-pink-500">//</span>
          </span>
        </div>
      </header>
      <main className="relative max-w-4xl mx-auto px-6 pb-16">{children}</main>
    </div>
  );
}

function LoginGate() {
  return (
    <Shell>
      <div className="max-w-md mx-auto mt-12">
        <div className="relative">
          <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-pink-500" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-[#5865F2]" />
          <div className="relative bg-zinc-900/90 border border-zinc-800 backdrop-blur-md p-8">
            <p
              className="text-pink-500 text-[10px] uppercase tracking-[0.3em] mb-4"
              style={{ fontFamily: "'Space Mono'" }}
            >
              // step.01 — identify
            </p>
            <h2
              className="text-2xl font-bold uppercase tracking-tight mb-3"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              Lie ton compte Discord
            </h2>
            <p className="text-zinc-400 text-sm mb-6">
              Avant de remplir ta candidature, connecte-toi avec Discord pour qu'on puisse
              t'identifier et te recontacter.
            </p>
            <a
              href="/api/auth/login?next=/candidature"
              className="w-full flex items-center justify-center gap-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-4 px-6 transition-all active:scale-[0.98] border-b-4 border-black/20 uppercase tracking-wider text-sm"
            >
              <LogIn className="w-5 h-5" />
              Se connecter avec Discord
            </a>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function ApplicationForm() {
  const navigate = useNavigate();
  const getMyApp = useServerFn(getMyApplication);
  const submitFn = useServerFn(submitApplication);
  const { data: existing, refetch } = useQuery({
    queryKey: ["myApplication"],
    queryFn: () => getMyApp(),
  });

  const [mcName, setMcName] = useState("");
  const [presentation, setPresentation] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState<string>("");
  const [schedule, setSchedule] = useState("");
  const [weeklyPlaytime, setWeeklyPlaytime] = useState("");
  const [firstVersion, setFirstVersion] = useState("");
  const [igGrade, setIgGrade] = useState<string>("");
  const [previousFactions, setPreviousFactions] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [skills, setSkills] = useState("");
  const [knowledgeLevel, setKnowledgeLevel] = useState([5]);

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          mcName,
          presentation,
          age: Number(age),
          country: country as (typeof COUNTRIES)[number],
          schedule,
          weeklyPlaytime,
          firstVersion,
          igGrade: igGrade as (typeof GRADES)[number],
          previousFactions,
          heardFrom,
          skills,
          knowledgeLevel: knowledgeLevel[0],
        },
      }),
    onSuccess: () => {
      toast.success("Candidature envoyée ! Tu seras notifié·e en DM.");
      refetch();
    },
    onError: (e: Error) => toast.error(toUserMessage(e)),
  });

  // Si pending, on affiche le statut
  if (existing && existing.status === "pending") {
    return (
      <Shell>
        <StatusCard
          icon={<Clock className="w-6 h-6 text-yellow-400" />}
          title="Candidature en attente"
          color="yellow"
          body={
            <>
              Ta candidature pour <strong>{existing.mc_name}</strong> est en cours d'examen par les
              recruteurs. Tu recevras un DM Discord dès qu'une décision sera prise.
            </>
          }
        />
      </Shell>
    );
  }

  if (existing && existing.status === "accepted") {
    return (
      <Shell>
        <StatusCard
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-400" />}
          title="Candidature acceptée"
          color="emerald"
          body={
            <>
              Bienvenue dans la PunkAstik ! Accède à ton espace membre.
              <div className="mt-4">
                <Button onClick={() => navigate({ to: "/me" })}>Mon espace</Button>
              </div>
            </>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8 mt-4">
        <p
          className="text-pink-500 text-[10px] uppercase tracking-[0.3em] mb-2"
          style={{ fontFamily: "'Space Mono'" }}
        >
          // step.02 — application
        </p>
        <h2
          className="text-3xl font-bold uppercase tracking-tight"
          style={{ fontFamily: "'Space Grotesk'" }}
        >
          Candidature PunkAstik
        </h2>
        <p className="text-zinc-400 text-sm mt-2">
          Tous les champs sont obligatoires sauf indication contraire. Sois honnête, c'est plus
          simple pour tout le monde.
        </p>
        {existing?.status === "rejected" && (
          <div className="mt-4 p-3 bg-red-950/40 border border-red-800/50 text-red-200 text-sm">
            Ta précédente candidature a été refusée
            {existing.decision_reason && (
              <>
                {" "}
                — motif : <em>{existing.decision_reason}</em>
              </>
            )}
            . Tu peux re-soumettre une nouvelle candidature.
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-6 bg-zinc-900/90 border border-zinc-800 p-6 md:p-8"
      >
        <Field label="Pseudo Minecraft exact" required>
          <Input
            value={mcName}
            onChange={(e) => setMcName(e.target.value)}
            placeholder="Notch"
            required
            maxLength={16}
          />
        </Field>

        <Field label="Présentation (IRL + IG Paladium / Minecraft)" required>
          <Textarea
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            placeholder="Qui tu es dans la vie, ton parcours sur Paladium / Minecraft…"
            required
            rows={6}
            maxLength={3000}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Âge" required>
            <Input
              type="number"
              min={10}
              max={99}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </Field>
          <Field label="Pays de résidence" required>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionne…" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Horaires de connexion (heure de Paris)" required>
            <Input
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="Ex : 18h-23h en semaine, journée le week-end"
              required
            />
          </Field>
          <Field label="Temps de jeu estimé / semaine" required>
            <Input
              value={weeklyPlaytime}
              onChange={(e) => setWeeklyPlaytime(e.target.value)}
              placeholder="Ex : 20h"
              required
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Première version jouée sur Pala" required>
            <Input
              value={firstVersion}
              onChange={(e) => setFirstVersion(e.target.value)}
              placeholder="Ex : Pala 4"
              required
            />
          </Field>
          <Field label="Grade en jeu (Paladium)" required>
            <Select value={igGrade} onValueChange={setIgGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionne…" />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Anciennes factions (optionnel)">
          <Textarea
            value={previousFactions}
            onChange={(e) => setPreviousFactions(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Liste des factions où tu étais et pourquoi tu en es parti·e"
          />
        </Field>

        <Field label="Comment as-tu entendu parler de la PunkAstik ?" required>
          <Input
            value={heardFrom}
            onChange={(e) => setHeardFrom(e.target.value)}
            placeholder="Bouche-à-oreille, ami, recrutement…"
            required
          />
        </Field>

        <Field label="Compétences spécifiques" required>
          <Textarea
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            rows={3}
            placeholder="PVP, concepteur BC, farm, QDF, donjons…"
            required
            maxLength={1000}
          />
        </Field>

        <Field label={`Niveau de connaissance Paladium : ${knowledgeLevel[0]}/10`} required>
          <Slider
            value={knowledgeLevel}
            onValueChange={setKnowledgeLevel}
            min={0}
            max={10}
            step={1}
            className="mt-3"
          />
        </Field>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={mutation.isPending || !country || !igGrade}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-6 uppercase tracking-wider"
          >
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Send className="w-5 h-5 mr-2" />
            )}
            Envoyer ma candidature
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-zinc-300 text-xs uppercase tracking-wider">
        {label}
        {required && <span className="text-pink-500 ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  color: "yellow" | "emerald" | "red";
}) {
  const borderColor =
    color === "yellow"
      ? "border-yellow-500"
      : color === "emerald"
        ? "border-emerald-500"
        : "border-red-500";
  return (
    <div className="max-w-lg mx-auto mt-12">
      <div className={`relative bg-zinc-900/90 border-2 ${borderColor} p-8`}>
        <div className="flex items-center gap-3 mb-3">
          {icon}
          <h2
            className="text-xl font-bold uppercase tracking-tight"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {title}
          </h2>
        </div>
        <div className="text-zinc-300 text-sm leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

// Force "used" for XCircle to avoid unused import in some bundlers
void XCircle;
