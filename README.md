# DMG Client Tracker

Internal tool. For each client it screenshots their Google Maps / Business Profile page, pulls
website traffic from Umami, asks OpenAI for plain-English insights, and emails the client a
branded report: numbers, text and one image. In the app, each client also has growth graphs, which
can be shared with the client through a read-only link.

Prototype: schema, design and flow are all expected to change.

## How it fits together

```
Cloudflare Worker (workflows/)                Next.js on Vercel
┌──────────────────────────────┐              ┌────────────────────────────────────┐
│ Cron Triggers                │─ GET  ──────▶│ /api/cron/due      who is due?     │
│   weekly / monthly           │─ POST ──────▶│ /api/reports/run   one client      │
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
| `app/clients/[id]` | One client: Overview, `/graphs` (growth over time), `/analytics` (Umami snapshots), `/google-profile` (screenshots + AI note), `/edit` (the client form) |
| `app/share/[slug]/[token]` | A client's read-only graphs page. The only page with no sign-in |
| `app/settings` | The client list: activate, delete, review kit shortcuts |
| `app/clients/new` | The new client form; saving opens that client's page |
| `app/api` | `clients`, `clients/[id]/share`, `reports/run`, `cron/due`, `cron/reviews`, `screenshots/[id]`, `auth/login` |
| `lib/pipeline.ts` | The report run |
| `lib/umami.ts` `openai.ts` `r2.ts` `playwright.ts` `email.ts` `mongodb.ts` | One client per service |
| `lib/leads.ts` | Lead event names and the lead rows of a report |
| `lib/graphs.ts` `graph-data.ts` | The graph ranges, periods and scales; and loading them from Umami and MongoDB |
| `lib/reviews.ts` | The weekly Google reading behind the review graphs |
| `lib/schemas.ts` | Collection types + input validation |
| `tracking/umami-events.tsx` | Not part of this app: the file copied into each client site to send lead events |
| `proxy.ts` | Auth gate (Next.js 16 name for middleware) |
| `workflows/` | Cloudflare Worker + `wrangler.toml` |

### MongoDB collections (`lib/schemas.ts`)

| Collection | One document per | Key fields |
| --- | --- | --- |
| `clients` | client | `name`, `emails[]`, `contacts[]` (`name`, `phone`), `url` (Maps share link), `googleReviewUrl`, `googlePlaceId`, `umamiWebsiteId`, `leadTypes[]`, `graphOrder[]` (order of the graph sections), `schedules[]`, `active`, `copyTeam` (BCC the team inbox on every email to this client), `shareToken` (the graphs link, absent = none), `lastRunAt`, `lastStatus`, `lastError` |
| `reviews` | weekly Google reading | `clientId`, `placeId`, `rating`, `reviewCount`, `fetchedAt` |
| `screenshots` | capture | `clientId`, `url`, `r2Key`, `bytes`, `capturedAt`, `note` (AI's fixed fields: `state`, `rating`, `reviewCount`, `category`, `address`, `phone`, `website`, `hoursShown`, `language`), `place` (Places API: `placeId`, `name`, `address`, `rating`, `reviewCount`), `placeError` |
| `metrics` | Umami pull | `clientId`, `websiteId`, `periodStart/End`, `current`, `previous`, `topPages`, `topReferrers`, `events` (every event name: `current`, `previous`), `forms` (`started`, `submitted`, `steps`) |
| `ai_logs` | pipeline run | `clientId`, `trigger`, `period`, `status`, `error`, `screenshotId`, `metricsId`, `model`, `output`, `usage`, `email` |

Indexes are created on first connection. There are no migrations.

## Lead tracking

Besides traffic, a report can count what visitors did on the client's site. The site sends Umami
events; the report run reads them with the traffic numbers.

| Event | Sent when | Lead type |
| --- | --- | --- |
| `call_click` | a `tel:` link is tapped | Call taps |
| `sms_click` | an `sms:` link is tapped | Text taps |
| `whatsapp_click` | a WhatsApp link is tapped (`wa.me`, `api.whatsapp.com`, `whatsapp:`) | WhatsApp taps |
| `chat_open` | the chat widget is opened, once per page load (from the chat provider's own callback) | Chat opens |
| `form_start` | a form is first touched (`form` property = the form's name) | Forms |
| `form_submit` | a form is completed (`form` property) | Forms |
| `book_click` | the visitor is sent to the booking page | Bookings |
| `book_complete` | a booking is made in an embedded Cal.com calendar | Bookings |
| `form_step` | a later step of a form is reached (`step` property) | none, dashboard only |

1. **In this app:** edit the client and tick the lead types its site tracks under **Leads in the
   report**. The form then lists the event names for those types and a prompt to copy.
2. **On the client site:** paste that prompt into the AI agent working in the site's codebase. It
   gives the goal, the event names and their properties, and leaves the build to the agent, since
   sites differ. `tracking/umami-events.tsx` is a ready-made version for Next.js / React sites, for
   doing it by hand. Either way the event names are the same on every site.

Only ticked types reach the email and the AI. A ticked type with nothing recorded shows as 0, and
the Analytics tab warns when a ticked type has never had an event.

The client's Analytics tab also lists each form (started against completed), form steps and every
event name Umami recorded, ticked or not. Those never go in the email.

A tap or an opened chat widget is counted, not the call, message or conversation itself, and the report wording
says so. `book_complete` only exists where the calendar is embedded on the site: a plain link to
cal.com can only be counted as "Booking page opened". Never put names, emails or phone numbers in
event data.

## Graphs

Each client has a **Graphs** tab: visitors, page views, visits, the lead types ticked for that
client, and Google review count and rating, drawn over time. There is one control, the range, and
the range fixes the grouping, so no view has too many points to read or too few to compare:

| Range | One point per |
| --- | --- |
| Last 30 / 60 / 90 days | week (Monday to Sunday, UTC) |
| Last 6 / 12 months, All time | month |

Ranges cover whole weeks or months plus the one in progress, which is drawn paler and never used
for the headline number or a comparison. "All time" starts at the site's first visit or the first
Google reading and stops at 36 months.

- **Traffic and leads** are read live from Umami, one request pair per week or month, so visitors
  are unique within each period. Finished periods are cached (`use cache` in `lib/umami.ts`).
  They go back as far as Umami does, including before the client was added here.
- **Reviews** are Google's own figures only: the reading each report run keeps on its screenshot,
  plus one reading a week for every active client with a Google place ID, taken on the weekly
  cron tick (`POST /api/cron/reviews`). History starts with the first reading; Google has no past
  figures to ask for. Needs `GOOGLE_PLACES_API_KEY`.

**Client link.** At the bottom of the Graphs tab, **Create client link** makes a read-only page of
the same graphs at `/share/<business-name>/<token>` with no sign-in. The name only makes the link easy to recognise and is never used to find the client: after a rename, a link with the old name redirects to the new one. The random token is the only protection, so treat the
link like a password. **Reset link** replaces it and **Turn off** removes it; either way the old
address stops working at once. The page shows graphs and the client's name, nothing else.

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
| `NEXT_PUBLIC_APP_URL` | yes | Where the app is served from. Emails link to it (the client's report link), so it must be the live address |
| `EMAIL_OVERRIDE_TO` | testing | Sends every email to this address instead of the client. Outside the live site (`VERCEL_ENV=production`) nothing is sent at all unless it is set |
| `EMAIL_REPLY_TO` | no | Where a client's reply lands, default `team@domoregrowth.com` |
| `GOOGLE_PLACES_API_KEY` | no | Places API (New) key. Adds Google's own rating and review count to every snapshot (one Place Details call per report, plus one per active client a week for the review graphs; 1,000 a month free). Without it those come from the screenshot, where Google often hides the count, and there are no review graphs |
| `AGENCY_NAME` | no | Email header + watermark text, default `DMG` |
| `OPENAI_MODEL` | no | Default `gpt-4.1-mini` (~$0.002 per report). Must accept images. `gpt-4.1-nano` is ~3x cheaper |
| `MONGODB_DB` | no | Default `dmg_tracker` |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_BROWSER_BINDING` | no | Not read by the app; kept for reference / wrangler in CI |

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
3. **Dashboard** → pick the period (weekly or monthly) → **Run** builds that report without emailing. **Run & send** also emails it.

## Cron schedules

Defined in `workflows/wrangler.toml`, all UTC:

```toml
[triggers]
crons = [
  "30 13 * * MON", # weekly  Monday 13:30 (7:00 PM IST)
  "40 13 1 * *",   # monthly 1st 13:40
]
```

The Worker picks the client group from the shape of the expression — day-of-month set means
`monthly`, day-of-week set means `weekly` — so you can change times freely. There is no daily
report: an expression with neither set runs nothing. Examples:

| Want | Cron |
| --- | --- |
| Weekly on Friday 09:00 UTC | `0 9 * * FRI` |
| Monthly on the 15th 07:00 UTC | `0 7 15 * *` |

Each client can be weekly, monthly or both, ticked on its **Edit** tab. No boxes ticked means
manual runs only. Every scheduled run is its own report with its own window (weekly = last 7 days,
monthly = 30) and always emails the client, so a weekly + monthly client gets two emails on a
Monday that falls on the 1st.

The weekly tick also reads every active client's Google rating and review count for the review
graphs, whatever schedule the client is on.

Test a cron locally from `workflows/` (uses the real Browser Run binding, so it needs `wrangler login`):

```bash
npm run dev
```

```bash
curl "http://localhost:8787/__scheduled?cron=30+13+*+*+MON"
```

Put `WORKER_SECRET=...` in `workflows/.dev.vars` for local Worker runs.

## Known limits

- **Not yet run end to end.** Build, types, auth, client CRUD, the cron endpoint and the failure path are verified locally. Screenshot → Umami → OpenAI → email needs real credentials and has not been exercised.
- **Google may block the browser.** Cloudflare IPs can get a consent wall or CAPTCHA from Google Maps. The Worker declines the consent wall; a CAPTCHA will end up in the screenshot and the AI is told to say so. Automated access to Google Maps is also against Google's terms — a places/SERP API is the robust route if this becomes a problem.
- **Batch size.** A cron tick runs clients two at a time inside one Worker invocation (15 minute limit). Fine for a few dozen clients; past that, move the fan-out to Cloudflare Queues.
- **One shared password.** No per-user accounts or audit trail.
- **Deleting a client keeps its history** (screenshots, metrics, logs) and its R2 objects.
- **Watermark** is a bar drawn into the page before capture, not composited onto the image.
