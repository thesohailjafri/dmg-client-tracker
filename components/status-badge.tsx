import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "ok" | "failed" | null }) {
  if (!status) return <Badge variant="outline">Never run</Badge>;
  return status === "ok" ? (
    <Badge variant="secondary">OK</Badge>
  ) : (
    <Badge variant="destructive">Failed</Badge>
  );
}
