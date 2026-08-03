# Metric Card

A compact KPI card built on AppKit UI `Card` + `Badge`. Shows a value with an optional
period-over-period delta badge that colors itself by direction.

## Install

```bash
npx shadcn@latest add @databricks-appkit/metric-card
# or, with the AppKit CLI
appkit add metric-card
```

## Usage

```tsx
import { MetricCard } from "@/components/appkit/metric-card";
import { Users } from "lucide-react";

<MetricCard
  title="Monthly active users"
  value="12,480"
  delta={8.2}
  description="vs. last month"
  icon={<Users className="size-4" />}
/>;

// Lower-is-better metric: a downward delta renders as positive.
<MetricCard title="P95 latency" value="142ms" delta={-5.1} invertDelta />;
```

## Props

| Prop          | Type                  | Description                                                        |
| ------------- | --------------------- | ------------------------------------------------------------------ |
| `title`       | `string`              | Metric label.                                                      |
| `value`       | `string \| number`    | Pre-formatted metric value.                                        |
| `delta`       | `number?`             | Percent change vs. previous period.                                |
| `invertDelta` | `boolean?`            | Treat a downward delta as positive (cost, latency, error rate).    |
| `description` | `string?`             | Supporting text next to the delta.                                 |
| `icon`        | `ReactNode?`          | Icon rendered in the header.                                       |
| `className`   | `string?`             | Extra classes for the root card.                                   |

## Requires

- `@databricks/appkit-ui` (>= 0.41.0) — provides `Card`, `Badge`, `cn`.
- Consumer must import `@databricks/appkit-ui/styles.css` once at app root for theming.
