"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "", label: "Overview" },
  { path: "/report", label: "Report" },
  { path: "/analytics", label: "Analytics" },
  { path: "/google-profile", label: "Google profile" },
  { path: "/edit", label: "Edit" },
];

// The sections of a client page. Each is its own URL, so a tab can be linked to.
export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Client sections" className="mt-6 flex gap-1 border-b">
      {TABS.map((tab) => {
        const href = `/clients/${clientId}${tab.path}`;
        const current = pathname === href;
        return (
          <Link
            key={tab.path}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground max-sm:px-2",
              current && "border-primary text-primary hover:text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
