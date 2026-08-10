import { getTranslations } from 'next-intl/server';
import { TriangleAlert } from 'lucide-react';

/**
 * Says, on every public page, that the data is not real.
 *
 * The site needs this because the sample data is realistic enough to be mistaken for
 * a register. UDISE codes follow the real format and start with 09, which is genuinely
 * Uttar Pradesh. School names are the conventions UP actually uses — Rajkiya Prathmik
 * Vidyalaya, Saraswati Vidya Mandir, Janta Inter College. Districts and blocks are
 * real places. So a page can show a plausibly-named school, at a real-format code, in
 * a real block of a real district, carrying a quality score, a grade, a verified
 * status, a fee disclosure and complaints from named parents. There is very likely an
 * actual school in Pindra called Rajkiya Prathmik Vidyalaya.
 *
 * Fake data in a prototype is ordinary. A prototype that does not say so, while
 * publishing quality judgements about identifiable schools, is not.
 *
 * Deliberately not dismissible. The person who most needs to read it is someone
 * arriving for the first time, and a banner they can close is a banner the next
 * visitor does not see. It is also above the navigation rather than below it, so it
 * cannot be scrolled past on the way to a school's page.
 *
 * Remove this when the register holds real school data — not before, and not because
 * it is in the way of a screenshot.
 */
export async function DemoDataNotice() {
  const t = await getTranslations('demoNotice');

  return (
    <div
      role="note"
      className="border-b border-[#B45309]/30 bg-[#7A5209] px-4 py-2.5 text-white print:hidden"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-[13px] leading-snug">
          <span className="font-bold">{t('title')}</span> {t('body')}
        </p>
      </div>
    </div>
  );
}
