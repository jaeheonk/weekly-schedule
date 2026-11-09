import { WeekdayNumber } from '../types/schedule';

/**
 * Returns the ISO-8601 Weekday number (1 = Monday, ..., 7 = Sunday)
 */
export function getWeekdayNumber(date: Date = new Date()): WeekdayNumber {
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  return day === 0 ? 7 : (day as WeekdayNumber);
}

/**
 * Returns the ISO-8601 week key: "YYYY-Www" (e.g., "2026-W46")
 */
export function getWeekKey(date: Date = new Date()): string {
  // Target date
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO week date weeks start on Monday, so correct the day number
  const dayNr = (target.getUTCDay() + 6) % 7;
  // Set the target to the nearest Thursday (current date + 3 - current day number)
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  // ISO-8601 year
  const firstThursday = target.getTime();
  // January 1st of the target year
  target.setUTCMonth(0, 1);
  // If Jan 1st isn't a Thursday, move to nearest Thursday
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  // Number of days between first Thursday and current Thursday divided by 7 + 1
  const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / (7 * 24 * 3600 * 1000));
  const year = new Date(firstThursday).getUTCFullYear();
  const paddedWeek = String(weekNumber).padStart(2, '0');
  return `${year}-W${paddedWeek}`;
}

/**
 * Formats hour and minute into friendly Korean string (e.g. "오후 3시", "오후 3:30")
 */
export function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  if (minute === 0) {
    return `${period} ${displayHour}시`;
  }
  return `${period} ${displayHour}:${String(minute).padStart(2, '0')}`;
}

/**
 * Formats time range: "오후 3시 ~ 오후 4시"
 */
export function formatTimeRange(startHour: number, startMinute: number, endHour: number, endMinute: number): string {
  return `${formatTime(startHour, startMinute)} ~ ${formatTime(endHour, endMinute)}`;
}

/**
 * Comparator to sort schedule items chronologically by start time
 */
export function compareScheduleItemsByTime(
  a: { startHour: number; startMinute: number },
  b: { startHour: number; startMinute: number }
): number {
  const aMin = a.startHour * 60 + a.startMinute;
  const bMin = b.startHour * 60 + b.startMinute;
  return aMin - bMin;
}
