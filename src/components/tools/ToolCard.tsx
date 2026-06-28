import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function ToolCard({
  to,
  icon: Icon,
  title,
  description,
  code,
  accent = "pink",
  disabled = false,
  disabledLabel,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  code: string;
  accent?: "pink" | "blurple";
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const accentBorder = "border-primary";
  const accentText = "text-primary";

  const inner = (
    <>
      <div
        className={`absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 ${disabled ? "border-border" : accentBorder}`}
      />
      <div
        className={`absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 ${disabled ? "border-border" : accentBorder}`}
      />
      <div
        className={`relative bg-card/80 border border-border backdrop-blur p-5 h-full flex flex-col transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-border"}`}
      >
        <div
          className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.25em] mb-2"
          style={{ fontFamily: "'Space Mono'" }}
        >
          {code}
        </div>
        <div className="flex items-start gap-3 mb-2">
          <Icon
            className={`w-5 h-5 mt-0.5 ${disabled ? "text-muted-foreground" : accentText} shrink-0`}
          />
          <h3
            className="text-base font-bold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {title}
          </h3>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
        <span
          className="mt-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono"
          style={{ fontFamily: "'Space Mono'" }}
        >
          {disabledLabel ?? "Bientôt"}
        </span>
      </div>
    </>
  );

  if (disabled) {
    return <div className="relative group block">{inner}</div>;
  }

  return (
    <Link to={to} className="relative group block">
      <div className={`absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 ${accentBorder}`} />
      <div
        className={`absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 ${accentBorder}`}
      />
      <div className="relative bg-card/80 border border-border hover:border-border backdrop-blur p-5 h-full flex flex-col transition-colors">
        <div
          className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.25em] mb-2"
          style={{ fontFamily: "'Space Mono'" }}
        >
          {code}
        </div>
        <div className="flex items-start gap-3 mb-2">
          <Icon className={`w-5 h-5 mt-0.5 ${accentText} shrink-0`} />
          <h3
            className="text-base font-bold uppercase tracking-tight text-foreground"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            {title}
          </h3>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
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
