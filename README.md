# DMG Client Tracker

Internal tool. For each client it screenshots their Google Maps / Business Profile page, pulls
website traffic from Umami, asks OpenAI for plain-English insights, and emails the client a
branded report. No client portal, no charts — numbers, text and one image.

Prototype: schema, design and flow are all expected to change.

## How it fits together

```
Cloudflare Worker (workflows/)                Next.js on Vercel
┌──────────────────────────────┐              ┌────────────────────────────────────┐
│ Cron Triggers                │─ GET  ──────▶│ /api/cron/due      who is due?     │
│   daily / weekly / monthly   │─ POST ──────▶│ /api/reports/run   one client      │
│                              │              │   lib/pipeline.ts:                 │
│ POST /screenshot             │◀──── POST ───│     1 screenshot (asks the Worker) │
│   Browser Run + Playwright   │              │     2 Umami metrics                │
│   watermark → R2             │              │     3 OpenAI insights              │
└──────────────────────────────┘              │     4 log to MongoDB               │
                                              │     5 email via Resend             │
                                              │ /dashboard  /settings  /login      │
                                              └────────────────────────────────────┘
```

The Worker does only what needs Cloudflare (browser, R2 write, cron). Everything else is one
code path in `lib/pipeline.ts`, used by both the cron and the dashboard's **Run** buttons.

| Path | What |
| --- | --- |
| `app/dashboard` | Clients, manual runs, recent reports |
| `app/clients/[id]` | One client: Overview, `/analytics` (Umami snapshots), `/google-profile` (screenshots + AI note) |
| `app/settings` | Add / edit / delete clients, URL, recipients, schedule |
| `app/api` | `clients`, `reports/run`, `cron/due`, `screenshots/[id]`, `auth/login` |
| `lib/pipeline.ts` | The report run |
| `lib/umami.ts` `openai.ts` `r2.ts` `playwright.ts` `email.ts` `mongodb.ts` | One client per service |
| `lib/schemas.ts` | Collection types + input validation |
| `proxy.ts` | Auth gate (Next.js 16 name for middleware) |
| `workflows/` | Cloudflare Worker + `wrangler.toml` |

### MongoDB collections (`lib/schemas.ts`)

| Collection | One document per | Key fields |
| --- | --- | --- |
| `clients` | client | `name`, `emails[]`, `contacts[]` (`name`, `phone`), `url` (Maps share link), `googleReviewUrl`, `googlePlaceId`, `umamiWebsiteId`, `schedules[]`, `active`, `lastRunAt`, `lastStatus`, `lastError` |
| `screenshots` | capture | `clientId`, `url`, `r2Key`, `bytes`, `capturedAt`, `note` (AI's fixed fields: `state`, `rating`, `reviewCount`, `category`, `address`, `phone`, `website`, `hoursShown`, `language`), `place` (Places API: `placeId`, `name`, `address`, `rating`, `reviewCount`), `placeError` |
| `metrics` | Umami pull | `clientId`, `websiteId`, `periodStart/End`, `current`, `previous`, `topPages`, `topReferrers` |
| `ai_logs` | pipeline run | `clientId`, `trigger`, `period`, `status`, `error`, `screenshotId`, `metricsId`, `model`, `output`, `usage`, `email` |

Indexes are created on first connection. There are no migrations.

## Local setup

Needs Node 20+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` (table below), then:

```bash
npm run dev
```

Open http://localhost:3000 and sign in with `APP_PASSWORD`.

Without `WORKER_URL` the app still runs: clients can be managed, and a run fails cleanly and is
logged on the dashboard.

## Environment variables

Set these in `.env.local` and in Vercel. Full list with comments: `.env.example`.

| Variable | Needed | Notes |
| --- | --- | --- |
| `APP_PASSWORD` | yes | Shared team password for the dashboard |
| `MONGODB_URI` | yes | Atlas connection string |
| `OPENAI_API_KEY` | yes | |
| `WORKER_URL` | yes | Deployed Worker URL |
| `WORKER_SECRET` | yes | Random string, same value as the Worker secret |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Used to build the R2 endpoint |
| `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | yes | R2 S3 API token, read access is enough |
| `UMAMI_API_URL` | yes | e.g. `https://umami.example.com` |
| `UMAMI_API_KEY` or `UMAMI_USERNAME` + `UMAMI_PASSWORD` | yes | Self-hosted Umami has no API keys: use a login token as the key, or give username/password |
| `RESEND_API_KEY`, `EMAIL_FROM` | yes | `EMAIL_FROM` must be on a domain verified in Resend |
| `EMAIL_OVERRIDE_TO` | testing | Sends every report to this address instead of the client |
| `GOOGLE_PLACES_API_KEY` | no | Places API (New) key. Adds Google's own rating and review count to every snapshot (one Place Details call per report, 1,000 a month free). Without it those come from the screenshot, where Google often hides the count |
| `AGENCY_NAME` | no | Email header + watermark text, default `DMG` |
| `OPENAI_MODEL` | no | Default `gpt-4.1-mini` (~$0.002 per report). Must accept images. `gpt-4.1-nano` is ~3x cheaper |
| `MONGODB_DB` | no | Default `dmg_tracker` |
| `NEXT_PUBLIC_APP_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_BROWSER_BINDING` | no | Not read by the app; kept for reference / wrangler in CI |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Deployment

### 1. MongoDB Atlas

1. Create a cluster (free M0 is fine for a prototype) and a database user.
2. Network Access: allow `0.0.0.0/0`. Vercel has no fixed outbound IPs on standard plans.
3. Copy the connection string into `MONGODB_URI`.

### 2. Cloudflare R2

1. Uses the shared bucket `dmg-common-bucket` (`bucket_name` in `workflows/wrangler.toml` and `R2_BUCKET_NAME`). Everything this app writes goes under `dmg-client-reports/` (`R2_PREFIX` in `wrangler.toml`), as `dmg-client-reports/clients/<clientId>/<timestamp>.jpg`.
2. R2 → Manage API tokens → create a token with **Object Read** on that bucket → `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`.
3. Keep the bucket private. The dashboard reads images through `/api/screenshots/[id]`.

R2 tokens are scoped per bucket, not per folder: this app's token and Worker binding can reach the other apps' objects in the shared bucket too.

### 3. Cloudflare Worker

Browser Run needs to be available on the account (Workers Paid lifts the free tier's daily browser-time cap).

```bash
cd workflows
```

```bash
npm install
```

```bash
npx wrangler login
```

Set `APP_URL` in `wrangler.toml` to the Vercel URL, then:

```bash
npx wrangler secret put WORKER_SECRET
```

```bash
npx wrangler deploy
```

The deploy prints the Worker URL. Put it in `WORKER_URL`.

### 4. Vercel

1. Import the repo. Framework preset: Next.js. Root directory: repo root.
2. Add every variable from `.env.example`.
3. Deploy, attach the domain, then make sure `APP_URL` in `wrangler.toml` matches it and redeploy the Worker.

`/api/reports/run` sets `maxDuration = 300`. That needs Fluid Compute (on by default for new projects); a run normally takes 20–60 seconds.

### 5. First run

1. Sign in → **Settings** → add a client.
2. Set `EMAIL_OVERRIDE_TO` to your own address while testing.
3. **Dashboard** → pick the period (daily / weekly / monthly) → **Run** builds that report without emailing. **Run & send** also emails it.

## Cron schedules

Defined in `workflows/wrangler.toml`, all UTC:

```toml
[triggers]
crons = [
  "0 6 * * *",    # daily   06:00
  "10 6 * * MON", # weekly  Monday 06:10
  "20 6 1 * *",   # monthly 1st 06:20
]
```

The Worker picks the client group from the shape of the expression — day-of-month set means
`monthly`, day-of-week set means `weekly`, neither means `daily` — so you can change times
freely. Examples:

| Want | Cron |
| --- | --- |
| Daily at 13:30 UTC | `30 13 * * *` |
| Weekly on Friday 09:00 UTC | `0 9 * * FRI` |
| Monthly on the 15th 07:00 UTC | `0 7 15 * *` |
| Weekdays only | not supported as "daily" — a day-of-week value is treated as `weekly` |

Each client can be on any mix of schedules, ticked in **Settings**: for example weekly **and**
monthly. No boxes ticked means manual runs only. Every scheduled run is its own report with its
own window (daily = last 1 day, weekly = 7, monthly = 30) and always emails the client, so a
weekly + monthly client gets two emails on a Monday that falls on the 1st.

Test a cron locally from `workflows/` (uses the real Browser Run binding, so it needs `wrangler login`):

```bash
npm run dev
```

```bash
curl "http://localhost:8787/__scheduled?cron=0+6+*+*+*"
```

Put `WORKER_SECRET=...` in `workflows/.dev.vars` for local Worker runs.

## Known limits

- **Not yet run end to end.** Build, types, auth, client CRUD, the cron endpoint and the failure path are verified locally. Screenshot → Umami → OpenAI → email needs real credentials and has not been exercised.
- **Google may block the browser.** Cloudflare IPs can get a consent wall or CAPTCHA from Google Maps. The Worker declines the consent wall; a CAPTCHA will end up in the screenshot and the AI is told to say so. Automated access to Google Maps is also against Google's terms — a places/SERP API is the robust route if this becomes a problem.
- **Batch size.** A cron tick runs clients two at a time inside one Worker invocation (15 minute limit). Fine for a few dozen clients; past that, move the fan-out to Cloudflare Queues.
- **One shared password.** No per-user accounts or audit trail.
- **Deleting a client keeps its history** (screenshots, metrics, logs) and its R2 objects.
- **Watermark** is a bar drawn into the page before capture, not composited onto the image.
