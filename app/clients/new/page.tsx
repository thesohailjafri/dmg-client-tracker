import { Suspense } from "react";
import { NewClient } from "@/components/client-form";
import { Shell } from "@/components/shell";
import { requireSession } from "@/lib/data";

export default function NewClientPage() {
  return (
    <Shell title="New client" description="The business, who gets its reports, and how often they go out.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewClientData />
      </Suspense>
    </Shell>
  );
}

async function NewClientData() {
  await requireSession();
  return <NewClient />;
}
