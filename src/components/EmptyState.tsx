import { cn } from "@/lib/utils";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Compact = inline list empty (e.g. inside a card list). Default = full card area. */
  variant?: "default" | "compact";
}

/**
 * Cohérent à travers l'app: occupe une hauteur minimale stable afin que
 * la mise en page ne saute pas entre l'état "chargement" et l'état "vide".
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = "Aucun résultat",
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/20",
        isCompact ? "min-h-[120px] p-4" : "min-h-[200px] p-8",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground",
          isCompact ? "h-8 w-8" : "h-10 w-10",
        )}
      >
        <Icon className={cn(isCompact ? "h-4 w-4" : "h-5 w-5")} />
      </div>
      <p className={cn("font-medium text-foreground", isCompact ? "text-sm" : "text-sm")}>
        {title}
      </p>
      {description ? <p className="text-xs text-muted-foreground max-w-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
