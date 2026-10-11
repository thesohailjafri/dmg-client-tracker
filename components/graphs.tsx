import { RangePicker } from "@/components/range-picker";
import { TrendChart } from "@/components/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatValue, type GraphBucket, type GraphSection, type GraphsData } from "@/lib/graphs";

// The graphs for one client and one range: the range picker, then a card per kind of figure.
// Shown on the team's Graphs tab and, with `audience="client"`, on the client's read-only link,
// where a section with nothing to draw is left out instead of explaining how to set it up.
export function Graphs({
  data,
  basePath,
  audience,
}: {
  data: GraphsData;
  // the page these graphs are on: the range picker links back to it
  basePath: string;
  audience: "team" | "client";
}) {
  const sections =
    audience === "client" ? data.sections.filter((section) => section.series.length > 0) : data.sections;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <RangePicker basePath={basePath} current={data.range} />
        <p className="text-xs text-muted-foreground">
          One point per {data.unit}. The headline number is the last full {data.unit}; the paler bar is
          this {data.unit} so far.
        </p>
      </div>

      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground">There is nothing to show for this range yet.</p>
      )}

      {sections.map((section) => (
        <Card key={section.key}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.note && <CardDescription>{section.note}</CardDescription>}
          </CardHeader>
          <CardContent>
            {section.series.length === 0 ? (
              <p className="text-sm text-muted-foreground">{section.empty}</p>
            ) : (
              <>
                <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {section.series.map((series) => (
                    <TrendChart key={series.key} series={series} buckets={data.buckets} unit={data.unit} />
                  ))}
                </div>
                <details className="mt-6">
                  <summary className="cursor-pointer text-xs text-primary">Show as a table</summary>
                  <Figures section={section} buckets={data.buckets} unit={data.unit} />
                </details>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// The same numbers as the charts above it, newest first.
function Figures({ section, buckets, unit }: { section: GraphSection; buckets: GraphBucket[]; unit: string }) {
  return (
    <Table className="mt-3">
      <TableHeader>
        <TableRow>
          <TableHead className="capitalize">{unit}</TableHead>
          {section.series.map((series) => (
            <TableHead key={series.key} className="text-right">
              {series.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {buckets
          .map((bucket, index) => ({ bucket, index }))
          .reverse()
          .map(({ bucket, index }) => (
            <TableRow key={index}>
              <TableCell>
                {bucket.long}
                {bucket.partial && <span className="text-muted-foreground"> (so far)</span>}
              </TableCell>
              {section.series.map((series) => {
                const value = series.values[index];
                return (
                  <TableCell key={series.key} className="text-right tabular-nums">
                    {value === null ? <span className="text-muted-foreground">–</span> : formatValue(value, series.digits)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
