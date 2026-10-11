import { ObjectId } from "mongodb";
import { sendEmail } from "./email";
import { collections } from "./mongodb";
import { generateInsights, OPENAI_MODEL } from "./openai";
import { fetchPlace, findPlaceId, placesEnabled } from "./places";
import { captureScreenshot } from "./playwright";
import { getObject } from "./r2";
import { reportEmail, runFigures } from "./report-email";
import { PERIOD_DAYS, type AiLogDoc, type PlaceFacts, type Schedule } from "./schemas";
import { fetchUmamiMetrics } from "./umami";

// The Places API is an extra: when it fails the report still goes out, and the snapshot records why.
async function googleFigures(
  find: () => Promise<PlaceFacts | null>,
): Promise<{ place: PlaceFacts } | { placeError: string }> {
  try {
    const place = await find();
    return place ? { place } : { placeError: "No business on Google matched this client's name and address." };
  } catch (error) {
    return { placeError: error instanceof Error ? error.message : String(error) };
  }
}

// One report for one client: screenshot -> Umami -> OpenAI -> log -> email (lib/report-email.ts).
// Every run writes exactly one ai_logs doc, whether it succeeds or fails.
export async function runReport(
  clientId: string,
  options: { trigger: "manual" | "cron"; period: Schedule; sendEmail: boolean },
): Promise<AiLogDoc> {
  const { clients, screenshots, metrics, aiLogs } = await collections();
  const client = await clients.findOne({ _id: new ObjectId(clientId) });
  if (!client) throw new Error("Client not found");

  const log: AiLogDoc = {
    _id: new ObjectId(),
    clientId: client._id,
    clientName: client.name,
    trigger: options.trigger,
    period: options.period,
    status: "ok",
    email: { status: "skipped" },
    createdAt: new Date(),
  };

  try {
    const periodDays = PERIOD_DAYS[options.period];

    const placeId = placesEnabled() ? client.googlePlaceId : "";
    const [capture, umami, known] = await Promise.all([
      captureScreenshot({ url: client.url, clientId, clientName: client.name }),
      client.umamiWebsiteId ? fetchUmamiMetrics(client.umamiWebsiteId, periodDays) : null,
      placeId ? googleFigures(() => fetchPlace(placeId)) : null,
    ]);

    log.screenshotId = new ObjectId();
    await screenshots.insertOne({
      _id: log.screenshotId,
      clientId: client._id,
      url: client.url,
      r2Key: capture.key,
      bytes: capture.bytes,
      capturedAt: new Date(capture.capturedAt),
      ...known,
    });

    if (umami) {
      log.metricsId = new ObjectId();
      await metrics.insertOne({
        _id: log.metricsId,
        clientId: client._id,
        ...umami,
        fetchedAt: new Date(),
      });
    }

    // The AI is told the same figures the email will show, worked out from what was just saved.
    // Only the leads ticked for this client are among them: the raw events stay out.
    const { figures } = await runFigures(client, log);

    const image = await getObject(capture.key);
    const ai = await generateInsights({
      facts: figures.facts,
      image: { base64: image.body.toString("base64"), contentType: image.contentType },
    });
    log.model = OPENAI_MODEL;
    log.output = ai.output;
    log.usage = ai.usage;

    // First run with the Places API: find the business by its name plus the address the AI just read
    // off the screenshot, and remember it on the client. Later runs skip the search.
    const found =
      placesEnabled() && !client.googlePlaceId
        ? await googleFigures(async () => {
            const id = await findPlaceId([client.name, ai.note.address].filter(Boolean).join(", "));
            if (!id) return null;
            await clients.updateOne({ _id: client._id }, { $set: { googlePlaceId: id } });
            return fetchPlace(id);
          })
        : null;
    await screenshots.updateOne({ _id: log.screenshotId }, { $set: { note: ai.note, ...found } });

    if (options.sendEmail) {
      log.email = await sendEmail({
        to: client.emails,
        email: await reportEmail(client, log),
        copyTeam: client.copyTeam,
        // A scheduled report goes out once a day at most, however often its cron tick is retried.
        // A manual "Run & send" is someone asking for it again, so it is never held back.
        idempotencyKey:
          options.trigger === "cron"
            ? `report-${clientId}-${options.period}-${log.createdAt.toISOString().slice(0, 10)}`
            : undefined,
      });
      if (log.email.status === "failed") {
        log.status = "failed";
        log.error = `Email: ${log.email.error}`;
      }
    }
  } catch (error) {
    log.status = "failed";
    log.error = error instanceof Error ? error.message : String(error);
  }

  await aiLogs.insertOne(log);
  await clients.updateOne(
    { _id: client._id },
    {
      $set: {
        lastRunAt: log.createdAt,
        lastStatus: log.status,
        lastError: log.error ?? "",
        updatedAt: new Date(),
      },
    },
  );
  return log;
}
