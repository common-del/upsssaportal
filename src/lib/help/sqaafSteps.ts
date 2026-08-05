export type SqaafStep = { title: string; detail: string };

/** Placeholder guidance pending the department's own wording. */
export const SQAAF_STEPS: SqaafStep[] = [
  {
    title: 'Open SQAAF Update from your dashboard.',
    detail:
      'Placeholder guidance. The form opens on the domain you last worked on, so you can stop and come back without losing anything.',
  },
  {
    title: 'Answer every indicator in a domain before moving on.',
    detail:
      'Placeholder guidance. Part-finished domains are marked incomplete and will block submission until they are answered.',
  },
  {
    title: 'Attach evidence wherever an indicator asks for it.',
    detail:
      'Placeholder guidance. The Evidence Manager lists what is still outstanding across all domains, so you can work through the gaps in one place.',
  },
  {
    title: 'Review the summary and check the totals.',
    detail:
      'Placeholder guidance. The summary flags anything left blank, and shows the domain scores that will make up your overall result.',
  },
  {
    title: 'Submit for verification.',
    detail:
      'Placeholder guidance. The form locks on submission and an independent evaluator reviews it. You will be notified when the review begins.',
  },
];

/** Placeholder file committed under public/ so the download button is real. */
export const SQAAF_GUIDANCE_PDF = '/downloads/sqaaf-guidance-placeholder.pdf';
