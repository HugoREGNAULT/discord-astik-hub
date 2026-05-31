import { lazy, Suspense, type ComponentProps } from "react";

const LeaderboardChart = lazy(() =>
  import("./LeaderboardChart").then((m) => ({ default: m.LeaderboardChart })),
);

export function LazyLeaderboardChart(
  props: ComponentProps<typeof LeaderboardChart>,
) {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-md bg-muted" />}
    >
      <LeaderboardChart {...props} />
    </Suspense>
  );
}
