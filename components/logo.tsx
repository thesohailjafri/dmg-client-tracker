import { cn } from "@/lib/utils";

/* Product mark. Same paths as public/logo.svg; the tile follows --primary. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <rect width="64" height="64" rx="15" className="fill-primary" />
      <g
        className="stroke-primary-foreground"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 43 25 31l8 8 17-17" />
        <path d="M39.5 22H50v10.5" />
        <path d="M14 22l6-6" />
        <path d="M41 51l6-6" />
      </g>
    </svg>
  );
}
