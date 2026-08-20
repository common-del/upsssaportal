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
| Domain weights | `weight: number` per indicator | `weightPercent` per domain, currently an equal 20% placeholder because the source pages do not give inter-domain weights |

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

## 2. Desk screening every indicator of every school is the programme's real cost

This is the most important finding in this review and it is an operational problem, not
a software one.

The ToR requires the Online Verifier to "review uploaded documentary and photographic
evidence against each SQAAF indicator" for every assigned school, and the flowchart shows
"screeners screen the evidence provided by the school" then "compute risk score for every
school", with no sampling step. The brief faithfully implements this at Section 2, step 4.

At the stated volume that is:

- 2,65,278 schools
- roughly 80 applicable indicators each
- at the brief's assumed 60% MANUAL split, about **48 human judgements per school**
- **about 1.27 crore manual indicator judgements per year**

At 90 seconds per judgement, which is optimistic for opening a document and deciding
whether it justifies a claimed level, that is roughly 318,000 hours, or about **177
full-time screeners working every productive hour of the year**. At two minutes it is
about 236.

The ToR sources Online Verifiers from "VSK data analysts". A Vidya Samiksha Kendra does
not hold a bench of 180 to 240 analysts.

Three ways out, and the choice is SSSA's, not the build's:

1. **Narrow the scope.** Screen the MISMATCH rows for every school, and a sample of the
   MANUAL indicators, rather than all of them. Risk scoring then runs on partial coverage
   for the manual half, which is exactly the concern the brief already raises about the
   20% threshold.
2. **Fund the headcount** and accept the cost.
3. **Reduce the manual share** by mapping more indicators to external sources, which
   depends on what UDISE+, Prerna and Manav Sampada actually expose.

Until this is decided, the desk-screening workspace should be built so the set of
indicators presented to a verifier comes from a query, never from "all of them". That
keeps option 1 open without a rewrite.

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

- 33% of 2,65,278 is 87,542, so the brief's "about 87,500" is right.
- The flowchart's start node reads "all 2,65,278 lakh schools". The word "lakh" there is
  a slip in the source; the figure is 2,65,278 schools, not 2,65,278 lakh.
