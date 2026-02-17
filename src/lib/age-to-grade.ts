/**
 * Maps a child's age (as of academic year start, April 1) to an eligible
 * grade using RTE norms for Uttar Pradesh.
 *
 * Returns null if age is below 6 or above 17.
 */
export function ageToGrade(ageYears: number): number | null {
  if (ageYears < 6 || ageYears > 17) return null;
  return ageYears - 5; // 6→1, 7→2, …, 17→12
}

/**
 * Computes a child's age in completed years as of the academic year start
 * (April 1 of the current academic year).
 */
export function computeAge(dob: Date): number {
  const today = new Date();
  // Academic year starts April 1
  const academicYearStart = new Date(today.getFullYear(), 3, 1); // month is 0-indexed, so 3 = April
  // If we haven't reached April yet, use last year's April 1
  const refDate =
    today < academicYearStart
      ? new Date(today.getFullYear() - 1, 3, 1)
      : academicYearStart;

  let age = refDate.getFullYear() - dob.getFullYear();
  const monthDiff = refDate.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Returns a localized grade label like "Class 5" or "कक्षा 5".
 */
export function gradeLabel(grade: number, locale: string): string {
  return locale === 'hi' ? `कक्षा ${grade}` : `Class ${grade}`;
}
