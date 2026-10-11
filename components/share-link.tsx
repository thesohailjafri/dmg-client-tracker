"use client";

import { CheckIcon, CopyIcon, ExternalLinkIcon, LinkIcon } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { sharePath } from "@/lib/graphs";
import { cn } from "@/lib/utils";

// The client's read-only graphs link: make it, copy it, replace it or turn it off.
export function ShareLink({
  clientId,
  name,
  token: initial,
}: {
  clientId: string;
  // the business name, which the link carries so it can be recognised
  name: string;
  token: string;
}) {
  const [token, setToken] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // which change is waiting for a second click
  const [confirming, setConfirming] = useState<"reset" | "off" | null>(null);
  const [error, setError] = useState("");

  async function change(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/share`, { method });
      const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not change the link.");
      setToken(body.token ?? "");
      setConfirming(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not change the link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${sharePath(name, token)}`);
    } catch {
      setError("Could not copy the link.");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => change("POST")}>
            <LinkIcon />
            Create client link
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Link copied" : "Copy client link"}
        </Button>
        <a
          href={sharePath(name, token)}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <ExternalLinkIcon />
          Open client view
        </a>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming("reset")}>
          Reset link
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming("off")}>
          Turn off
        </Button>
      </div>
      {confirming && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
          <span>
            {confirming === "reset"
              ? "The link the client has now will stop working, and a new one is made."
              : "The link the client has now will stop working."}
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => change(confirming === "reset" ? "POST" : "DELETE")}
          >
            {confirming === "reset" ? "Reset link" : "Turn off"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(null)}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
