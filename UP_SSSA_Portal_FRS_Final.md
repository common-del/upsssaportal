# Functional Requirements Specification (FRS) — FINAL

## UP SSSA School Grading, Accreditation, Public Disclosure & Grievance Portal

### Phase 1 — Web Only — Vercel Deployable

**Version**: 1.0 FINAL  
**Date**: 17 February 2026  
**Status**: Approved for development

---

## 1. Goals and Scope

### 1.1 Goals

1. Enable SSSA to define and publish SQAAF (School Quality Assessment and Accreditation Framework) frameworks per school category.
2. Enable schools to complete self-assessment against published SQAAF.
3. Enable independent verifiers to assess schools against the same SQAAF.
4. Compute scores, grades, and publish results publicly.
5. Provide public discovery of schools (interactive search, comparison, map) and a structured grievance workflow.
6. Provide role-based dashboards for SSSA Admin, District Officials, and Block-level drill-down.
7. Provide a parent rating system for schools.
8. Support bilingual (English/Hindi) operation across all user-facing interfaces.

### 1.2 Out of Scope (Phase 1)

1. Offline mode and native mobile applications.
2. Real-time integration with UDISE or other external systems (CSV import only; API stubs as placeholders).
3. Separate Block Official user role (block-level data is accessible via drill-down within District dashboard).
4. SMS/email notifications (all notifications are mock/in-app only in Phase 1).
5. Password reset flow.
6. Real OTP provider integration (mock OTP only; Twilio integration deferred).

---

## 2. User Roles and Permissions

### 2.1 User Types

| # | Role | Authentication Method |
|---|---|---|
| 1 | Public User | No login required |
| 2 | Parent Rater | Mobile number + mock OTP verification |
| 3 | School User | UDISE code (11-digit) + password |
| 4 | Verifier User | Username + password (created by SSSA Admin) |
| 5 | District Official | Username + password (created by SSSA Admin) |
| 6 | SSSA Admin | Username + password (seeded in DB) |

### 2.2 Permissions Summary

#### Public User

- View interactive UP district map, school directory, school public profiles, published results.
- Use the guided "Find Schools" tool with criteria-based search and side-by-side comparison.
- Submit feedback (disputes) with attachments.
- Track grievance tickets by ticket ID.

#### Parent Rater (OTP-verified)

- Submit one star rating per cycle per school per verified mobile number.
- Rate across configurable dimensions (default: Teaching Quality, Infrastructure & Facilities, Safety & Security, Cleanliness & Hygiene, Administration & Management).
- Rating scale: 1–5 stars per dimension.

#### School User

- Submit self-assessment against published SQAAF framework.
- Upload evidence (conditional on parameter configuration).
- Save draft, submit final.
- View verifier feedback in side-by-side comparison.
- View final results and grade.
- Raise disputes (against public grievances or assessment results).
- Respond to public disputes routed to school inbox.
- Appeal verifier score differences within 5-day appeal window.
- Maintain School Improvement Plan.

#### Verifier User

- View assigned schools (grouped by district).
- View deadline tracking.
- Submit verification assessment against SQAAF form.
- Upload PDF and image evidence.
- Save draft and submit final.
- View submission history and audit trail.

#### District Official

- District-scoped monitoring dashboard with block-level drill-down.
- District verification dashboard.
- Participate in dispute resolution escalation.
- Export CSV of school data.

#### SSSA Admin

- Full system control.
- Framework builder: create, edit, publish SQAAF frameworks.
- Rubric and scoring configuration (weights, grade bands).
- Cycle configuration with timeline phases.
- Verifier assignment (manual + auto load-balanced).
- User and role management (individual + CSV bulk upload).
- Dispute category configuration.
- Finalization control: reconcile scores, approve appeals, publish results.
- Full audit logging access.

### 2.3 Authentication Details

- **Auth library**: NextAuth.js v5 (Auth.js) with Credentials provider.
- **School login**: UDISE code as username + password. Demo account seeded: UDISE `11111111111`, password `school123`.
- **SSSA Admin bootstrap**: Seeded in database. Username: `sssa`, password: `admin123`.
- **Verifier / District Official**: Accounts created exclusively by SSSA Admin (individual or CSV bulk upload).
- **Parent OTP**: Mock OTP in Phase 1 (always accepts `123456`). Twilio integration deferred to Phase 2.
- **Session management**: JWT-based sessions, edge-compatible.

---

## 3. Core Entities

| # | Entity | Description |
|---|---|---|
| 1 | School | Identified by 11-digit UDISE code; includes metadata (name, district, block, category, address, phone, fees, medium, facilities, etc.) |
| 2 | SchoolCategory | Configurable by Admin (default: Primary, Upper Primary, Secondary) |
| 3 | District | UP geography — 75 districts (to be seeded from CSV) |
| 4 | Block | Sub-district geography (~820 blocks, seeded from CSV) |
| 5 | Cycle | A time-bound assessment round with configurable phase windows |
| 6 | Framework | SQAAF framework per school category per cycle; versioned (one per cycle) |
| 7 | Domain | A group of parameters within a framework |
| 8 | Parameter | An assessable item within a domain, with bilingual title, options, evidence rules |
| 9 | OptionLevel | Single-select options for a parameter, with bilingual labels |
| 10 | Rubric | Score mapping: each option mapped to a numeric score |
| 11 | GradeBand | Configurable grade tiers with percentage thresholds (default: Uday, Unnat, Utkarsh) |
| 12 | Submission | School's self-assessment responses for a cycle |
| 13 | SubmissionResponse | Per-parameter response within a submission (selected option + evidence) |
| 14 | VerifierAssignment | Maps verifiers to schools for a cycle |
| 15 | VerificationSubmission | Verifier's assessment responses for an assigned school |
| 16 | Appeal | School's appeal of verifier score differences (5-day window, lighter process) |
| 17 | Result | Computed scores, grades per school per cycle |
| 18 | Ticket | Dispute/grievance with full lifecycle |
| 19 | TicketTimeline | Timeline entries for ticket actions |
| 20 | DisputeCategory | Admin-configurable dispute categories |
| 21 | ParentRating | Individual parent rating (per mobile, per school, per cycle) |
| 22 | RatingDimension | Admin-configurable rating dimensions |
| 23 | SchoolImprovementPlan | Domain-level improvement actions for a school |
| 24 | AuditLog | System-wide audit trail |
| 25 | User | All authenticated users with role, district/block mapping |

---

## 4. SQAAF Framework Builder (SSSA Admin)

### 4.1 Features

- Create framework per school category (categories are admin-configurable; defaults: Primary, Upper Primary, Secondary).
- Add/edit/disable domains with bilingual titles (English + Hindi) and unique codes (e.g., `D1`, `D2`).
- Add/edit/disable parameters under domains with:
  - Unique code (e.g., `P1.1`, `P2.3`).
  - Bilingual title (English + Hindi) — both required.
  - Bilingual description/help text — both-or-neither rule.
  - Input type: Single-select only (Phase 1).
  - Evidence required flag (boolean).
  - If evidence required: allowed file types defined (minimum PDF + image), bilingual instructions (both-or-neither rule).
  - Data source tags (at least one required; values: UDISE, Manual, Other).
  - Display order (unique, consecutive within domain).
- Option-level creation per parameter:
  - Minimum 2 active options for single-select.
  - Unique option key within parameter.
  - Bilingual labels (English + Hindi) — both required.
- One framework version per cycle. Audit trail for all changes.
- **Publish** locks framework for the cycle (hard lock — cannot be edited after publish).
- Full publish-gate validation (see Section 4.2).

### 4.2 Publish-Gate Validations

The system enforces ALL of the following when SSSA Admin clicks **Publish Framework**:

#### A. Framework Completeness

| ID | Validation | Rule |
|---|---|---|
| VAL-01 | Framework type is set | Must be one of the configured school categories |
| VAL-02 | Cycle is selected | Framework must be attached to exactly one cycle |
| VAL-03 | At least 1 active domain exists | — |
| VAL-04 | At least 1 active parameter exists | Across the entire framework |
| VAL-05 | Domain order is valid | Unique and consecutive |
| VAL-06 | Parameter order within domain is valid | Unique and consecutive |

#### B. Domain Validations

| ID | Validation | Rule |
|---|---|---|
| VAL-07 | Domain code is non-empty | — |
| VAL-08 | Domain code is unique within framework | — |
| VAL-09 | Domain code matches allowed pattern | e.g., `D1`, `D2` (configurable regex) |
| VAL-10 | Domain English title is not empty | — |
| VAL-11 | Domain Hindi title is not empty | — |
| VAL-12 | Disabled domain has no active parameters | Block publish or force-disable its parameters |

#### C. Parameter Validations

| ID | Validation | Rule |
|---|---|---|
| VAL-13 | Parameter code is non-empty | — |
| VAL-14 | Parameter code is unique within framework | — |
| VAL-15 | Parameter code matches allowed pattern | e.g., `P1.1`, `P2.3` (configurable regex) |
| VAL-16 | Parameter English title is not empty | — |
| VAL-17 | Parameter Hindi title is not empty | — |
| VAL-18 | Help text: both-or-neither rule | If provided, both EN and HI required |
| VAL-19 | Input type is `Single Select` | Phase 1 only |
| VAL-20 | Parameter has minimum 2 active options | — |
| VAL-21 | Option keys are unique within parameter | — |
| VAL-22 | Option English label is not empty | — |
| VAL-23 | Option Hindi label is not empty | — |
| VAL-24 | Evidence required is boolean | — |
| VAL-25 | If evidence required: allowed file types defined | Minimum PDF + image |
| VAL-26 | If evidence required: instructions both-or-neither | Both EN + HI or neither |
| VAL-27 | At least 1 data source tag selected | From configured list (UDISE, Manual, Other) |

#### D. Rubric & Scoring Validations

| ID | Validation | Rule |
|---|---|---|
| VAL-28 | Rubric exists for this framework + cycle | — |
| VAL-29 | Every active parameter has a score mapping | — |
| VAL-30 | Every active option has a score mapped | No null, no blank |
| VAL-31 | Scores are numeric | — |
| VAL-32 | Scores within allowed range | Default 0–4, configurable; no negatives unless enabled |
| VAL-33 | Parameter max score > 0 | — |
| VAL-34 | Domain total possible score > 0 | — |
| VAL-35 | Overall total possible score > 0 | — |
| VAL-36 | At least 2 grade bands configured | — |
| VAL-37 | Grade band labels in both languages | EN + HI |
| VAL-38 | Grade band thresholds cover 0–100% without gaps or overlaps | — |
| VAL-39 | Threshold ordering is valid | Highest grade = highest threshold |
| VAL-40 | Normalization rule enabled | Score % = achieved ÷ possible for that framework |

#### E. Cycle Gating Validations

| ID | Validation | Rule |
|---|---|---|
| VAL-41 | Self-assessment start < self-assessment end | — |
| VAL-42 | Verification start < verification end | — |
| VAL-43 | Dispute start < dispute end (if bounded) | Disputes can be always-open |
| VAL-44 | Publish allowed only in cycle draft or pre-self-assessment | Once SA window starts, publish is blocked |

#### F. Public Disclosure Validations

| ID | Validation | Rule |
|---|---|---|
| VAL-45 | Staff names not in any public payload schema | — |
| VAL-46 | Private contact fields not in public payload | — |
| VAL-47 | Public phone number field is separate from internal | Shows "Not available" if absent |

#### G. Technical & Integrity Validations

| ID | Validation | Rule |
|---|---|---|
| VAL-48 | No orphan references | Every parameter → domain, every option → parameter |
| VAL-49 | No draft objects with missing required fields | — |
| VAL-50 | Publishing user ID captured | — |
| VAL-51 | Publish timestamp captured | — |
| VAL-52 | Framework version number increments | — |
| VAL-53 | No duplicate published framework for same cycle + type | Block unless explicit replace mode |

#### H. UX Validation Messages

- Show blocking errors inline with exact domain/parameter that fails.
- Provide "Fix now" deep link to the offending item.

---

## 5. Scoring Rubric

### 5.1 Score Mapping

- Map each option of each parameter to a numeric score.
- Scores are numeric, within a configurable range (default: 0–4).
- No negative scores unless explicitly enabled by admin.

### 5.2 Domain Scoring

- **Domain total** = sum of maximum possible scores of each active parameter in the domain.
- **Domain weights**: Equal by default. Admin can configure custom weights per domain.
- Display domain totals in the rubric configuration UI.

### 5.3 Final Score Computation

- **Final score** = weighted sum across domains.
- Formula: `Σ (domain_achieved / domain_possible × domain_weight) / Σ domain_weight × 100`
- This produces a percentage (0–100%).
- Weights are flexible and admin-configurable per framework.
- **Normalization**: Overall score percent = achieved ÷ possible for that specific framework (accounts for differing parameter counts across framework types).

### 5.4 Grade Bands

- 3-tier system by default:
  - **Utkarsh** (Highest tier)
  - **Unnat** (Middle tier)
  - **Uday** (Entry tier)
- Grade bands are configurable: labels (bilingual), percentage thresholds.
- Thresholds must cover 0–100% without gaps or overlaps.
- Admin can modify band labels and thresholds per framework.

### 5.5 Live Score Preview

- Framework builder shows a live preview of scoring as rubric is configured.
- Locked after framework publish.

---

## 6. Cycle Configuration

### 6.1 Cycle Properties

- Name, year, description.
- Timeline phases with date ranges:
  - **Self-Assessment window**: start date → end date
  - **Verification window**: start date → end date
  - **Dispute window**: start date → end date (or always-open)
  - **Finalization date**

### 6.2 Phase Rules

- Self-Assessment and Verification windows **can run in parallel** (overlapping dates allowed).
- Disputes can be **always open** (no end date required).
- **Soft gating**: When a phase deadline passes, a warning is shown but submission is still allowed. Admin can enforce hard deadlines per school if needed.
- Admin can reopen submissions at **any level**: individual school, district-wide, or globally for the entire cycle.

### 6.3 Framework Lock

- Once a framework is published for a cycle, it cannot be edited.
- One framework version per cycle per school category.

### 6.4 Audit Logging

- All cycle configuration changes are logged with user ID, timestamp, and before/after values.

---

## 7. Monitoring Dashboard

### 7.1 District View (District Official + SSSA Admin)

Metrics displayed:

| Metric | Description |
|---|---|
| Total schools | Count of schools in scope |
| Started self-assessment | Schools that began SA |
| Submitted | Schools that submitted SA |
| Average self score | Mean self-assessment score |
| Verified | Schools with completed verification |
| Average verification score | Mean verifier score |
| Finalized | Schools with published results |
| Average final score | Mean final score |

### 7.2 Block-Level Drill-Down

- Within the District dashboard, officials can drill down to block level.
- Same metrics as district view, scoped to the selected block.
- No separate Block Official role — District Officials and SSSA Admin access block-level data via drill-down filters.

### 7.3 School Drill-Down

- Status indicators per school (Not Started, In Progress, Submitted, Verified, Finalized).
- Grade display.
- Click to view school detail report.
- Export CSV of school listing with all metrics.

### 7.4 State-Level View (SSSA Admin only)

- Aggregate metrics across all districts.
- District comparison table.
- State-wide grade distribution.

---

## 8. Verification Dashboard

### 8.1 Verification Summary Metrics

- Total schools assigned for verification.
- Verified count, pending count.
- Average self-assessment score vs. average verification score.

### 8.2 Self vs. Verifier Comparison

- Side-by-side view of school's self-assessment and verifier's assessment per parameter.
- **Delta highlighting**: Parameters where self-score and verifier-score differ are visually flagged.
- Color-coded delta indicators (green = match, amber = minor diff, red = major diff).

### 8.3 Evidence Viewing

- View evidence uploaded by both school and verifier inline.
- Support for PDF and image preview.

### 8.4 Finalization Control (SSSA Admin Only)

- Finalization triggers grade computation and makes results public.
- **Reconciliation flow**:
  1. System flags schools where verifier score differs significantly from self-assessment.
  2. Flagged schools get a **5-day appeal window** (starts from whichever is later: SA close date or verification close date).
  3. If school appeals with supporting evidence → SSSA Admin reviews and approves/rejects.
  4. If no school response within 5 days → verifier score is accepted as final.
  5. After appeal window closes, Admin can finalize and publish results.
- This appeal process is **separate and lighter** than the full dispute workflow (Section 12).

---

## 9. Verifier Workspace

### 9.1 Dashboard

- Assigned schools grouped by district.
- Deadline tracking with countdown timers.
- Status per school: Not Started, In Progress, Submitted.

### 9.2 Assessment Form

- SQAAF form matching the published framework.
- Same parameter list as school self-assessment.
- PDF and image evidence upload per parameter.
- Save draft and final submit.
- Audit trail for all actions.

### 9.3 Assignment Logic

- Verifiers can be assigned to schools in **multiple districts**.
- **Capacity**: Configurable max number of schools per verifier per cycle.
- **Auto load-balancing**: System distributes schools evenly across available verifiers within each district, weighted by remaining capacity. Assignment algorithm:
  1. For each unassigned school, find eligible verifiers (mapped to that district, with remaining capacity).
  2. Assign to the verifier with the most remaining capacity (greedy balance).
  3. If tie, assign randomly.
- **Admin override**: SSSA Admin can manually reassign any school to any verifier.

---

## 10. School Workspace

### 10.1 Self-Assessment

- Fill published SQAAF form for the active cycle.
- Per-parameter: select one option from the configured option levels.
- Conditional evidence upload: if the parameter has `evidence_required = true`, school must upload evidence (PDF or image).
- Allowed evidence file types: PDF, JPG, PNG. Max file size: 10MB per file.
- **Draft and Submit**: School can save progress as draft and return later. Final submit locks the submission (unless admin reopens).
- Progress indicator showing completion percentage per domain.

### 10.2 Verifier Feedback View

- Side-by-side comparison: school's answers vs. verifier's answers per parameter.
- Delta highlighting for differences.
- Final score and grade display.

### 10.3 Appeal Process (Lighter than Disputes)

- After verification is complete, if scores differ, school is notified.
- **5-day appeal window** from whichever is later: SA close date or verification close date.
- School can submit appeal with evidence per flagged parameter.
- SSSA Admin reviews and approves (uses school score) or rejects (uses verifier score).
- If school does not appeal within 5 days → verifier score is final.
- This is **not** the same as the public dispute workflow.

### 10.4 Disputes

- Raise disputes against public grievances filed about the school.
- Respond to disputes routed to school inbox.
- View SLA clock and escalation status.

### 10.5 School Improvement Plan (SIP)

- Domain score breakdown showing strengths and gaps.
- Action tracking: each action has description, owner, target date, status.
- Status management: Not Started, In Progress, Completed.

---

## 11. Public Portal

### 11.1 About SSSA

- Framework explanation: what is SQAAF, how it works.
- Governance details.
- Scoring methodology explanation.

### 11.2 View All Information (Map & Directory)

- **Interactive UP district map** (custom SVG):
  - Clickable districts showing average score / grade distribution.
  - Color-coded by average grade tier.
  - Click district → drill down to school list for that district.
- **Filterable school directory**:
  - Filters: District, Block, School Category, Grade tier, Management type.
  - Search by school name and UDISE code.
  - Table view with pagination.
- **School public profile page** (on click):
  - School name, UDISE, category, district, block, address.
  - Grade tier and overall score (if published).
  - Parent rating (average stars).
  - Public phone number (or "Not available").
  - Fees information.
  - Domain-wise score breakdown (visible on click/expand — not shown by default).
  - Historical cycle scores (when available).

### 11.3 Find Schools — Interactive Guided Search

A two-step guided criteria form for parents to find suitable schools:

#### Step 1: Basic Requirements (Mandatory)

| Field | Input Type | Behavior |
|---|---|---|
| District | Dropdown | Select from list of UP districts |
| Block | Dropdown | Filtered by selected district |
| Date of Birth of Ward | Date picker (D/M/Y) | Retrieves eligible grade using RTE age norms |
| Sex of Ward | Select: M / F / T | — |
| Special Needs | Select if applicable / N/A | Filter for schools with special needs support |
| Desirable Fees Range | Range selector (₹0 to max) | Dropdown or slider |

#### Step 2: Desirable Criteria (Optional)

| Field | Input Type | Options |
|---|---|---|
| Co-Educational / Same Sex? | Select | Co-Ed, Boys Only, Girls Only, Any |
| Private or Public or Both? | Select | Private, Public, Both |
| Medium of Instruction | Multi-select | English, Hindi, Multilingual, Other |
| Facilities Desired | Checklist | Library, Computer Lab, Playground, Science Lab, Drinking Water, Toilets, Smart Classroom, Boundary Wall, Ramp for Disabled |

#### Age-to-Grade Mapping (RTE Norms)

| Age (as of academic year start) | Eligible Grade |
|---|---|
| 6+ | Class 1 |
| 7+ | Class 2 |
| 8+ | Class 3 |
| 9+ | Class 4 |
| 10+ | Class 5 |
| 11+ | Class 6 |
| 12+ | Class 7 |
| 13+ | Class 8 |
| 14+ | Class 9 |
| 15+ | Class 10 |
| 16+ | Class 11 |
| 17+ | Class 12 |

#### Search Results

- Results displayed in a table.
- Columns: School Name, UDISE, Category, Grade Tier, Parent Rating (stars), Public Phone, Fees, Distance (if location available).
- Click school name → opens public school profile.

### 11.4 School Comparison

- After search results, user can select 2–3 schools.
- Side-by-side comparison table:
  - Each row = one attribute (category, grade, parent rating, fees, medium, facilities, etc.).
  - Each column = one school.
- Differences highlighted.

### 11.5 Feedback and Dispute (Public)

- **Parent Rating Flow** (OTP-verified):
  1. Search and select school.
  2. Enter mobile number → receive mock OTP → verify.
  3. Rate 1–5 stars across each dimension (Teaching Quality, Infrastructure & Facilities, Safety & Security, Cleanliness & Hygiene, Administration & Management).
  4. One rating per cycle per school per verified mobile number.
  5. Rating dimensions are admin-configurable.

- **Dispute/Grievance Flow**:
  1. Select dispute category (admin-configured).
  2. Enter details (text).
  3. Attach supporting documents (PDF/image, max 10MB per file).
  4. Submit → receive ticket ID for tracking.
  5. Routed to school inbox first.

---

## 12. Dispute Workflow

### 12.1 Who Can File

- Public users (no login required, but must provide contact info).
- School users (from their workspace).

### 12.2 Dispute Categories

- Admin-configurable list. Examples: "Incorrect Grade", "Inaccurate Data", "Infrastructure Complaint", "Staff Conduct", "Other".

### 12.3 Escalation Ladder (Auto-Escalation)

| Level | Handler | SLA (Calendar Days) | Auto-Escalation |
|---|---|---|---|
| 1 | School | 5 days | If no response → auto-escalate to Block |
| 2 | Block | 10 days | If no response → auto-escalate to District |
| 3 | District | 30 days | If no response → auto-escalate to State |
| 4 | State (SSSA Admin) | — | Final resolution |

- Block-level escalation is handled via the block drill-down in the District dashboard (no separate Block Official role).
- Escalation is **automatic**: when the SLA deadline expires without resolution, the system auto-escalates to the next level.

### 12.4 Ticket Statuses

- New
- Assigned
- Responded
- Escalated
- Resolved
- Rejected

### 12.5 Ticket Features

- Full timeline log of all actions.
- Role-based actions (school responds, district reviews, admin resolves).
- Attachment support at every stage.
- Public tracking: submitter can check status by ticket ID.
- All notifications are in-app/mock in Phase 1 (no email/SMS).

---

## 13. User and Role Management

### 13.1 User Creation

- **Bulk upload via CSV**: SSSA Admin uploads CSV with columns: name, username, password, role, district, block (if applicable), verifier capacity (if verifier).
- **Individual user creation**: SSSA Admin creates users one at a time via form.

### 13.2 Verifier Management

- Verifier capacity (max schools per cycle) is configurable per verifier.
- Verifiers can be mapped to multiple districts.

### 13.3 School User Accounts

- School accounts will be seeded from UDISE CSV (to be provided later).
- UDISE code serves as username.
- Demo account seeded: UDISE `11111111111`, password `school123`.

### 13.4 Admin Controls

- Disable/enable user accounts.
- Full audit logging of all user management actions.

---

## 14. Non-Functional Requirements

### 14.1 Performance

- Public pages load under 3 seconds.
- Search results under 1 second under typical load.
- All large lists use server-side pagination.
- Map loads via cached aggregates, not full school list.

### 14.2 Security

- Role-based access enforced server-side (middleware + API route guards).
- Passwords hashed with bcrypt.
- OTP verification for parent ratings (mock in Phase 1).
- Rate limiting on API routes.
- File type validation (PDF, JPG, PNG only) and size validation (max 10MB per file).
- CSRF protection via NextAuth.
- JWT-based sessions (edge-compatible).

### 14.3 Privacy

- No staff names in any public-facing data.
- No private contact numbers in public data.
- Public school phone number only if explicitly marked as public by the school record.
- If not present, display "Not available".

### 14.4 Accessibility

- Keyboard navigable throughout.
- WCAG 2.1 AA contrast compliance.
- Proper form labels and ARIA attributes.
- Focus management in modals and drawers.
- Color-independent cues (icons + text, not color alone).

### 14.5 Bilingual Support

- English/Hindi toggle in the site header.
- Language preference persisted per user (stored in localStorage for public users, in user profile for authenticated users).
- Default language: English.
- All framework content (domains, parameters, options, help text, grade labels) stored bilingually in the database.
- All UI chrome (menus, labels, buttons, error messages) translated via i18n library.
- **Both-or-neither rule**: If a bilingual field is optional, it must be filled in both languages or left empty in both.

---

## 15. Architecture & Tech Stack

### 15.1 Chosen Stack (Optimized for Free-Tier Vercel)

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Stable, best Vercel support, React Server Components |
| Language | TypeScript (strict mode) | Type safety |
| Styling | Tailwind CSS v4 | Utility-first, matches design system |
| Database | Neon Postgres (free tier) | Serverless-native, no connection pool headaches |
| ORM | Prisma | Strong typing, migrations, studio |
| Auth | NextAuth.js v5 (Auth.js) | Edge-compatible, Vercel-optimized |
| File Storage | Vercel Blob (free: 250MB) | Zero-config on Vercel, presigned uploads |
| i18n | next-intl | Lightweight, SSR-friendly |
| Client State | Zustand | Minimal, lightweight |
| Icons | Lucide React | Clean aesthetic, tree-shakeable |
| Map | Custom SVG (UP districts) | No external dependency, fast loading |
| Validation | Zod | Runtime type validation |
| Dev DB | SQLite (via Prisma) | Fast local development, zero setup |

### 15.2 Design System — Color Palette

| Token | Hex | Usage |
|---|---|---|
| Navy Primary | `#1B2A4A` | Headers, sidebar, primary backgrounds |
| Navy Secondary | `#2C3E6B` | Secondary elements, hover states |
| Navy Light | `#3D5A99` | Accents, links |
| CTA Green | `#5B7B3A` | Primary buttons, success states |
| CTA Green Hover | `#4A6A2E` | Button hover |
| White | `#FFFFFF` | Backgrounds, text on dark |
| Light Gray | `#F5F7FA` | Page backgrounds, card backgrounds |
| Border Gray | `#E2E8F0` | Borders, dividers |
| Text Primary | `#1A202C` | Headings, primary text |
| Text Secondary | `#4A5568` | Body text, descriptions |
| Warning Amber | `#D69E2E` | Warnings, medium deltas |
| Error Red | `#E53E3E` | Errors, high deltas |
| Success Green | `#38A169` | Success states, matching scores |

Design principles: Minimalist, clean, government-appropriate, generous whitespace, aesthetic iconography.

### 15.3 Vercel Deployment Strategy

| Concern | Mitigation |
|---|---|
| Serverless function timeout (10s free) | Chunked operations, lightweight API routes |
| Serverless bundle size (50MB limit) | No heavy server-side libs, edge-compatible Prisma |
| File upload size (4.5MB body limit) | Direct browser-to-Vercel-Blob via presigned URLs |
| Cold starts | Lightweight API routes, Edge runtime for auth |
| Build time | ISR for public pages, no heavy build-time data fetching |
| Database connections | Neon serverless driver (HTTP-based) |
| Large public pages | Server Components + streaming, paginated queries |

### 15.4 Environments

| Environment | Purpose |
|---|---|
| Local (localhost:3000) | Development with SQLite |
| Vercel Preview | Auto-deployed PR previews with Neon branch |
| Vercel Production | Production deployment with Neon main DB |

---

## 16. Seed Data

### 16.1 Pre-Seeded on Setup

- **SSSA Admin account**: username `sssa`, password `admin123`.
- **Demo School account**: UDISE `11111111111`, password `school123`.

### 16.2 To Be Provided by Stakeholder

- CSV of all UP schools with UDISE codes and metadata (will be provided later).
- CSV of UP districts and blocks (will be provided later for pre-seeding).
- SQAAF framework structure (will be provided later for upload).
- Grade band thresholds for Uday / Unnat / Utkarsh.

---

## 17. Acceptance Criteria

| # | Criterion | Details |
|---|---|---|
| 1 | Admin can create and publish frameworks | Full SQAAF builder with all publish-gate validations passing |
| 2 | Schools can complete self-assessment | Fill form, upload evidence, save draft, submit |
| 3 | Verifiers can complete verification | Assigned schools, fill form, upload evidence, submit |
| 4 | Scores computed and grades assigned | Weighted scoring, grade band mapping, normalization |
| 5 | Results published after finalization | Appeal window respected, admin approval flow works |
| 6 | Public directory functional | Map, search, filters, school profiles with correct privacy rules |
| 7 | Find Schools guided search works | Two-step criteria form, age-to-grade mapping, comparison table |
| 8 | Parent rating works | OTP-verified, 1–5 stars, one per mobile per school per cycle |
| 9 | Dispute workflow functional | Auto-escalation with SLA, full ticket lifecycle, block drill-down |
| 10 | District dashboard operational | Metrics, block drill-down, school drill-down, CSV export |
| 11 | Bilingual toggle works | EN/HI across all UI, persistent preference |
| 12 | Deploys to Vercel without errors | Free tier compatible, no timeout issues |
| 13 | All data seeded correctly | Admin account, demo school, geography data (when provided) |

---

## 18. Appendix A — Guided Criteria Field Reference (From Wireframes)

### Step 1 Wireframe: Enter Basic Requirements

```
┌─────────────────────────────────────────────────┐
│       Interactive School Comparison Interface     │
├─────────────────────────────────────────────────┤
│              Enter Basic Requirements            │
├─────────────────────────────────────────────────┤
│ District              │ [Dropdown]               │
│ Block                 │ [Dropdown, filtered]     │
│ DoB of Ward           │ [D/M/Y] → Eligible Grade │
│ Sex of Ward           │ [M / F / T]              │
│ Special Needs         │ [Select / N/A]           │
│ Desirable Fees Range  │ [₹0 to # Dropdown]      │
├─────────────────────────────────────────────────┤
│                                    [ Next >> ]   │
└─────────────────────────────────────────────────┘
```

### Step 2 Wireframe: Select Desirable Criteria

```
┌─────────────────────────────────────────────────┐
│       Interactive School Comparison Interface     │
├─────────────────────────────────────────────────┤
│            Select Desirable Criteria             │
├─────────────────────────────────────────────────┤
│ Co-Ed / Same Sex?     │ [Select]                 │
│ Private / Public?     │ [Select]                 │
│ Medium of Instruction │ [EN/HI/Multi/Other]      │
│ Facilities Desired    │ [Checklist]              │
├─────────────────────────────────────────────────┤
│          [ Find Schools Matching Criteria... ]   │
└─────────────────────────────────────────────────┘
```

---

## 19. Appendix B — Appeal vs. Dispute: Process Comparison

| Aspect | Appeal (Section 10.3) | Dispute (Section 12) |
|---|---|---|
| **Purpose** | School challenges verifier score differences | Public/school files complaint about school data or conduct |
| **Trigger** | Automatic — flagged when verifier score differs | Manual — filed by user |
| **Window** | 5 calendar days from max(SA close, verification close) | Always open (or cycle-bounded) |
| **Filed by** | School only | Public users or schools |
| **Resolution** | SSSA Admin approves (school score) or rejects (verifier score) | Escalation ladder: School → Block → District → State |
| **Escalation** | No escalation — single-level Admin decision | 4-level auto-escalation with SLA |
| **Outcome** | Affects final computed score | Does not directly affect score; results in action/response |
| **Weight** | Lightweight, per-parameter | Full ticket lifecycle with timeline and attachments |

---

*End of FRS — Version 1.0 FINAL*
