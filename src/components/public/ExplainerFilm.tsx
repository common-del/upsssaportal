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
    <section className="flex flex-col justify-center border-t border-white/10 p-7 text-white sm:p-9 lg:border-l lg:border-t-0">
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1 text-xs text-white/70">{description}</p>

      {!videoId ? (
        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-white/5 px-6 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white/70">
            <Play size={22} />
          </div>
          <p className="text-sm font-medium text-white/60">Video coming soon</p>
        </div>
      ) : playing ? (
        <div className="mt-5 aspect-video w-full overflow-hidden rounded-xl bg-black">
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
          className="group relative mt-5 block aspect-video w-full overflow-hidden rounded-xl bg-black"
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
