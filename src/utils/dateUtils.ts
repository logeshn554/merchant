/**
 * Date and timezone utilities for AllGo.
 * Computes calendar day boundaries in Asia/Kolkata (IST).
 */

export function getTodayIST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isSameDayIST(date1: Date | string | number, date2: Date | string | number = new Date()): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return getTodayIST(d1) === getTodayIST(d2);
}
