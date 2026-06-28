import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * DA "Tools / PunkAstik" — kit visuel partagé (terminal/cyberpunk).
 * Réutilisable hors `/tools` : importer depuis ce fichier (alias PageHeader / PageCard).
 *
 * Convention UI du projet :
 * - Pages "outils Paladium" et gestion faction (points, donations, tools.*) :
 *   utiliser les composants Da* d'ici (DaButton, DaInput, DaSelect, DaChip…).
 *   Angles droits, focus rose, ambiance terminal.
 * - Formulaires de profil / admin (me, welcome, config, objectives) :
 *   utiliser les composants shadcn (`@/components/ui/*`). Ils héritent du
 *   même anneau de focus rose via la variable CSS `--ring`.
 * Éviter de mélanger les deux kits dans une même page.
 */

export function ToolHeader({
  code,
  title,
  description,
}: {
  code: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p
        className="text-primary text-[10px] uppercase tracking-[0.4em] mb-2"
        style={{ fontFamily: "'Space Mono'" }}
      >
        {code}
      </p>
      <h1
        className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-white"
        style={{ fontFamily: "'Space Grotesk'" }}
      >
        {title}
      </h1>
      {description && <p className="text-muted-foreground text-sm mt-2 max-w-3xl">{description}</p>}
    </div>
  );
}

export const PageHeader = ToolHeader;

export function ToolCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative bg-card border border-border backdrop-blur p-4 md:p-5 ${className}`}>
      {children}
    </div>
  );
}

export const PageCard = ToolCard;

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.3em] text-primary mb-3"
      style={{ fontFamily: "'Space Mono'" }}
    >
      // {children}
    </div>
  );
}

export function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
      style={{ fontFamily: "'Space Mono'" }}
    >
      {children}
    </span>
  );
}

export function DaButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger" | "success";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-primary text-primary-foreground border-[3px] border-primary shadow-[3px_3px_0px_#000000] disabled:opacity-50",
    ghost:
      "bg-transparent hover:bg-secondary text-muted-foreground hover:text-white border border-border hover:border-border",
    danger:
      "bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/40",
    success:
      "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-bold uppercase tracking-[0.2em] px-5 py-2 transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${styles[variant]} ${className}`}
      style={{ fontFamily: "'Space Mono'" }}
    >
      {children}
    </button>
  );
}

export function DaInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`bg-input border-[3px] border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 font-mono ${
        props.className ?? ""
      }`}
    />
  );
}

export function DaSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`bg-input border-[3px] border-border px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 font-mono ${
        props.className ?? ""
      }`}
    />
  );
}

export function DaChip({
  children,
  accent = "pink",
}: {
  children: ReactNode;
  accent?: "pink" | "blurple" | "zinc" | "green" | "red";
}) {
  const map: Record<string, string> = {
    pink: "bg-primary/15 text-primary border-primary/30",
    blurple: "bg-primary/15 text-primary border-primary/30",
    zinc: "bg-secondary text-muted-foreground border-border",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border text-[10px] uppercase tracking-[0.2em] ${map[accent]}`}
      style={{ fontFamily: "'Space Mono'" }}
    >
      {children}
    </span>
  );
}

export function LoadingBlock({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-3 text-muted-foreground text-xs uppercase tracking-[0.3em] py-8 justify-center"
      style={{ fontFamily: "'Space Mono'" }}
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="relative border-l-[3px] border-primary/40 bg-primary/5 p-4 text-sm">
      <div
        className="text-[10px] uppercase tracking-[0.3em] text-primary mb-1"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // erreur
      </div>
      <p className="text-primary">{message}</p>
      {hint && <p className="text-muted-foreground text-xs mt-2">{hint}</p>}
    </div>
  );
}

export function EmptyBlock({ label }: { label: string }) {
  return (
    <div
      className="text-muted-foreground text-xs uppercase tracking-[0.3em] py-6 text-center"
      style={{ fontFamily: "'Space Mono'" }}
    >
      {label}
    </div>
  );
}

export function StatTile({
  label,
  value,
  accent = "white",
}: {
  label: string;
  value: ReactNode;
  accent?: "white" | "pink" | "blurple" | "green" | "red";
}) {
  const color =
    accent === "pink"
      ? "text-primary"
      : accent === "blurple"
        ? "text-primary"
        : accent === "green"
          ? "text-emerald-400"
          : accent === "red"
            ? "text-red-400"
            : "text-white";
  return (
    <div className="border border-border bg-card p-3">
      <div
        className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-1"
        style={{ fontFamily: "'Space Mono'" }}
      >
        {label}
      </div>
      <div className={`text-xl font-bold ${color}`} style={{ fontFamily: "'Space Grotesk'" }}>
        {value}
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  buttonLabel = "Chercher",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  buttonLabel?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col sm:flex-row gap-2"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-input border-[3px] border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 font-mono"
      />
      <button
        type="submit"
        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-[0.2em] px-5 py-2 transition-colors border-[3px] border-primary shadow-[3px_3px_0px_#000000]"
        style={{ fontFamily: "'Space Mono'" }}
      >
        {buttonLabel}
      </button>
    </form>
  );
}

export function MissingKeyBanner() {
  return (
    <div className="border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-300 mb-4">
      <span className="font-mono uppercase tracking-[0.2em] text-amber-400 mr-2">// config</span>
      Variable <code className="font-mono">VITE_PALADIUM_API_KEY</code> manquante — les appels API
      échoueront. Ajoute-la dans les Build Secrets puis relance le build.
    </div>
  );
}
