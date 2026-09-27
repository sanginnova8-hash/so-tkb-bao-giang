import { Weekday } from '../types';

export const WEEKDAYS: { key: Weekday; label: string; shortLabel: string }[] = [
  { key: 2, label: 'Thứ Hai', shortLabel: 'T2' },
  { key: 3, label: 'Thứ Ba', shortLabel: 'T3' },
  { key: 4, label: 'Thứ Tư', shortLabel: 'T4' },
  { key: 5, label: 'Thứ Năm', shortLabel: 'T5' },
  { key: 6, label: 'Thứ Sáu', shortLabel: 'T6' },
  { key: 7, label: 'Thứ Bảy', shortLabel: 'T7' },
];

/**
 * Parses YYYY-MM-DD string to Date at 00:00:00 local time
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

/**
 * Formats Date to YYYY-MM-DD
 */
export function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats YYYY-MM-DD to dd/MM/yyyy (Vietnamese standard)
 */
export function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Gets the Date object for a specific day in weekNumber given startMonday of Week 1
 */
export function getDateOfWeekDay(startMondayDate: string, weekNumber: number, weekday: Weekday): Date {
  const baseMonday = parseDate(startMondayDate);
  // Week 1 starts at baseMonday
  const weekOffsetDays = (weekNumber - 1) * 7;
  // Monday is weekday 2, offset = 0
  const dayOffset = weekday - 2;
  const result = new Date(baseMonday);
  result.setDate(result.getDate() + weekOffsetDays + dayOffset);
  return result;
}

/**
 * Gets the date range formatted string for a week: e.g. "Từ 09/09/2024 đến 14/09/2024"
 */
export function getWeekDateRangeVN(startMondayDate: string, weekNumber: number, includeSaturday: boolean = false): {
  startDateStr: string;
  endDateStr: string;
  displayRange: string;
} {
  const mon = getDateOfWeekDay(startMondayDate, weekNumber, 2);
  const endDay = includeSaturday ? 7 : 6;
  const end = getDateOfWeekDay(startMondayDate, weekNumber, endDay as Weekday);

  const startISO = formatDateISO(mon);
  const endISO = formatDateISO(end);

  const startVN = formatDateVN(startISO);
  const endVN = formatDateVN(endISO);

  return {
    startDateStr: startISO,
    endDateStr: endISO,
    displayRange: `Từ ngày ${startVN} đến ngày ${endVN}`,
  };
}

/**
 * Gets current week number estimated from today's date vs startMonday
 */
export function getCurrentWeekNumber(startMondayDate: string): number {
  try {
    const start = parseDate(startMondayDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 1;
    const week = Math.floor(diffDays / 7) + 1;
    return Math.max(1, Math.min(week, 40));
  } catch {
    return 1;
  }
}
