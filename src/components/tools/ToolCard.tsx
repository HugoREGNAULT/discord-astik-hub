import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function ToolCard({
  to,
  icon: Icon,
  title,
  description,
  code,
  accent = "pink",
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  code: string;
  accent?: "pink" | "blurple";
}) {
  const accentBorder = accent === "blurple" ? "border-[#5865F2]" : "border-pink-500";
  const accentText = accent === "blurple" ? "text-[#5865F2]" : "text-pink-500";
  return (
    <Link to={to} className="relative group block">
      <div className={`absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 ${accentBorder}`} />
      <div
        className={`absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 ${accentBorder}`}
      />
      <div className="relative bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 backdrop-blur p-5 h-full flex flex-col transition-colors">
        <div
          className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.25em] mb-2"
          style={{ fontFamily: "'Space Mono'" }}
        >
          {code}
        </div>
        <div className="flex items-start gap-3 mb-2">
          <Icon className={`w-5 h-5 mt-0.5 ${accentText} shrink-0`} />
          <h3
            className="text-base font-bold uppercase tracking-tight text-white"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {title}
          </h3>
        </div>
        <p className="text-zinc-400 text-xs leading-relaxed">{description}</p>
        <span
          className={`mt-4 text-[10px] uppercase tracking-[0.3em] ${accentText} font-mono`}
          style={{ fontFamily: "'Space Mono'" }}
        >
          → ouvrir
        </span>
      </div>
    </Link>
  );
}
