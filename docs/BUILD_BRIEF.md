# Build brief: UP SQAAF Verification Portal

> Supplied by SSSA, 20 August 2026. Kept verbatim so the spec stays with the code.
> Findings from reviewing this brief against the source documents are in
> [`BRIEF_REVIEW.md`](./BRIEF_REVIEW.md). Where the two disagree, the review records
> what was checked and against which source; it does not amend the brief.

## 0. What you are building

A web portal for the Uttar Pradesh State School Standards Authority (SSSA) that verifies whether a school's self-reported score under the School Quality Assessment and Assurance Framework (SQAAF) matches its actual position on the ground.

Scale to design for: 2,65,278 schools submitting a self-assessment each year. Roughly 33% of them, about 87,500, receive a physical visit each year. Every screen, query and list must assume this volume. Do not build a pilot-shaped app.

Build the full working application, not a click-through mockup. Seed data must be realistic in volume so pagination, search and queue behaviour are actually exercised.

## 1. Stack

Assume unless told otherwise:

- Next.js (App Router) with TypeScript
- Tailwind CSS
- PostgreSQL with Prisma
- Auth with role-based access control, session-based
- File storage abstracted behind a single interface so the storage backend can be swapped later
- Deployment target: Vercel

Do not add a component library that imposes its own visual identity. Build components against the palette in Section 9.

## 2. The verification flow

Implement exactly this state machine. Each school has one `AssessmentCycle` record per year, moving through these states.

1. **SELF_ASSESSMENT_OPEN**. School rates itself on every applicable SQAAF indicator and uploads evidence.
2. **SUBMITTED** or **NOT_SUBMITTED**. On deadline, non-submitters get an automated reminder and a configurable extension. If still not submitted after the extension, the cycle moves to **NON_SUBMITTER** and the school is pushed to the priority field list.
3. **AUTO_CHECK**. The portal runs automated cross-matching on the subset of indicators that map to external data sources (Section 4). Produces a set of `AutoCheckResult` rows: MATCH, MISMATCH, or NOT_CHECKABLE.
4. **DESK_SCREENING**. An Online Verifier reviews every indicator: the MISMATCH rows flagged by the system, and every NOT_CHECKABLE indicator by reading the evidence the school uploaded and judging whether it justifies the level the school claimed. The verifier's per-indicator decisions plus the automated mismatches together produce the risk score (Section 5).
5. **Risk decision.** If risk is above threshold, go to **VIDEO_WALKTHROUGH**. If not, go to the census queue.
6. **VIDEO_WALKTHROUGH**. Live, geofenced, unedited video walkthrough conducted by the Online Verifier. Verifier records observations against each disputed indicator, then marks the case RESOLVED or UNRESOLVED.
   - RESOLVED: school joins the census queue for its normal turn.
   - UNRESOLVED: school is fast-tracked into this year's field cohort.
7. **COHORT_BUILD**. SSSA builds the yearly field cohort at the configured percentage. Order of the queue: fast-tracked unresolved cases, then non-submitters, then census-queue schools due by rotation.
8. **FIELD_VISIT**. Day-of-inspection reveal (Section 7). On-Ground Verifier visits, verifies every indicator, runs the student spot-check, records findings with photos and geotags, signs off the same day.
9. **DISCREPANCY_REVIEW**. Where findings do not match the self-assessment, the discrepancy is flagged and the score corrected with evidence attached.
10. **SCHOOL_RESPONSE_WINDOW**. Configurable window in which the school may view the proposed correction and file a written response with evidence, before publication. See Section 8. This step is not in the source documents. Build it behind a feature flag, default ON.
11. **PUBLISHED**. Verified score is published. The school is marked not due for a physical visit for the configured revisit interval.
12. **AUDIT**, running in parallel. A random sample of already-verified schools is re-checked by an independent Audit Cell. Audit results feed verifier performance records.

## 3. Roles

Six roles. Enforce separation strictly at the data-access layer, not just in the UI.

| Role | Sees |
|---|---|
| School | Only its own assessment, evidence, improvement plan, response window, published score |
| Online Verifier | Only the schools in its current assigned batch, with school identity masked (Section 7) |
| On-Ground Verifier | Only its assigned district and travel window until reveal time, then the specific school |
| Supervisor | Its own cell's verifiers, batch allocation, turnaround, quality checks, de-empanelment cases |
| Audit Cell | The random audit sample and the primary verifier's findings for those cases only |
| SSSA PMU or Admin | Everything, plus configuration, cohort build, reporting |

## 4. Indicator model and the two-track check

This is the core design point. Get it right before building screens.

Every SQAAF indicator carries a `checkMethod` field with one of two values:

- **AUTO**: the indicator maps to a field in an external government data source. The portal cross-matches automatically and returns MATCH or MISMATCH.
- **MANUAL**: no external source covers it. The Online Verifier must open the evidence the school uploaded and judge whether it justifies the claimed level.

External sources to model as adapters behind a common interface. Build them as stubs returning seeded mock data, with the real integration deferred:

- UDISE+
- Prerna Portal, covering Nirikshan and Gunvatta modules, for attendance and infrastructure records
- Manav Sampada, for teacher service and vacancy records

Do not assume these expose live APIs. Write each adapter so it can be backed either by an API call or by a periodic bulk file reconciliation, chosen by config. This has not been confirmed and the build must survive either answer.

**Placeholder indicator structure.** The real UP SQAAF indicator set is not yet supplied. Seed with this shape and make it fully data-driven, loaded from a seed file, never hard-coded in components:

```
Domain (6)
  └ Sub-domain (5 to 8 per domain)
      └ Indicator (1 per level)
          ├ level: 1 to 4
          ├ checkMethod: AUTO | MANUAL
          ├ externalSource: udise_plus | prerna | manav_sampada | null
          ├ externalFieldKey: string | null
          ├ evidenceItems: [{ label, mandatory, fileTypes }]
          └ weight: number
```

Roughly 40% AUTO and 60% MANUAL in the seed, so both paths are visibly exercised. The real ratio is unknown.

## 5. Risk scoring

The risk score is computed by the system but built from the Online Verifier's judgements, not instead of them. Sequence:

1. AUTO indicators: system compares self-reported level to the external source and writes MATCH or MISMATCH.
2. MANUAL indicators: the Online Verifier records one of `EVIDENCE_SUPPORTS_LEVEL`, `EVIDENCE_INSUFFICIENT`, `EVIDENCE_CONTRADICTS_LEVEL`, or `EVIDENCE_MISSING`, plus a mandatory free-text rationale for anything other than the first.
3. The system applies a stored rubric to those inputs and returns a single risk score plus a band.

Hard requirements:

- The rubric lives in a versioned `RiskRubric` table. Weights, thresholds and decision rules are editable only by SSSA PMU. Verifiers cannot alter them, per the terms of reference.
- Every computed score stores the rubric version used, so historical scores stay reproducible after a rubric change.
- The verifier can **escalate** any case where the rubric cannot be cleanly applied. Escalation routes to the Supervisor and freezes the case.
- Show the verifier the score only after all their per-indicator decisions are entered, so the score does not anchor their judgement.

**Threshold, unresolved.** The source flowchart says "deviation greater than 20%". It does not say 20% of what, and a percentage computed only over AUTO indicators would be measured on partial coverage. Implement the threshold as a config object, not a constant:

```
riskThreshold: {
  basis: 'TOTAL_SCORE' | 'MATCHED_INDICATORS_ONLY' | 'PER_DOMAIN_WORST',
  value: number,
  minimumAutoIndicatorsForBasis: number
}
```

Default it to `MATCHED_INDICATORS_ONLY` at 20 and surface it in the admin configuration screen with a plain-language explanation of what each basis means.

## 6. Configuration, not constants

Every one of these is contested or unresolved across the source documents. None may be hard-coded. All live in a single admin-editable `ProgrammeConfig` record with an audit trail of changes.

| Key | Default | Note |
|---|---|---|
| `fieldCohortPercentage` | 33 | |
| `revisitIntervalYears` | 3 | |
| `spotCheckMode` | `FIXED_COUNT` | Documents conflict: the terms of reference say 10 students, the role card and flowchart say 10% |
| `spotCheckFixedCount` | 10 | |
| `spotCheckPercentage` | 10 | |
| `spotCheckMinimum` | 5 | Floor for very small schools if percentage mode is used |
| `auditSamplePercentage` | 3 | Documents conflict: flowchart says 1% per district, terms of reference say 3% to 5% |
| `auditSampleBasis` | `PER_DISTRICT` | |
| `deEmpanelContradictionRate` | 20 | Percentage |
| `deEmpanelMinimumAuditedCases` | 10 | Not in source documents. Without a floor, one contradiction in five audited cases triggers removal |
| `deEmpanelAbsoluteCount` | 3 | Assignments in a rolling 12 months |
| `submissionExtensionDays` | 15 | |
| `videoWalkthroughTurnaroundDays` | 7 | |
| `dayOfRevealHour` | 7 | Local time |
| `schoolResponseWindowDays` | 7 | |

Build an admin screen that edits these with inline explanations. Where two source documents disagree, the screen must say so in the help text.

## 7. Anonymity and reveal, enforced by the system

The terms of reference promise anonymity between Online Verifiers and schools. A live two-way video call breaks that promise unless the platform prevents it. Implement:

- Online Verifier sees a masked school code, not the name, address, cluster or principal name, throughout desk screening and the video walkthrough.
- In the video session, the verifier's camera and microphone are off by default and cannot be enabled. Verifier instructions are pushed to the school as on-screen text prompts from a queue, not spoken. Verifier is displayed to the school as a pseudonymous ID.
- The school side is camera-on, geofenced against the school's registered coordinates, with a continuous location check and no upload of pre-recorded files.
- **Low-bandwidth fallback**, required. If a live session fails a connectivity check twice, the school is issued a time-boxed, geofenced, in-app guided capture task: short clips recorded inside the app, timestamped and location-stamped, no gallery upload permitted. Without this, the flagged queue will jam in rural districts.
- On-Ground Verifier sees only district and travel window until `dayOfRevealHour` on the notified date, when the specific school unlocks. Reveal is server-side and time-gated. The client must never hold the school identity before reveal.
- Conflict-of-interest self-declaration prompt at the moment of reveal, with a one-tap recuse-and-reassign path.

## 8. School response window

Not present in the source documents. Build it, behind a feature flag defaulting to ON.

After a discrepancy is flagged and a corrected score proposed, the school gets a read-only view of the correction, the evidence attached, and a form to submit a written response with supporting files, within `schoolResponseWindowDays`. The Supervisor sees the response before publication and either upholds, revises, or refers the case back for a re-visit.

Rationale, state it in the repo README: a published score that can be corrected downward with no chance to respond is the single most likely point of legal and political challenge in a public disclosure system. Cheap to build now, expensive to retrofit after go-live.

## 9. Visual system

Palette sampled directly from the existing programme slides:

```
--navy-primary:   #1F3864   /* Online Verifier track, primary blocks */
--navy-deep:      #073763   /* Headings, icons */
--gold-primary:   #BF9000   /* On-Ground Verifier track, field actions */
--gold-tint:      #D0AD42
--paper:          #FFFFFF
--ink-muted:      #5F7190
```

Rules:

- Navy carries the online or desk track. Gold carries the field or on-ground track. Keep this consistent so a user can tell at a glance which half of the system a screen belongs to. This mapping is already established in the programme's own role cards.
- Status colours: green at or above 70%, amber between 50% and 70%, red below 50%.
- British English throughout. Indian number grouping, 2,65,278. Use "to" for ranges. No em or en dashes in any interface copy.
- No organisation logo or branding of any kind. State emblem placement left as a slot in the header component, unfilled.
- Every screen must be usable on a low-end Android tablet at 720p. The field interface must work in bright sunlight: high contrast, large tap targets, no thin type.

## 10. Screens to build

**School**

- Self-assessment form, indicator by indicator, with evidence upload gated per indicator
- Submission status and deadline
- School Improvement Plan, auto-generated from the self-reported score, regenerating whenever a rating or parameter level changes
- Response window view and form
- Published score view

**Online Verifier**

- Batch queue with turnaround countdown
- Indicator review workspace: split view, evidence viewer on one side, indicator and level claim on the other, AUTO results pre-filled and read-only, MANUAL indicators requiring a decision and rationale
- Escalate control on every indicator
- Video walkthrough console: geofence status, indicator checklist, text-prompt queue, observation capture per indicator, resolve or do-not-resolve decision
- Personal quality and calibration record

**On-Ground Verifier**

- Assignment card: district and travel window only, until reveal
- Reveal screen with conflict-of-interest declaration
- Field verification interface: full indicator list, photo capture, geotag, offline-first with sync queue
- Student spot-check module: random student selection from the roll, reading, writing and numeracy tasks, per the configured mode
- Same-day digital sign-off
- Discrepancy log

**Supervisor**

- Batch allocation and roster
- Turnaround and productivity dashboard
- Quality check sampler
- Escalation inbox
- De-empanelment case view showing the audit contradiction rate against both the percentage and absolute rules, with the minimum-cases floor visible
- Risk algorithm drift monitor: distribution of risk scores over time, flagging shifts for referral to the platform vendor

**Audit Cell**

- Random sample queue
- Blind re-verification interface, primary verifier's findings hidden until the auditor submits
- Reconciliation view after submission

**SSSA PMU or Admin**

- Programme configuration, per Section 6
- Cohort build tool with queue preview and district-wise load
- Rubric versioning
- State, division and district status reporting
- Publication control

## 11. Build order

1. Data model, roles, auth, seeding at realistic volume
2. Indicator engine and the AUTO or MANUAL split, with stub adapters
3. School self-assessment and submission
4. Desk screening workspace and risk scoring
5. Cohort build and reveal logic
6. Field interface, offline-first
7. Supervisor and audit
8. Admin configuration and reporting
9. Video walkthrough console last, since it is the most externally dependent

Write tests for the state machine, the risk rubric, the reveal time-gate and the anonymity data masking before moving past step 5. Those four are where a defect becomes a public credibility failure rather than a bug.

## 12. Out of scope for version 1

- Real integrations with UDISE+, Prerna or Manav Sampada, stubs only
- Payment or piece-rate billing for verifiers
- Public-facing school report cards
- Training and certification module, referenced in the terms of reference but a separate build

## 13. Ask before assuming

Stop and ask if any of these come up:

- The real SQAAF indicator list arrives and conflicts with the placeholder shape
- A configuration key would need to become a constant for a feature to work
- Any requirement forces the Online Verifier to see school identity
- Any requirement forces school identity onto the client before reveal time
