import Link from "next/link";
import { Suspense } from "react";
import { KeyNumbers } from "@/components/key-numbers";
import { RunButtons } from "@/components/run-buttons";
import { ScheduleBadges } from "@/components/schedule-badges";
import { Shell } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listClients, listReports, requireSession, type ClientView, type ReportView } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Shell title="Dashboard" description="Clients, manual runs and the latest reports.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <DashboardData />
      </Suspense>
    </Shell>
  );
}

async function DashboardData() {
  await requireSession();
  const [clients, reports] = await Promise.all([listClients(), listReports()]);
  return (
    <>
      <Clients clients={clients} />
      <Reports reports={reports} />
    </>
  );
}

function Clients({ clients }: { clients: ClientView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clients</CardTitle>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No clients yet.{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Add one in Settings
            </Link>
            .
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Last run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="font-medium hover:text-primary hover:underline">
                      {client.name}
                    </Link>
                    <a
                      href={client.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block max-w-72 truncate text-xs text-muted-foreground hover:text-primary"
                    >
                      {client.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    <ScheduleBadges schedules={client.schedules} active={client.active} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={client.lastStatus} />
                      {client.lastRunAt && (
                        <span className="text-xs text-muted-foreground">{formatDate(client.lastRunAt)} UTC</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RunButtons
                      clientId={client.id}
                      clientName={client.name}
                      schedules={client.schedules}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Reports({ reports }: { reports: ReportView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent reports</CardTitle>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has run yet.</p>
        ) : (
          <ul className="divide-y">
            {reports.map((report) => (
              <li key={report.id} className="py-4 first:pt-0 last:pb-0">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-medium">{report.clientName}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(report.createdAt)} UTC</span>
                    <StatusBadge status={report.status} />
                    <Badge variant="outline">{report.period}</Badge>
                    <Badge variant="outline">{report.trigger}</Badge>
                    <Badge variant="outline">email {report.email.status}</Badge>
                  </summary>

                  <div className="mt-4 flex flex-col gap-6">
                    {report.error && (
                      <p role="alert" className="text-destructive">
                        {report.error}
                      </p>
                    )}

                    {report.numbers.length > 0 && <KeyNumbers numbers={report.numbers} />}

                    {report.output && (
                      <>
                        <p>{report.output.summary}</p>
                        <div className="grid gap-6 sm:grid-cols-2">
                          <BulletList title="Insights" items={report.output.insights} />
                          <BulletList title="Recommendations" items={report.output.recommendations} />
                        </div>
                        <div>
                          <h3 className="text-xs font-medium text-muted-foreground">Screenshot findings</h3>
                          <p className="mt-2">{report.output.screenshotFindings}</p>
                        </div>
                      </>
                    )}

                    {report.screenshotId && (
                      <a
                        href={`/api/screenshots/${report.screenshotId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-fit text-primary hover:underline"
                      >
                        Open screenshot
                      </a>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
