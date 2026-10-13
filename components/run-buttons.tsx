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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SCHEDULES, type Schedule } from "@/lib/schemas";

// Pick which report to build (weekly or monthly window), then:
// "Run" builds it without emailing anyone, "Run & send" also emails the client.
export function RunButtons({
  clientId,
  clientName,
  schedules,
  blocked = "",
}: {
  clientId: string;
  clientName: string;
  schedules: Schedule[];
  // Why no report can be run for this client, shown under the disabled buttons. "" = it can.
  blocked?: string;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<Schedule>(schedules[0] ?? "weekly");
  const [pending, setPending] = useState<"run" | "send" | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function run(sendEmail: boolean) {
    setPending(sendEmail ? "send" : "run");
    setError("");
    try {
      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, period, sendEmail }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(body.error ?? `Run failed (${res.status})`);
    } catch {
      setError("Network error");
    }
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <NativeSelect
          size="sm"
          aria-label={`Report period for ${clientName}`}
          value={period}
          disabled={pending !== null || blocked !== ""}
          onChange={(event) => setPeriod(event.target.value as Schedule)}
        >
          {SCHEDULES.map((schedule) => (
            <NativeSelectOption key={schedule} value={schedule}>
              {schedule}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button variant="outline" size="sm" disabled={pending !== null || blocked !== ""} onClick={() => run(false)}>
          {pending === "run" ? "Running…" : "Run"}
        </Button>
        <Button size="sm" disabled={pending !== null || blocked !== ""} onClick={() => setConfirming(true)}>
          {pending === "send" ? "Sending…" : "Run & send"}
        </Button>
      </div>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send the {period} report?</AlertDialogTitle>
            <AlertDialogDescription>
              This builds the report and emails it to {clientName} now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                run(true);
              }}
            >
              Run &amp; send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {blocked && <p className="max-w-64 text-right text-xs whitespace-normal text-muted-foreground">{blocked}</p>}
      {error && (
        <p role="alert" className="max-w-64 text-right text-xs whitespace-normal text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
