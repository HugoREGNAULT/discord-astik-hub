import { lazy, Suspense, type ComponentProps } from "react";

const ApplicationsChart = lazy(() =>
  import("./ApplicationsChart").then((m) => ({ default: m.ApplicationsChart })),
);

export function LazyApplicationsChart(
  props: ComponentProps<typeof ApplicationsChart>,
) {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-md bg-muted" />}
    >
      <ApplicationsChart {...props} />
    </Suspense>
  );
}
