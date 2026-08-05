import { roleLabelForRole } from '@/lib/appNavConfig';

export type FaqItem = { q: string; a: string };

export type FaqSet = {
  /** Which set was resolved, for the page subheading. */
  audience: 'school' | 'official';
  heading: string;
  intro: string;
  items: FaqItem[];
};

/** Placeholder content pending the real answers from the department. */
const SCHOOL_FAQS: FaqItem[] = [
  {
    q: 'When does the SQAAF submission window close?',
    a: 'Placeholder answer. The window for the current cycle closes on the date shown on your school dashboard. Once it closes the form locks, and any further edit needs a request to your district office.',
  },
  {
    q: 'Can I edit my answers after submitting?',
    a: 'Placeholder answer. Once submitted, the assessment is locked for verification. If something needs correcting, raise it with your district office and they can send the form back to you.',
  },
  {
    q: 'What evidence do I need to upload for each domain?',
    a: 'Placeholder answer. Each indicator lists the documents it accepts. The Evidence Manager shows what is still outstanding against every domain.',
  },
  {
    q: 'Who verifies our submission, and how long does it take?',
    a: 'Placeholder answer. An independent evaluator assigned by the district reviews your submission. You will see the status change on your dashboard when the review begins.',
  },
  {
    q: 'How is our Uday, Unnat or Utkarsh level decided?',
    a: 'Placeholder answer. The level follows the overall verified score across all SQAAF domains. Your report card shows the score and the level side by side.',
  },
  {
    q: 'We disagree with our verified result. What can we do?',
    a: 'Placeholder answer. Results can be appealed within the appeal window shown on your report card. The appeal goes to your district office with any supporting evidence you attach.',
  },
];

/** Placeholder content pending the real answers from the department. */
const OFFICIAL_FAQS: FaqItem[] = [
  {
    q: 'How do I see which schools in my area have not yet submitted?',
    a: 'Placeholder answer. Self Assessment Monitoring lists every assigned school with its current stage, so outstanding submissions can be filtered out from there.',
  },
  {
    q: 'How are verifiers assigned to schools?',
    a: 'Placeholder answer. Verifier Assignment matches available evaluators to schools within their area, subject to the capacity limits set against each verifier.',
  },
  {
    q: 'Can I send a submission back to a school for correction?',
    a: 'Placeholder answer. A submission under review can be returned with a reason, which reopens the form for the school and notifies its account.',
  },
  {
    q: 'What happens when a school appeals its result?',
    a: 'Placeholder answer. The appeal appears in the dispute inbox for your level, with the school’s stated grounds and any evidence attached, and must be closed before the cycle is finalised.',
  },
  {
    q: 'When do results become visible to the public?',
    a: 'Placeholder answer. Results stay internal until the cycle is finalised and published. Nothing appears on the public site before that step.',
  },
  {
    q: 'Who can change the SQAAF framework itself?',
    a: 'Placeholder answer. Only state-level administrators can edit domains, indicators or weightages, and only between cycles rather than during an open one.',
  },
];

export function faqSetForRole(role: string | undefined): FaqSet {
  const isSchool = roleLabelForRole(role ?? '') === 'SCHOOL';

  return isSchool
    ? {
        audience: 'school',
        heading: 'Frequently Asked Questions',
        intro: 'Answers for schools filling and submitting their SQAAF assessment.',
        items: SCHOOL_FAQS,
      }
    : {
        audience: 'official',
        heading: 'Frequently Asked Questions',
        intro:
          'Answers for district and state officials monitoring submissions, verification and disputes.',
        items: OFFICIAL_FAQS,
      };
}
