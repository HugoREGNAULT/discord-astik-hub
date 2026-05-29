import { createFileRoute } from "@tanstack/react-router";
import {
  User as UserIcon,
  Users,
  Activity,
  ShoppingBag,
  Trophy,
  MousePointerClick,
  Calculator,
  Calendar,
  LineChart,
  Store,
  Receipt,
} from "lucide-react";

import { ToolCard } from "@/components/tools/ToolCard";
import { ToolHeader, MissingKeyBanner } from "@/components/tools/ToolsUi";
import { PaladiumRateLimits } from "@/components/tools/PaladiumRateLimits";
import { hasPaladiumKey } from "@/lib/paladium/api";


export const Route = createFileRoute("/_authenticated/tools/")({
  head: () => ({
    meta: [
      { title: "Outils Paladium · PunkAstik" },
      {
        name: "description",
        content:
          "Suite d'outils Paladium internes à la faction : lookup joueur, faction, statut serveurs, market, classements, optimiseur PalaClicker, calculateur XP.",
      },
    ],
  }),
  component: ToolsIndex,
});

function ToolsIndex() {
  const keyOk = hasPaladiumKey();
  return (
    <div className="max-w-6xl">
      <ToolHeader
        code="// tools.index"
        title="Outils Paladium"
        description="Suite d'outils internes faction pour interagir avec l'API Paladium : joueurs, factions, market, clicker, métiers."
      />
      {!keyOk && <MissingKeyBanner />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <ToolCard
          to="/tools/player"
          code="[01]"
          icon={UserIcon}
          title="Lookup Joueur"
          description="Recherche un joueur Paladium par pseudo : identité, faction, grade, argent, niveau, métiers et clicker."
          accent="pink"
        />
        <ToolCard
          to="/tools/faction"
          code="[02]"
          icon={Users}
          title="Profil Faction"
          description="Détails d'une faction : membres, alliances, statistiques. Raccourci PunkAstik."
          accent="blurple"
        />
        <ToolCard
          to="/tools/status"
          code="[03]"
          icon={Activity}
          title="Statut Serveurs"
          description="État live des serveurs Paladium (dont anarchie). Auto-refresh 60s."
          accent="pink"
        />
        <ToolCard
          to="/tools/market"
          code="[04]"
          icon={ShoppingBag}
          title="Market HDV"
          description="Liste des items en vente. Recherche par nom et tri par prix."
          accent="blurple"
        />
        <ToolCard
          to="/tools/leaderboard"
          code="[05]"
          icon={Trophy}
          title="Classements"
          description="Top joueurs par argent, niveau et autres catégories."
          accent="pink"
        />
        <ToolCard
          to="/tools/clicker"
          code="[06]"
          icon={MousePointerClick}
          title="PalaClicker Optimizer"
          description="Recommande le prochain achat le plus rentable en RPS pour maximiser tes ClicCoins."
          accent="blurple"
        />
        <ToolCard
          to="/tools/xp-calculator"
          code="[07]"
          icon={Calculator}
          title="Calculateur XP Métiers"
          description="Calcule l'XP et les ressources à farmer pour passer d'un niveau à un autre."
          accent="pink"
        />
        <ToolCard
          to="/tools/events"
          code="[08]"
          icon={Calendar}
          title="Agenda événements"
          description="KOTH, À vos marques et autres événements Paladium à venir, avec countdown."
          accent="blurple"
        />
        <ToolCard
          to="/tools/uptime"
          code="[09]"
          icon={LineChart}
          title="Uptime serveurs"
          description="Disponibilité et fréquentation des serveurs Paladium sur 7 jours."
          accent="pink"
        />
        <ToolCard
          to="/tools/shop-admin"
          code="[10]"
          icon={Store}
          title="Shop admin"
          description="Prix actuels du shop admin et historique quotidien par item."
          accent="blurple"
        />

        <ToolCard
          to="/tools/sales"
          code="[11]"
          icon={Receipt}
          title="Ventes joueur"
          description="Recherche un joueur (pseudo ou UUID) et consulte ses ventes HDV en cours et passées avec filtres."
          accent="pink"
        />

      </div>
      <div className="mt-8">
        <PaladiumRateLimits />
      </div>
    </div>
  );
}
