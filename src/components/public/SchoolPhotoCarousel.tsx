'use client';

import { useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SchoolPhoto } from '@/lib/public/schoolProfile';

/**
 * The school's photographs, at the bottom of the public profile.
 *
 * Nothing populates this yet. There is no photo field on `School` and no upload
 * flow anywhere in the portal, so every school currently shows placeholders. That
 * is deliberate rather than hidden: an empty strip that names the views a parent
 * would expect is honest about what is missing, where quietly rendering nothing
 * would leave the profile looking finished when a whole section of it is not.
 *
 * The placeholder captions are derived from what the school actually reports —
 * a school with no library gets no library slot — so the strip never implies a
 * facility the record does not claim.
 *
 * When photos do exist, pass them in and nothing else changes: the frame, the
 * arrows, the dots and the counter all behave the same way.
 */

const NAVY = '#1B2A6B';

type Slide = { key: string; url: string | null; caption: string };

export function SchoolPhotoCarousel({
  photos,
  placeholderCaptions,
  schoolName,
}: {
  photos: SchoolPhoto[];
  /** Used only when there are no photos. One placeholder frame per caption. */
  placeholderCaptions: string[];
  schoolName: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const isPlaceholder = photos.length === 0;
  const slides: Slide[] = isPlaceholder
    ? placeholderCaptions.map((caption, i) => ({ key: `ph-${i}`, url: null, caption }))
    : photos.map((p, i) => ({ key: `${i}-${p.url}`, url: p.url, caption: p.caption }));

  // Nothing to show and nothing to promise. Only reachable if a school reports no
  // building, no classrooms and no facilities at all.
  if (slides.length === 0) return null;

  const scrollToIndex = (i: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, i));
    strip.scrollTo({ left: clamped * strip.clientWidth, behavior: 'smooth' });
    // Set it here as well as on scroll, so the dots respond immediately rather
    // than only once the smooth scroll settles.
    setIndex(clamped);
  };

  // Keeps the dots and the counter honest when somebody swipes or drags instead
  // of using the arrows.
  const handleScroll = () => {
    const strip = stripRef.current;
    if (!strip || strip.clientWidth === 0) return;
    setIndex(Math.round(strip.scrollLeft / strip.clientWidth));
  };

  const atStart = index === 0;
  const atEnd = index === slides.length - 1;

  return (
    <section aria-labelledby="school-photos-heading">
      <h2 id="school-photos-heading" className="text-lg font-bold text-[#1B2A6B]">
        Photos
      </h2>
      {isPlaceholder && (
        <p className="mt-1 text-sm text-gray-500">
          No photographs have been uploaded for this school yet. They will appear here once the
          school adds them.
        </p>
      )}

      {/* Capped rather than full-bleed: a photograph across the whole content
          column would be over 1100px wide, and at any sensible height that is a
          letterbox, not a picture of a school. 16:9 inside 768px is a photo shape
          at every screen size, without fixed heights per breakpoint. */}
      <div className="relative mt-4 max-w-3xl">
        <div
          ref={stripRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-xl [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {slides.map((s) => (
            <div key={s.key} className="w-full shrink-0 snap-start">
              {s.url ? (
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.url}
                    alt={`${s.caption} at ${schoolName}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-[#F8F9FA]">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm">
                    <Camera className="h-6 w-6 text-gray-400" strokeWidth={1.75} aria-hidden />
                  </span>
                  <p className="px-4 text-center text-base font-semibold text-gray-500">
                    {s.caption}
                  </p>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Photo awaited</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* One frame needs no arrows. Disabled at the ends rather than looping,
            so the counter under the frame always means what it says. */}
        {slides.length > 1 && (
          <>
            <ArrowButton
              side="left"
              disabled={atStart}
              onClick={() => scrollToIndex(index - 1)}
              label="Previous photo"
            />
            <ArrowButton
              side="right"
              disabled={atEnd}
              onClick={() => scrollToIndex(index + 1)}
              label="Next photo"
            />
          </>
        )}
      </div>

      {/* Same cap as the frame, so the caption sits under the picture and the dots
          under its right edge rather than out at the far side of the page. */}
      <div className="mt-3 flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">{slides[index]?.caption}</span>
          {slides.length > 1 && (
            <span className="ml-2 tabular-nums text-gray-400">
              {index + 1} of {slides.length}
            </span>
          )}
        </p>

        {slides.length > 1 && (
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => scrollToIndex(i)}
                aria-label={`Show ${s.caption}`}
                aria-current={i === index}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index ? 'w-5' : 'w-2 bg-gray-300 hover:bg-gray-400',
                )}
                style={i === index ? { backgroundColor: NAVY } : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ArrowButton({
  side,
  disabled,
  onClick,
  label,
}: {
  side: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-gray-200 bg-white/95 shadow-md transition',
        side === 'left' ? 'left-3' : 'right-3',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-white',
      )}
    >
      <Icon className="h-5 w-5 text-[#1B2A6B]" strokeWidth={2.25} aria-hidden />
    </button>
  );
}
