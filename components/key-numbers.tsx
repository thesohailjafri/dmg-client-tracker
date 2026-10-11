import type { KeyNumber } from "@/lib/format";

// A row of headline figures: label, value, and the change beside it.
export function KeyNumbers({ numbers }: { numbers: KeyNumber[] }) {
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {numbers.map((number) => (
        <div key={number.label}>
          <dt className="text-xs text-muted-foreground">{number.label}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {number.value}
            {number.change && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">{number.change}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
