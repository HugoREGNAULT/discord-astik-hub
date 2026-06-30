# Brutalist Paladium Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la direction artistique rouge/rose par un univers brutalist sombre × Paladium (fond charbon violacé, accent unique violet #8b5cf6, coins droits, bordures 3px, ombres dures), en dark mode forcé permanent.

**Architecture:** Tout part du CSS global (`styles.css`) via des CSS custom properties que Tailwind v4 mappe en tokens. Les composants shadcn/ui (`src/components/ui/`) consomment ces tokens → toutes les pages qui utilisent Card, Button, Badge, Progress, Input, Tabs, Dialog suivront automatiquement. Les composants maison avec du style hardcodé (AppSidebar, ToolsUi, pages publiques) sont retouchés manuellement.

**Tech Stack:** React 19, TanStack Router/Start, Tailwind CSS v4 (`@theme inline`), shadcn/ui new-york, `class-variance-authority`, `@fontsource/*`, Radix UI primitives, `bun` comme package manager.

## Global Constraints

- Aucune modification de logique, routes, loaders, mutations, permissions, auth
- Coins droits partout : `rounded-none` — jamais `rounded-sm/md/lg/xl`
- Bordures 3px : `border-[3px]` — jamais `border` (1px) ou `border-2` (2px)
- Accent unique : `#8b5cf6` (`--primary`) — jamais `pink-*`, `rose-*`, `#5865F2`, ni aucune autre couleur d'accent
- `ThemeToggle` retiré du rendu — le composant reste dans le repo mais n'est plus utilisé
- Responsive mobile conservé — aucun breakpoint modifié
- Focus clavier visible : `focus-visible:ring-2 focus-visible:ring-primary` conservé
- `prefers-reduced-motion` respecté via `motion-safe:` prefix sur les transitions animées
- Toutes les commandes sont exécutées depuis le répertoire `discord-astik-hub/`

---

### Task 1 : Installer Inter + Refondre les tokens CSS

**Files:**

- Modify: `src/styles.css`
- Run: `bun add @fontsource/inter`

**Interfaces:**

- Produces: Variables CSS `--background`, `--primary`, etc. mappées sur la palette violette — consommées par toutes les tâches suivantes via `var(--primary)`, `bg-primary`, `text-muted-foreground`, etc.

- [ ] **Step 1 : Installer @fontsource/inter**

```bash
bun add @fontsource/inter
```

Expected output : ligne `@fontsource/inter` ajoutée dans `package.json` dependencies.

- [ ] **Step 2 : Remplacer entièrement `src/styles.css`**

Contenu complet du fichier après modification :

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";
@import "@fontsource/space-grotesk/300.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/space-mono/400.css";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

/* Brutalist Sombre × Univers Paladium — dark forever */
:root {
  --radius: 0rem;
  --background: #0d0a13;
  --foreground: #f3ecff;
  --card: #161020;
  --card-foreground: #f3ecff;
  --popover: #161020;
  --popover-foreground: #f3ecff;
  --primary: #8b5cf6;
  --primary-foreground: #0d0a13;
  --secondary: #1d1530;
  --secondary-foreground: #f3ecff;
  --muted: #1d1530;
  --muted-foreground: #9a8fb5;
  --accent: #8b5cf6;
  --accent-foreground: #0d0a13;
  --destructive: oklch(0.62 0.23 25);
  --destructive-foreground: oklch(0.98 0 0);
  --success: oklch(0.7 0.18 150);
  --success-foreground: oklch(0.14 0 0);
  --warning: oklch(0.78 0.16 80);
  --warning-foreground: oklch(0.14 0 0);
  --border: #2c2140;
  --input: #1d1530;
  --ring: #8b5cf6;
  --sidebar: #0a0813;
  --sidebar-foreground: #f3ecff;
  --sidebar-primary: #8b5cf6;
  --sidebar-primary-foreground: #0d0a13;
  --sidebar-accent: #1d1530;
  --sidebar-accent-foreground: #f3ecff;
  --sidebar-border: #2c2140;
  --sidebar-ring: #8b5cf6;
}

.dark {
  --background: #0d0a13;
  --foreground: #f3ecff;
  --card: #161020;
  --card-foreground: #f3ecff;
  --popover: #161020;
  --popover-foreground: #f3ecff;
  --primary: #8b5cf6;
  --primary-foreground: #0d0a13;
  --secondary: #1d1530;
  --secondary-foreground: #f3ecff;
  --muted: #1d1530;
  --muted-foreground: #9a8fb5;
  --accent: #8b5cf6;
  --accent-foreground: #0d0a13;
  --destructive: oklch(0.62 0.23 25);
  --destructive-foreground: oklch(0.98 0 0);
  --border: #2c2140;
  --input: #1d1530;
  --ring: #8b5cf6;
  --sidebar: #0a0813;
  --sidebar-foreground: #f3ecff;
  --sidebar-primary: #8b5cf6;
  --sidebar-primary-foreground: #0d0a13;
  --sidebar-accent: #1d1530;
  --sidebar-accent-foreground: #f3ecff;
  --sidebar-border: #2c2140;
  --sidebar-ring: #8b5cf6;
}

@layer base {
  * {
    border-color: var(--color-border);
  }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: "Inter", sans-serif;
    font-feature-settings: "ss01", "cv11";
    background-image:
      radial-gradient(ellipse 60% 40% at 20% 0%, rgba(139, 92, 246, 0.07) 0%, transparent 70%),
      radial-gradient(ellipse 40% 30% at 80% 100%, rgba(139, 92, 246, 0.05) 0%, transparent 70%);
  }
}

@layer components {
  /* Coin équerre brutal en haut à droite — à placer sur tout élément `relative` */
  .brutal-corner::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-top: 3px solid var(--primary);
    border-right: 3px solid var(--primary);
    pointer-events: none;
    z-index: 1;
  }

  /* Barre XP rayée style Paladium — à appliquer sur l'indicateur de Progress */
  .xp-bar-indicator {
    background-image: repeating-linear-gradient(
      45deg,
      #8b5cf6 0px,
      #8b5cf6 6px,
      #6d3df0 6px,
      #6d3df0 12px
    );
  }
}
```

- [ ] **Step 3 : Vérifier le typecheck**

```bash
bun run typecheck
```

Expected: 0 erreurs TypeScript. (Les tokens CSS ne génèrent pas d'erreurs de types.)

- [ ] **Step 4 : Commit**

```bash
git add src/styles.css package.json bun.lock
git commit -m "feat: design system — tokens violet Paladium + Inter + brutal-corner CSS"
```

---

### Task 2 : Restyle `_authenticated.tsx` — layout + suppression ThemeToggle

**Files:**

- Modify: `src/routes/_authenticated.tsx`

**Interfaces:**

- Consumes: tokens `--background`, `--border`, `--primary`, `--muted-foreground` de Task 1
- Produces: layout principal avec fond `bg-background`, header violet, sans ThemeToggle

- [ ] **Step 1 : Remplacer le fichier**

Remplacer `src/routes/_authenticated.tsx` par la version suivante (seul le JSX/styles change, toute la logique est identique) :

```tsx
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getSessionStatus, getCurrentUser } from "@/lib/auth/session.functions";
import { recordView } from "@/lib/data/usage.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { authenticated } = await getSessionStatus();
    if (!authenticated) throw redirect({ to: "/login" });
  },
  loader: async () => {
    try {
      return await getCurrentUser();
    } catch {
      return null;
    }
  },
  head: () => ({}),
  component: AuthLayout,
});

const PATH_LABELS: Record<string, string> = {
  "/dashboard": "Classement",
  "/polls": "Sondages",
  "/absences": "Absences",
  "/tools": "Outils Paladium",
  "/tools/alerts": "Mes alertes",
  "/tools/player": "Player",
  "/tools/sales": "Ventes",
  "/tools/faction": "Faction",
  "/tools/check-bc": "Check BC",
  "/tools/status": "Status",
  "/tools/market": "Market",
  "/tools/leaderboard": "Leaderboard",
  "/tools/clicker": "Clicker",
  "/tools/xp-calculator": "XP Calc",
  "/tools/events": "Events",
  "/tools/uptime": "Uptime",
  "/tools/shop-admin": "Shop admin",
  "/staff": "Dashboard staff",
  "/members": "Membres",
  "/effectif": "Effectif",
  "/pdc": "Plan de coupe",
  "/recruitment": "Candidatures",
  "/blacklist": "Blacklist",
  "/points": "Gestion Points",
  "/config": "Config valeurs",
  "/logs": "Logs",
  "/admin": "Admin",
  "/welcome": "Bienvenue",
};

function buildCrumbs(pathname: string): Array<{ label: string; href: string; isLast: boolean }> {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string; isLast: boolean }> = [];
  for (let i = 0; i < segments.length; i++) {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = PATH_LABELS[href] ?? decodeURIComponent(segments[i]);
    crumbs.push({ label, href, isLast: i === segments.length - 1 });
  }
  return crumbs;
}

function AuthLayout() {
  const loaderUser = Route.useLoaderData();
  const { data: freshUser } = useCurrentUser();
  const user = freshUser ?? loaderUser;
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const crumbs = buildCrumbs(pathname);

  const trackView = useServerFn(recordView);
  const lastTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    if (lastTrackedRef.current === pathname) return;
    lastTrackedRef.current = pathname;
    void trackView({ data: { path: pathname } }).catch(() => {});
  }, [pathname, user, trackView]);

  if (!user) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-background text-muted-foreground uppercase tracking-[0.3em] text-xs"
        style={{ fontFamily: "'Space Mono'" }}
      >
        // loading…
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground relative">
        {/* Background grid violet */}
        <div className="fixed inset-0 opacity-20 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(rgba(139,92,246,0.4) 0.5px, transparent 0.5px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        <AppSidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <header className="h-14 flex items-center gap-3 border-b border-border px-4 sticky top-0 bg-background/90 backdrop-blur z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />
            <Breadcrumb className="hidden sm:flex" style={{ fontFamily: "'Space Mono'" }}>
              <BreadcrumbList className="text-[10px] uppercase tracking-[0.3em] gap-1.5 sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-muted-foreground hover:text-primary">
                    <Link to="/dashboard">PunkAstik //</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {crumbs.map((c) => (
                  <span key={c.href} className="inline-flex items-center gap-1.5 sm:gap-2">
                    <BreadcrumbSeparator className="text-muted-foreground [&>svg]:size-3" />
                    <BreadcrumbItem>
                      {c.isLast ? (
                        <BreadcrumbPage className="text-foreground font-normal">
                          {c.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href={c.href}
                          className="text-muted-foreground hover:text-primary"
                        >
                          {c.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-1">
              <CommandPalette />
              <NotificationBell />
              <span
                className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] hidden md:inline ml-1"
                style={{ fontFamily: "'Space Mono'" }}
              >
                SYS_HUB_V2
              </span>
              <span
                className="w-2 h-2 bg-success shadow-[0_0_8px_rgba(52,211,153,0.7)] ml-1"
                aria-hidden
              />
            </div>
          </header>

          <main
            className="flex-1 p-4 md:p-6 overflow-x-hidden relative"
            style={{ fontFamily: "'Space Grotesk'" }}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2 : Vérifier le typecheck**

```bash
bun run typecheck
```

Expected: 0 erreurs (le `ThemeToggle` import supprimé ne doit plus causer d'erreur si le composant existe encore dans le repo).

- [ ] **Step 3 : Commit**

```bash
git add src/routes/_authenticated.tsx
git commit -m "feat: design system — layout principal violet, suppression ThemeToggle"
```

---

### Task 3 : Restyle `ui/card.tsx` — brutal shadow + coin équerre

**Files:**

- Modify: `src/components/ui/card.tsx`

**Interfaces:**

- Consumes: classe CSS `brutal-corner` de Task 1, tokens `--border`, `--card`
- Produces: `Card` avec `border-[3px] border-border shadow-[5px_5px_0px_#000] brutal-corner`

- [ ] **Step 1 : Remplacer `src/components/ui/card.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative rounded-none border-[3px] border-border bg-card text-card-foreground shadow-[5px_5px_0px_#000000] brutal-corner",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

- [ ] **Step 2 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/ui/card.tsx && git commit -m "feat: design system — Card brutal shadow + coin équerre violet"
```

---

### Task 4 : Restyle `ui/button.tsx` + `ui/badge.tsx`

**Files:**

- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`

**Interfaces:**

- Consumes: `--primary`, `--secondary`, `--border`
- Produces: Button sans arrondi avec ombre dure, Badge monospace sans arrondi

- [ ] **Step 1 : Remplacer `src/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 uppercase tracking-wide",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-[3px] border-primary shadow-[3px_3px_0px_#000000] motion-safe:transition-all motion-safe:hover:shadow-[1px_1px_0px_#000000] motion-safe:hover:translate-x-[2px] motion-safe:hover:translate-y-[2px]",
        destructive:
          "bg-destructive text-destructive-foreground border-[3px] border-destructive shadow-[3px_3px_0px_#000000] motion-safe:transition-all motion-safe:hover:shadow-[1px_1px_0px_#000000] motion-safe:hover:translate-x-[2px] motion-safe:hover:translate-y-[2px]",
        outline:
          "border-[3px] border-primary bg-transparent text-primary hover:bg-primary/10 motion-safe:transition-colors",
        secondary:
          "bg-secondary text-secondary-foreground border-[3px] border-border hover:bg-secondary/80 motion-safe:transition-colors",
        ghost: "hover:bg-accent hover:text-accent-foreground motion-safe:transition-colors",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 2 : Remplacer `src/components/ui/badge.tsx`**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-none border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary/20 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-destructive bg-destructive/20 text-destructive-foreground",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 3 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/ui/button.tsx src/components/ui/badge.tsx && git commit -m "feat: design system — Button brutal shadow + Badge monospace sans arrondi"
```

---

### Task 5 : Restyle `ui/progress.tsx` — barre XP rayée

**Files:**

- Modify: `src/components/ui/progress.tsx`

**Interfaces:**

- Consumes: classe CSS `xp-bar-indicator` de Task 1, `--muted`, `--border`
- Produces: `Progress` avec track gris bordé et remplissage rayé violet

- [ ] **Step 1 : Remplacer `src/components/ui/progress.tsx`**

```tsx
"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-3 w-full overflow-hidden rounded-none bg-muted border-[3px] border-border",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 xp-bar-indicator motion-safe:transition-all motion-safe:duration-500",
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```

- [ ] **Step 2 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/ui/progress.tsx && git commit -m "feat: design system — Progress barre XP rayée violet"
```

---

### Task 6 : Restyle `ui/input.tsx` + `ui/tabs.tsx`

**Files:**

- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/tabs.tsx`

**Interfaces:**

- Consumes: `--input`, `--border`, `--primary`, `--muted`
- Produces: Input 3px border sans arrondi, Tabs underline brutal

- [ ] **Step 1 : Remplacer `src/components/ui/input.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-none border-[3px] border-border bg-input px-3 py-1 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary motion-safe:transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 2 : Remplacer `src/components/ui/tabs.tsx`**

```tsx
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center justify-start rounded-none border-b border-border bg-transparent p-0 text-muted-foreground gap-0",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-none border-b-[3px] border-transparent px-4 py-2 text-xs font-medium uppercase tracking-wider cursor-pointer motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

- [ ] **Step 3 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/ui/input.tsx src/components/ui/tabs.tsx && git commit -m "feat: design system — Input 3px border, Tabs underline brutal"
```

---

### Task 7 : Restyle `ui/dialog.tsx` — ombre dure 8px

**Files:**

- Modify: `src/components/ui/dialog.tsx`

**Interfaces:**

- Consumes: `--border`, `--background`
- Produces: DialogContent avec `border-[3px] border-border rounded-none shadow-[8px_8px_0px_#000000]`

- [ ] **Step 1 : Modifier uniquement `DialogContent` dans `src/components/ui/dialog.tsx`**

Trouver et remplacer la classe de `DialogPrimitive.Content` :

Avant :

```
"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg"
```

Après :

```
"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border-[3px] border-border bg-background p-6 shadow-[8px_8px_0px_#000000] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-none"
```

- [ ] **Step 2 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/ui/dialog.tsx && git commit -m "feat: design system — Dialog ombre dure 8px, sans arrondi"
```

---

### Task 8 : Restyle `AppSidebar.tsx`

**Files:**

- Modify: `src/components/AppSidebar.tsx`

**Interfaces:**

- Consumes: tokens `--sidebar`, `--sidebar-border`, `--sidebar-accent`, `--sidebar-foreground`, `--muted-foreground`, `--primary`
- Produces: sidebar toute violet, sans pink ni blurple, accent bar toujours `bg-primary`

- [ ] **Step 1 : Remplacer `src/components/AppSidebar.tsx`**

```tsx
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Trophy,
  UserCircle2,
  Users,
  Coins,
  ShoppingCart,
  Settings2,
  Swords,
  Target,
  ShieldAlert,
  LogOut,
  UserPlus,
  CalendarCheck,
  FileText,
  Ban,
  LayoutDashboard,
  Wrench,
  Bell,
  Megaphone,
  Eye,
  Award,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { CurrentUser } from "@/lib/auth/session.functions";
import { hasPerm } from "@/lib/auth/use-current-user";
import type { Permission } from "@/lib/auth/permissions";
import logo from "@/assets/logo.png";

type Item = {
  title: string;
  url: string;
  icon: any;
  perm: Permission;
};

type Section = {
  label: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    label: "// punkastik",
    items: [
      { title: "Mon profil", url: "/me", icon: UserCircle2, perm: "profile.self" },
      { title: "Classement", url: "/dashboard", icon: Trophy, perm: "profile.self" },
      { title: "Absences", url: "/absences", icon: CalendarCheck, perm: "profile.self" },
      { title: "Outils Paladium", url: "/tools", icon: Wrench, perm: "profile.self" },
      { title: "Projets", url: "/projects", icon: Target, perm: "profile.self" },
      { title: "Valeurs & ressources", url: "/values", icon: Coins, perm: "profile.self" },
      { title: "Check BC", url: "/check-bc", icon: ShieldAlert, perm: "profile.self" },
      { title: "Mes alertes", url: "/tools/alerts", icon: Bell, perm: "profile.self" },
    ],
  },
  {
    label: "// staff",
    items: [
      { title: "Dashboard staff", url: "/staff", icon: LayoutDashboard, perm: "members.view" },
      { title: "Récap", url: "/staff-recap", icon: Eye, perm: "members.view" },
      { title: "Membres", url: "/members", icon: Users, perm: "members.view" },
      { title: "Économie faction", url: "/faction-economy", icon: Coins, perm: "members.view" },
    ],
  },
  {
    label: "// recrutement",
    items: [
      { title: "Candidatures", url: "/recruitment", icon: UserPlus, perm: "recruit.access" },
      { title: "Blacklist", url: "/blacklist", icon: Ban, perm: "recruit.access" },
      { title: "Périodes d'essai", url: "/trials", icon: CalendarCheck, perm: "recruit.access" },
      { title: "Backlog candidatures", url: "/backlog", icon: FileText, perm: "admin.access" },
    ],
  },
  {
    label: "// économie",
    items: [
      { title: "Gestion Points", url: "/points", icon: Coins, perm: "points.manage" },
      { title: "Quêtes hebdo", url: "/quests-admin", icon: Swords, perm: "quests.manage" },
      { title: "Config valeurs", url: "/config", icon: Settings2, perm: "config.manage" },
    ],
  },
  {
    label: "// administration",
    items: [
      { title: "Logs", url: "/logs", icon: FileText, perm: "admin.access" },
      { title: "Admin", url: "/admin", icon: ShieldAlert, perm: "admin.access" },
    ],
  },
];

export function AppSidebar({ user }: { user: CurrentUser | null | undefined }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((i) => hasPerm(user, i.perm)),
  })).filter((section) => section.items.length > 0);

  const handleNavClick = () => {
    setOpenMobile(false);
  };

  return (
    <Sidebar
      collapsible="icon"
      className="[&_[data-sidebar=sidebar]]:bg-sidebar [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-sidebar-border text-sidebar-foreground"
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/30 blur-md" />
            <img
              src={logo}
              alt="PunkAstik"
              className="relative w-8 h-8 object-cover rounded-none border border-primary/40"
            />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span
              className="text-sm font-bold uppercase tracking-tight text-sidebar-foreground"
              style={{ fontFamily: "'Space Grotesk'" }}
            >
              PunkAstik <span className="text-primary">//</span>
            </span>
            <span
              className="text-[9px] text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              Faction Paladium
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel
              className="text-[9px] text-muted-foreground uppercase tracking-[0.3em]"
              style={{ fontFamily: "'Space Mono'" }}
            >
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = path === item.url || path.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="relative rounded-none border border-transparent text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent hover:border-sidebar-border data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:border-sidebar-border motion-safe:transition-colors"
                      >
                        <Link
                          to={item.url}
                          className="flex items-center gap-3"
                          onClick={handleNavClick}
                        >
                          <span
                            className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-primary ${
                              active ? "opacity-100" : "opacity-0 group-hover/menu-item:opacity-60"
                            } motion-safe:transition-opacity`}
                          />
                          <item.icon className="size-4 shrink-0" />
                          <span
                            className="text-xs uppercase tracking-wider"
                            style={{ fontFamily: "'Space Grotesk'" }}
                          >
                            {item.title}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        {user && (
          <div className="flex items-center gap-2 px-2 py-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-8 rounded-none border border-sidebar-border"
              />
            ) : (
              <div className="size-8 rounded-none bg-sidebar-accent border border-sidebar-border" />
            )}
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <div
                className="text-xs font-bold truncate uppercase tracking-tight text-sidebar-foreground"
                style={{ fontFamily: "'Space Grotesk'" }}
              >
                {user.globalName ?? user.username}
              </div>
              <div
                className="text-[11px] text-muted-foreground truncate uppercase tracking-wide"
                style={{ fontFamily: "'Space Mono'" }}
              >
                @{user.username}
              </div>
            </div>
            <a
              href="/api/auth/logout"
              className="text-muted-foreground hover:text-primary group-data-[collapsible=icon]:hidden motion-safe:transition-colors"
              title="Déconnexion"
            >
              <LogOut className="size-4" />
            </a>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 2 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/AppSidebar.tsx && git commit -m "feat: design system — Sidebar violette, accent unique primary, suppression pink/blurple"
```

---

### Task 9 : Restyle `me.tsx` — bandeau joueurs pulsant

**Files:**

- Modify: `src/routes/_authenticated/me.tsx`

**Interfaces:**

- Consumes: `--primary`
- Produces: bandeau joueurs avec carré `8×8 bg-primary animate-pulse` au lieu d'icône ronde

- [ ] **Step 1 : Remplacer le bloc bandeau joueurs dans `src/routes/_authenticated/me.tsx`**

Trouver (lignes 73–85) :

```tsx
{
  /* Bandeau joueurs connectés */
}
{
  playerCountData?.online != null && (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
      <Users className="size-4 text-primary" />
      <span className="text-muted-foreground">Joueurs en ligne sur Paladium :</span>
      <span className="font-bold text-primary tabular-nums">{playerCountData.online}</span>
      {playerCountData.capturedAt && (
        <span className="text-xs text-muted-foreground ml-auto">
          {formatRelative(playerCountData.capturedAt)}
        </span>
      )}
    </div>
  );
}
```

Remplacer par :

```tsx
{
  /* Bandeau joueurs connectés */
}
{
  playerCountData?.online != null && (
    <div className="flex items-center gap-2 border-[3px] border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
      <span className="w-2 h-2 bg-primary motion-safe:animate-pulse shrink-0" aria-hidden />
      <span className="text-muted-foreground">Joueurs en ligne sur Paladium :</span>
      <span className="font-bold text-primary tabular-nums">{playerCountData.online}</span>
      {playerCountData.capturedAt && (
        <span className="text-xs text-muted-foreground ml-auto">
          {formatRelative(playerCountData.capturedAt)}
        </span>
      )}
    </div>
  );
}
```

Supprimer l'import `Users` de lucide-react si `Users` n'est plus utilisé ailleurs dans le fichier (vérifier — il est dans l'import ligne 5).

- [ ] **Step 2 : Retirer `Users` de l'import lucide-react**

`Users` n'est utilisé que dans le bandeau qu'on vient de remplacer. Modifier la ligne d'import :

Avant :

```tsx
import { Coins, Gamepad2, Copy, Check, Users } from "lucide-react";
```

Après :

```tsx
import { Coins, Gamepad2, Copy, Check } from "lucide-react";
```

- [ ] **Step 3 : Typecheck + commit**

```bash
bun run typecheck && git add src/routes/_authenticated/me.tsx && git commit -m "feat: design system — bandeau joueurs /me avec carré pulsant violet"
```

---

### Task 10 : Restyle `ToolsUi.tsx` — composant UI interne outils

**Files:**

- Modify: `src/components/tools/ToolsUi.tsx`

**Interfaces:**

- Consumes: `--primary`, `--border`, `--muted`
- Produces: boutons/inputs/badges des outils en violet, sans pink ni blurple

- [ ] **Step 1 : Lire le fichier pour repérer les numéros de ligne exacts**

Lire `src/components/tools/ToolsUi.tsx` en entier avant d'effectuer les remplacements ci-dessous.

- [ ] **Step 2 : Remplacer toutes les occurrences `pink-500` → `primary` et `#5865F2`/`blurple` → `primary`**

Remplacements à effectuer dans `src/components/tools/ToolsUi.tsx` :

| Avant                                                                                       | Après                                                                                                               |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `"bg-pink-500 hover:bg-pink-600 text-white border-b-4 border-black/20 disabled:opacity-50"` | `"bg-primary text-primary-foreground border-[3px] border-primary shadow-[3px_3px_0px_#000000] disabled:opacity-50"` |
| `focus-visible:ring-pink-500`                                                               | `focus-visible:ring-ring`                                                                                           |
| `focus-visible:ring-offset-zinc-950`                                                        | `focus-visible:ring-offset-background`                                                                              |
| `focus:border-pink-500`                                                                     | `focus:border-primary`                                                                                              |
| `focus-visible:ring-pink-500/40`                                                            | `focus-visible:ring-primary/40`                                                                                     |
| `focus-visible:ring-pink-500/60`                                                            | `focus-visible:ring-primary/60`                                                                                     |
| `bg-zinc-950 border border-zinc-800` (sur inputs)                                           | `bg-input border-[3px] border-border`                                                                               |
| `text-white placeholder:text-zinc-500` (sur inputs)                                         | `text-foreground placeholder:text-muted-foreground`                                                                 |
| `text-zinc-400`                                                                             | `text-muted-foreground`                                                                                             |
| `hover:bg-zinc-900`                                                                         | `hover:bg-secondary`                                                                                                |
| `"text-pink-500"` (dans `MonoLabel`)                                                        | `"text-primary"`                                                                                                    |
| `"text-pink-500 text-[10px]..."` (dans `SectionHeading`)                                    | `"text-primary text-[10px]..."`                                                                                     |
| `pink: "bg-pink-500/15 text-pink-300 border-pink-500/30"`                                   | `"bg-primary/15 text-primary border-primary/30"`                                                                    |
| `blurple: "bg-[#5865F2]/15 text-[#a3aafb] border-[#5865F2]/30"`                             | `"bg-primary/15 text-primary border-primary/30"`                                                                    |
| `"text-pink-500"` dans `StatusDot`                                                          | `"text-primary"`                                                                                                    |
| `"text-[#5865F2]"` dans `StatusDot`                                                         | `"text-primary"`                                                                                                    |
| `border-l-2 border-pink-500/40 bg-pink-500/5` (AlertBox)                                    | `border-l-[3px] border-primary/40 bg-primary/5`                                                                     |
| `bg-pink-500 hover:bg-pink-600` (SearchInput button)                                        | `bg-primary hover:bg-primary/90`                                                                                    |
| `rounded-lg`, `rounded-md`, `rounded-sm` (s'il y en a)                                      | `rounded-none`                                                                                                      |

- [ ] **Step 3 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/tools/ToolsUi.tsx && git commit -m "feat: design system — ToolsUi migré vers accent primaire violet"
```

---

### Task 11 : Restyle `ToolCard.tsx`, `NotificationBell.tsx`, `CommandPalette.tsx`, composants membres

**Files:**

- Modify: `src/components/tools/ToolCard.tsx`
- Modify: `src/components/tools/PaladiumRateLimits.tsx`
- Modify: `src/components/NotificationBell.tsx`
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/components/Guard.tsx`
- Modify: `src/components/DonationsPanel.tsx`
- Modify: `src/components/members/MemberHeader.tsx`
- Modify: `src/components/members/MemberQuickActions.tsx`
- Modify: `src/components/LeaderboardChart.tsx`

**Interfaces:**

- Consumes: `--primary`, `--muted-foreground`, `--border`, `--secondary`
- Produces: tous les composants partagés sans pink ni blurple

- [ ] **Step 1 : Restyle `ToolCard.tsx`**

Dans `src/components/tools/ToolCard.tsx`, remplacer :

```tsx
const accentBorder = accent === "blurple" ? "border-[#5865F2]" : "border-pink-500";
const accentText = accent === "blurple" ? "text-[#5865F2]" : "text-pink-500";
```

Par :

```tsx
const accentBorder = "border-primary";
const accentText = "text-primary";
```

- [ ] **Step 2 : Restyle `PaladiumRateLimits.tsx`**

Dans `src/components/tools/PaladiumRateLimits.tsx` :

- `text-pink-500` → `text-primary` (ligne header et ligne usage low)
- Vérifier qu'il n'y a pas d'autres couleurs hardcodées.

- [ ] **Step 3 : Restyle `NotificationBell.tsx`**

Dans `src/components/NotificationBell.tsx` :

- `return "text-pink-500"` → `return "text-primary"`
- `return "text-[#5865F2]"` → `return "text-primary"`
- `hover:text-pink-500 hover:bg-zinc-900` → `hover:text-primary hover:bg-secondary`
- `bg-pink-500 text-[10px]... shadow-[0_0_8px_rgba(236,72,153,0.7)]` (badge compteur) → `bg-primary text-primary-foreground text-[10px]... shadow-[0_0_8px_rgba(139,92,246,0.7)]`
- `bg-pink-500 mt-1.5` (point non-lu) → `bg-primary mt-1.5`

- [ ] **Step 4 : Restyle `CommandPalette.tsx`**

Dans `src/components/CommandPalette.tsx` :

- `text-zinc-400 hover:text-pink-500 hover:bg-zinc-900` → `text-muted-foreground hover:text-primary hover:bg-secondary` (les deux occurrences)

- [ ] **Step 5 : Restyle `Guard.tsx`**

Dans `src/components/Guard.tsx` :

- `"text-pink-500 text-[10px]..."` → `"text-primary text-[10px]..."`

- [ ] **Step 6 : Restyle `DonationsPanel.tsx`**

Dans `src/components/DonationsPanel.tsx` :

- `text-pink-500` → `text-primary`

- [ ] **Step 7 : Restyle `MemberHeader.tsx`**

Dans `src/components/members/MemberHeader.tsx` :

- `"text-pink-500 mb-1"` → `"text-primary mb-1"`

- [ ] **Step 8 : Restyle `MemberQuickActions.tsx`**

Dans `src/components/members/MemberQuickActions.tsx` :

- `hover:text-pink-400 hover:border-pink-500/60` → `hover:text-primary hover:border-primary/60`
- `border-zinc-800 bg-zinc-950` → `border-border bg-background`

- [ ] **Step 9 : Restyle `LeaderboardChart.tsx`**

Dans `src/components/LeaderboardChart.tsx` :

- `"#ec4899"` (pink-500) → `"#8b5cf6"` (violet primary)

- [ ] **Step 10 : Typecheck + commit**

```bash
bun run typecheck && git add src/components/tools/ToolCard.tsx src/components/tools/PaladiumRateLimits.tsx src/components/NotificationBell.tsx src/components/CommandPalette.tsx src/components/Guard.tsx src/components/DonationsPanel.tsx src/components/members/MemberHeader.tsx src/components/members/MemberQuickActions.tsx src/components/LeaderboardChart.tsx && git commit -m "feat: design system — composants partagés migrés vers accent violet"
```

---

### Task 12 : Restyle pages publiques (index, login, candidature, legal)

**Files:**

- Modify: `src/routes/index.tsx`
- Modify: `src/routes/login.tsx`
- Modify: `src/routes/candidature.tsx`
- Modify: `src/routes/legal.tsx`

**Interfaces:**

- Consumes: `--background`, `--primary`, `--border`, `--foreground`
- Produces: pages publiques avec fond `#0d0a13`, accent violet, grille violette, coins droits

- [ ] **Step 1 : Remplacements dans toutes les pages publiques**

Pour chacun des 4 fichiers, effectuer ces remplacements (adapter selon ce qui est présent dans chaque fichier) :

| Avant                                               | Après                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `bg-[#0a0a0c]`                                      | `bg-background`                                                  |
| `radial-gradient(#5865F2 0.5px, transparent 0.5px)` | `radial-gradient(rgba(139,92,246,0.4) 0.5px, transparent 0.5px)` |
| `via-pink-500`                                      | `via-primary`                                                    |
| `via-[#5865F2]`                                     | `via-primary`                                                    |
| `text-pink-500`                                     | `text-primary`                                                   |
| `bg-pink-500`                                       | `bg-primary`                                                     |
| `bg-pink-500/30`                                    | `bg-primary/30`                                                  |
| `bg-pink-500/5`                                     | `bg-primary/5`                                                   |
| `border-pink-500`                                   | `border-primary`                                                 |
| `border-pink-500/40`                                | `border-primary/40`                                              |
| `border-pink-500/50`                                | `border-primary/50`                                              |
| `border-pink-500/60`                                | `border-primary/60`                                              |
| `hover:bg-pink-600`                                 | `hover:bg-primary/90`                                            |
| `bg-[#5865F2]`                                      | `bg-primary`                                                     |
| `hover:bg-[#4752c4]`                                | `hover:bg-primary/90`                                            |
| `bg-[#5865F2]/15`                                   | `bg-primary/15`                                                  |
| `border-[#5865F2]`                                  | `border-primary`                                                 |
| `border-[#5865F2]/30`                               | `border-primary/30`                                              |
| `border-[#5865F2]/60`                               | `border-primary/60`                                              |
| `text-[#5865F2]`                                    | `text-primary`                                                   |
| `text-[#a3aafb]`                                    | `text-primary`                                                   |
| `bg-zinc-900/90`                                    | `bg-card/90`                                                     |
| `border-zinc-800`                                   | `border-border`                                                  |
| `border-l-2 border-pink-500/50`                     | `border-l-[3px] border-primary/50`                               |
| `from-pink-500 to-[#5865F2]`                        | `from-primary to-primary/60`                                     |
| `rounded-sm`                                        | `rounded-none`                                                   |
| `rounded-lg`                                        | `rounded-none`                                                   |
| `rounded-md`                                        | `rounded-none`                                                   |
| `shadow-2xl shadow-pink-500/10`                     | `shadow-[8px_8px_0px_#000000]`                                   |
| `shadow-lg shadow-pink-500/20`                      | `shadow-[4px_4px_0px_#000000]`                                   |
| `w-1 h-1 bg-pink-500 animate-pulse`                 | `w-1 h-1 bg-primary motion-safe:animate-pulse`                   |

Pour `legal.tsx` la ligne avec `from-pink-500 to-[#5865F2] bg-clip-text text-transparent` → `from-primary to-primary/60 bg-clip-text text-transparent`.

- [ ] **Step 2 : Typecheck + commit**

```bash
bun run typecheck && git add src/routes/index.tsx src/routes/login.tsx src/routes/candidature.tsx src/routes/legal.tsx && git commit -m "feat: design system — pages publiques migrées vers palette violette"
```

---

### Task 13 : Scan résiduel + authenticated routes one-off

**Files:**

- Modify: diverses routes `src/routes/_authenticated/*.tsx` (ciblées par grep)

**Interfaces:**

- Consumes: rien de nouveau
- Produces: zéro occurrence résiduelle de `pink-500` ou `#5865F2` dans tout le codebase

- [ ] **Step 1 : Grep résiduel**

```bash
grep -rn "pink-500\|#5865F2\|#ec4899" src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

- [ ] **Step 2 : Pour chaque occurrence trouvée**

Appliquer les mêmes remplacements que Task 12 (tableau de correspondances). Fichiers typiques attendus : `shop.tsx`, et quelques routes avec des MonoLabels ou textes accentués.

- [ ] **Step 3 : Restyle status badges dans `me.tsx`**

Dans `src/routes/_authenticated/me.tsx`, le `STATUS_META` utilise `bg-emerald-500`, `bg-amber-500`, `bg-sky-500`. La spec demande "états: nuances de violet/gris". Remplacer :

```tsx
const STATUS_META: Record<string, { label: string; dot: string }> = {
  active: { label: "Actif", dot: "bg-primary" },
  trial: { label: "Période d'essai", dot: "bg-primary/60" },
  away: { label: "En pause", dot: "bg-muted-foreground" },
  former: { label: "Ancien", dot: "bg-muted-foreground/50" },
  left: { label: "Parti", dot: "bg-muted-foreground/30" },
  visitor: { label: "Visiteur", dot: "bg-muted-foreground/30" },
};
```

- [ ] **Step 5 : Grep résiduel `bg-zinc-9`, `bg-zinc-8`, `border-zinc-8` dans les routes**

```bash
grep -rn "bg-zinc-9\|bg-zinc-8\|border-zinc-8\|border-zinc-7\|bg-\[#0a0a0c\]" src/routes/ --include="*.tsx"
```

Remplacer les occurrences trouvées :

- `bg-zinc-900*` → `bg-card` ou `bg-secondary` selon le contexte
- `bg-zinc-800` → `bg-secondary`
- `border-zinc-800*` → `border-border`
- `bg-[#0a0a0c]` → `bg-background`

- [ ] **Step 6 : Typecheck + commit**

```bash
bun run typecheck && git add -p && git commit -m "feat: design system — nettoyage résiduel pink/zinc/blurple hardcodés"
```

---

### Task 14 : Typecheck final + vérification build

**Files:**

- Aucun fichier modifié dans cette tâche

- [ ] **Step 1 : Typecheck complet**

```bash
bun run typecheck
```

Expected: `Found 0 errors.`

- [ ] **Step 2 : Build de vérification**

```bash
bun run build:ci
```

Expected: build réussi sans erreurs.

- [ ] **Step 3 : Démarrer le dev server pour vérification visuelle**

```bash
bun run dev
```

Vérifier manuellement dans le navigateur :

- `/login` : fond violet, bouton Discord violet plein avec ombre dure
- Layout authentifié : sidebar violette, header sans ThemeToggle
- `/me` : carré pulsant violet dans le bandeau joueurs, Cards avec coin équerre violet
- Progress bar : rayures violettes style XP
- Inputs : bordure 3px, fond sombre
- Tabs : underline violet sur l'onglet actif
- Dialogs : ombre dure 8px

- [ ] **Step 4 : Commit final si des corrections mineures ont été apportées**

```bash
git add -p && git commit -m "fix: design system — corrections visuelles post-review"
```
