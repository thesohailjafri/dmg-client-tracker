"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// Sends the client's welcome email, after asking: it goes to the client straight away.
// `again` when one has already gone out. `blocked` is why it cannot be sent yet, "" when it can.
export function SendWelcome({
  clientId,
  clientName,
  again,
  blocked = "",
}: {
  clientId: string;
  clientName: string;
  again: boolean;
  blocked?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = again ? "Send again" : "Send welcome email";

  async function send() {
    setPending(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${clientId}/welcome`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(body.error ?? `Could not send (${res.status})`);
    } catch {
      setError("Network error");
    }
    setPending(false);
    // how it went is kept on the client, so the line above this button says it
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        disabled={pending || blocked !== ""}
        title={blocked || undefined}
        onClick={() => setConfirming(true)}
      >
        {pending ? "Sending…" : label}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send the welcome email?</AlertDialogTitle>
            <AlertDialogDescription>
              This emails {clientName}&apos;s report recipients their report link now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                send();
              }}
            >
              {label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
