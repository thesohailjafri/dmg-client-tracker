import { Suspense } from "react";
import { ClientManager } from "@/components/client-manager";
import { Loader } from "@/components/loader";
import { Shell } from "@/components/shell";
import { listClients, requireSession } from "@/lib/data";

export default function SettingsPage() {
  return (
    <Shell
      title="Settings"
      description="Clients, the URL each report captures, and how often it goes out."
    >
      <Suspense fallback={<Loader />}>
        <SettingsData />
      </Suspense>
    </Shell>
  );
}

async function SettingsData() {
  await requireSession();
  return <ClientManager clients={await listClients()} />;
}
