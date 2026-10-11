import { cn } from "@/lib/utils";

// Shown while a page's data arrives: the logo's trend line draws itself, the arrowhead and sparks
// land, a ring goes out, and it starts over. The motion is in globals.css under [data-loader], the
// one place the app allows any. Waits a moment before appearing so a fast load shows nothing.
export function Loader({ className }: { className?: string }) {
  return (
    <div role="status" data-loader className={cn("flex justify-center py-16", className)}>
      <span className="relative block size-12">
        <span className="loader-ring absolute inset-0 rounded-[23.4%] bg-primary" />
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="relative size-12">
          <rect width="64" height="64" rx="15" className="fill-primary" />
          <g
            className="stroke-primary-foreground"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* same paths as components/logo.tsx; pathLength makes each one 1 long for the dashes */}
            <path className="loader-line" pathLength={1} d="M13 43 25 31l8 8 17-17" />
            <path className="loader-head" pathLength={1} d="M39.5 22H50v10.5" />
            <path className="loader-spark" d="M14 22l6-6" />
            <path className="loader-spark loader-spark-late" d="M41 51l6-6" />
          </g>
        </svg>
      </span>
      <span className="sr-only">Loading</span>
    </div>
  );
}

// The same wait for a page header: bars where the title, the line under it and the tabs will be,
// so the page does not jump when they arrive.
export function HeaderLoader({ tabs = false }: { tabs?: boolean }) {
  return (
    <header role="status" data-loader className="pt-10 pb-8">
      <div className="loader-bar h-8 w-56 max-w-full rounded-md bg-border" />
      <div className="loader-bar mt-2 h-4 w-80 max-w-full rounded bg-border" />
      {tabs && <div className="mt-6 h-9 border-b" />}
      <span className="sr-only">Loading</span>
    </header>
  );
}
