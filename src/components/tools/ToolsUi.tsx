import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * DA "Tools / PunkAstik" — kit visuel partagé (terminal/cyberpunk).
 * Réutilisable hors `/tools` : importer depuis ce fichier (alias PageHeader / PageCard).
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
        className="text-pink-500 text-[10px] uppercase tracking-[0.4em] mb-2"
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
      {description && <p className="text-zinc-400 text-sm mt-2 max-w-3xl">{description}</p>}
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
    <div
      className={`relative bg-zinc-900/70 border border-zinc-800 backdrop-blur p-4 md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export const PageCard = ToolCard;

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-3"
      style={{ fontFamily: "'Space Mono'" }}
    >
      // {children}
    </div>
  );
}

export function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[10px] uppercase tracking-[0.3em] text-zinc-500"
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
      "bg-pink-500 hover:bg-pink-600 text-white border-b-4 border-black/20 disabled:opacity-50",
    ghost:
      "bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700",
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
      className={`text-xs font-bold uppercase tracking-[0.2em] px-5 py-2 transition-colors disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${styles[variant]} ${className}`}
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
      className={`bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40 font-mono ${
        props.className ?? ""
      }`}
    />
  );
}

export function DaSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white focus:border-pink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/40 font-mono ${
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
    pink: "bg-pink-500/15 text-pink-300 border-pink-500/30",
    blurple: "bg-[#5865F2]/15 text-[#a3aafb] border-[#5865F2]/30",
    zinc: "bg-zinc-800 text-zinc-300 border-zinc-700",
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
      className="flex items-center gap-3 text-zinc-500 text-xs uppercase tracking-[0.3em] py-8 justify-center"
      style={{ fontFamily: "'Space Mono'" }}
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="relative border border-pink-500/40 bg-pink-500/5 p-4 text-sm">
      <div
        className="text-[10px] uppercase tracking-[0.3em] text-pink-500 mb-1"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // erreur
      </div>
      <p className="text-pink-200">{message}</p>
      {hint && <p className="text-zinc-500 text-xs mt-2">{hint}</p>}
    </div>
  );
}

export function EmptyBlock({ label }: { label: string }) {
  return (
    <div
      className="text-zinc-600 text-xs uppercase tracking-[0.3em] py-6 text-center"
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
      ? "text-pink-500"
      : accent === "blurple"
        ? "text-[#5865F2]"
        : accent === "green"
          ? "text-emerald-400"
          : accent === "red"
            ? "text-red-400"
            : "text-white";
  return (
    <div className="border border-zinc-800 bg-zinc-900/60 p-3">
      <div
        className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 mb-1"
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
        className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-pink-500 focus:outline-none font-mono"
      />
      <button
        type="submit"
        className="bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold uppercase tracking-[0.2em] px-5 py-2 transition-colors border-b-4 border-black/20"
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
