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
    <section className="mt-10">
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {ACTIONS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex flex-col items-center px-2 text-center">
            <Icon size={26} style={{ color: NAVY }} aria-hidden />
            <span className="mt-2 block text-sm font-bold leading-snug text-gray-900">
              {t(key)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: NAVY }}
        >
          <ShieldCheck size={22} className="text-white" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-gray-900">{t('involvementTitle')}</span>
          <span className="mt-0.5 block text-sm text-text-secondary">{t('involvementBody')}</span>
        </span>
        <span className="hidden shrink-0 items-center gap-2 sm:flex" aria-hidden>
          <Trophy size={30} style={{ color: NAVY }} />
          <BarChart3 size={30} style={{ color: NAVY }} />
        </span>
      </div>
    </section>
  );
}
