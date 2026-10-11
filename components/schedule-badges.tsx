import { Badge } from "@/components/ui/badge";
import type { Schedule } from "@/lib/schemas";

export function ScheduleBadges({ schedules, active }: { schedules: Schedule[]; active: boolean }) {
  if (!active) return <Badge variant="outline">paused</Badge>;
  if (schedules.length === 0) return <Badge variant="outline">manual only</Badge>;
  return (
    <div className="flex flex-wrap gap-1">
      {schedules.map((schedule) => (
        <Badge key={schedule} variant="outline">
          {schedule}
        </Badge>
      ))}
    </div>
  );
}
