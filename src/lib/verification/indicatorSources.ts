import type { CheckMethod, ExternalSource } from '@prisma/client';

/**
 * Which of the 89 SQAAF indicators a government system can answer, and which need a person.
 *
 * This is the single most consequential table in the verification build, and not mainly for
 * technical reasons. Every indicator left MANUAL costs desk-screening time: at the state's
 * volume over a three-year cycle, each one is roughly 1.2 full-time screeners. Every
 * indicator marked AUTO that the source cannot actually answer produces a MISMATCH a
 * verifier then has to dismiss, which is worse than leaving it MANUAL.
 *
 * So the mapping below is derived from what each source plausibly holds, not chosen to hit
 * the 40/60 ratio the brief guessed at. It lands at 29 AUTO and 60 MANUAL.
 *
 *   UDISE+          the school census: room counts, facilities, enrolment, staff totals
 *   Prerna          attendance, learning outcomes, and the Nirikshan inspection module
 *   Manav Sampada   teacher service records, postings, qualifications, vacancies
 *
 * UDISE+ field keys are the real column names from the register extract in this repository
 * (`data/up_schools_sample_named.csv`), so they can be checked against something concrete.
 * Prerna and Manav Sampada keys are descriptive placeholders: no schema for either has been
 * supplied, and inventing plausible-looking column names would make them look confirmed.
 * Those are marked `unconfirmedKey` so the adapter can refuse rather than guess.
 *
 * Every entry here needs review by someone who deals with these departments. Two known
 * problems, recorded rather than papered over:
 *
 *   - Several AUTO indicators are graded on a three-level rubric while the source holds a
 *     raw count or a yes/no. Turning "42 classrooms" into level 1, 2 or 3 needs a threshold
 *     rule per indicator, and those rules do not exist yet. Until they do, the auto-check
 *     records NOT_CHECKABLE with a reason rather than inventing a level.
 *   - Indicators 2.1.3 and 2.1.4 carry the same title, "Availability of non-teaching
 *     staff", in the transcribed source. One of them is probably a transcription error and
 *     it should be resolved before scores are published.
 */

export type IndicatorSourceMapping = {
  checkMethod: CheckMethod;
  externalSource: ExternalSource | null;
  externalFieldKey: string | null;
  /** True when the key is a placeholder rather than a confirmed field in that system. */
  unconfirmedKey?: boolean;
  /** Why a person is needed. Only for MANUAL, and only where it is not obvious. */
  note?: string;
};

const AUTO = (
  source: ExternalSource,
  key: string,
  unconfirmedKey = false,
): IndicatorSourceMapping => ({
  checkMethod: 'AUTO',
  externalSource: source,
  externalFieldKey: key,
  ...(unconfirmedKey ? { unconfirmedKey: true } : {}),
});

const MANUAL = (note?: string): IndicatorSourceMapping => ({
  checkMethod: 'MANUAL',
  externalSource: null,
  externalFieldKey: null,
  ...(note ? { note } : {}),
});

/** Keyed by the indicator code from the SCERT checklist, e.g. "1.1.1". */
export const INDICATOR_SOURCES: Record<string, IndicatorSourceMapping> = {
  // ── D1 Infrastructure and Safety ────────────────────────────────────────────
  // Mostly countable, which is why this domain carries most of the AUTO indicators.
  '1.1.1': AUTO('UDISE_PLUS', 'total_class_rooms'),
  '1.1.2': MANUAL('Adequacy of space and seating is a judgement about a room, not a count of rooms.'),
  '1.1.3': MANUAL('Ventilation is not a UDISE field.'),
  '1.1.4': MANUAL('Lighting adequacy is not recorded separately from electricity supply.'),
  '1.1.5': AUTO('UDISE_PLUS', 'separate_room_for_hm'),
  '1.1.6': AUTO('UDISE_PLUS', 'hand_pump_fun_yn'),
  '1.1.7': AUTO('UDISE_PLUS', 'total_girls_func_toilet'),
  '1.1.8': AUTO('UDISE_PLUS', 'handwash_near_toilet'),
  '1.1.9': AUTO('UDISE_PLUS', 'playground_available'),
  '1.1.10': MANUAL('No assembly-space field exists; the playground field is not a substitute.'),
  '1.1.11': AUTO('UDISE_PLUS', 'library_availability'),
  '1.1.12': AUTO('UDISE_PLUS', 'phy_lab_cond'),
  '1.1.13': AUTO('UDISE_PLUS', 'comp_lab_cond'),
  '1.1.14': AUTO('UDISE_PLUS', 'smart_class_tv_tot'),
  '1.1.15': AUTO('UDISE_PLUS', 'medical_checkups'),
  '1.1.16': MANUAL('Menstrual hygiene provision is not a UDISE field.'),
  '1.1.17': AUTO('UDISE_PLUS', 'availability_ramps'),
  '1.1.18': MANUAL('Whether a helpline number is displayed can only be seen.'),
  '1.1.19': MANUAL('UDISE records a kitchen for mid-day meals, which is not the same claim as a canteen.'),
  '1.1.20': MANUAL('Kitchen garden and green-school status is not recorded.'),
  '1.1.21': MANUAL('Waste management practice is not recorded.'),
  '1.1.22': AUTO('UDISE_PLUS', 'electricity_availability'),

  '1.2.1': MANUAL('CCTV presence and, more importantly, whether it functions, is not recorded.'),
  '1.2.2': MANUAL('Guard deployment is not a UDISE field.'),
  '1.2.3': AUTO('UDISE_PLUS', 'boundary_wall'),
  '1.2.4': MANUAL('A fire safety certificate has to be read; UDISE holds no such field.'),
  '1.2.5': MANUAL('Whether drills happen is a records check.'),
  '1.2.6': MANUAL('POCSO compliance is a process, evidenced by committee records and training.'),

  // ── D2 Administration, Human Resource and Leadership ────────────────────────
  '2.1.1': AUTO('UDISE_PLUS', 'total_tch'),
  '2.1.2': AUTO('MANAV_SAMPADA', 'subject_qualified_teacher_count', true),
  '2.1.3': AUTO('MANAV_SAMPADA', 'non_teaching_staff_count', true),
  '2.1.4': AUTO('MANAV_SAMPADA', 'non_teaching_staff_count', true),
  '2.1.5': AUTO('MANAV_SAMPADA', 'counsellor_posted', true),
  '2.1.6': MANUAL('Continuity of non-teaching staff attendance is not covered by either system.'),
  '2.1.7': AUTO('PRERNA', 'teacher_attendance_rate', true),

  '2.2.1': MANUAL('Academic involvement of the head teacher is observed, not recorded.'),
  '2.2.2': AUTO('MANAV_SAMPADA', 'training_completions', true),
  '2.2.3': AUTO('PRERNA', 'nirikshan_inspection_count', true),
  '2.2.4': MANUAL('POSH compliance is a committee and process check.'),
  '2.2.5': MANUAL('Recognition practice is not recorded anywhere.'),
  '2.2.6': AUTO('UDISE_PLUS', 'enr_total'),

  // ── D3 Teaching and Learning ────────────────────────────────────────────────
  // Almost entirely MANUAL, and correctly so: this domain is about what happens in a
  // classroom, which no census holds.
  '3.1.1': MANUAL('Curriculum completion is evidenced by teaching plans and diaries.'),
  '3.1.2': MANUAL('Lesson plan quality requires reading the plans.'),
  '3.1.3': MANUAL('Activity-based learning is a classroom observation.'),
  '3.1.4': AUTO('UDISE_PLUS', 'ict_lab_yn'),
  '3.1.5': MANUAL('Pre-vocational exposure is evidenced by activity records.'),
  '3.1.6': MANUAL('Vocational skills provision is evidenced by records.'),
  '3.1.7': MANUAL('Use of mother tongue is a classroom observation.'),
  '3.1.8': MANUAL('Gender equality and constitutional values in teaching is an observation.'),

  '3.2.1': MANUAL('Children’s participation in the lesson is a classroom observation.'),
  '3.2.2': MANUAL(),
  // Attendance is the one thing in this sub-domain a system does hold, and Prerna is built
  // around it. Missing this would have put a routinely measured figure in front of a
  // screener for no reason.
  '3.2.3': AUTO('PRERNA', 'student_attendance_rate', true),
  '3.2.4': MANUAL(),
  '3.2.5': MANUAL(),
  '3.2.6': MANUAL(),
  '3.2.7': MANUAL(),
  '3.2.8': MANUAL(),
  '3.2.9': MANUAL(),
  '3.2.10': MANUAL(),
  '3.2.11': MANUAL(),

  '3.3.1': MANUAL(),
  '3.3.2': MANUAL(),
  '3.3.3': MANUAL(),
  '3.3.4': MANUAL(),
  '3.3.5': MANUAL(),
  '3.3.6': MANUAL(),
  '3.3.7': MANUAL(),
  '3.3.8': MANUAL(),

  // ── D4 Assessment and Learning Outcomes ─────────────────────────────────────
  // Outcomes are the one place Prerna genuinely helps, if the modules expose them.
  '4.1.1': MANUAL('Assessment regularity is evidenced by an assessment calendar and records.'),
  '4.1.2': MANUAL('Feedback timeliness has to be seen in pupils’ work.'),
  '4.1.3': MANUAL('Whether data is analysed, rather than merely collected, is a judgement.'),
  '4.1.4': MANUAL(),
  '4.1.5': MANUAL('Remedial support is evidenced by group records and plans.'),

  '4.2.1': AUTO('PRERNA', 'summative_result_summary', true),
  '4.2.2': AUTO('PRERNA', 'fln_reading_proficiency', true),
  '4.2.3': AUTO('PRERNA', 'board_result_summary', true),
  '4.2.4': MANUAL('Competitive exam participation is evidenced by the school’s own records.'),
  '4.2.5': MANUAL('As 4.2.4.'),
  '4.2.6': MANUAL('As 4.2.4.'),

  // ── D5 Inclusivity and Community Participation ──────────────────────────────
  '5.1.1': AUTO('UDISE_PLUS', 'spl_educator_yn'),
  '5.1.2': MANUAL('Participation of CWSN in activities is an observation, not a facility count.'),
  '5.1.3': MANUAL(),
  '5.1.4': MANUAL(),

  '5.2.1': MANUAL('Parent-teacher meetings are evidenced by minutes and attendance.'),
  '5.2.2': AUTO('UDISE_PLUS', 'smc_smdc_meetings'),
  '5.2.3': MANUAL('Complaint redressal is a process check, and this portal now holds some of it.'),
  '5.2.4': MANUAL(),
  '5.2.5': MANUAL(),
  '5.2.6': AUTO('PRERNA', 'retention_rate', true),
};

export function mappingFor(code: string): IndicatorSourceMapping {
  // Unmapped codes fall to MANUAL rather than being skipped. A new indicator that nobody
  // has classified should cost a screener's time, not silently pass unchecked.
  return INDICATOR_SOURCES[code] ?? MANUAL('Not yet classified.');
}

export function mappingSummary() {
  const values = Object.values(INDICATOR_SOURCES);
  const auto = values.filter((v) => v.checkMethod === 'AUTO');
  return {
    total: values.length,
    auto: auto.length,
    manual: values.length - auto.length,
    unconfirmedKeys: auto.filter((v) => v.unconfirmedKey).length,
    bySource: {
      UDISE_PLUS: auto.filter((v) => v.externalSource === 'UDISE_PLUS').length,
      PRERNA: auto.filter((v) => v.externalSource === 'PRERNA').length,
      MANAV_SAMPADA: auto.filter((v) => v.externalSource === 'MANAV_SAMPADA').length,
    },
  };
}
