import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

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
      <p className="text-zinc-400 text-sm mt-2 max-w-3xl">{description}</p>
    </div>
  );
}

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
