"use client";

import { LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/review-kit", label: "Review kit" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/login", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <div className="sticky top-0 z-30 border-b bg-card">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1 px-6 text-sm max-sm:px-4">
        <Link href="/dashboard" className="mr-5 flex items-center gap-2.5 font-semibold tracking-tight max-sm:mr-2">
          <Logo className="size-7" />
          <span className="max-sm:sr-only">DMG Client Tracker</span>
        </Link>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground max-sm:px-2",
              pathname === link.href && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            {link.label}
          </Link>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={signOut}>
          <LogOutIcon />
          <span className="max-sm:sr-only">Sign out</span>
        </Button>
      </nav>
    </div>
  );
}
