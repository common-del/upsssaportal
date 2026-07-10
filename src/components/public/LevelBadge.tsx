import { cn } from '@/lib/cn';
import type { PerformanceLevel } from '@/lib/public/constants';
import { PERFORMANCE_COLORS } from '@/lib/public/constants';

const TEXT_COLORS: Record<PerformanceLevel, string> = {
  Uday: 'text-gray-700',
  Unnat: 'text-[#1B2A6B]',
  Utkarsh: 'text-[#F5B731]',
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
