"use client";

import { useState } from "react";
import {
  changeAt,
  formatValue,
  headlineIndex,
  scaleFor,
  type GraphBucket,
  type GraphSeries,
  type GraphUnit,
} from "@/lib/graphs";
import { cn } from "@/lib/utils";

// How many axis labels fit under a chart at its narrowest.
const MAX_LABELS = 5;

// One figure over time: the headline number, then a bar per week or month (or a line, for a
// reading such as a review count). Hover, tap or the arrow keys read out a single period; every
// value is also in the table under the section, so nothing depends on the pointer.
export function TrendChart({
  series,
  buckets,
  unit,
}: {
  series: GraphSeries;
  buckets: GraphBucket[];
  unit: GraphUnit;
}) {
  const [active, setActive] = useState<number | null>(null);
  const count = buckets.length;
  const scale = scaleFor(series);
  const height = (value: number) => ((value - scale.low) / (scale.high - scale.low)) * 100;
  const centre = (index: number) => ((index + 0.5) / count) * 100;

  const lead = headlineIndex(series, buckets);
  const leadValue = lead >= 0 ? series.values[lead] : null;
  const leadChange = lead >= 0 ? changeAt(series, lead) : null;

  // Labels are counted back from the newest period, so that one is always named.
  const every = Math.ceil(count / MAX_LABELS);
  const labelled = (index: number) => (count - 1 - index) % every === 0;

  const points = series.values.flatMap((value, index) =>
    value === null ? [] : [{ index, x: centre(index), y: height(value) }],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (event.key === "Escape") setActive(null);
    if (!step) return;
    event.preventDefault();
    setActive((current) => Math.min(count - 1, Math.max(0, (current ?? count - 1) + step)));
  }

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption>
        <div className="text-xs text-muted-foreground">{series.label}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-xl font-semibold">
            {leadValue === null ? "–" : formatValue(leadValue, series.digits)}
          </span>
          <span className="text-xs text-muted-foreground">
            {leadChange ? `${leadChange.text} ${comparedWith(series, buckets, leadChange.from, unit)}` : leadNote(series, unit)}
          </span>
        </div>
      </figcaption>

      <div className="flex">
        <div aria-hidden="true" className="relative h-36 w-9 shrink-0">
          {scale.ticks.map((tick) => (
            <span
              key={tick}
              style={{ bottom: `${height(tick)}%` }}
              className="absolute right-2 translate-y-1/2 text-[11px] leading-none text-muted-foreground tabular-nums"
            >
              {formatValue(tick, series.digits)}
            </span>
          ))}
        </div>

        <div
          role="group"
          tabIndex={0}
          aria-label={`${series.label} by ${unit}. Use the left and right arrow keys to read each ${unit}.`}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? count - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="relative h-36 min-w-0 flex-1 rounded-sm outline-offset-4 focus-visible:outline-2"
        >
          {scale.ticks.map((tick, index) => (
            <div
              key={tick}
              style={{ bottom: `${height(tick)}%` }}
              className={cn("absolute inset-x-0 border-t", index === 0 ? "border-input" : "border-border")}
            />
          ))}

          {/* One full-height column per period: the hover target, far bigger than the mark in it. */}
          <div className="absolute inset-0 flex">
            {series.values.map((value, index) => (
              <div
                key={index}
                onPointerEnter={() => setActive(index)}
                onPointerDown={() => setActive(index)}
                className={cn(
                  "relative flex h-full flex-1 items-end justify-center",
                  active === index && "bg-foreground/5",
                )}
              >
                {series.kind === "total" && value !== null && value > 0 && (
                  <div
                    style={{ height: `${height(value)}%` }}
                    className={cn(
                      "min-h-0.5 w-[72%] max-w-6 rounded-t-[4px] bg-primary",
                      buckets[index].partial && "opacity-40",
                    )}
                  />
                )}
                {series.kind === "level" && active === index && (
                  <div className="absolute inset-y-0 left-1/2 w-px bg-input" />
                )}
              </div>
            ))}
          </div>

          {series.kind === "level" && (
            <>
              <svg
                aria-hidden="true"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
              >
                <polyline
                  points={points.map((point) => `${point.x},${100 - point.y}`).join(" ")}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {points.map((point) => (
                <span
                  key={point.index}
                  style={{ left: `${point.x}%`, bottom: `${point.y}%` }}
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary ring-2 ring-card"
                />
              ))}
            </>
          )}

          {active !== null && (
            <Readout series={series} buckets={buckets} unit={unit} index={active} x={centre(active)} y={height(series.values[active] ?? scale.low)} />
          )}
        </div>
      </div>

      <div aria-hidden="true" className="relative ml-9 h-4">
        {buckets.map(
          (bucket, index) =>
            labelled(index) && (
              <span
                key={index}
                style={{ left: `${centre(index)}%` }}
                className="absolute -translate-x-1/2 text-[11px] leading-none whitespace-nowrap text-muted-foreground"
              >
                {bucket.label}
              </span>
            ),
        )}
      </div>
    </figure>
  );
}

const before = (unit: GraphUnit) => `vs ${unit} before`;

// What a change is measured against, in words.
function comparedWith(series: GraphSeries, buckets: GraphBucket[], from: number, unit: GraphUnit): string {
  return series.kind === "total" ? before(unit) : `since ${buckets[from].label}`;
}

// Beside the headline number when there is no change to show.
function leadNote(series: GraphSeries, unit: GraphUnit): string {
  return series.kind === "total" ? `last full ${unit}` : "latest reading";
}

// The tooltip for one period: the value leads, the wording follows.
function Readout({
  series,
  buckets,
  unit,
  index,
  x,
  y,
}: {
  series: GraphSeries;
  buckets: GraphBucket[];
  unit: GraphUnit;
  index: number;
  x: number;
  y: number;
}) {
  const value = series.values[index];
  const bucket = buckets[index];
  // The period in progress is not compared: a part of a week against a whole one reads as a drop.
  const change = series.kind === "total" && bucket.partial ? null : changeAt(series, index);
  // Near either edge the box hangs inward so it stays inside the chart.
  const side = x < 30 ? { left: 0 } : x > 70 ? { right: 0 } : { left: `${x}%`, transform: "translateX(-50%)" };

  return (
    <div
      role="status"
      style={{ bottom: `calc(${y}% + 12px)`, ...side }}
      className="pointer-events-none absolute z-10 w-max max-w-52 rounded-lg bg-popover px-2.5 py-2 text-xs leading-snug text-popover-foreground shadow-md ring-1 ring-foreground/10"
    >
      <div className="text-muted-foreground">
        {bucket.long}
        {bucket.partial && ", so far"}
      </div>
      {value === null ? (
        <div className="mt-0.5 text-muted-foreground">No reading</div>
      ) : (
        <div className="mt-0.5">
          <span className="font-semibold">{formatValue(value, series.digits)}</span>{" "}
          <span className="text-muted-foreground">{series.label.toLowerCase()}</span>
        </div>
      )}
      {change && (
        <div className="text-muted-foreground">
          {change.text} {comparedWith(series, buckets, change.from, unit)}
        </div>
      )}
    </div>
  );
}
