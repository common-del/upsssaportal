import { Star } from 'lucide-react';
import type { PerformanceLevel } from '@/lib/public/constants';
import { tierStars } from '@/lib/public/schoolProfile';

export function TierStars({ level, size = 14 }: { level: PerformanceLevel; size?: number }) {
  const filled = tierStars(level);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${filled} of 3 stars (${level})`}>
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= filled ? 'fill-[#F5B731] text-[#F5B731]' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}
