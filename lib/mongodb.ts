import { MongoClient, type Db } from "mongodb";
import { env } from "./env";
import type { AiLogDoc, ClientDoc, MetricsDoc, ScreenshotDoc } from "./schemas";

// Reuse one client across hot reloads and warm serverless invocations.
const globalForMongo = globalThis as unknown as { _mongo?: Promise<Db> };

async function connect(): Promise<Db> {
  const client = await new MongoClient(env("MONGODB_URI"), { maxPoolSize: 5 }).connect();
  const db = client.db(process.env.MONGODB_DB || "dmg_tracker");
  await Promise.all([
    db.collection("clients").createIndex({ active: 1, schedules: 1 }),
    db.collection("screenshots").createIndex({ clientId: 1, capturedAt: -1 }),
    db.collection("metrics").createIndex({ clientId: 1, periodEnd: -1 }),
    db.collection("ai_logs").createIndex({ createdAt: -1 }),
    db.collection("ai_logs").createIndex({ clientId: 1, createdAt: -1 }),
  ]);
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
  };
}
