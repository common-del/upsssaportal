'use client';

import { useState } from 'react';
import { Play, Clock } from 'lucide-react';

type Props = {
  title: string;
  description: string;
  /** YouTube video ID. Omit to show a "coming soon" placeholder instead of a
   * non-functional player - there's no real explainer film yet. */
  videoId?: string;
  minutes?: string;
};

export function ExplainerFilm({ title, description, videoId, minutes = '1 min' }: Props) {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-[#EEF0F8] px-4 py-2.5">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>

      {!videoId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-gray-50 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-gray-400">
            <Play size={22} />
          </div>
          <p className="text-sm font-medium text-gray-500">Video coming soon</p>
        </div>
      ) : playing ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={title}
          className="group relative block aspect-video w-full bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-95 transition group-hover:opacity-100"
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-105">
              <Play size={26} fill="#1B2A6B" className="ml-1 text-[#1B2A6B]" />
            </span>
          </span>
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
            <Clock size={12} />
            {minutes}
          </span>
        </button>
      )}
    </section>
  );
}
