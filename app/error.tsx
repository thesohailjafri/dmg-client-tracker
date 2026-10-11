"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-xl font-semibold">Something failed</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "Check the server logs and your environment variables."}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
