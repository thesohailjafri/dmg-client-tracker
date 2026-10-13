# Requirement specification: Google Business Profile as a per-client setting

Status: draft for review. Nothing is built yet.

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

- **Has one:** everything works as it does today. No change.
- **Has none:** nothing about Google is collected, shown or mentioned for that client: not in the
  app, not in the report email, not in the welcome email, not on the client's link. The rest of
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
Profile"**. It is ticked for a new client.

**R2.** While ticked, the three Google fields show as they do today: Google Maps profile link
(required), Google review link (optional), Google Place ID (optional).

**R3.** While unticked, the three Google fields are hidden and the client is saved with all three
empty.

**R4.** A client has a Google profile when its Maps link is filled in. There is no separate stored
flag: an empty Maps link means "no Google profile", the same way an empty Umami website ID already
means "no website traffic". (See open question Q1 for the alternative.)

**R5.** A client must have at least one thing to report on: a Google profile or an Umami website
ID. Saving with neither is refused with the message *"Add a Google Business Profile or an Umami
website ID. A report needs at least one."* (See Q2.)

**R6.** The server enforces R3 to R5, not only the form. A review link or Place ID sent without a
Maps link is saved empty.

**R7.** Every existing client already has a Maps link, so every existing client keeps working
exactly as now. No data migration.

## 5. Requirements for a client with no Google profile

### 5.1 Report run

**R8.** No screenshot is taken: no call to the Worker, no image in R2, no `screenshots` document,
and the run log has no `screenshotId`.

**R9.** The Places API is not called: no figures read, no search for a Place ID.

**R10.** The AI is still asked for the summary, insights and recommendations, from the website
and lead figures alone. It gets no image and a prompt with no screenshot instructions, and it
returns no listing note. `screenshotFindings` is saved empty.

**R11.** The run succeeds. A missing Google profile is never a failure or a warning on the run.

### 5.2 Weekly Google reading

**R12.** The weekly pull skips the client.

**R13.** The pull's "unmatched" count covers only clients that have a Google profile but no Place
ID yet. A client with no profile is not reported as unmatched.

### 5.3 Report email (client-facing)

**R14.** No "Google profile" figures block, in the HTML or the plain-text version.

**R15.** The summary sentence written in code says nothing about Google. The AI is given no
Google facts, so its wording cannot mention any.

**R16.** This holds for any run of that client, including the preview of a run made while the
client still had a profile. Google figures reach a client-facing email only while the setting is
on.

### 5.4 Welcome email (client-facing)

**R17.** The email no longer assumes a Google profile. Its introduction has one fixed wording per
case (section 7). Nothing else in the email changes.

### 5.5 Client page (team)

**R18.** The **Google profile** tab is not shown. Opening its address directly shows one line,
*"This client has no Google Business Profile."*, with a link to the Edit tab. It is not an error
page.

**R19.** Overview, Actions: these buttons are not shown: Open Google profile, Copy Google profile
link, Copy Google review link, Review QR code, Review request banner.

**R20.** Overview, Growth: the "Google profile" figures block is not shown.

**R21.** Overview, Business details: the three Google rows (Maps profile, review link, Place ID)
are replaced by one row, **Google Business Profile: None**, so the team can tell a deliberate
"none" from something forgotten.

**R22.** Wording that takes a Google profile for granted is adjusted: the Public directories
description ("besides Google Maps"), the directories help text on the form ("The Google Maps
profile is already saved above"), the client page's header line, and the client-link description
on the Report tab.

**R23.** Edit, Graphs order: "Google reviews" stays in the list so the order survives, marked
*(hidden: no Google profile)*. This is how "Website leads" is already marked when no leads are
ticked.

### 5.6 Client list and dashboard (team)

**R24.** Settings client list: no Review link, Review QR code, Review request banner, Open Google
Maps profile or Copy Google review link for this client.

**R25.** Dashboard client table: the line under the client's name shows the website address when
there is one, otherwise nothing. It never renders an empty link.

**R26.** Dashboard recent reports: a run with no screenshot shows no "Open screenshot" link and no
"what the AI saw" block.

### 5.7 Graphs (team Report tab and the client's link)

**R27.** The "Google reviews" section is left out completely, with no empty-state message. The
remaining sections keep the client's saved order.

**R28.** "All time" starts at the site's first visit and ignores any old Google readings.

### 5.8 Client's link (client-facing)

**R29.** Overview tab: no Google Business Profile row, no Google review link row, no Review QR
code card.

**R30.** The line under the business name and the link-preview description use the wording for
that client's case (section 7).

### 5.9 Switching an existing client

**R31.** On to off: the Google fields are cleared on save (R3). Everything collected before
(screenshots, Google readings, images in R2) stays in the database and is hidden everywhere.
Nothing is deleted. Reports from then on have no Google part.

**R32.** Off to on: the Maps link is pasted in, the next report run finds the Place ID as it does
for a new client, and the earlier history shows again. The review graph has a gap for the time
the setting was off.

**R33.** Past runs on the dashboard keep their screenshot link. That is a record of what the run
did, and only the team sees it.

## 6. Behaviour by case

| Google profile | Umami website | Report run | Report email | Client's link, Report tab |
| --- | --- | --- | --- | --- |
| Yes | Yes | Screenshot, Places, traffic, AI with image | Google profile, Website, Leads | Traffic, leads, reviews |
| Yes | No | Screenshot, Places, AI with image | Google profile | As today |
| **No** | **Yes** | **Traffic only, AI without image** | **Website, Leads** | **Traffic, leads** |
| No | No | Cannot be saved (R5) | n/a | n/a |

Only the third row is new behaviour. The first two rows must not change.

## 7. Client-facing wording

Fixed text chosen in code by case. None of it is written by the AI. The website-only column is
new and needs sign-off.

| Where | Website and Google | Website only (new) | Google only |
| --- | --- | --- | --- |
| Client's link, line under the name | How your website and Google profile are growing. | How your website is growing. | How your Google profile is growing. |
| Client's link, preview description | How {name}'s website and Google profile are growing. | How {name}'s website is growing. | How {name}'s Google profile is growing. |
| Welcome email, introduction | Your growth report is part of your {agency} website package. It shows how your website and your Google profile are growing, and it is always up to date. … | Your growth report is part of your {agency} website package. It shows how your website is growing, and it is always up to date. … | Your growth report is part of your {agency} package. It shows how your Google profile is growing, and it is always up to date. … |

Side effect: the client's link currently says "website and Google profile" even for a Google-only
client. The Google-only column fixes that.

## 8. Acceptance checks

1. A new client can be saved with the box unticked and an Umami website ID. No Google field is
   asked for.
2. Saving with the box unticked and no Umami website ID is refused with the R5 message, from the
   form and from the API.
3. Running a report for that client: succeeds, makes no Worker call and no Places call, writes no
   `screenshots` document, and the email has no Google block and no Google wording.
4. That client's page has no Google profile tab, no Google or review buttons, and "Google Business
   Profile: None" in its details.
5. That client's link shows only traffic and leads on Report, and no Google rows or QR code on
   Overview. The word "Google" does not appear on either tab.
6. The welcome email preview for that client does not contain the word "Google".
7. The weekly Google pull does not read that client and does not count it as unmatched.
8. Unticking the box on an existing client and saving: its old screenshots and readings are still
   in the database, are shown nowhere, and its next report has no Google part.
9. Ticking it again with a Maps link: the Google profile tab returns with the old snapshots, and
   the next run finds the Place ID.
10. An existing client that was not touched behaves exactly as before: same run, same email, same
    pages.

## 9. Out of scope

- Other profile sources (Bing Places, Apple Maps, Yelp ratings).
- Deleting a client's old Google history or R2 images.
- An app-wide switch for Google features.
- Changes to the standalone Review kit page (`/review-kit`), which is not tied to a client.
- The empty-state message a Google-only client sees in the traffic section of its link. That is
  existing behaviour.

## 10. Open questions

**Q1. Switching off: clear the Google links, or keep them behind a stored on/off flag?**
Recommended: clear them (R3, R4). One rule, no new field, and the checks already in the code for
an empty review link and Place ID keep working. Cost: switching back on means pasting the Maps
link again. The alternative keeps the links and adds a stored flag that every Google feature has
to check as well.

**Q2. A client with neither a Google profile nor an Umami website: refuse to save, or allow it as
a record with no reports?**
Recommended: refuse (R5). Today no client can exist without a Google profile, so nothing that
works now stops working, and no client ever gets an empty report.

**Q3. Old Google snapshots after switching off: hidden from the team as well, or still viewable?**
Recommended: hidden (R18, R31), so "off" means the same thing everywhere. They return if the
setting is switched back on.

**Q4. Is the website-only wording in section 7 approved?**
The welcome email is the agency's own pitch, so the new sentence needs a yes before it is sent to
a client.
