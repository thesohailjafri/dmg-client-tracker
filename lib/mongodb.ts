import dns from "node:dns";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env";
import { claimReviewSlug } from "./review-link";
import type { AiLogDoc, ClientDoc, MetricsDoc, ReviewClickDoc, ReviewDoc, ScreenshotDoc } from "./schemas";

// Reuse one client across hot reloads and warm serverless invocations.
const globalForMongo = globalThis as unknown as { _mongo?: Promise<Db> };

// A mongodb+srv:// address needs a DNS lookup that Node does itself, without the operating system.
// On some Windows networks the only DNS server on offer is an IPv6 link-local address (fe80::1),
// which Node cannot use: it asks 127.0.0.1 instead and the lookup dies with "querySrv ECONNREFUSED".
// When that happens, look the cluster up through public DNS and return the plain mongodb:// form of
// the address, whose hostnames the operating system resolves. Never needed on Vercel.
async function withoutSrv(uri: string): Promise<string> {
  const url = new URL(uri);
  const resolver = new dns.promises.Resolver();
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  const [hosts, txt] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${url.hostname}`),
    // The TXT record carries the options Atlas wants on every connection (authSource, replicaSet).
    resolver.resolveTxt(url.hostname).catch(() => []),
  ]);
  const options = new URLSearchParams({
    tls: "true",
    ...Object.fromEntries(new URLSearchParams(txt.map((chunks) => chunks.join("")).join("&"))),
    ...Object.fromEntries(url.searchParams),
  });
  const login = url.username ? `${url.username}${url.password && `:${url.password}`}@` : "";
  const seeds = hosts.map((host) => `${host.name}:${host.port}`).join(",");
  return `mongodb://${login}${seeds}${url.pathname || "/"}?${options}`;
}

async function open(): Promise<MongoClient> {
  const uri = env("MONGODB_URI");
  try {
    return await new MongoClient(uri, { maxPoolSize: 5 }).connect();
  } catch (error) {
    const { code, syscall } = error as NodeJS.ErrnoException;
    if (code !== "ECONNREFUSED" || !syscall?.startsWith("query")) throw error;
    return new MongoClient(await withoutSrv(uri), { maxPoolSize: 5 }).connect();
  }
}

async function connect(): Promise<Db> {
  const client = await open();
  const db = client.db(process.env.MONGODB_DB || "dmg_tracker");
  await Promise.all([
    db.collection("clients").createIndex({ active: 1, schedules: 1 }),
    // sparse: only clients with a graphs link carry the field
    db.collection("clients").createIndex({ shareToken: 1 }, { unique: true, sparse: true }),
    // sparse: a client from before review links existed has none until the loop below
    db.collection("clients").createIndex({ reviewSlug: 1 }, { unique: true, sparse: true }),
    db.collection("review_clicks").createIndex({ clientId: 1, day: 1, source: 1 }, { unique: true }),
    db.collection("reviews").createIndex({ clientId: 1, fetchedAt: 1 }),
    db.collection("screenshots").createIndex({ clientId: 1, capturedAt: -1 }),
    db.collection("metrics").createIndex({ clientId: 1, periodEnd: -1 }),
    db.collection("ai_logs").createIndex({ createdAt: -1 }),
    db.collection("ai_logs").createIndex({ clientId: 1, createdAt: -1 }),
  ]);
  // Clients from before review links existed get theirs here, oldest first so two businesses with
  // the same name always come out the same way round. Nothing to do once they all have one.
  const clients = db.collection<ClientDoc>("clients");
  const unnamed = clients.find({ reviewSlug: { $exists: false } }, { projection: { name: 1 } }).sort({ _id: 1 });
  for await (const client of unnamed) await claimReviewSlug(clients, client._id, client.name);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForMongo._mongo) {
    globalForMongo._mongo = connect().catch((error) => {
      globalForMongo._mongo = undefined;
      throw error;
    });
  }
  return globalForMongo._mongo;
}

export async function collections() {
  const db = await getDb();
  return {
    clients: db.collection<ClientDoc>("clients"),
    screenshots: db.collection<ScreenshotDoc>("screenshots"),
    metrics: db.collection<MetricsDoc>("metrics"),
    aiLogs: db.collection<AiLogDoc>("ai_logs"),
    reviews: db.collection<ReviewDoc>("reviews"),
    reviewClicks: db.collection<ReviewClickDoc>("review_clicks"),
  };
}
