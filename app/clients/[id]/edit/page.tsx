import { Suspense } from "react";
import { EditClient } from "@/components/client-form";
import { Loader } from "@/components/loader";
import { getClient, requireSession } from "@/lib/data";

export default function ClientEditPage({ params }: PageProps<"/clients/[id]/edit">) {
  return (
    <Suspense fallback={<Loader />}>
      {params.then(({ id }) => (
        <Edit id={id} />
      ))}
    </Suspense>
  );
}

async function Edit({ id }: { id: string }) {
  await requireSession();
  const client = await getClient(id);
  // the layout above already says the client was not found
  if (!client) return null;
  return <EditClient client={client} />;
}
