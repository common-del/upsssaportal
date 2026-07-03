import Link from 'next/link';
import { AlertTriangle, SearchCheck, ArrowRight } from 'lucide-react';

const OPTIONS = [
  {
    href: '/public/dispute/new',
    title: 'File a Dispute',
    description:
      'Report an issue or concern about a school — fees, safety, infrastructure, or anything else.',
    icon: AlertTriangle,
  },
  {
    href: '/public/dispute/track',
    title: 'Track a Dispute',
    description: 'Check the status of a grievance you have already filed.',
    icon: SearchCheck,
  },
] as const;

export default function DisputeLandingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">
        Dispute Resolution
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        The grievance redressal facility for schools under UP SSSA jurisdiction.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1B2A6B] text-white">
              <Icon size={20} />
            </div>
            <p className="mt-4 flex items-center gap-2 font-bold text-[#1B2A6B]">
              {title}
              <ArrowRight
                size={16}
                className="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#1B2A6B]"
              />
            </p>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
