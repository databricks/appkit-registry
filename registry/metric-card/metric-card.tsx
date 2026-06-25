import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from "@databricks/appkit-ui/react";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface MetricCardProps {
  /** Metric label, e.g. "Monthly active users". */
  title: string;
  /** Pre-formatted metric value. */
  value: string | number;
  /** Optional supporting text shown next to the delta. */
  description?: string;
  /** Percent change vs. the previous period. Positive = up, negative = down. */
  delta?: number;
  /**
   * When true, a downward delta is styled as positive. Use for metrics where
   * lower is better (cost, latency, error rate).
   */
  invertDelta?: boolean;
  /** Optional icon rendered in the card header. */
  icon?: ReactNode;
  className?: string;
}

/**
 * A compact KPI card built on AppKit UI primitives. Renders a value with an
 * optional period-over-period delta badge that colors itself by direction.
 */
export function MetricCard({
  title,
  value,
  description,
  delta,
  invertDelta = false,
  icon,
  className,
}: MetricCardProps) {
  const direction =
    delta === undefined || delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const isPositive =
    direction === "flat" ? null : invertDelta ? direction === "down" : direction === "up";
  const DeltaIcon =
    direction === "up" ? ArrowUpIcon : direction === "down" ? ArrowDownIcon : MinusIcon;

  return (
    <Card className={cn("gap-2", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {(delta !== undefined || description) && (
          <div className="flex items-center gap-2">
            {delta !== undefined ? (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1",
                  isPositive === true && "border-emerald-200 text-emerald-600",
                  isPositive === false && "border-red-200 text-red-600",
                )}
              >
                <DeltaIcon className="size-3" />
                {Math.abs(delta)}%
              </Badge>
            ) : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
