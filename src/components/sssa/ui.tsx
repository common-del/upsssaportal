import type { ReactNode } from 'react';

/**
 * Shared page furniture for the SSSA console.
 *
 * Each page was assembling its own header, stat tiles and tables, so headings sat
 * at slightly different sizes and tables at slightly different paddings. These are
 * the same components everywhere, which is what makes the pages line up.
 *
 * Subtitles are deliberately short. An admin console explains a column when the
 * column is ambiguous; it does not narrate why the page is arranged as it is.
 */

const NAVY = '#1B2A6B';

const TONE: Record<string, string> = {
  red: '#C8372D',
  amber: '#B8791A',
  green: '#1C7A4A',
  muted: '#9AA2B4',
  default: '#111827',
};

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </header>
  );
}

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  /** One short line, only when a column or figure would otherwise be ambiguous. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-bold tracking-tight text-gray-900">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: keyof typeof TONE | string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div
        className="mt-1 text-3xl font-bold leading-none tracking-tight tabular-nums"
        style={{ color: TONE[tone] ?? TONE.default }}
      >
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      {sub && <div className="mt-1 text-xs tabular-nums text-gray-500">{sub}</div>}
    </div>
  );
}

export function Table({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white text-[13px]"
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`border-b border-gray-100 bg-gray-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  strong,
  bold,
  muted,
  tone,
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  /** The row's subject — the school or person the row is about. */
  strong?: boolean;
  bold?: boolean;
  muted?: boolean;
  tone?: keyof typeof TONE | string;
}) {
  const color = tone ? (TONE[tone] ?? TONE.default) : strong ? NAVY : muted ? '#6B7280' : undefined;
  return (
    <td
      className={[
        'px-4 py-3 align-middle',
        align === 'right' ? 'text-right tabular-nums' : 'text-left',
        strong || bold ? 'font-semibold' : '',
        color ? '' : 'text-gray-700',
      ].join(' ')}
      style={color ? { color } : undefined}
    >
      {children}
    </td>
  );
}

const PILL: Record<string, string> = {
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  grey: 'bg-gray-100 text-gray-600',
};

export function Pill({ children, tone = 'grey' }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${PILL[tone] ?? PILL.grey}`}
    >
      {children}
    </span>
  );
}
