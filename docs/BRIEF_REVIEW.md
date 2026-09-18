# Review of the build brief against the source documents

Checked 20 August 2026 against:

- **ToR**, "Concept Note: Verification of School Self-Assessment under SQAAF, Uttar Pradesh", 4 pages
- **Flowchart**, the five-panel process diagram (School, SQAAF Portal, Online Verifier, SSSA, On-Ground Verifier, Randomized Audit)
- **Role cards**, the Online Verifier / On-Ground Verifier two-column slide
- **Protocol strip**, "Verification Protocol and Algorithmic Triangulation", steps 1 to 4
- **This repository** at commit `0ccfbea`

The brief is accurate on most of what it claims and its instinct to make contested
numbers configurable is right. What follows is only where it diverges from the sources,
plus two problems the sources create that the brief does not resolve.

---

## 1. The real indicator set already exists, and it does not match the placeholder

The brief says the real SQAAF indicator set "is not yet supplied" and gives a placeholder
shape. It is supplied. `prisma/realFrameworkData.ts` in this repository carries it,
transcribed from SCERT Uttar Pradesh, "SQAAF Checklist", 8 June 2026 version, pages 22 to
54 of a 54-page document, with the Hindi copied verbatim.

| | Brief placeholder | Real framework in repo |
|---|---|---|
| Domains | 6 | **5** |
| Sub-domains | 5 to 8 per domain, so 30 to 48 | **11 in total** |
| Indicators | not stated | **89** |
| Levels per indicator | **1 to 4** | **1 to 3**, scored 1, 2, 3 |
| Applicability | not modelled | per school stage: PRIMARY, UPPER_PRIMARY, SECONDARY |
| Domain weights | `weight: number` per indicator | `weightPercent` per domain, now the real SCERT table: 20, 15, 20, 30, 15 |

The five real domains: Infrastructure and Safety; Administration, Human Resource and
Leadership; Teaching and Learning; Assessment and Learning Outcomes; Inclusivity and
Community Participation.

Section 13 of the brief says to stop and ask when this happens. Two things follow that
are not cosmetic:

- **A four-level rubric will not map onto a three-level framework.** Every score, band
  and risk calculation has to be built for three.
- **Applicability is load-bearing.** 71 of the 89 indicators apply to all stages; the
  rest are restricted. A primary school does not answer the same paper as a secondary
  school, so "every applicable indicator" is a per-school computation, not a constant.

## 2. Desk screening is staffable, but only because a cycle spans three years

**Corrected 20 August 2026.** An earlier version of this section put the desk-screening
load at about 1.27 crore judgements a year and 177 to 236 full-time screeners. That read
the volume as annual. SSSA has confirmed one verification cycle spans **three years**, so
the figure was wrong by a factor of three. The corrected numbers are below.

The ToR requires the Online Verifier to "review uploaded documentary and photographic
evidence against each SQAAF indicator" for every assigned school, and the flowchart shows
"screeners screen the evidence provided by the school" then "compute risk score for every
school", with no sampling step. The brief faithfully implements this at Section 2, step 4.

Over a three-year cycle that is:

- 2,65,278 schools, so about **88,426 entering verification each year**
- roughly 80 applicable indicators each
- at the brief's assumed 60% MANUAL split, about **48 human judgements per school**
- **about 42.4 lakh manual indicator judgements a year**

| Seconds per judgement | Hours per year | Full-time screeners at 1,800 h |
|---|---|---|
| 60 | 70,700 | **39** |
| 90 | 1,06,100 | **59** |
| 120 | 1,41,500 | **79** |

Between 40 and 80 analysts is a real cost but a plausible one for a Vidya Samiksha Kendra
cell, which the earlier figure was not. This is no longer a finding that threatens the
programme design. It is a staffing line that has to be budgeted, and it is sensitive to
the MANUAL share: every indicator moved from MANUAL to AUTO takes about 1.2 screeners off
the number.

Two things follow for the build:

- The desk-screening workspace still takes its indicator set **from a query**, not from
  "all of them", governed by config. Defaulting to every indicator honours the ToR, and
  narrowing later stays a config change rather than a rewrite.
- The MANUAL share is the cost driver, so `checkMethod` on each of the 89 indicators is a
  budget decision as much as a technical one. It should be reviewed by someone who knows
  what UDISE+, Prerna and Manav Sampada actually hold, not set to hit a 40/60 ratio.

### The ambiguity that survives, and is now the open question

The 33% field cohort has two readings, and only one makes `revisitIntervalYears: 3`
coherent.

| Reading | Visits per year | A school is visited |
|---|---|---|
| 33% of the **annual verification intake** (88,426) | 29,181 | once every nine years |
| 33% of **all schools** (2,65,278) | 87,542 | once every three years |

The second matches the flowchart's "verified score published, next visit within 3 years"
and matches the brief's own "about 87,500". But it also means the field cohort is very
nearly the whole annual intake, which leaves the risk triage deciding little: almost every
school screened would be visited anyway.

The first preserves the triage but contradicts the three-year revisit promise.

This is not resolvable from the documents, so `fieldCohortBasis` is a config key with the
same shape as `riskThreshold.basis`, defaulting to `ALL_SCHOOLS` because that is what the
flowchart's revisit promise requires. **It needs an answer from SSSA before cohort build
goes live**, because it changes the field verifier headcount by roughly 3x.

## 3. Video walkthrough and anonymity cannot both hold

The brief spots the tension and solves half of it. The ToR says Online Verifiers and
schools "remain anonymous to each other at all times". The brief protects the verifier:
camera and microphone off and unable to be enabled, text prompts instead of speech, a
pseudonymous ID.

It does not protect the school, and it cannot. A live geofenced walkthrough shows the
verifier the building, the nameboard, the corridors, the staff and the principal. The
masked school code hides a name the video then reveals. Geofencing makes it worse: the
session is pinned to the school's registered coordinates by design.

So one of these has to give, and Section 13's third trigger, "any requirement forces the
Online Verifier to see school identity", is met by the walkthrough itself:

- **Re-scope the promise** to "the verifier is anonymous to the school, and the school is
  anonymous to the verifier during desk screening", accepting that the walkthrough is a
  disclosed step. Then the honest control is a per-session access record and a
  conflict-of-interest check at the point the walkthrough is scheduled, mirroring the
  field reveal.
- **Or drop the live walkthrough** in favour of the guided-capture fallback the brief
  already specifies, which the verifier reviews afterwards. Clips still show the building,
  so this only narrows exposure rather than removing it, but it removes the live session.

Either is defensible. Silently masking the school code while streaming its front gate is
not, because it reads as a control and is not one.

## 4. Six smaller divergences

**a. The ToR asserts API integration.** Page 1 says the cross-match is one "which the
SQAAF portal runs through API integration". The brief says not to assume live APIs. The
brief's hedge is the right engineering call, but it should be recorded that it overrides
an explicit ToR statement rather than filling a silence.

**b. There are two supervisor cells, not one supervisor.** The ToR team composition table
has the Online Verifier reporting to "Supervisor (Online Cell)" and the On-Ground
Verifier to "Supervisor (Field Cell)". The brief's Section 3 hints at this with "its own
cell's verifiers" but the role list has a single Supervisor. The model needs a cell
attribute on the supervisor, and batch allocation has to respect it.

**c. Online Verifiers are not an empanelled pool.** The ToR sources them from VSK data
analysts, while On-Ground Verifiers and Supervisors come from "Empanelment". The
de-empanelment rules in Section 6 therefore cannot apply uniformly: a serving government
analyst cannot be de-empanelled from a pool they were never in. Model a workforce source
on the verifier record and gate the de-empanelment logic on it.

**d. Certification is a hard gate the brief drops.** The ToR: "Empanelment is activated
only after certification is cleared." Section 12 puts the training module out of scope,
which is reasonable, but the *gate* is not the module. An uncertified verifier must not be
assignable. That is one field and one check, and it belongs in version 1.

**e. Conflict of interest is a standing eligibility rule, not only a declaration.** The
ToR bars a verifier from holding "any position within the UP school education department,
or in a school/cluster within the assigned district". That has to be enforced when the
roster is built, not merely self-declared at reveal. The brief models only the reveal-time
prompt.

**f. The Audit Cell is also an integrity channel.** The ToR requires verifiers to report
inducement or pressure "to the Supervisor and the Independent Audit Cell". The brief's
Audit Cell sees only the random sample. It needs an inbox that does not route through the
Supervisor, since the Supervisor may be the subject of the report.

## 5. Where the brief is right and the sources are wrong or silent

Recorded so these are not re-litigated later.

- **Spot-check conflict is real.** ToR page 2: "basic reading, writing, and math
  spot-checks to 10 randomly selected students". Role card: "10% of students". These are
  different instruments. Configurable is correct.
- **Audit sample conflict is real.** Flowchart: "In every district, 1% of schools are
  picked at random". ToR pages 2 and 3: "approximately 3-5%". Configurable is correct.
- **De-empanelment floor is genuinely missing.** ToR: removal at "more than 20% of the
  findings (i.e. more than 1 in 5) or in 3 assignments within any rolling 12 month
  period, whichever is met first". With no minimum case count, a single contradiction in
  the first five audited cases triggers removal. The brief adding
  `deEmpanelMinimumAuditedCases` fixes a real defect in the ToR.
- **The school response window is genuinely absent** from both sources, and the brief's
  reasoning for adding it is sound.
- **The 20% deviation basis is genuinely unspecified.** The flowchart says only "if
  deviation is > 20%".
- **Showing the risk score only after the verifier commits** is not in the sources and is
  a good addition.
- **Audit sample is drawn from field-visited schools.** The flowchart branches the audit
  off the field verifier's "findings match self-assessment?" decision, so the auditor
  re-does a physical check. The brief's wording, "already-verified schools", is looser
  than the source; it should say field-visited.

## 6. Arithmetic checked

- 33% of 2,65,278 is 87,542, so the brief's "about 87,500" is right, on the
  `ALL_SCHOOLS` reading of the cohort basis discussed in Section 2.
- The flowchart's start node reads "all 2,65,278 lakh schools". The word "lakh" there is
  a slip in the source; the figure is 2,65,278 schools, not 2,65,278 lakh.
- The brief's Section 0 says schools submit a self-assessment "each year" while SSSA has
  confirmed a cycle spans three years. Both can hold: schools may self-assess annually
  while the verification pipeline works through a third of them a year. The build assumes
  that, since it is the only reading under which the flowchart's annual self-assessment
  and the three-year cycle are both true. **If instead only a third of schools
  self-assess each year, say so** and the intake query changes.

## 7. Decisions taken, 20 August 2026

Recorded so the build's assumptions are auditable.

| Question | Decision |
|---|---|
| Where the verification portal lives | Extend this repository, inside the existing verifier interface behind the current login |
| Indicator set and levels | The real framework: 5 domains, 11 sub-domains, 89 indicators, 3 levels, per-stage applicability |
| Desk screening scope | Query-scoped and config-governed, defaulting to every applicable indicator |
| Anonymity | Verifier anonymous to the school throughout; school anonymous to the verifier during desk screening only. The video walkthrough is a disclosed step with a per-session access record and a conflict-of-interest check when it is scheduled |
| Cycle length | Three years |

Still open: `fieldCohortBasis` (Section 2), the level-threshold norms for countable AUTO
indicators (Section 8), and review of the `checkMethod` assignment across the 89 indicators
(Section 2).

## 8. Domain weights, resolved 20 August 2026

SSSA supplied the SCERT weightage table. It replaces an equal 20% placeholder that every
domain carried.

| # | Domain | Weight |
|---|---|---|
| 1 | Infrastructure and Safety | 20% |
| 2 | Administration, HR and Leadership | 15% |
| 3 | Teaching and Learning | 20% |
| 4 | Assessment and Learning Outcomes | **30%** |
| 5 | Inclusivity and Community Participation | 15% |

They sum to 100, which a test now asserts. A weighted score computed over weights that do
not sum to 100 is not a percentage of anything, and the failure is silent: every school
still gets a number, it is just not the number the framework describes, and the grade bands
then cut that wrong number at 55 and 80.

The same table confirms three things the build had already assumed: roughly 80 parameters
apply to a school, each scores 1 to 3 by level, and the bands are Uday up to 55%, Unnat 55%
to 80%, Utkarsh above 80%. The existing `GradeBand` rows already hold 55 and 80, so nothing
changes there.

**A defect this exposes.** The public homepage's "Did you know" panel has been telling
parents that Assessment and Learning Outcomes carries 30% of a school's score, more than any
other domain, while the framework data weighted it at 20% like everything else. The claim
was right and the calculation was wrong. Every score computed before this correction
under-weighted learning outcomes and over-weighted the two 15% domains.

Scores are not recomputed by the backfill, deliberately. Rewriting published figures as a
side effect of a deploy is worse than leaving them visibly stale; recomputation belongs to
`finalizeAllResults`, which SSSA runs knowingly. What the correction does is make the next
computation right.

**One consequence for step 4.** The heaviest domain is also the most human. Of the eleven
indicators in Assessment and Learning Outcomes, three are AUTO through Prerna and eight are
MANUAL, so 30% of every school's score rests mostly on desk judgement rather than on
cross-matched records. That is an argument for weighting a desk verifier's
`EVIDENCE_CONTRADICTS_LEVEL` at least as heavily as an automated mismatch in the risk
rubric, which is how the seeded rubric already has it.

## 9. Walkthrough voice, decided 24 August 2026

SSSA instructed that the verifier and the school speak to each other on the walkthrough
call, with the verifier's video still never visible, and, on reconfirming the same day,
that the text prompt queue goes entirely: "text prompts wont work. they need to be able
to talk to each other."

This reverses section 7 of the brief and the terms of reference, which switch the
verifier's microphone off and push instructions as text precisely to keep the verifier
anonymous: a voice is identifiable in a small district, and calls can be recorded. That
risk was put to SSSA and the instruction stood, so it is recorded here as a settled
decision rather than held as configuration: a text-only setting whose instruction channel
no longer exists would be a broken product pretending to be an option.

What remains of the protection: the verifier's camera has no code path at all, the school
sees a pseudonymous ID and never a name, and the verifier's typed observations against
each disputed indicator are the written record of the session. When a real video
transport is procured, session recording should be part of the requirement, because the
recording then replaces the prompt log as the evidentiary trail of what was asked for.

## 10. The consolidation to two verifier logins and one admin, decided 8 September 2026

SSSA instructed that the portal carry exactly two verifier logins — an Online Verifier and
an On-Ground Verifier — and that everything else on that tab is a function of the admin:
"rest everything else is a function of the admin." The proposal was walked through in
mock-ups and approved as proposed.

What changed. The supervisor and audit portals are gone as sign-ins: their eight screens
(workforce roster, escalations, quality sample, discrepancies, de-empanelment, risk drift,
audit queue, integrity reports) moved under /app/sssa in a new Oversight group of the admin
sidebar, and the verifier login tab accepts only the two working roles plus the original
legacy VERIFIER account. The demo accounts supervisor1, supervisor2 and audit1 are
deactivated by the workforce seed rather than deleted, so every ruling and finding they
signed keeps its author.

The trade this makes, stated plainly. The terms of reference separate the Audit Cell from
the people it audits; folding audit into the same login that supervises verifiers and runs
the cycle removes that separation of duties. One admin account now assigns work, samples
it, rules on discrepancies, audits published cases and acknowledges integrity reports —
including, in principle, reports about the administration itself. SSSA accepted this for
the demonstration build. The roles remain in the schema and in `requireRole` gates, so
re-separating oversight later is a matter of reactivating accounts and narrowing a handful
of gates (`acknowledgeIntegrityReport` and the audit case scoping in
`src/lib/actions/audit.ts` are the two that were widened), not of rebuilding screens.

Redundancies removed in the same pass, from the admin build audit:

- Two publication systems. The unlinked Finalization page held a cycle-wide "publish
  results" switch from before the verification pipeline existed, and the school report
  card gated on that switch alone — so schools published one-by-one through the pipeline
  read their own report card as "preliminary" forever. Finalization now redirects to
  Reporting, and the report card gate is per school: published means this school's
  `Result.publishedAt` is set, or the old cycle switch was thrown before the retirement.
  The appeal decision screen under /finalization/appeal/[udise] is alive and linked from
  Appeals; only the index retired.
- Two Frameworks. The sidebar pointed at a display editor that persisted nothing while the
  real manager at /app/sssa/frameworks was linked from nowhere. The sidebar entry now
  points at the manager and the display editor is deleted.
- Verification renamed Appeals. The pipeline assigns verifiers itself, so of that page's
  two queues only Appeals is still the admin's own work. The manual assignment queue
  survives behind a "Legacy queue" tab because the original VerifierAssignment screens
  still run on it; old /verifiers links redirect with their tab intent preserved.
- District links that bounced. Both district navs pointed Monitoring (and the district
  admin's Dispute Resolution) into /app/sssa pages that middleware bounces district users
  out of — every click a silent return to the homepage. The district portal now has its
  own district-scoped Monitoring page, district admins are admitted to the shared district
  pages with their own nav, and the ticket actions accept and district-scope
  DISTRICT_ADMIN.

## 11. The Decisions inbox, decided 9 September 2026

Walking the consolidated admin, SSSA found that Appeals, Escalations and Discrepancies
"feel the same", and they were right for a structural reason: three sidebar entries, each
a heading over a list of rulings waiting on the same one person. A first pass that kept
the three pages and differentiated their presentation did not cure it, so the pages were
merged. Three layouts were mocked up (one list worst-first; three lanes; inbox with a
side workbench) and SSSA chose the first.

/app/sssa/decisions is now the single queue: every pending ruling in one list, sorted by
how long it has waited. Each row carries a type chip naming its consequence (an appeal
changes a published score, an escalation freezes its case, a discrepancy blocks
publication), a line naming who brought it (schools file appeals, online verifiers raise
escalations, the system opens a discrepancy when a signed-off field visit differs from
the claim), and a waiting clock that turns amber at 7 days and red at 14. Escalations are
ruled inline; appeals and discrepancy cases open their existing screens unchanged. The
sidebar entry carries a live count of rulings waiting.

What it replaced: the Appeals, Escalations and Discrepancies entries are gone from the
sidebar and their URLs redirect into the inbox's filters, so old notification links keep
working. The legacy manual assignment queue is not a decision and stays reachable at
/app/sssa/appeals?tab=legacy, linked from the inbox footer and the verifier profiles, in
no sidebar because it is on the way out. Audit deliberately did not merge: it is a blind
re-check of finished work, and putting it in the same list would seat the primary
findings one click from the person meant not to see them before submitting.

## 12. Decisions dealt one at a time, decided 10 September 2026

Seeing the merged inbox live with 22 real rows, SSSA found it overwhelming, and the
diagnosis held up: every card carried seven pieces of information and five of them
repeated, fourteen times over for the appeals alone. Seven presentation options were
mocked up; SSSA chose focus mode.

The Decisions page now deals one ruling at a time, oldest first: a single card with
everything needed to act (the score movement and the school's written grounds for an
appeal, the verifier's rationale and the full inline ruling form for an escalation, the
contradiction and response-window state for a discrepancy), a progress bar standing in
for the rest, and Skip to push a case to the back of the sitting. The full list remains
one toggle away for scanning, jumping and batching, and ?view=list deep-links to it.
Nothing about ruling changed: escalations resolve inline, appeals and discrepancy cases
open their existing screens.

## 13. The Decisions page settles into three tabs, decided 10 September 2026

Iterating on the live inbox through mock-up rounds, SSSA settled the Decisions page's
final shape: an Overview tab as the default (who-count tiles that double as doors, the
backlog by age with a ruled-this-week line, districts carrying the queue, appeals decided
with the upheld share, the median time to decide an appeal, and the most escalated
indicator), then two work tabs — Appeals, and Verification issues with a who-raised
filter. Every decision of any kind renders one six-slot card: who raised it and the
consequence, a waiting clock, the one big fact, a who-line, the substance quoted (the
school's grounds, the verifier's reason, or the school's response, honestly empty when
none), and one button. Escalations rule inline behind their button; appeals and
discrepancy cases open their existing screens. "Rule oldest first" in the header deals
the same cards one at a time, worst first, across every kind.

Two naming decisions are SSSA's own and are recorded as such: escalations read "raised
by an online verifier", and discrepancy cases read "from the on-ground verifier" rather
than "from the system" — attributing the case to the verifier whose signed-off findings
it is built on, with the sub-line "field visit differs from the claim" keeping it clear
that the portal opens the case automatically and no one files it by hand.

## 14. The legacy assignment window closes, decided 10 September 2026

Seeing the legacy manual-assignment queue live — 83 seeded schools, the oldest
"waiting" 130 days, none of which anyone would ever work — SSSA asked why it still
existed and ordered it removed. The window is gone: the page, the users-page shortcuts
into it, and the reminder button are deleted, and every old URL for it redirects to
Decisions. What remains, deliberately, is the pathway's data: the cycle's completed
verifications, results, report cards and the appeals now in the Decisions inbox were all
produced by the legacy VerifierAssignment machinery, so its models, actions and seeds
stay until demo history is regenerated through the pipeline. One consequence to know:
the portal currently has no manual-assignment fallback in the interface; if the pipeline
mis-assigns, the remedy is administrative until the pipeline grows its own reassignment
control.

## 15. The two verifier cells are sealed off from each other, decided 10 September 2026

SSSA clarified that online and on-ground verifiers are separate groups of people: an
online verifier never receives physical assignments and an on-ground verifier never
receives desk screening work. Assignment already respected this (desk batches only go to
online-cell profiles, cohort visits only to field-cell profiles), but the portal did not:
one shared sidebar showed Desk Screening, Walkthroughs and Field Assignments to every
verifier, with empty states standing in for gates.

Now the separation is structural. The verifier sidebar is per cell — online sees Overview,
Desk Screening and Walkthroughs; on-ground sees Overview and Field Assignments; the legacy
VERIFIER account sees only its Overview, where its old assignment table lives. The desk,
walkthrough and assignment pages gate on the specific role and send a signed-in verifier
of the other cell to their own Overview rather than to login. Server actions follow:
requireOnlineVerifier guards desk screening and walkthrough actions, requireOngroundVerifier
guards cohort assignment and field visit actions, the legacy assessment actions accept only
the legacy VERIFIER role, and requireVerifier itself dropped the retired SUPERVISOR and
AUDIT_CELL roles. The walkthrough and field actions' existing profile-cell checks remain as
a second lock.

## 16. The field visit briefing and post-inspection appeals, decided 10 September 2026

SSSA asked that whatever the online screener flagged reach the on-ground verifier, and
that appeals be visible to the verifier they concern. Two rules shaped the build, both
SSSA's own corrections during design review: a school can appeal only after the on-ground
assessment, so no appeal exists at inspection time and nothing appeal-shaped appears in
the visit workspace; and a school never sees the desk screening, so the flags travel to
the field verifier and to no one else.

The desk briefing rides the reveal mechanism rather than weakening it. A sealed
assignment now carries one new fact, a count: "N indicators flagged at desk screening
wait behind the seal". A count names no school and no indicator, so the sealed type's
promise holds; the tests pin this. The flags themselves open with the school, inside the
visit workspace: a strip under the school header gives the count and a flagged-only
toggle, and each flagged indicator carries the desk decision, the screener's rationale
(with the SSSA's ruling appended where the flag had been escalated and ruled), a "ruled
by SSSA" mark, and the line "Not visible to the school". The note is styled in the desk
track's navy inside the field track's gold, so it reads as received intelligence, not as
the field verifier's own finding. The flagged-only toggle narrows what is listed, never
what is counted: progress and sign-off still run over every indicator.

Appeals appear after the fact, on the on-ground verifier's Overview: "Appeals on your
inspections" lists appeals schools filed against visits this verifier signed off, waiting
ones first, then decided ones with the per-indicator outcome ("upheld as you found it" /
"revised to the school's level"). Read-only by design; deciding appeals is the SSSA's
Decisions page, and the same waiting appeal shows there.

Fixing the visibility exposed an eligibility gap: appeal eligibility keyed only on the
legacy VerificationSubmission, so no school verified through the pipeline could appeal at
all. Eligibility now also accepts a published run resting on a signed-off field visit,
with the five-day window anchored to publication, the first moment the school can see the
result it would contest. A desk-only publication is deliberately not appealable: the
school never saw the desk screening, so there is nothing for it to argue against. The
appeal form's diff likewise reads the visit's findings (levels translated to option keys)
where a signed-off visit exists, falling back to the legacy submission otherwise.

Demo data comes from a separately guarded seed (seedFieldAppealsDemo), because the
pipeline demo's marker already exists in the production database and code added inside it
would never run: field1 gains one submitted appeal awaiting the SSSA and one decided
mixed (one indicator kept, one revised), built on the pipeline demo's published runs and
coherent with their discrepancy records.

## 17. Field Assignments becomes a day plan, decided 10 September 2026

SSSA rejected the assignment screen outright and approved a redesign through three mock-up
rounds. The old screen gave a visit happening this minute and a sealed visit four days out
the same gold card at the same weight, in a two column grid that scrambled their order,
repeated the reveal explanation on every sealed card, and dropped signed-off visits from
view entirely.

The screen is now a day plan on one page. Today's work sits on top at full size: an
in-progress visit shows arrival time, a live progress line (graded count, total, and how
many differ from the claim so far) and one button; a revealed visit not yet begun shows
the school and the conflict confirmation. The sealed future is a route list, one row per
visit with a calendar date tile, the district, the travel window and the desk flag count;
a row opens in place to its travel facts, the seal explanation (written once, on the row
being asked about, with only one row open at a time) and the desk flag teaser. Finished
work is one green line with the cycle's signed-off count. A day with no visit says so and
points at the next unlock rather than dead-ending.

Two SSSA decisions are recorded with it. First, wording: what unlocks is the school
information, never "the school" (an earlier instruction to say "opens" was superseded in
the same session). Second, the conflict declaration is a single confirmation: the
prominent red "I have a connection" button is removed at SSSA's direction. The stand-down
mechanism itself remains, as the terms of reference require, behind a quiet two-step link
under the confirmation (a muted line, then an explicit "Yes, stand down"); if SSSA later
wants no interface path at all, the remedy becomes administrative and that is a rules
decision to take knowingly.

AssignmentCard.tsx is deleted; the screen renders through FieldAssignmentsList, whose
sealed rows are built from the sealed assignment shape and so cannot name a school. All
dates and times on the screen render in IST regardless of the device's zone.

## 18. The field verifier's Overview becomes a tracking page, decided 11 September 2026

SSSA asked for the on-ground verifier's front door to be a one stop tracking page:
geography, assigned, pending, in progress, done, appeals. Option B of three mock-ups was
chosen: tiles as doors, then a district ledger, matching the tile pattern already approved
on the admin side so the product speaks one language.

Six tiles, each a door. Assigned (the cycle's total and its district count), Pending
(sealed or not begun), In progress (arrived, not signed off; when exactly one visit is
under way the tile opens that visit directly), Done (signed off), Appeals (with how many
wait on the SSSA; the tile scrolls to the appeal cards), and Next unlock, the one tile
that is a moment rather than a count, gold-washed, showing the next reveal time, day and
district. Under them, "Your districts": one row per district with the total and a
working-order line of what is left there (done, mid-visit, ready to begin, sealed with its
unlock day), districts with live work sorted first. The appeal cards from section 16 keep
their place at the foot under an anchor.

The old three tiles (Ready to visit, Sealed, Signed off) are gone: they counted only open
work, blurred pending with in progress, carried no geography or totals, and all led to the
same page. All dates and times on the new Overview render in IST, and the wording rule
holds: school information unlocks.

## 19. Appeals leave the Overview for a page built for volume, decided 11 September 2026

SSSA's second look at the tracking page: appeals should not be cards on the Overview, and a
page of two cards is no answer to a cycle with twenty of them. The Overview now carries only
the number (the Appeals tile, which opens the new page), and the on-ground sidebar gains an
Appeals entry whose badge is the live count of appeals still waiting on the SSSA, injected
per-request like the admin's Decisions badge.

The page itself is the case ledger at volume. Waiting appeals are pinned above everything
under their own heading with the wait shown in days, so the only appeals that can still
change are never buried under history. The decided pile reads newest first under month
headings, ten rows at a time behind a show-more button that says how many remain and from
when. Every closed row is two lines carrying its verdict chip: Upheld in full, Partly
revised, Revised (outline), or Waiting with days. Rows open in place, one at a time, the
same gesture as the Field Assignments route list.

Past five appeals a find bar appears: All, Waiting and Decided chips with counts, search
matching school name or UDISE as you type, a district filter, and a match line ("2 of 8
appeals match") with a one-tap clear, so a filtered page never masquerades as the whole
record. At five or fewer the bar does not render at all, and the empty page explains the
five day appeal window rather than dead-ending. A second guarded demo seed adds up to six
more appeals against field1's published inspections (two waiting, four decided across two
months and both outcomes) so the demo login actually crosses the find bar's threshold.

## 20. The pre-visit school briefing, and the flag names its raiser, decided 11 September 2026

Two SSSA corrections to the visit flow. First, before an inspection starts the verifier now
gets a briefing: between the workspace header and the arrival button sits "Know the school
before you walk in", six facts from the school's own record (category, management, students
on roll, classes, when the self assessment was submitted, and the claimed level split), then
the flag list as a checklist preview, each flag's reason in two words. It renders only after
the school information has unlocked and only until arrival; once the visit is under way the
flag strip and the inline notes carry the same intelligence.

Second, the word "desk" is gone from everything the field verifier reads: the strip says
"The online verifier flagged N indicators on this school", the indicator chip says "Flagged
by online verifier", the navy note block is headed "Online verifier · <decision> · ruled by
SSSA", and the sealed row's teaser and fact tile say the same. The internal pipeline keeps
its names; only the copy changed, because a person who has never heard the phrase "desk
screening" should still know exactly who flagged the indicator in front of them.

## 21. The online verifier's Overview becomes the same tracking page, decided 16 September 2026

Option A of three mock-ups, chosen with one wording correction: the first tile says
"Assigned", not "Batch", deliberately the same word the field cell's first tile uses, so
both cells' front doors read identically. Six door tiles: Assigned (masked cases allocated
this cycle), Pending (no decisions yet), In progress (decisions under way), Cleared (state
moved past desk screening), Walkthroughs (with the turnaround clock, red past due, from
enteredStateAt plus the configured turnaround days) and Frozen by escalation (with how many
of this verifier's escalations the SSSA has ruled). Under them, "Your cases": one row per
open case with its masked code, progress through the manual indicators, what the verifier
has flagged, a red chip where an indicator is frozen, frozen cases sorted first; a dashed
row carries the overflow into Desk Screening. A green line closes the page with the
cleared count.

Anonymity is carried the same way the desk queue carries it: the query selects only the
school's udise (which feeds the keyed mask and is never rendered) and its category; no
name, place, management or contact is fetched anywhere on the screen, and the codes are
the same SC codes the desk queue already shows. Every number is a live read from
AssessmentCycleRun, DeskScreeningDecision, ProgrammeConfig and the parameter register;
nothing new is recorded. The old three-tile Overview and its "start in Desk Screening"
footer are gone.

## 22. The walkthrough console holds the call still, decided 16 September 2026

Two usability fixes from SSSA's review of the console. The call pane is now sticky on wide
screens: scrolling the disputed indicator checklist no longer scrolls the video away, since
a verifier writing an observation on the eighth indicator is still on the call. And the
sidebar now highlights the entry you are working under even on detail pages that live at a
different path segment: nav entries carry alias prefixes, so the walkthrough console
(/walkthrough/[id]) lights Walkthroughs and the visit workspace (/visit/[id]) lights Field
Assignments. Before this, a verifier deep in the work saw no highlight at all.

## 23. Desk Screening becomes a deadline board, and "frozen" is renamed, decided 16 September 2026

SSSA asked what "frozen by SSSA" meant, which was itself the finding: nothing is frozen by
the SSSA. An online verifier who cannot cleanly judge an indicator escalates it; that
indicator locks and the case is held at the finish line, unable to be completed or scored
until the SSSA rules, though the verifier may keep deciding its other indicators. The case
is frozen by the verifier's own escalation, waiting on the SSSA. So the word is gone from
every verifier-facing screen: the Overview tile reads "Sent to SSSA · held until it rules",
queue and ledger rows read "N with SSSA", the case workspace reads "With the SSSA · the
case is held until it rules", and the held-case error says the same.

The queue page is Option B of three mock-ups: a deadline board. Every case is one row and
rows run in turnaround order, most overdue first, because the turnaround is the promise the
page keeps. Each row carries a due tile (red past due, amber within two days or held, navy
otherwise), the masked code and stage, a progress meter over the manual indicators, and a
meta line that turns the old bare mismatch count into the advice it always was ("start at
the 7 automated mismatches"). A case held with the SSSA shows days held rather than its
turnaround, since that clock is not the verifier's to keep while the SSSA has it. The whole
row is the door; the old five-column table and its small "Open case" link are gone.

SSSA chose this shape knowing its trade-off, recorded here: pure deadline order means a
nearly-finished case with days in hand sits below an untouched one due sooner, so "finish
what you started" loses to the clock. Option A's zoned work order remains the alternative
if that grates in use. The queue query now also returns decided counts, the SSSA-held count
and days held, and hoists the manual-indicator count out of its per-row loop.

## 24. Risk rests on the flags, not on escalations, decided 16 September 2026

SSSA's ruling while reviewing the escalation path: "the risk score will be calculated based
on the discrepancies marked by the online verifier, not by how many escalations there are."

The score was already computed almost entirely from the verdicts, each flag and automated
mismatch carrying its own weight; escalation added one flat run-level bump, ESCALATED_RUN,
on top. That bump is gone. It scored the rubric's own ambiguity as though it were the
school's risk: an indicator whose level descriptions did not cover a school's case made that
school look riskier, which is a statement about the framework, not the school. An
escalated indicator now counts exactly like any other, through whatever decision the
verifier recorded against it.

Removed with it: ESCALATED_RUN from the rubric weights type, from the weights an admin can
tune on the programme configuration screen (a lever that changed nothing would be a lie),
and from the seeded version 1 rubric. Weights are stored as JSON, so no migration was
needed. The PER_DOMAIN_WORST basis loses its escalation bump too, and the test that pinned
the old behaviour is replaced by one pinning the new rule: the score is the verdicts and
nothing else.

Note this changes scores already on the record: a case that carried an escalation scores
lower than it did before, which is the intended correction rather than a side effect.

## 25. The escalation path is removed, decided 16 September 2026

SSSA directed that the escalation path be removed in full, on the reasoning that the risk
scoring mechanism makes it unnecessary. That reasoning holds, and it is recorded here rather
than merely the instruction, because the departure from the build brief only makes sense
alongside it.

The brief states escalation as a requirement ("The verifier can escalate any case where the
rubric cannot be cleanly applied. Escalation routes to the Supervisor and freezes the case",
plus "Escalate control on every indicator" and "Escalation inbox"). It was written for a
worry that the pipeline answers another way. A desk screener never assigns a level: they
judge evidence, and the four verdicts are supports, insufficient, missing and contradicts.
An indicator the rubric cannot cleanly settle therefore already has an exact and honest
answer, evidence insufficient, and no screener is forced to record a judgement they do not
hold. That verdict then carries weight into the risk score, pushes the case toward the
threshold, and routes it to a video walkthrough and onward to a physical inspection. The
unjudgeable case reaches a person who can stand in the room and look, which is what
escalation was reaching for, arrived at by evidence rather than by a manual request that can
be forgotten.

An objection raised during the review was wrong and is corrected here: that removing
escalation would force a verifier to put a level they did not believe onto a school's
published record. Desk screening sets no levels, so it does not.

What does go is a rubric quality signal. The retired "most escalated indicator" panel existed
to find level descriptions that do not fit real schools. The same finding survives in the
data as a high rate of evidence insufficient on one indicator across many schools; recovering
it is a query, not a mechanism.

Gone from the verifier: the escalate control on every indicator, the escalateIndicator
action, the hold that stopped a case being completed and scored, and every trace of the
wait on the Overview and the Desk Screening queue.

Gone from the admin: escalations as a kind of pending decision in the Decisions inbox, its
card, the four-option inline ruling form, the "raised by online verifiers" filter on the
Verification issues tab (which now has a single source, so the filter went with it), the
"most escalated indicator" panel, the escalation share of the sidebar badge and of "ruled
this week", the getEscalationInbox and resolveEscalation actions, and the open-escalations
counters on the Workforce roster.

Gone from the field: the "ruled by SSSA" mark on a flagged indicator in the visit briefing,
which could only be produced by a resolved escalation.

Two deliberate choices in how it was removed. No data was destroyed: DeskScreeningDecision
keeps its escalated and escalatedAt columns and the rows that carry them, but nothing reads
them, so no case is stuck and no migration was needed. And the old /app/sssa/escalations
URL still redirects to Decisions, so links in existing notifications do not break.

## 26. The walkthrough queue and console, decided 16 September 2026

Queue A and Console A of the mock-ups, with the console's four-step header dropped at SSSA's
instruction. The strip had to be explained to be understood, which is the same failure as
"flagged at desk" and "frozen by SSSA"; the console already blocks every control until the
conflict declaration is answered, so the order enforces itself without being drawn.

The queue is two zones rather than one list, because it answers two questions. "Yours" is
what this verifier is committed to, with a live call pinned at the top: a green edge, minutes
elapsed instead of a deadline (while a school is on the line the turnaround is not the thing
that matters), and the only green button on the page, reading "Rejoin the call". "Unclaimed"
is the pool any online verifier may take. Deadline order inside each zone, due tiles in the
Desk Screening idiom, and every row says what the case involves: disputed indicators, or
observations made, or clips returned when the session dropped to guided capture. Unclaimed
rows also carry the risk score, which is the only thing that justifies a stranger's case
being offered.

The console keeps the pinned call pane from section 22 and rebuilds the indicator column.
A progress line runs over the disputed indicators; the indicator being asked about is the
only one at full strength, with observed ones marked and the rest stepped back, and clicking
any of them makes it current, because a school on a call jumps about and the verifier has to
follow. Each indicator says why it is disputed, the screener's verdict or the automated
mismatch, beside the level claimed. The status pills stop counting at the reader: the
connectivity pill reads "Connection steady", or names how many more drops end the call, and a
live session shows minutes elapsed.

The queue query now returns the disputed and observed counts, clips returned, the session
start and the stored risk score. Nothing new is recorded; every figure already existed.

Left open deliberately, and not built: whether a guided capture window that lapses with clips
missing should route the case to a field visit automatically or wait for the verifier. The
resolve rules already refuse a resolution while any disputed indicator lacks an observation,
so the outcome is the same either way; the question is who performs it.

## 27. The walkthrough answers in levels, and guided capture is renamed, decided 16 September 2026

Two changes SSSA directed after reading the walkthrough console.

The free text box is gone. Each disputed indicator now offers the framework's own three
descriptors plus a fourth option, "Could not check on the call". This is the instrument the
on-ground verifier already uses on site, so one indicator is judged the same way wherever it
is judged, and the walkthrough answers in the same currency as the school's claim and the
field visit rather than in a paragraph nothing downstream can compare. The verifier reads the
rubric instead of recalling it, exactly as in the field workspace.

"Could not check" is a real answer with a consequence. It records that the camera never
showed the indicator or the connection would not carry it, and it does not count as settled,
so the resolve rule refuses RESOLVED and the case goes UNRESOLVED into this year's field
cohort for a physical inspection. That behaviour is not new machinery: the rule already
refused to resolve a case while any dispute was unobserved, and this simply gives the
unobserved case an honest name.

WalkthroughObservation gains observedLevel and couldNotCheck; its note column becomes
optional and is no longer written, but old records keep their text and the console shows it
read-only beneath the picker, marked as recorded before the level picker. Legacy notes still
count as settled, so a session begun under the old design can still be resolved.

One consequence SSSA accepted knowingly, recorded because it may be revisited: with no note,
a level that differs from the school's claim carries no written reason. If that school
appeals, the walkthrough's contribution to the file is a number. Desk screening requires a
rationale for exactly this reason. The proposal on the table was one optional line shown only
where the chosen level differs from the claim; SSSA chose to build without it.

And "guided capture" is renamed "Recording tasks" on every screen. The brief's phrase
explained nothing, and the portal was already inconsistent, with the school's own screen
saying "Recording task" while every verifier screen said guided capture. Both sides now use
the school's word. The internal names, the enum and the rules module keep the brief's term.

## 28. Recording tasks becomes a page of its own, built 16 September 2026

Conducting a call and reviewing clips two days later are different jobs, and they were sharing
a queue. A case whose call dropped twice sat in Video Walkthroughs behind a gold chip, next to
cases waiting for a verifier to pick up the phone. The two are not comparable work: one is an
appointment, the other is homework that arrives on someone else's schedule. They also keep
different clocks, the walkthrough turnaround against the school's 48 hour recording window, so
a single deadline column was lying about one of them.

Recording tasks is now its own page, and a case appears in exactly one of the two queues.
The walkthrough queue filters recording cases out and says where they went, in its empty state
and beneath the list, because a case a verifier remembers must not simply vanish.

Three zones, in the order they need attention. Ready to review is every pile whose clips are
all in: the only work that can be settled now. Waiting on the school needs nothing from the
verifier and says so. Window closed short is the 48 hours passing with clips missing, which
cannot be settled from a screen. The left tile changes meaning by zone: hours left while the
school records, clips in once they are complete, clips in against tasks sent once the window
has closed.

The sidebar badge counts only the ready piles. Counting open cases would put a number there
that never moves while a school records, and a badge that does not mean "work waiting" is
noise within a week. The Overview gains a sixth tile on the same split, so the walkthrough
tile stops counting cases that are not walkthroughs.

The console adapts rather than forking. In recording mode there is no call pane, no fence and
no connectivity pill, because there is no call: the page becomes a single column with the
window's state at the top, and each clip sits under the indicator it answers, using the
parameter the recording task now carries. Clips from before tasks named their indicator are
listed together at the foot rather than filed under a guess. The fourth option is reworded
from "Could not check on the call" to "The clip does not show this", with the same
consequence: the indicator stays unsettled and the case goes for a physical inspection.

Still open, and unchanged from section 26: whether a window that lapses with clips missing
should route the case to a field visit automatically or wait for the verifier. The page now
makes the lapse visible, which is the part that was missing; who performs the routing is still
SSSA's to decide.

## 29. The school's recording screen, rebuilt 16 September 2026

Every other screen in this portal is a desk screen. This one is held by a head teacher walking
a campus with an Android phone, and it was built as though it were not.

Four things were wrong, and one of them was doing real harm.

The framework's title was the whole instruction. "4.1 Separate functional toilets for girls" is
a name, not a brief, and a verifier then sets a level from whatever the clip happens to show. A
school that films the door but never the tap has sent a clip that settles nothing, and the case
goes to a physical visit. Both sides lose to a missing sentence.

The fix needed no new content. Parameter already carries evidenceChecklistEn and
evidenceChecklistHi, transcribed from SCERT UP's own SQAAF Checklist of 8 June 2026, and the
self assessment form has been showing them for months. The recording screen now shows the same
list under "What the verifier needs to see". It is headed that way and not as a shot list
because the checklist was authored for evidence uploads: some of its items are UDISE+ entries,
which cannot be filmed and which the verifier already holds. Indicators with no published
checklist say so and fall back to the claimed level.

The school never saw its own claim. The clip exists to demonstrate a level the school itself
answered, and it could not read that answer on this screen. It now sits above the checklist, in
both languages.

A sent clip vanished behind the word "Recorded". No playback, no replacement, no way to find
out what had been sent. Filming again now simply adds another clip for the same indicator: the
latest stands as the answer, earlier attempts stay on the record and the school is told they
do, and the verifier's console already renders every clip an indicator has.

The gallery mark was applied in silence. The portal flags a video whose own timestamp says it
was not filmed just now, and the school was told this once in passing and never learned whether
its own clip had been flagged. That is a penalty nobody can answer. The mark is now on the clip,
with the one fix that helps.

Two changes behind the screen.

Freshness is judged against the moment the app took the file, not against the server's clock.
The old comparison would have marked an honest school down for having no signal: a clip filmed
at noon and sent at seven, because that is when the network came back, is not a gallery file. It
is no more trusting than the check it replaces, which already believed the file's own timestamp.
capturedAt now records when the clip was filmed, clamped so it cannot be later than arrival or
earlier than the session, and the 48 hour window is still enforced on arrival.

And there is an outbox. A head teacher walks to the far end of a campus, films a toilet block and
walks back into a dead spot; the old code threw the recording away and told them to check their
signal. The file is now written to IndexedDB before anything is attempted and removed only once
the server has it, retried when the signal returns and every half minute besides, keyed by task
so a second take replaces the first rather than queueing behind it. The queue rules are pure and
tested, following the field interface's sync queue; persistence fails soft, and where the browser
will not keep a file the screen says to stay on the page rather than promising otherwise.

Unchanged and still open, from section 26: the 48 hours runs through nights and weekends, so a
call that drops at four on a Friday gives a school about one working day. That is a rule for
SSSA, not a screen.

Departure from the mock-up, recorded because it was shown: the mock promised that a clip filmed
in time but arriving late would still count. It does not. The deadline is enforced on arrival,
because accepting a school-reported filming time would make the window enforceable only against
schools that do not know to lie about it. The screen says plainly that a clip which missed the
window cannot be counted.

## 30. Recordings fold back into the walkthrough queue, decided 16 September 2026

SSSA reversed section 28 the same day: one queue, not two. Recording tasks loses its page, its
sidebar entry and its badge, and its cases return to Walkthroughs.

The reversal is reasonable even though the split was not wrong. A recording case only exists
when a call drops twice, which should be uncommon; a whole page and a sidebar slot for what may
be three cases in forty is a lot of furniture, and one case's lifecycle spread across two
destinations is two places to lose it.

But the merge has to answer the problem that caused the split, which is that a call and a pile
of clips keep different clocks. A call runs against the seven day turnaround, a recording against
the school's 48 hour window, and one deadline column would be wrong for half the list.

Two devices answer it. The tile states the clock that governs its own row: minutes elapsed on a
live call, hours of the window while a school films, clips returned once the window shuts or the
pile is complete, days of the turnaround otherwise. And the zones sort by whether the verifier
can act rather than by which clock runs out first. "Do now" holds a live call, a complete pile
and anything overdue; "Yours, not yet started" holds calls to place; "Waiting on a school" is
quiet and says outright that nothing is needed; "Unclaimed" is the pool.

Sorting by clock alone was the option rejected. It would put "24 hours left" on a school that is
still filming above a call due in five days, although one needs the verifier and the other does
not. The question the page answers is what to do next, not what expires first.

What is lost, stated because it was a real gain: the sidebar badge. It counted clip piles that
were complete, which is the rare kind of count that only moves when there is work to do. Merged
into Walkthroughs there is no equally honest number, because open cases never fall to zero and a
badge that is always lit is ignored inside a week. The badge is dropped rather than replaced with
a number that means nothing, and the "Do now" zone carries the urgency instead. The alternative
on the table was a tabbed page, which would have kept the count; SSSA chose the single list.

/app/verifier/recording-tasks still redirects, as /app/sssa/escalations does, because the URL was
in production and a bookmark should land on the work rather than on a 404. The Overview's
Walkthroughs tile now counts the whole queue, and a second tile names the subset waiting on
schools, which is the one number on that row a verifier can do nothing about.

## 31. Filters on the walkthrough queue, and two defects a screenshot showed, 16 September 2026

Filters first, because they were what was asked for. They are deliberately orthogonal to the
zones: filtering by "what can I act on" would only reproduce the Do now heading two inches
lower. What a zone cannot answer is where the case somebody just emailed about has got to, show
me only the recordings, and what is late. So a find bar on the masked code, a route filter of
All / Calls / Recordings, and a turnaround toggle, all with counts, and a match line so a
filtered page never masquerades as the whole queue. They appear at six cases and above; below
that a filter bar is furniture. The list became a client component to make the find bar answer
as it is typed, which is the same shape as the field cell's Appeals list.

Then two defects the screenshot made obvious.

A live call printed 37,308 minutes in. The demo's live session was seeded weeks ago and never
closed, and the tile did the arithmetic without asking whether the answer was still a sentence a
person could read. It now steps minutes to hours to days, and past four hours the chip stops
saying "Live now" and says "Call left open", because a walkthrough call does not run for a
day and the thing that has actually happened is that nobody closed the session. The action reads
"Open and close it". A scheduled time in the past now reads "Missed" rather than "Scheduled",
for the same reason: the row should say what is true.

And the category on each row printed GOVT_AIDED, a raw enum. The underscores are gone, which is
the display half of the problem. The other half is not a display problem and is recorded below
rather than fixed, because fixing it is a data decision.

### The category column carries two different things, and one of them is on the forbidden list

School.category holds the grade stage for hand-seeded schools and an ownership type for the bulk
register: GOVT, GOVT_AIDED, PRIVATE_AIDED, PRIVATE. seedMockPerformanceSchools.ts already notes
the collision in a comment. Two consequences follow, and neither is cosmetic.

The masking contract is broken in spirit. maskSchool documents category as "the school's stage
... not identifying", and justifies showing it because 18 of the 89 indicators do not apply to
every stage. For most schools the value is not the stage, so the justification does not hold,
and management is explicitly on IDENTIFYING_FIELDS as a field that must never reach an online
verifier. Ownership does not name a school on its own, but the project's own rule says it should
not be there, and it is there on every row of two verifier screens.

Worse, indicator applicability is being computed from it. CATEGORY_TO_CODE maps only Primary,
Upper Primary and Secondary, and every call site falls back to PRIMARY. A secondary school whose
category reads GOVT is therefore screened against the primary indicator set. That is a
correctness defect in what gets verified, not a labelling one.

The fix is a schema change rather than a patch: a stage field separate from management,
backfilled from whatever source the register has, with applicability reading the stage and the
verifier screens showing the stage alone. It is left for SSSA to schedule.

## 32. Plainer words on the verifier and school screens, 16 September 2026

A copy pass SSSA directed, five terms wide.

  past the turnaround   →  past the deadline
  2 of 9 observed       →  2 of 9 checked
  Yours, not yet started →  Not started
  Open console          →  Open
  clip                  →  video

The rest of the vocabulary on those screens stays as it was: Do now, Unclaimed, Waiting on a
school, Call left open, Window closed short, Recording, Claim, disputed indicators.

"Clip" is the one worth explaining. It is mild trade jargon, and the person reading it on the
school side is a head teacher with a phone, not somebody who works in video. "Video" is the word
they would use, and it costs the verifier nothing to use the same one. The rename is copy only:
the outbox module, its types and the Prisma model keep clip in their names, because renaming
internals to match a label is churn that touches everything and improves nothing a user sees.

"Turnaround" went for the same reason. It is programme vocabulary, correct in a brief and empty
on a queue row; the config field videoWalkthroughTurnaroundDays keeps its name.

Four terms were proposed and refused, and the refusal is right. Walkthrough, indicator, desk
screening and appeal appear in the SQAAF framework, the brief and the configuration, so renaming
them in the interface alone would leave two names for one thing. Changing those is a programme
decision, taken once and applied everywhere, not a copy pass.

## 33. The walkthrough queue becomes a focus panel on a rail, built 16 September 2026

SSSA chose direction B after seeing the queue drawn three ways. The five faults named in that
review were real: nine identical cards, ninety pixels a row for six facts, four colour systems
per row, zones set smaller than the data they organise, and no way to see the week.

The page now answers "what now" with an answer. One case fills the left with its clock, its
code, a sentence saying why it is in front of you, and its agenda: the disputed indicators with
the checked ones ticked. Everything else compresses into a rail that still shows the whole
queue, grouped Do now, Not started, Waiting on a school, Unclaimed. The rail is clickable, so
nothing is hidden and any case is one press away, and "Skip to the next case" walks the same
order the rail reads in.

The agenda cost one query, not one per row. getWalkthroughQueue already derived each case's
disputed set; it now also fetches every parameter any case disputes, once, and maps codes and
titles onto the rows. Framework text only, so nothing about a school crosses into it.

A search field sits above, at full width. Finding a case by its code is the question asked
several times a day, and the code is the only name a case has, so it earns the width; the four
counts below it are pressable, which turns a line that was already printing them into the
filter. They are real buttons with aria-pressed and a visible focus ring, because prose that
behaves like a button and is not one is a control only a mouse user can find.

Two words changed with the layout. "4 recording" named no actor and could be read as the
verifier recording something; the filter now reads "4 videos" against "5 calls", which is
parallel and uses the word agreed in section 32. The row chip "Recording" becomes "School is
filming" for the same reason, since leaving the filter and the chip disagreeing would be worse
than either word alone.

Direction C, the week, was drawn and not built. It is at its best when the cell is in trouble
and nearly empty when it is healthy, it has nowhere honest to put an unclaimed case, and with a
seven day deadline against forty-eight hours of filming time most of what it ever draws is a
pile at one edge. It would suit a supervisor's view of the whole cell, which is a different
screen for a different person.

## 34. The district logins are retired, 17 September 2026

Monitoring and complaint handling are run from the SSSA admin, whose Monitoring and Complaints
pages already cover every district, so a separate district sign-in was a second way into work one
team does. The district credential row leaves the login page, the Official tab stops promising
district officials a way in, and prisma/seedRetireDistrictLogins.ts deactivates every
DISTRICT_OFFICIAL and DISTRICT_ADMIN account on each deploy.

Deactivated rather than deleted, exactly as supervisor1, supervisor2 and audit1 were in the
August consolidation. A district official may have answered a complaint, and deleting the user
would take the author off those timeline entries. It is also reversible in one line if districts
are staffed again.

brandHrefForRole no longer lists the district roles, so a stale session that still carries one
falls through to the admin prefix and middleware bounces it. That fails closed, which is the
same treatment the retired oversight roles get.

Two things this does not do, both stated rather than assumed. The /app/district routes still
exist; no account can reach them, so they are unreachable rather than removed, and deleting them
is a separate change. And DISTRICT_NAV_ITEMS and DISTRICT_ADMIN_DASHBOARD_NAV_ITEMS are now dead
configuration.

One consequence worth SSSA's attention. A complaint escalates on a timer through
SCHOOL → BLOCK → DISTRICT → STATE, each rung waiting out its own SLA before the next. Nothing
breaks when district logins go, because the escalation was never an action anybody took. But the
DISTRICT rung is now a tier nobody can act on, so every complaint that reaches it simply waits
out the clock before arriving at the SSSA. If districts are not coming back, that rung is delay
without a purpose and the ladder should lose it. That is a programme decision, and the ladder is
unchanged until it is taken.

## 35. Compliance folds into the register, 17 September 2026

Compliance was the register a second time. It queried all 32,579 schools, paginated them,
filtered them by district and management, and printed School, District, Block and Management
before its own column, which is the same four columns Schools already prints. Two pages, two
filter bars and two paginated queries, to show one extra fact.

The fact it showed was a profile status built from four parts: address, public contact number,
fee disclosure, and mandatory documents. SSSA's objection was that most of a profile arrives
from existing data sources rather than from the school, and that is right about two of the four.
Address and phone come from the UDISE+ extract. Once that import lands, "not started" is a
status no school can stay in, so a register-wide profile status would be measuring the import
rather than the school.

The question an official actually reads a register for is whether the school has filed its
SQAAF, and the register was already carrying the answer as an unexplained dash in the self
assessment column. That column is now headed SQAAF and says "Not submitted" where nothing was
filed; the verified column says "Not verified" on the same principle. A dash was doing two jobs,
"no score" and "never submitted", and only the second is a fact about the school.

Fee disclosure keeps the column it already had on the register. Mandatory documents are no
longer reported across the register: SSSA was asked where they should go, given that they are
the one compliance fact no external source can supply, and chose to drop them. They stay visible
on a school's own record, so the cost is that nobody can ask which schools hold no fire safety
certificate without opening them one at a time. Recorded because it is a real loss and a
deliberate one.

/app/sssa/compliance redirects to the register, for the same reason /app/sssa/escalations and
/app/verifier/recording-tasks still redirect. src/lib/sssa/compliance.ts is deleted rather than
left unreferenced; the school's own profileStatus.ts keeps the four-part rule and its comment no
longer points at a file that has gone.

## 36. The blocks furthest behind move to Monitoring, 17 September 2026

A table of blocks with a chase button is monitoring, not a register of schools, and it was
sitting behind a tab on the Schools page. It moves to Monitoring, which already reported a
weaker version of the same thing.

That weaker version was the exception group silent-blocks: blocks with no submissions at all,
over Block, District and Schools, and no way to act on any of it. Furthest behind counts the
same blocks, ranks them by how many schools have not started rather than only finding the ones
at exactly zero, and carries the reminder. So it replaces that group rather than joining it, and
Monitoring keeps four cards.

Both now read buildBehindBlocks, so the card's count and the table beneath it cannot disagree.
Two definitions of "behind" in one page is how a heading comes to contradict the rows under it.
Removing the old group also removed three queries that nothing else used.

The exception table could not hold a Remind button: its rows are a record of strings and
numbers, with nowhere for a control. ExceptionMonitor now takes a slots map, so a group can hand
in a panel that renders itself. BehindBlocks is server-rendered on the page and passed in as a
node, which keeps the data fetching where it was.

Schools loses its tab strip. With Furthest behind gone and Compliance folded in the day before,
the register is the only view left, and a strip with one tab is furniture. SchoolsTabs is
deleted. The district select inside the block table no longer writes tab=behind, which would
have been a dead parameter on a page with no tabs.

## 37. The register gets one grade column and six filters, 17 September 2026

Two changes SSSA specified together.

### One grade, and who gave it

The table was carrying Self assessed and Verified as separate score columns. It now carries
SQAAF, which is the band the school sits in, and Status, which says whether that band came from
the school or from a verifier.

The verifier's figure wins where there is one. That is what makes a single column possible:
once a verification exists, the school's own claim is no longer the answer to "where does this
school stand". Status is what keeps the merge honest, because Utkarsh claimed and Utkarsh found
are not the same fact. Verified is solid, Self-assessed is outlined, and a school that has not
submitted shows a dash, because there is no assessment for a status to describe.

SQAAF shows the band as a coloured pill with the score small beneath it: the band is what an
officer reads down a page, the score is what they check once a row catches the eye. "Not
submitted" sits in the same column as a fourth value, in grey, because it answers the same
question.

What this gives up is the ability to see a school's own score beside the verifier's. A school
claiming 74 that a verifier scored 51 now reads as one Uday row. That analysis is Monitoring's:
it carries an exception group for schools where the two differ by fifteen points or more, and
that group is now the only place the disagreement is visible.

### Six filters above the table

Search, District, Block, Management, SQAAF, Status. One control per column the register can be
asked a question about, in column order. Fee has a column and no menu by SSSA's choice: worth
seeing on a row, not a question asked of all 32,579.

Block is built from the chosen district rather than listing 826 at once, and is disabled until
a district is picked, which says why it is empty without a sentence. Changing district clears
the block, because a block from the old district would filter every school out and read as an
empty register. Any change resets to page one, since page seven of the old result set means
nothing in the new one.

District, block and management filter in the query. SQAAF and Status are derived from the
scores, so they filter after the rows are built; the page already fetches the whole match set
before slicing a page out of it, so the count stays right. The count names both numbers when
anything is in force, because a filtered register that still reports 32,579 is lying about what
is on screen.

The bar replaced the public DirectoryFilters component, which rendered two of the five selects
it supports and had to be told to hide the rest. category, type and performance are still read
from the URL, because other pages link in with them, but they have no control here.

## 38. Field Cohort becomes a step in the year, and a recusal stops losing the school, 17 September 2026

Asked what the Field Cohort tab was for, the honest answer was that the screen did not say. It
opened on an amber box about whether 33% means 33% of the register or 33% of the year's intake,
then showed four counts, a list of raw district codes and a button labelled "Build cohort". It
never stated what the button did, and it looked identical before and after the press.

Two defects were found alongside the design problem, and both are fixed here.

### Pressing the button twice created a second visit for every school

`loadCandidates` selected runs in `CENSUS_QUEUE` **or** `FIELD_COHORT`. `buildCohort` created a
`FieldVisit` unconditionally for everything the plan selected. `FieldVisit` has no unique key on
`runId`, and `transitionRun` treats a `FIELD_COHORT` to `FIELD_COHORT` move as a silent no-op, so
nothing downstream refused it. A second press would have given thousands of schools two visits,
likely to two different verifiers, each holding a sealed card for the same school.

The candidate query now excludes any run that already carries a visit of any kind
(`fieldVisits: { none: {} }`). Drawing again adds only schools that have joined the queue since,
which is the behaviour the screen now states in words.

### A recusal silently dropped the school out of the year

`recusedAt` was written and nothing read it. Every other query in the app filters recused rows
out, so the school left the cohort with nobody told, while the verifier's own card said it was
"waiting to be reassigned". Nothing was going to reassign it.

Standing down now hands the visit on. `placeReplacement` writes a **new** visit row pointing back
at the recused one through `replacesVisitId`, rather than mutating it: who was sent, who stood
down and who went instead all stay on the record, which is the first thing an integrity question
asks about. The replacement goes to the eligible verifier carrying the fewest open visits, never
to anybody who has already stood down from that school, and never today, because a recusal is
normally declared at 07:00 on the morning of the visit.

Least-loaded here, round-robin in the draw. They are different decisions: the draw allocates the
whole year at once, where round-robin is already even, and a replacement allocates one, where the
fair answer is whoever is carrying least.

When nobody is left, the school appears on the verification year screen with a per-row picker.
The list is deliberately not paginated: a list long enough to need a pager is not a paging
problem, it is a field cell too small for the cohort that was drawn.

### The tab becomes a row

Field Cohort was a permanent sidebar item for a button pressed once a year. It is now a row in a
**Verification Year** screen, in its place after self assessment, desk screening and walkthroughs
and before field visits and publication. Before the draw the row carries the button; after it, it
carries the date, who pressed it, the travel window and anything still unplaced. The draw screen
lives on at `/app/sssa/cohort`, reached from that row, and the year owns its highlighting.

`CohortDraw` records the press: cycle, actor, window, selected, created, unassigned. Stored
rather than inferred from the visits it produced, because a count of visits cannot distinguish a
cohort the Authority drew from schools the walkthrough fast-tracked in one at a time.

### The draw screen says what it does

The first block on the screen is now three numbers with sentences attached: how many schools
move, how many visits are created, and how many are in districts with nobody rostered to visit
them. District load carries names, a bar and the verifier count beside it, because a cohort
correctly sized statewide is still undeliverable in a district drawing three times its share, and
unreadable as `D001`. The percentage argument is the last line on the page, which is its weight.

Districts with no verifier are counted at district level only. Block-level and school-level
exclusions are per-school facts; the draw reports what it actually skipped rather than the
preview guessing at it.

"Build" became "draw" throughout, including the typed confirmation. Build named the machinery.
Draw names what is happening to the schools.

## 39. Reporting retires and publication stops needing a button, 17 September 2026

SSSA asked for the Reporting tab to go, on the grounds that results publish themselves: a score is
visible once a school finishes its self assessment, and verification revises it afterwards.

The tab held two unrelated things, and the reasoning covered one of them.

### What was already true

The public school profile never read the run state or `Result.publishedAt`. It reads what the
school entered plus a verified badge derived from whether a verification submission exists. So
scores were already visible without anybody pressing anything, exactly as described.

### What was not

The button was the only thing that recomputed a score from the verified record.
`computeVerifiedResult` runs on the transition into `PUBLISHED`: it takes the school's claims and
replaces every indicator where a supervisor upheld a discrepancy, and for a non-submitter it uses
the field verifier's observed levels instead. Nothing else writes a corrected `Result`. Deleting
the tab and stopping there would have frozen every public score at its self-claim for good, which
is the opposite of "the score updates automatically after verification".

Raised before building. SSSA's answer: make publication automatic, and drop the district tables
as well.

### Three of the four paths already published themselves

A field visit signed off with nothing raised goes straight to `PUBLISHED`. A supervisor's ruling
on the last discrepancy publishes the run, whether the school's response window was used or not.
Only the census queue needed a person.

### The rule that replaced the button: the draw is the cut-off

A school sits in the census queue because desk screening found nothing worth a walkthrough, or
because its walkthrough resolved. Its verified record is therefore its own self-assessment, and
the only thing still undecided is whether a field verifier will turn up. The draw decides that.

So anything not selected publishes at the draw, and anything reaching the queue after the draw
publishes on arrival. Both halves are needed: publishing only at the draw strands every school
screened after it, and publishing only on arrival empties the pool the census rotation draws
from. The second half is possible because `CohortDraw` exists, which section 38 added for a
different reason.

At full state volume the draw-time sweep is a long loop in one request, the same shape as the
draw's own allocation loop beside it. Both belong in a job queue before this runs against
2,65,278 schools for real, and the project has no scheduling infrastructure yet.

### What went

`/app/sssa/reporting` is a redirect, the sidebar entry is gone, and `PublishControl`,
`publishCensusQueue`, `getStatusReport` and `getPublicationOverview` are deleted. `publishResults`
in the finalization actions went with them: it was already unreachable, and it was the last bulk
writer of `Result.publishedAt`, which the automatic path now sets per school on its way through.

Removing it did leave `Cycle.resultsPublished` with nothing to set it, so the verification year no
longer reads that flag as its state. A year is complete when every run in it has a published
result, derived. The old flag is still read as history, so a cycle from before this change still
counts as complete if somebody threw the switch.

## 40. Workforce absorbs three screens, 17 September 2026

Four sidebar entries became one. Workforce now carries the KPIs, the assign button, the schools
nobody is going to, and a filterable verifier table whose rows open a page per person. Quality
Sample, De-empanelment and Verification Year are redirects.

### Why the two oversight tabs folded in

Both were whole-roster screens answering a question about one person. You arrived at Quality
Sample already knowing whose work you wanted to read, then looked for them in a list of
everybody; the de-empanelment board was the same shape. Under a verifier's own name, the sampled
work and the standing against the removal rules sit beneath the caseload they are judgements
about, which is the order somebody actually reads them in.

What that loses is the cross-roster reading, and the table keeps the part of it that was doing
work: a flag count per verifier, and a row that says "Removal recommended" when either rule has
triggered. What it does not keep is reviewing the week's sample as a batch. Named here because
it was a real capability and it is gone, not overlooked.

The weekly draw itself is untouched: still seeded on the server, still redrawn on Monday, so a
verifier cannot predict which of their cases will come up. A verifier's page shows the part of
this week's draw that is theirs, with the verdict control on it. Without that the page would
have shown a sampled-work section that could never fill and a flag count that could never move.

### Why Verification Year went, a day after it was built

Section 38 gave the cohort draw a home with a visible before and after, which it needed. It did
not need a tab: the draw is the act of putting schools on field verifiers, so it belongs where
the verifiers are, and the schools left with nobody are a staffing list rather than a stage in a
timeline. Both are on Workforce, with the draw screen still at `/app/sssa/cohort` behind the
assign button.

The stage-by-stage view of the year did not survive the move. The four KPIs answer how far the
year has got in aggregate; which stage is backed up they do not answer. Dropped on SSSA's
instruction, recorded here rather than left to be discovered.

### The district filter answers "can work there", not "is listed there"

An empty roster means statewide everywhere else in the code, so a filter that read the narrower
question would return nothing for exactly the district that has nobody rostered, which is the
district you were looking at it for. The cost is that where nobody has a roster the filter
returns everybody, so the column says "Statewide" on every row and the count line says the
result includes statewide staff. No seed sets district rosters, so on the demo that is every
verifier.

### The assign panel is the Authority's

`previewCohort` returns nothing to a supervisor, and a panel reading "nothing is waiting" off a
null would be a statement about the queue rather than about their permissions. The panel renders
for SSSA_ADMIN only.

## 41. The risk drift monitor is removed, and the brief requirement with it, 17 September 2026

The brief asks for a "risk algorithm drift monitor: distribution of risk scores over time,
flagging shifts for referral to the platform vendor" (BUILD_BRIEF section on the supervisor
screens). It was built, and it is now gone: the page, the pure module, the server action, its
tests and the sidebar entry.

Recorded here at length because this is the first requirement in the brief the build
deliberately does not meet. It is a decision, not an omission.

### What was wrong with it

Four faults, surfaced when SSSA asked what the tab did.

**It truncated to the oldest data.** The query took 20,000 scores ordered by date ascending. At
the brief's volume of 88,426 screenings a year that is under three months, and it never
advanced: the page would have shown early 2026 for ever while the months anybody wanted were
discarded.

**It would have reported SSSA's own rubric changes as vendor drift.** Every score stores the
rubric that produced it, precisely so a reweighting cannot silently move a decided number. The
drift query ignored that column. Reweight the rubric and every later month legitimately shifts,
and the page would have told the Authority to refer its own deliberate change to the vendor.

**Its baseline went deaf.** Cumulative with no window, so the longer it ran the less a single
month could move it. A detector that loses sensitivity with age is backwards.

**One remedy for three causes.** A shift means the schools changed, the screeners changed, or
the inputs changed. The page named the vendor for all three, and had no record of a flag having
been seen, so a shift referred in March would still be shouting in December.

### What was offered and what was chosen

Three options were put to SSSA: move the detection into Monitoring as an exception group and fix
it on the way; delete it outright; or keep the tab and repair it. SSSA chose to delete it
outright.

So nothing now watches the screening algorithm for drift. If the rubric's behaviour changes,
whether because the schools changed, the screeners drifted or a UDISE+ feed changed shape,
nobody is told. The risk score itself is untouched and still routes every case between the video
walkthrough and the census queue; only the monitoring of its distribution is gone.

`RiskScore.band` survives the removal. It was read by this screen, and it remains the readable
form of a number nobody wants to compare by eye.

## 42. Integrity reports fold into Complaints, 17 September 2026

Two queues become one list with four filters: search, district, complaint type, and who raised
it. Integrity Reports leaves the sidebar; `/app/sssa/integrity` redirects.

### Why one list and not two tabs

They are different objects. A Ticket is filed on the public form against a UDISE code, carries
`nextDueAt` and a `handlerLevel`, and climbs a level on its own when a deadline passes. An
IntegrityReport is filed by somebody in the verification workforce about inducement or pressure
and carries neither a clock nor a ladder, only whether the Authority has acknowledged it.

But they are the same question for whoever opens either page: what has somebody objected to, and
what is waiting on me. Two tabs made that a navigation decision taken before the question was
asked, with three rows behind one tab and a hundred and fifty behind the other.

Drafted first as two tabs split by who the complaint was about. SSSA rejected that split, and was
right to: the useful cut is who raised it, not who it names.

### Treating inducement as a complaint type is what makes it work

Given a category of its own, "Inducement or pressure" flows through the type filter and the
category bars with no special case, and the only place the two kinds differ on screen is the
status cell: an escalation level and a deadline for one, acknowledged or not for the other. Both
are stated on the page, because with two kinds of urgency in one list the sort order stops being
self-evident. It reads past-deadline first, then reports waiting on the Authority, then oldest.

### "Raised by" filters the group, not the words

`Ticket.submitterRole` is free text a member of the public types about themselves. A menu built
from that column would list every phrase anybody had ever used, so the filter offers the source
instead: the public, or a verifier.

There is no option for a school, because a school cannot raise a complaint. Its Complaints tab is
where it answers complaints filed against it; it can appeal its own verification and reply to
proposed corrections, but both argue about its own score. A school with something to say about a
verifier has nowhere to say it. The option was drawn in the mock-up and dropped on SSSA's
instruction rather than left as a menu entry that can never match anything.

### A report now has somewhere to go

The old inbox showed the paragraph and offered one control: acknowledge. Acknowledging a report
of a bribe and then having nowhere to go is not a process, so a report has its own page under
Complaints, and that page links through to the subject's record on Workforce, where their sampled
work and their standing against the removal rules are.

The page also states that the report is not anonymous. The reporter is named on the record, which
was true before and said nowhere, and matters most to somebody reading a report about their own
supervisor.

### Access is unchanged

Both screens were already gated to the audit function and the Authority, so the merge grants
nobody anything new. What changes is attention: these reports now sit in a list somebody opens
weekly rather than one nobody opened.

### Still outstanding on this page

The escalation ladder still routes to DISTRICT, and district logins were retired in section 34. A
complaint escalating to that rung sits with nobody until it escalates again. Raised twice, not
yet ruled on.

## 43. The walkthrough queue says what happened, in a sentence, 17 September 2026

The queue built in section 33 as a focus panel on a rail was rejected as hard to navigate. Three
alternatives were drawn and SSSA chose the sentence list.

### What was wrong with it

**Nine hex codes were the only name a case had.** `SC-AC5DFCAA55`, `SC-B4EFCD300B`,
`SC-E1537174D4`. Choosing between rows meant decoding ten characters and holding them in your
head. The masking rule means a school cannot be named on this page, and that is not negotiable,
but nothing required the code to be the thing the row led with.

**The rail and the panel were the same nine cases twice**, side by side, competing for attention.
"START HERE" was the screen admitting it did not know which a person would read first.

**Two clocks in identical type.** "26 days open" and "26 days over" sat in the same position
looking the same. One is age, the other is lateness.

**Everything was red.** Six of nine past the deadline, so red had stopped being a signal and
become the background.

**A three line policy paragraph** under the heading, about risk thresholds and turnarounds, read
once on somebody's first day and skipped ever after, pushing the work below the fold.

### What replaced it

Each row leads with what happened, written out: "The filming window closed with 11 clips never
sent." The code drops to the line beneath, shortened to four characters with the whole thing on
the tooltip and in the console, and search still matches it in full.

The clock states its own unit rather than sharing a column. A case on the call route counts days
against the seven day turnaround; a school that is filming counts hours of its forty-eight. One
column of days would be wrong for half the list, which is what split these into two pages in the
first place.

Red now means one thing: this needs you today. A live call, a closed window, a missed call, and a
filming window inside its last eight hours. Not "overdue", which on this backlog is most of it.

The sentence, the clock, the button and the sort order are one pure module with eighteen tests,
because they are rules about the state machine rather than layout. The ordering is by what the
verifier can act on, not by which clock runs out soonest: a school still filming would otherwise
sort above a call somebody needs to join now.

### What the mock-up did not cover

An unclaimed case. It keeps its sentence, because that is what tells you whether to take it, but
sinks below everything claimed and offers Claim rather than an action it cannot perform.

### Still wrong on this screen

The line reading "Govt" under the case code is a masking leak. `maskSchool` returns `category`
believing it holds a stage, but for bulk-register schools that field holds ownership type, and
management is on the list of fields an online verifier must never see. The fix is written in
`src/lib/schoolStage.ts` with sixteen tests and wired to nothing, pending a decision. *Closed the
same day, in §44.*

## 44. The masking leak is closed, and applicability stops guessing, 17 September 2026

### The leak

The last section ended by naming it: the line under a case code on the desk queue read "Govt".

`maskSchool` returned two fields, the masked code and `School.category`, on the understanding
that category held a teaching stage. It does for the 21 hand-seeded schools, which carry
"Primary", "Upper Primary" or "Secondary". It does not for the 32,357 the bulk register supplied,
which carry "GOVT", "GOVT_AIDED", "PRIVATE_AIDED" or "PRIVATE" in the same column: an ownership
type, already stored properly in `School.management`, and `management` is on `IDENTIFYING_FIELDS`
precisely because who runs a school is not something an Online Verifier may be told.

So the enumerated test that guards `MaskedSchool` passed while the leak ran, because it checks
that no field is *named* `management` and the value was arriving under a different name.

### The second half of the same defect

Seven copies of a category-to-code map read that column to decide which of the 89 indicators
apply, each ending `?? 'PRIMARY'`. Two of the demo seeds carried an eighth and a ninth. Every
bulk-register school missed every one of those maps, took the silent fallback, and was measured
against primary's paper. Eighteen of the 89 indicators are stage-specific, so this is not a
cosmetic mismatch: it changes what a school is judged on, and nothing anywhere said it had
happened.

### What changed

`School.stage` is a new nullable column holding PRIMARY, UPPER_PRIMARY or SECONDARY, and it is
the only thing applicability reads now. `src/lib/schoolStage.ts`, written earlier and until now
wired to nothing, is the single place the stage is derived and the single place the fallback is
applied.

`maskSchool` takes `{ udise, stage }` and returns a label. A school with no recorded stage reads
"Stage not recorded" rather than passing as primary, because "I do not know which paper this is"
is information a screener needs. `category` has been added to `IDENTIFYING_FIELDS`, so a future
select of it into a masked payload reads as the leak it would be, and the regression test asserts
that an ownership value cannot come out of `maskSchool` at all.

The nine maps are gone. Seven in the application, two in the seeds, all replaced by
`stageCodeFor(school.stage)`.

`prisma/backfillSchoolStage.ts` fills the column from the school's own declared class range
first, then from the legacy category where that names a stage. It runs in the build chain after
the enrolment seeds and before anything that computes a result.

### What deliberately did not change

No stored score moves. `STAGE_FALLBACK` is still PRIMARY, so a school the register cannot place
is measured exactly as it was yesterday. The difference is that the backfill prints how many
schools that is, every build, instead of the number being an accident of a lookup miss. On the
current register that count is most of the 32,357, because the bulk seed records an ownership
type and no class range, and nothing in the portal can honestly derive a stage from that. The
fallback is now a stated assumption rather than a hidden one.

`School.category` stays in the schema, annotated as legacy, because older screens and seeds still
write it. Nothing reads it for applicability or masking any more.

### Two things found on the way, not fixed

**The field briefing printed the same fact twice.** "Category" and "Management" sat next to each
other in the pre-visit briefing, and for a bulk-register school both said GOVT. The briefing now
shows Stage, which is the fact a verifier walking in actually lacks. This one is fixed; it is
listed here because it was not part of the leak.

**`mustSeeMaskedOnly` returns true for the legacy `VERIFIER` role, and that role's dashboard
shows the school's name, UDISE, district and category in a table.** `verifier1 / verifier123` is
a live seeded login. Either that dashboard should not exist, or `VERIFIER` should not be on the
must-mask list. It is a real contradiction, it predates this change, and it wants a decision
rather than a guess.

## 45. The walkthrough queue splits into three tabs, 17 September 2026

SSSA asked for one list to become three piles: cases where a time still has to be agreed with the
school, cases with a call booked, and schools that have sent video. Three options were put up —
tabs, three stacked tables, one table with grouped rows — and tabs were chosen.

### Why splitting at all is right

The three barely share a column. A case nobody has spoken to has a risk score, an age and no
window. A booked call has a time and no clips. A recording case has a filming window and no
appointment. A single table across all three means either a column of empty cells for two thirds
of the rows, or one State column doing the work of four, which is the sentence-per-row list
from §43 with extra furniture.

Worth recording that these are not three independent queues. They read left to right as a
pipeline: a case starts with no time agreed, becomes a booked call, and reaches the recording
route only when that call drops out on connectivity. Nothing lands in Recordings without having
been in Booked first.

### The three states the brief's three buckets did not cover

Each has a row in the current demo, so none of this is hypothetical.

**A call running now.** Not waiting for a time, not a future appointment. It is the most urgent
row on the page and it belongs to no bucket. It sits under Booked, which is where the verifier
who agreed it would look.

**Filming started, nothing sent.** On the recording route with no video to review.

**Window closed with clips missing.** Nothing more is coming; the case cannot be reviewed and
goes to the field.

All three filming states stay in Recordings, along with the one that worked. A verifier asking
"what are my schools recording" should get every case, not only the ones that succeeded.

### What was done about the cost of tabs

Tabs hide two thirds of the work, and would have hidden the live call with it. That was named
before the choice was made and two things answer it, deliberately no more:

Every tab carries its count, and the count turns red when that tab holds something needing the
verifier today. It is the only thing that can carry urgency across a tab boundary.

The page opens on To schedule every time except one: when a call of the verifier's own is live,
it opens on Booked. One exception with one reason, so the default stays predictable rather than
chasing whatever is most urgent that minute. Somebody else's live call does not move it, because
that is a case this verifier cannot join.

A missed call goes back to To schedule rather than staying under Booked. The session row still
reads SCHEDULED, but no time is agreed any more and the only move is to agree another one.

Search runs across all three tabs and the counts show matches per tab, so a case in a tab you are
not looking at announces where it is instead of reading as no result.

### Where the rules live

`src/lib/verification/walkthroughTabs.ts`, with sixteen tests, for the same reason the sentence
module exists: which tab a case belongs to and which tab opens are rules about the state machine,
not layout. One test asserts every one of the five session states lands in a tab, so a state added
later cannot quietly fall through the page.

## 46. Red on the walkthrough queue is narrowed to what can be acted on, 17 September 2026

§43 said red would mean one thing, this needs you today, and named the screen it replaced for
printing every overdue case in red on a backlog where six of nine were late. The code did not
deliver that. `pressing` was set to `facts.overdue` for a case nobody had started and for a call
booked ahead, and on a register where every case is twenty to twenty-seven days past the
turnaround that is almost the whole list. The first screenshot of the tabbed build showed all
three tab counts red and every visible row carrying a red edge: the fault named in §43, back,
under a description claiming it had been fixed.

The description was wrong about the code rather than the code wrong about the description, and
the way to find that was to look at the screen against real data rather than to read the module.

SSSA chose the narrow reading. `pressing` now covers four situations and no others:

- a call running now, or one started and never closed;
- a call the school missed and has not rebooked;
- a filming window that has closed;
- a filming window inside its last eight hours.

Every one is something a verifier can act on this minute. A case nobody has started is not,
however late it is, because booking a call needs the school to agree a time. A call booked for
Thursday is not, because until Thursday it is the school's turn.

Lateness has not been hidden. It keeps its own column, in red, in a column headed Deadline where
lateness is what the column is about, and the sort still puts the longest wait first inside a
band. What changed is that being late no longer competes with a call ringing.

Two tests hold the line: an untouched case twenty-six days over is not pressing but still reports
"26d past the deadline", and an overdue case with a call booked ahead stays unpressing.

Worth being plain about what this does to the demo: it does not turn the tabs quiet. To schedule
still reads red while it holds a missed call, and Recordings while it holds a closed window, both
of which are correct. The change is that being overdue alone stops painting a row.

## 47. The state dashboard leads on completion, and districts rank on it, 18 September 2026

### How this was arrived at

Eleven mock-ups were rejected before the brief became clear, which is the useful part of the
record. The first six varied the concept (operations console, three questions, repaired
scorecard, a time-led status screen, the verification pipeline, a district league table) and all
six were wrong. Asking which axis was wrong produced the answer in one exchange: the look did not
match the portal, the information was wrong, and the one thing the page is for is how far the
cycle has got.

The lesson worth keeping: the mock-ups were built in an invented visual language rather than the
portal's own tokens, which made every one of them read as somebody else's product. Reading
`globals.css` and `StateDashboard.tsx` for the real values should have been the first step, not
the seventh.

### What the page carries now

In the order SSSA gave it: schools that have finished their self assessment, then the state
average score, then the four counts, then districts ranked, then management type, then a way
through to the highest and lowest scoring schools.

**The banner leads on completion.** The score is roughly stable week to week; completion is what
the Authority is asked about. Both sit in the same navy strip, so neither needs its own furniture.

**The four counts sum to the register.** `verified` is Result rows carrying a final score, which
is deliberately the same set the average is computed from. A page that averaged one population
and counted another would contradict itself twice over. `buildCycleCounts`, which Monitoring and
the Schools funnel use, counts VerificationSubmission instead; the two agree in normal running,
and this definition is the right one here because of what sits beside it.

**Districts rank on self assessment finished, not on score.** A district that has not finished is
a district somebody has to chase; a district's average is not something the Authority acts on
directly. The score stays as a column so the ranking can be read against it. Top ten and the
bottom one, so the range shows without 75 rows.

### Three decisions inside that ranking

Districts with fewer than five schools are not ranked. This matters more on a completion ranking
than it did on a score one: two schools, both finished, would otherwise sit above every district
in the state at a permanent 100% while representing nothing.

Ties are broken by the larger district first. Finishing 431 of 438 is a bigger piece of work than
finishing 20 of 20, and a ranking that put the small one above it would send the Authority to the
wrong place. A remaining tie breaks on name, so the order is stable between requests rather than
shifting with whatever the database returned first.

One cell carries the ranking: the share finished, the fraction underneath, and a bar. The first
draft had Schools, Finished and a bar as three separate columns, which SSSA read as three
finished columns, correctly: they were the same fact three times across the row.

### The two things that were wrong on the old page

**Coverage read 100% at 99.6%.** 32,440 of 32,579 rounded up, so the page reported the job
finished while 139 schools were outstanding. Coverage is now stated as a count and a percentage
to one decimal.

**The single highest and lowest scoring school are gone.** One row at each end of 32,440 is
almost always a data artefact rather than a school anybody would act on: the old page printed one
at 100 out of 100 and one at 0. The card is now two doors into the register, filtered to the top
and bottom bands, which answers the same question with a population rather than an outlier.

**The management ranking stays**, at SSSA's explicit instruction after it was raised twice. It
now prints the spread underneath: a numbered list reads as a gap and across 32,000 schools there
is not one, so the card says "0.3 points separate first from third" rather than letting the
ranking imply otherwise.

### Known behaviour worth stating

The district ranking only does work while districts are unfinished. On a register where every
school has finished, it is a 75 way tie at 100% and the four counts read 0, 0, and the remainder.
The table earns its place for most of a cycle and goes flat at the end. That was put to SSSA with
the mock-up and accepted.

Ranking rules live in `src/lib/sssa/districtRanking.ts` with fourteen tests, because the minimum
size, the tie-break and the clamping on the four counts are decisions rather than arithmetic.

## 48. The banner becomes a ring, and the page gets one vocabulary, 18 September 2026

### The banner

Four treatments were put up. SSSA chose the ring.

What was wrong with what it replaces: two figures at 46px side by side, which means neither is the
headline, and no indication of proportion at all. Completion is a share of a whole, and 26,563
says nothing without 32,579 beside it. A reader should not have to divide.

The ring carries the share, the count sits beside it at 40px, and the average score drops to 36px
on the right of a rule. The two numbers now have an order rather than competing. It is also the
only one of the four that does not grow when the figures get longer, which matters on a page whose
numbers run to five digits.

### The vocabulary, which was the worse fault

The first build of this page used four vocabularies, and one of them collided with the rest of the
portal on meaning rather than on wording.

**"Finished" named two different populations.** `CycleFunnel`, on Monitoring and the School
Directory, uses it for schools that have sent a self assessment and not yet been verified. The
dashboard banner used it for schools that have sent one at all, verified included. One word, two
sets, two pages.

**The schools card carried two vocabularies inside one card**, four rows tall: the chips read
Highest and Lowest, the rows read Utkarsh and Uday.

**A grade band was "Band" here and "SQAAF" on the register's own filter.** Same thing, two names,
and the register is where a reader goes next.

**"Avg score" against "State average score"**, and **"scored" against "verified"** for the same
set of schools.

Settled, and the page now holds to it: *finished* means a self assessment has been sent, whether
or not anybody has checked it. The bucket for sent-but-unchecked is *awaiting verification* and
never *finished*. A grade band is a *SQAAF grade*. A school carrying a verified score is
*verified*, never *scored*. Nothing is abbreviated in one place and spelled out in another.

The two doors read "Top schools in the state" and "Bottom schools in the state", with the grade
and the count underneath, which is SSSA's wording.

### Still outstanding

`CycleFunnel` still calls its third bucket "Finished", which is now the one place in the portal
where that word means something narrower than it does here. Renaming it to "Awaiting verification"
would settle it, and it touches Monitoring and the School Directory, so it was raised rather than
done.
