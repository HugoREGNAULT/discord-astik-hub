import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toUserMessage } from "@/lib/errors";
import { ArrowLeft, LogIn, Send, Loader2, CheckCircle2, Clock, Star } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { submitApplication, getMyApplication } from "@/lib/data/applications.functions";
import { saveDraft } from "@/lib/data/application-drafts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

const IRL_MIN = 150;
const GAMING_MIN = 250;

// Phrases du curseur PvP. Les paliers non définis (2, 4) héritent du palier
// inférieur le plus proche.
const PVP_PHRASES: Record<number, string> = {
  1: "Moi bâton, cassé caillou",
  3: "Je sais cliqué mais pas tapé",
  5: "Tuer Wither OK, PvP Non",
  6: "Je suis pas bon, mais j'essaye",
  7: "Je commence à maîtriser les sticks",
  8: "Je maîtrise",
  9: "J'utilise les dernières métas",
  10: "Personne n'est meilleur que moi",
};
function pvpPhrase(n: number): string {
  for (let i = n; i >= 1; i--) if (PVP_PHRASES[i]) return PVP_PHRASES[i];
  return "";
}

function CandidaturePage() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <Shell>
        <div className="text-center text-muted-foreground py-20">Chargement…</div>
      </Shell>
    );
  }

  if (!user) return <LoginGate />;

  return <ApplicationForm />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(139,92,246,0.4) 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <header className="relative max-w-4xl mx-auto px-6 pt-8 pb-4 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-white text-sm uppercase tracking-wider"
          style={{ fontFamily: "'Space Mono'" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="w-8 h-8 rounded-none border border-primary/40" />
          <span
            className="font-bold uppercase tracking-tight"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            PunkAstik <span className="text-primary">//</span>
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
          <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-primary" />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-primary" />
          <div className="relative bg-card/90 border border-border backdrop-blur-md p-8">
            <p
              className="text-primary text-[10px] uppercase tracking-[0.3em] mb-4"
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
            <p className="text-muted-foreground text-sm mb-6">
              Avant de remplir ta candidature, connecte-toi avec Discord pour qu'on puisse
              t'identifier et te recontacter.
            </p>
            <a
              href="/api/auth/login?next=/candidature"
              className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary/90 text-white font-bold py-4 px-6 transition-all active:scale-[0.98] border-b-4 border-black/20 uppercase tracking-wider text-sm"
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

// --- Brouillon auto-sauvegardé (localStorage) -----------------------------
// Permet de fermer / recharger la page sans perdre ce qui a été écrit.
const DRAFT_KEY = "punkastik:candidature:draft:v1";

type Draft = {
  heardFrom: string;
  mcName: string;
  presentationIrl: string;
  age: string;
  country: string;
  presentationGaming: string;
  schedule: string;
  objectives: string;
  pvpLevel: number[];
  motivation: string;
  additionalInfo: string;
  formRating: number;
};

function readDraft(): Partial<Draft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // quota plein / mode privé : on ignore silencieusement.
  }
}
function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// --- Signaux d'authenticité (anti copier-coller / IA) ---------------------
// Compteurs accumulés pendant la saisie, persistés localement pour survivre à
// un rechargement, et envoyés au serveur avec le brouillon.
const META_KEY = "punkastik:candidature:meta:v1";
type DraftMeta = {
  pasteCount: number;
  pasteChars: number;
  pasteEvents: { len: number; t: number }[];
  keystrokes: number;
  typingMs: number;
  startedAt: number;
};
function emptyMeta(): DraftMeta {
  return {
    pasteCount: 0,
    pasteChars: 0,
    pasteEvents: [],
    keystrokes: 0,
    typingMs: 0,
    startedAt: 0,
  };
}
function readMeta(): DraftMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as DraftMeta) : null;
  } catch {
    return null;
  }
}
function writeMeta(m: DraftMeta) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}
function clearMeta() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(META_KEY);
  } catch {
    // ignore
  }
}

function ApplicationForm() {
  const navigate = useNavigate();
  const getMyApp = useServerFn(getMyApplication);
  const submitFn = useServerFn(submitApplication);
  const { data: existing, refetch } = useQuery({
    queryKey: ["myApplication"],
    queryFn: () => getMyApp(),
  });

  const [heardFrom, setHeardFrom] = useState("");
  const [mcName, setMcName] = useState("");
  const [presentationIrl, setPresentationIrl] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState<string>("");
  const [presentationGaming, setPresentationGaming] = useState("");
  const [schedule, setSchedule] = useState("");
  const [objectives, setObjectives] = useState("");
  const [pvpLevel, setPvpLevel] = useState([5]);
  const [motivation, setMotivation] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [formRating, setFormRating] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const saveDraftFn = useServerFn(saveDraft);
  const metaRef = useRef<DraftMeta>(emptyMeta());
  const lastKeyRef = useRef(0);

  // Télémétrie d'authenticité, déléguée au <form> (capture).
  function noteKeystroke(e: React.KeyboardEvent) {
    const now = Date.now();
    if (metaRef.current.startedAt === 0) metaRef.current.startedAt = now;
    if (e.key && e.key.length === 1) metaRef.current.keystrokes += 1;
    if (lastKeyRef.current > 0) {
      const gap = now - lastKeyRef.current;
      if (gap > 0 && gap < 5000) metaRef.current.typingMs += gap;
    }
    lastKeyRef.current = now;
  }
  function notePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text.length) return;
    const now = Date.now();
    if (metaRef.current.startedAt === 0) metaRef.current.startedAt = now;
    metaRef.current.pasteCount += 1;
    metaRef.current.pasteChars += text.length;
    metaRef.current.pasteEvents.push({
      len: text.length,
      t: Math.max(0, now - metaRef.current.startedAt),
    });
    if (metaRef.current.pasteEvents.length > 200)
      metaRef.current.pasteEvents = metaRef.current.pasteEvents.slice(-200);
  }

  // Restaure le brouillon au montage, APRÈS l'hydratation SSR (le HTML serveur
  // n'a pas accès à localStorage → sinon mismatch d'hydratation).
  useEffect(() => {
    const d = readDraft();
    if (d) {
      if (typeof d.heardFrom === "string") setHeardFrom(d.heardFrom);
      if (typeof d.mcName === "string") setMcName(d.mcName);
      if (typeof d.presentationIrl === "string") setPresentationIrl(d.presentationIrl);
      if (typeof d.age === "string") setAge(d.age);
      if (typeof d.country === "string") setCountry(d.country);
      if (typeof d.presentationGaming === "string") setPresentationGaming(d.presentationGaming);
      if (typeof d.schedule === "string") setSchedule(d.schedule);
      if (typeof d.objectives === "string") setObjectives(d.objectives);
      if (Array.isArray(d.pvpLevel) && typeof d.pvpLevel[0] === "number")
        setPvpLevel([d.pvpLevel[0]]);
      if (typeof d.motivation === "string") setMotivation(d.motivation);
      if (typeof d.additionalInfo === "string") setAdditionalInfo(d.additionalInfo);
      if (typeof d.formRating === "number") setFormRating(d.formRating);
    }
    const m = readMeta();
    if (m) metaRef.current = m;
    setHydrated(true);
  }, []);

  // Sauvegarde auto à chaque frappe (une fois hydraté). On ne persiste que si au
  // moins un champ "réel" est rempli (le curseur PvP par défaut ne compte pas).
  useEffect(() => {
    if (!hydrated) return;
    const filled =
      heardFrom ||
      mcName ||
      presentationIrl ||
      age ||
      country ||
      presentationGaming ||
      schedule ||
      objectives ||
      motivation ||
      additionalInfo ||
      formRating > 0;
    if (!filled) {
      clearDraft();
      clearMeta();
      return;
    }
    writeDraft({
      heardFrom,
      mcName,
      presentationIrl,
      age,
      country,
      presentationGaming,
      schedule,
      objectives,
      pvpLevel,
      motivation,
      additionalInfo,
      formRating,
    });
    writeMeta(metaRef.current);

    // Envoi serveur debouncé (2,5 s après la dernière frappe) → accès staff +
    // signaux d'authenticité, sans spammer la base.
    const charCount =
      heardFrom.length +
      mcName.length +
      presentationIrl.length +
      age.length +
      country.length +
      presentationGaming.length +
      schedule.length +
      objectives.length +
      motivation.length +
      additionalInfo.length;
    const handle = setTimeout(() => {
      const m = metaRef.current;
      void saveDraftFn({
        data: {
          heardFrom,
          mcName,
          presentationIrl,
          age,
          country,
          presentationGaming,
          schedule,
          objectives,
          pvpLevel: pvpLevel[0],
          motivation,
          additionalInfo,
          formRating: formRating > 0 ? formRating : undefined,
          pasteCount: m.pasteCount,
          pasteTotalChars: m.pasteChars,
          pasteEvents: m.pasteEvents,
          keystrokeCount: m.keystrokes,
          charCount,
          typingMs: Math.round(m.typingMs),
        },
      }).catch(() => {});
    }, 2500);
    return () => clearTimeout(handle);
  }, [
    hydrated,
    heardFrom,
    mcName,
    presentationIrl,
    age,
    country,
    presentationGaming,
    schedule,
    objectives,
    pvpLevel,
    motivation,
    additionalInfo,
    formRating,
    saveDraftFn,
  ]);

  function resetDraft() {
    setHeardFrom("");
    setMcName("");
    setPresentationIrl("");
    setAge("");
    setCountry("");
    setPresentationGaming("");
    setSchedule("");
    setObjectives("");
    setPvpLevel([5]);
    setMotivation("");
    setAdditionalInfo("");
    setFormRating(0);
    metaRef.current = emptyMeta();
    lastKeyRef.current = 0;
    clearDraft();
    clearMeta();
  }

  const irlLen = presentationIrl.trim().length;
  const gamingLen = presentationGaming.trim().length;
  const irlOk = irlLen >= IRL_MIN;
  const gamingOk = gamingLen >= GAMING_MIN;

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          heardFrom,
          mcName,
          presentationIrl,
          presentationGaming,
          age: Number(age),
          country: country as (typeof COUNTRIES)[number],
          schedule,
          objectives,
          pvpLevel: pvpLevel[0],
          motivation,
          additionalInfo,
          formRating: formRating > 0 ? formRating : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Candidature envoyée ! Tu seras notifié·e en DM.");
      clearDraft();
      clearMeta();
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

  const canSubmit =
    !mutation.isPending &&
    heardFrom.trim().length > 1 &&
    mcName.trim().length >= 3 &&
    irlOk &&
    Number(age) >= 10 &&
    !!country &&
    gamingOk &&
    schedule.trim().length > 1 &&
    objectives.trim().length > 1 &&
    motivation.trim().length > 1;

  const hasDraft =
    hydrated &&
    !!(
      heardFrom ||
      mcName ||
      presentationIrl ||
      age ||
      presentationGaming ||
      schedule ||
      objectives ||
      motivation ||
      additionalInfo ||
      formRating > 0
    );

  return (
    <Shell>
      <div className="mb-8 mt-4">
        <p
          className="text-primary text-[10px] uppercase tracking-[0.3em] mb-2"
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
        <p className="text-muted-foreground text-sm mt-2">
          Prends ton temps et sois honnête — c'est plus simple pour tout le monde. Les champs
          marqués <span className="text-primary">*</span> sont obligatoires.
        </p>
        {hasDraft && (
          <p
            className="mt-3 text-[11px] text-muted-foreground flex flex-wrap items-center gap-2"
            style={{ fontFamily: "'Space Mono'" }}
          >
            <span className="text-emerald-400">●</span>
            Brouillon enregistré sur cet appareil — tu peux recharger ou revenir plus tard.
            <button type="button" onClick={resetDraft} className="underline hover:text-foreground">
              effacer
            </button>
          </p>
        )}
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
        onKeyDownCapture={noteKeystroke}
        onPasteCapture={notePaste}
        className="space-y-6 bg-card/90 border border-border p-6 md:p-8"
      >
        {/* 1 — Découverte */}
        <Field
          label="Par quel moyen as-tu découvert notre faction ?"
          required
          hint="Qui a fait la promotion de la faction, et qui t'a envoyé ce formulaire ? (pseudo IG et/ou Discord)"
        >
          <Textarea
            value={heardFrom}
            onChange={(e) => setHeardFrom(e.target.value)}
            placeholder="Ex : pub sur le Discord X par Pseudo123, formulaire envoyé par MonPote_IG…"
            required
            rows={3}
            maxLength={600}
          />
        </Field>

        {/* 2 — Pseudo Minecraft */}
        <Field label="Quel est ton pseudonyme sur Minecraft ?" required>
          <Input
            value={mcName}
            onChange={(e) => setMcName(e.target.value)}
            placeholder="Notch"
            required
            maxLength={16}
          />
        </Field>

        {/* 3 — Présentation IRL */}
        <Field
          label="Présente-toi en quelques lignes sur le plan IRL"
          required
          hint="Qui es-tu, dans quel pays habites-tu, que fais-tu dans la vie, quelles sont tes passions…"
        >
          <Textarea
            value={presentationIrl}
            onChange={(e) => setPresentationIrl(e.target.value)}
            placeholder="Présente-toi…"
            required
            rows={5}
            maxLength={3000}
          />
          <CharCounter len={irlLen} min={IRL_MIN} />
        </Field>

        {/* Âge + Pays (conservés) */}
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
            {/* <select> natif (et non Radix) : la valeur est portée par l'attribut
                `value`, donc insensible à la traduction du navigateur qui cassait
                le menu Radix (« Sélectionne…FranceFrance » → pays jamais retenu). */}
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              translate="no"
              required
              className="notranslate flex h-9 w-full rounded-none border border-input bg-transparent px-3 py-1 text-base text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [&>option]:bg-card [&>option]:text-white"
            >
              <option value="" disabled>
                Sélectionne…
              </option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* 4 — Présentation Minecraft / Paladium */}
        <Field
          label="Présente-toi cette fois sur le plan Minecraft & Paladium"
          required
          hint="Nouveau dans ce milieu ? Dis-nous ce qui t'y intéresse et pourquoi tu as commencé. Sinon, précise si tu as déjà rejoint des factions par le passé."
        >
          <Textarea
            value={presentationGaming}
            onChange={(e) => setPresentationGaming(e.target.value)}
            placeholder="Ton expérience Minecraft / Paladium…"
            required
            rows={5}
            maxLength={3000}
          />
          <CharCounter len={gamingLen} min={GAMING_MIN} />
        </Field>

        {/* 5 — Disponibilités */}
        <Field
          label="Quelles sont tes disponibilités sur Paladium durant une semaine de travail/cours ?"
          required
        >
          <Textarea
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="Ex : 18h-23h en semaine, journée le week-end…"
            required
            rows={3}
            maxLength={600}
          />
        </Field>

        {/* 6 — Objectifs */}
        <Field
          label="As-tu des objectifs concrets sur Paladium ?"
          required
          hint="Sois honnête : qu'est-ce qui va te donner envie de jouer ? Ça nous permet d'engager plus de moyens dans la faction pour t'aider."
        >
          <Textarea
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            placeholder="Tes objectifs…"
            required
            rows={3}
            maxLength={2000}
          />
        </Field>

        {/* 7 — Niveau PvP */}
        <Field label={`Quel est ton niveau en PvP ? — ${pvpLevel[0]}/10`} required>
          <Slider
            value={pvpLevel}
            onValueChange={setPvpLevel}
            min={1}
            max={10}
            step={1}
            className="mt-3"
          />
          <p className="text-pink-400 text-sm italic mt-2" style={{ fontFamily: "'Space Mono'" }}>
            « {pvpPhrase(pvpLevel[0])} »
          </p>
        </Field>

        {/* 8 — Motivation */}
        <Field
          label="Pourquoi es-tu motivé à rejoindre une faction ? Et pourquoi la nôtre en particulier ?"
          required
        >
          <Textarea
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            placeholder="Ta motivation…"
            required
            rows={4}
            maxLength={2000}
          />
        </Field>

        {/* 9 — Ajout libre (optionnel) */}
        <Field label="Souhaites-tu rajouter quelque chose ?">
          <Textarea
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Optionnel — tout ce que tu veux ajouter."
            rows={3}
            maxLength={2000}
          />
        </Field>

        {/* 10 — Note étoiles (optionnel) */}
        <Field
          label="Note ce formulaire"
          hint="Optionnel — juste pour nous aider à l'améliorer. Ça n'influence pas ta candidature."
        >
          <StarRating value={formRating} onChange={setFormRating} />
        </Field>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 uppercase tracking-wider"
          >
            {mutation.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Send className="w-5 h-5 mr-2" />
            )}
            Envoyer ma candidature
          </Button>
          {!canSubmit && !mutation.isPending && (
            <p className="text-muted-foreground text-xs mt-2 text-center">
              Complète tous les champs obligatoires (présentations comprises) pour pouvoir envoyer.
            </p>
          )}
        </div>
      </form>
    </Shell>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-foreground text-xs uppercase tracking-wider block">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </Label>
      {hint && (
        <p className="text-[11px] leading-snug text-muted-foreground italic normal-case tracking-normal -mt-1">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

/** Compteur de caractères : visible UNIQUEMENT tant qu'on est sous le minimum. */
function CharCounter({ len, min }: { len: number; min: number }) {
  if (len >= min) {
    return (
      <p className="text-[11px] text-emerald-400/80 mt-1" style={{ fontFamily: "'Space Mono'" }}>
        ✓ {len} caractères
      </p>
    );
  }
  return (
    <p className="text-[11px] text-amber-400/90 mt-1" style={{ fontFamily: "'Space Mono'" }}>
      {len}/{min} caractères minimum
    </p>
  );
}

/** Notation par étoiles avec demi-points (0,5 → 5). value=0 = non noté. */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center" onMouseLeave={() => setHover(null)}>
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, display - i));
          return (
            <div key={i} className="relative w-9 h-9">
              <Star className="w-9 h-9 text-muted-foreground" strokeWidth={1.5} />
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className="w-9 h-9 text-yellow-400 fill-yellow-400" strokeWidth={1.5} />
              </div>
              <button
                type="button"
                aria-label={`${i + 0.5} étoile(s)`}
                className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(i + 0.5)}
                onClick={() => onChange(i + 0.5)}
              />
              <button
                type="button"
                aria-label={`${i + 1} étoile(s)`}
                className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(i + 1)}
                onClick={() => onChange(i + 1)}
              />
            </div>
          );
        })}
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">
        {display > 0 ? `${display}/5` : "—"}
      </span>
      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          effacer
        </button>
      )}
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
      <div className={`relative bg-card/90 border-2 ${borderColor} p-8`}>
        <div className="flex items-center gap-3 mb-3">
          {icon}
          <h2
            className="text-xl font-bold uppercase tracking-tight"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {title}
          </h2>
        </div>
        <div className="text-foreground text-sm leading-relaxed">{body}</div>
      </div>
    </div>
  );
}
