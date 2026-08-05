import { getTranslations } from 'next-intl/server';
import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

const NAVY = '#1B2A6B';
const GOLD = '#F5B731';

/** Informational only - none of these are links. */
const ACTIONS: {
  key: 'actionViewReport' | 'actionTalkParents' | 'actionEnquire' | 'actionCompare';
  icon: LucideIcon;
}[] = [
  { key: 'actionViewReport', icon: ClipboardList },
  { key: 'actionTalkParents', icon: MessagesSquare },
  { key: 'actionEnquire', icon: HelpCircle },
  { key: 'actionCompare', icon: MapPin },
];

export async function ParentActionStrip() {
  const t = await getTranslations('rating');

  return (
    // One panel rather than five loose pieces: the four notes are split by
    // hairlines and the banner is fused on as the panel's footer. Hairlines run
    // horizontally when the cells stack, vertically once they sit in a row.
    <section className="mt-10 overflow-hidden rounded-2xl bg-white shadow-sm">
      <ul className="flex flex-col sm:flex-row">
        {ACTIONS.map(({ key, icon: Icon }) => (
          <li
            key={key}
            className="flex flex-1 flex-col items-center gap-2.5 border-t border-gray-100 px-5 py-6 text-center first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0"
          >
            <Icon size={26} style={{ color: NAVY }} aria-hidden />
            <span className="text-sm font-bold leading-snug text-gray-900">{t(key)}</span>
          </li>
        ))}
      </ul>

      <div
        className="flex items-center gap-4 px-6 py-4 text-white"
        style={{ backgroundColor: NAVY }}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10">
          <ShieldCheck size={19} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{t('involvementTitle')}</span>
          <span className="mt-0.5 block text-[13px] text-white/70">{t('involvementBody')}</span>
        </span>
        <span
          className="ml-auto hidden shrink-0 items-center gap-2.5 sm:flex"
          style={{ color: GOLD }}
          aria-hidden
        >
          <Trophy size={25} />
          <BarChart3 size={25} />
        </span>
      </div>
    </section>
  );
}
