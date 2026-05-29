/**
 * Skeletons partagés pour éviter le "saut" de mise en page pendant le chargement.
 * Toujours utiliser un skeleton structurel (même hauteur/colonnes que le contenu réel)
 * plutôt qu'un simple texte « Chargement… ».
 */
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Petite ligne de skeleton avec largeur configurable. */
export function SkeletonLine({ className = "h-4 w-full" }: { className?: string }) {
  return <Skeleton className={className} />;
}

/** Grille de KPIs (utilisée par /staff, /dashboard…). */
export function KpiGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-3 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Grille de stats compactes (3-4 cartes alignées). */
export function StatGridSkeleton({ count = 4, cols = 4 }: { count?: number; cols?: 2 | 3 | 4 }) {
  const colsClass =
    cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid gap-4 ${colsClass}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-16 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Liste de lignes "membre" avec avatar + 2 lignes de texte + valeur à droite. */
export function MemberRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-3 flex items-center gap-3">
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-28 max-w-full" />
          </div>
          <div className="text-right space-y-1.5">
            <Skeleton className="h-5 w-12 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Liste générique en cartes (recrutement, sondages, donations…). */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="py-4 flex items-center gap-4">
            <Skeleton className="size-8 rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Liste compacte type ligne dans un Card (logs, activité staff). */
export function RowListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="p-3 flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-md shrink-0" />
          <Skeleton className="h-3 flex-1 max-w-sm" />
          <Skeleton className="h-3 w-24 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

/** Skeleton pour une grille de groupes de membres (effectif). */
export function GroupGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex-row items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-3 w-full max-w-[80%]" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton pour une fiche détaillée (header + stats + plusieurs cartes). */
export function DetailPageSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <StatGridSkeleton count={3} cols={3} />
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Skeleton pour le hero/profil de /me (image MC + infos). */
export function ProfileHeroSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-transparent p-6 flex flex-col md:flex-row gap-6 items-center md:items-start">
        <Skeleton className="h-48 md:h-64 w-32 md:w-44 shrink-0" />
        <div className="flex-1 w-full space-y-3 text-center md:text-left">
          <Skeleton className="h-3 w-20 mx-auto md:mx-0" />
          <Skeleton className="h-10 w-56 mx-auto md:mx-0" />
          <Skeleton className="h-4 w-32 mx-auto md:mx-0" />
          <div className="flex gap-2 justify-center md:justify-start">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-64 mx-auto md:mx-0" />
        </div>
      </div>
    </Card>
  );
}
