import Link from 'next/link';
import {
  Search,
  School,
  AlertTriangle,
  FileText,
  ArrowRight,
} from 'lucide-react';

const STATS_STRIP = [
  { label: 'Total Schools', value: '1,50,540' },
  { label: 'Schools Assessed', value: '45,230' },
  { label: '🔴 UDAY SCHOOLS', value: '33.7%' },
  { label: '🟡 UNNAT SCHOOLS', value: '44.6%' },
  { label: '🟢 UTKARSH SCHOOLS', value: '21.7%' },
] as const;

const QUICK_ACCESS = [
  {
    href: '/public/find',
    title: 'Find School',
    description: 'Answer a few questions to find the right school for your child',
    icon: Search,
  },
  {
    href: '/public/directory',
    title: 'School Directory',
    description: 'Browse and search all schools in Uttar Pradesh',
    icon: School,
  },
  {
    href: '/public/reports',
    title: 'Public Reports',
    description: 'View state, district and school performance reports',
    icon: FileText,
  },
  {
    href: '/public/dispute/new',
    title: 'Dispute & Feedback',
    description: 'File a dispute or share feedback about a school',
    icon: AlertTriangle,
  },
] as const;

export default function PublicHomePage() {
  return (
    <div className="bg-[#F3F4F6]">
      <section className="bg-[#1B2A6B] px-4 py-14 text-white sm:py-16">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
            State School Standards Authority — Uttar Pradesh
          </h1>
          <p className="mt-4 text-lg text-white/95 sm:text-xl">
            School Quality Monitoring and Accreditation Portal
          </p>
          <p className="mt-2 text-sm text-white/70">
            Access school information, performance reports, and grievance services.
          </p>
        </div>
      </section>

      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col divide-y divide-gray-200 sm:flex-row sm:divide-x sm:divide-y-0">
          {STATS_STRIP.map((stat) => (
            <div key={stat.label} className="flex-1 px-6 py-5 text-center sm:text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-bold text-[#1B2A6B] sm:text-2xl">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {QUICK_ACCESS.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1B2A6B] text-white">
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#1B2A6B]">{title}</p>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              </div>
              <ArrowRight
                size={18}
                className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1B2A6B]"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
