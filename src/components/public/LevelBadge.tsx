import { cn } from '@/lib/cn';
import type { PerformanceLevel } from '@/lib/public/constants';
import { PERFORMANCE_COLORS } from '@/lib/public/constants';

const TEXT_COLORS: Record<PerformanceLevel, string> = {
  Uday: 'text-pink-900',
  Unnat: 'text-amber-900',
  Utkarsh: 'text-green-900',
};

export function LevelBadge({
  level,
  className,
}: {
  level: PerformanceLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TEXT_COLORS[level],
        className,
      )}
      style={{ backgroundColor: PERFORMANCE_COLORS[level] }}
    >
      {level}
    </span>
  );
}
