"use client";

import Link, { useLinkStatus } from "next/link";
import { RANGES, type RangeKey } from "@/lib/graphs";
import { cn } from "@/lib/utils";

// Dims the range that was just picked until its graphs arrive, which can take a few seconds.
function Label({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={cn(pending && "opacity-50")}>{children}</span>;
}

// How far back the graphs go. Each range is its own URL (?range=), so a view can be linked to.
export function RangePicker({ basePath, current }: { basePath: string; current: RangeKey }) {
  return (
    <nav aria-label="Time range" className="flex flex-wrap gap-1">
      {RANGES.map((range) => (
        <Link
          key={range.key}
          href={`${basePath}?range=${range.key}`}
          scroll={false}
          aria-current={range.key === current ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
            range.key === current && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
          )}
        >
          <Label>{range.label}</Label>
        </Link>
      ))}
    </nav>
  );
}
