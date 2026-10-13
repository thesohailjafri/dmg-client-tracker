# Requirement specification: Google Business Profile as a per-client setting

Status: all decisions made on 2026-10-13 (section 10). Built on 2026-10-13; what was added while
building is in section 11.

## 1. Problem

Every client must have a Google Maps profile link today. The form will not save without one, and
the whole product assumes it: each report run screenshots that link, the AI reads the screenshot,
the Places API is asked for the rating and review count, and the app and the client's own link
show Google sections everywhere.

Some businesses have no Google Business Profile. Today they cannot be added at all, and if one
were forced in, its reports would fail at the screenshot step and its pages would show empty
Google sections.

## 2. Goal

Whether a client has a Google Business Profile becomes a setting on that client.

- **On:** everything works as it does today. No change.
- **Off:** nothing new about Google is collected, and nothing about Google is shown or said to the
  client: not in the report email, not in the welcome email, not on the client's link. The rest of
  the product (website traffic, leads, directories, schedules, emails) works as normal.

Reading of the brief: the setting is per client, not one switch for the whole app.

## 3. What depends on the Google profile today

| Area | What it does with Google | Where |
| --- | --- | --- |
| Client form | Maps link is required; review link and Place ID are optional | `lib/schemas.ts`, `components/client-form.tsx` |
| Report run | Screenshots the Maps link, sends the image to the AI, reads the Places API, finds and saves the Place ID | `lib/pipeline.ts`, `lib/openai.ts`, `lib/places.ts` |
| Weekly reading | Reads rating and review count for every active client with a Place ID | `lib/reviews.ts`, `app/api/cron/reviews` |
| Report email | "Google profile" figures block and the Google part of the summary | `lib/report-email.ts`, `lib/report-figures.ts`, `lib/email.ts` |
| Welcome email | Always says the report shows how the Google profile is growing | `lib/email.ts` |
| Client page | Google profile tab, Growth figures, action buttons, business details | `app/clients/[id]/*`, `components/client-tabs.tsx`, `components/client-actions.tsx` |
| Client list and dashboard | Maps link under the name, review kit and Google shortcuts | `components/client-manager.tsx`, `app/dashboard/page.tsx` |
| Graphs | "Google reviews" section and its place in the section order | `lib/graph-data.ts`, `lib/graphs.ts` |
| Client's link | Google profile link, review link, review QR code, "website and Google profile" wording | `app/share/[slug]/[token]/page.tsx`, `components/share-overview.tsx` |

## 4. The setting

**R1.** The client form's Business section has a checkbox: **"This business has a Google Business
Profile"**. It is ticked for a new client. Its help text: *"Untick if the business has none. Saved
Google links are kept and come back when you tick it again."*

**R2.** The setting is saved on the client as its own on/off value (`hasGoogleProfile`). A client
saved before the setting existed counts as on.

**R3.** While ticked, the three Google fields show as they do today: Google Maps profile link
(required), Google review link (optional), Google Place ID (optional).

**R4.** While unticked, the three Google fields are hidden and none is required. Whatever was
saved in them stays saved, untouched. Ticking the box again shows them filled in as they were.

**R5.** While the setting is off, the saved Google links are ignored by every feature. The on/off
value decides, never whether a link happens to be filled in. This is checked in one shared place
so no feature can read a kept link by mistake.

**R6.** A client can be saved with neither a Google profile nor an Umami website ID. It is a
record only (details, contacts, directories) until one of the two is added. See 5.10.

**R7.** The server enforces R3 and R4, not only the form: the Maps link is required exactly when
the setting is on.

**R8.** Every existing client counts as on (R2) and already has a Maps link, so every existing
client keeps working exactly as now. No data migration.

## 5. Requirements for a client with the setting off

### 5.1 Report run

**R9.** No screenshot is taken: no call to the Worker, no image in R2, no `screenshots` document,
and the run log has no `screenshotId`.

**R10.** The Places API is not called: no figures read, no search for a Place ID, even when a
Place ID is still saved.

**R11.** The AI is still asked for the summary, insights and recommendations, from the website
and lead figures alone. It gets no image and a prompt with no screenshot instructions, and it
returns no listing note. `screenshotFindings` is saved empty.

**R12.** The run succeeds. A switched-off Google profile is never a failure or a warning on the
run.

### 5.2 Weekly Google reading

**R13.** The weekly pull skips the client, even when a Place ID is still saved.

**R14.** The pull's "unmatched" count covers only clients with the setting on and no Place ID
yet.

### 5.3 Report email (client-facing)

**R15.** No "Google profile" figures block, in the HTML or the plain-text version.

**R16.** The summary sentence written in code says nothing about Google. The AI is given no
Google facts, so its wording cannot mention any.

**R17.** This holds for any run of that client, including the preview of a run made while the
setting was still on. Google figures reach a client-facing email only while the setting is on.

### 5.4 Welcome email (client-facing)

**R18.** The email no longer assumes a Google profile. Its introduction has one fixed wording per
case (section 7). Nothing else in the email changes.

### 5.5 Client page (team)

**R19.** **Google profile tab.** Past snapshots stay viewable by the team:
- Setting off and the client has past snapshots: the tab is shown, with a notice at the top:
  *"Google Business Profile is switched off for this client. These are past snapshots. No new
  ones are taken."*
- Setting off and no snapshots (the client never had a profile): the tab is not shown. Opening
  its address directly shows one line, *"This client has no Google Business Profile."*, with a
  link to the Edit tab. It is not an error page.

**R20.** Overview, Actions: these buttons are not shown: Open Google profile, Copy Google profile
link, Copy Google review link, Review QR code, Review request banner.

**R21.** Overview, Growth: the "Google profile" figures block is not shown. That card is for
current figures, and old ones would read as current. The history is on the Google profile tab.

**R22.** Overview, Business details: the three Google rows (Maps profile, review link, Place ID)
are replaced by one row, **Google Business Profile: Switched off**.

**R23.** Wording that takes a Google profile for granted is adjusted: the Public directories
description ("besides Google Maps"), the directories help text on the form ("The Google Maps
profile is already saved above"), the client page's header line, and the client-link description
on the Report tab.

**R24.** Edit, Graphs order: "Google reviews" stays in the list so the order survives, marked
*(hidden: Google profile switched off)*. This is how "Website leads" is already marked when no
leads are ticked.

### 5.6 Client list and dashboard (team)

**R25.** Settings client list: no Review link, Review QR code, Review request banner, Open Google
Maps profile or Copy Google review link for this client.

**R26.** Dashboard client table: the line under the client's name shows the website address when
there is one, otherwise nothing. It does not show the kept Maps link.

**R27.** Dashboard recent reports: a run with no screenshot shows no "Open screenshot" link and no
"what the AI saw" block. Past runs that did take a screenshot keep their link.

### 5.7 Graphs (team Report tab and the client's link)

**R28.** The "Google reviews" section is left out completely, with no empty-state message, on the
team's Report tab and on the client's link alike. The remaining sections keep the client's saved
order. The team's Report tab stays an exact preview of what the client sees; past ratings and
review counts remain readable on the Google profile tab, snapshot by snapshot.

**R29.** "All time" starts at the site's first visit and ignores old Google readings.

### 5.8 Client's link (client-facing)

**R30.** Overview tab: no Google Business Profile row, no Google review link row, no Review QR
code card, even though the links are still saved.

**R31.** The line under the business name and the link-preview description use the wording for
that client's case (section 7).

### 5.9 Switching an existing client

**R32.** On to off: the links stay saved (R4) and everything collected before (screenshots,
Google readings, images in R2) stays. Nothing is deleted. The team can still open the past
snapshots (R19). The client sees nothing about Google from that moment, and reports from then on
have no Google part.

**R33.** Off to on: the saved links are used again with nothing to retype. The next report run
takes a screenshot, the weekly reading resumes, and the Google sections return everywhere. The
review graph has a gap for the time the setting was off.

### 5.10 A client with nothing to report on (no Google profile, no Umami website)

**R34.** It can be saved and edited like any client. Its details, contacts and directories work
as normal.

**R35.** No report is run for it. The scheduled runs leave it out, so no failed run is logged for
it each week. The Run and Run & send buttons are disabled with the reason *"Nothing to report on
yet. Add a Google Business Profile or an Umami website ID."*, and the run API refuses with the
same message.

**R36.** No welcome email goes out when it is created, because that email promises a growth
report. Its Overview says *"Not sent: nothing to report on yet"* and the Send welcome button is
disabled with the same reason. Once a Google profile or Umami website is added, the team sends
the welcome email by hand with that button.

**R37.** The team's Report tab shows *"Nothing to report on yet. Add a Google Business Profile or
an Umami website ID on the Edit tab."* instead of graphs.

**R38.** Its client link still works. The Overview tab shows the business details and
directories. The Report tab shows one fixed line instead of graphs (section 7).

## 6. Behaviour by case

| Google profile | Umami website | Report run | Report email | Client's link, Report tab |
| --- | --- | --- | --- | --- |
| On | Yes | Screenshot, Places, traffic, AI with image | Google profile, Website, Leads | Traffic, leads, reviews |
| On | No | Screenshot, Places, AI with image | Google profile | As today |
| **Off** | **Yes** | **Traffic only, AI without image** | **Website, Leads** | **Traffic, leads** |
| **Off** | **No** | **None: record only** | **None** | **One fixed line** |

The last two rows are new behaviour. The first two must not change.

## 7. Client-facing wording

Fixed text chosen in code by case. None of it is written by the AI.

| Where | Website and Google | Website only | Google only | Neither |
| --- | --- | --- | --- | --- |
| Client's link, line under the name | How your website and Google profile are growing. | How your website is growing. | How your Google profile is growing. | Your report is being set up. |
| Client's link, preview description | How {name}'s website and Google profile are growing. | How {name}'s website is growing. | How {name}'s Google profile is growing. | {agency} Client Tracker. |
| Client's link, Report tab body | graphs | graphs | graphs | It will appear here once tracking is in place. |
| Welcome email, introduction | Your growth report is part of your {agency} website package. It shows how your website and your Google profile are growing, and it is always up to date. … | Your growth report is part of your {agency} website package. It shows how your website is growing, and it is always up to date. … | Your growth report is part of your {agency} package. It shows how your Google profile is growing, and it is always up to date. … | not sent (R36) |

All wording in this table was approved on 2026-10-13.

Side effect: the client's link currently says "website and Google profile" even for a Google-only
client. The Google-only column fixes that.

## 8. Acceptance checks

1. A new client can be saved with the box unticked. No Google field is asked for.
2. Running a report for a client with the setting off and an Umami website: succeeds, makes no
   Worker call and no Places call, writes no `screenshots` document, and the email has no Google
   block and no Google wording.
3. That client's page has no Google or review buttons and shows "Google Business Profile:
   Switched off" in its details.
4. That client's link shows only traffic and leads on Report, and no Google rows or QR code on
   Overview. The word "Google" does not appear on either tab.
5. The welcome email preview for that client does not contain the word "Google".
6. The weekly Google pull does not read that client, with or without a saved Place ID, and does
   not count it as unmatched.
7. Unticking the box on an existing client and saving: its Maps link, review link and Place ID are
   still in the database unchanged. Its Google profile tab still opens for the team, with the
   notice, and shows the old snapshots. Its client link and next report email show nothing about
   Google.
8. Ticking it again: the three fields are filled in as before with nothing retyped, and the next
   run takes a screenshot.
9. A client that never had a profile has no Google profile tab.
10. A client with neither source can be saved. It gets no welcome email, its Run buttons are
    disabled with the reason, the scheduled run skips it without logging a failure, and its client
    link shows the fixed line on Report.
11. Adding an Umami website ID to that client enables the Run buttons and the Send welcome button.
12. An existing client that was not touched behaves exactly as before: same run, same email, same
    pages.

## 9. Out of scope

- Other profile sources (Bing Places, Apple Maps, Yelp ratings).
- Deleting a client's old Google history or R2 images.
- An app-wide switch for Google features.
- Changes to the standalone Review kit page (`/review-kit`), which is not tied to a client.
- The empty-state message a Google-only client sees in the traffic section of its link. That is
  existing behaviour.

## 10. Decisions (2026-10-13)

| Question | Decision | Requirements |
| --- | --- | --- |
| Switching off: wipe the saved Google links or keep them? | **Keep them, switched off.** Ticking the box again restores them. | R2, R4, R5 |
| Old Google snapshots after switching off: hidden from the team too? | **Team can still see them.** The client never does. | R19, R32 |
| No Google profile and no Umami website: refuse to save? | **Allow it** as a record-only client with no reports. | R6, 5.10 |
| Website-only welcome email sentence | **Approved as written.** | Section 7 |
| Line on the client's link for a client with nothing to report on | **Approved:** "Your report is being set up. It will appear here once tracking is in place." | R38, section 7 |
| Review graph on the team's Report tab while the setting is off | **Hidden there too** (default, no objection raised). | R28 |

## 11. Added while building

Things the spec did not cover, and what was done about each.

**The review link, review messages and visiting card arrived in the app after this spec was
written.** They follow R5 like everything else. While the setting is off:
- The public review link (`/review/<name>`) answers "This review link is not active", so a link
  or printed QR code already out with customers stops sending them to Google. It works again as
  soon as the setting is switched back on.
- The Review link card, Copy review link and Copy review message are not shown on the client's
  Overview.
- The visiting card stays available. Its "Google review" and "Find us on Maps" codes have nothing
  to point at and are greyed out, like any code whose detail is missing.

**One more guard on the AI's wording (R16).** For a client with the setting off, any sentence
from the AI that mentions Google, reviews, a rating or a screenshot is dropped before the email
is built, on top of the AI being given no Google facts.

**The line on the client's link for a client with nothing to report on** is split over two places
that are read together: "Your report is being set up." under the business name, and "It will
appear here once tracking is in place." where the graphs would be. Same approved sentence, not
said twice.

**Report email preview link** stays on the Overview of a client with nothing to report on. It
answers "No finished report yet", as it does for any client that has never run.
