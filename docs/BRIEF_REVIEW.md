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
