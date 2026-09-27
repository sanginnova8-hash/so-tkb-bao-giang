import {
  CurriculumEntry,
  LessonLogEntry,
  SubjectAlias,
  TimetableSlot,
  Weekday,
} from '../types';
import { formatDateISO, getDateOfWeekDay } from './dateUtils';

/**
 * Extracts numeric grade from class name:
 * "10A8" -> 10, "12B1" -> 12, "11A1" -> 11, "6A" -> 6
 */
export function extractGradeFromClass(className: string): number | null {
  if (!className) return null;
  const match = className.trim().match(/^(\d{1,2})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Resolves canonical subject name using alias table
 */
export function resolveCanonicalSubject(
  rawSubject: string,
  aliases: SubjectAlias[],
  grade?: number | null
): string {
  if (!rawSubject) return '';
  const trimmed = rawSubject.trim();

  // Try exact match with grade
  if (grade !== null && grade !== undefined) {
    const matchWithGrade = aliases.find(
      (a) =>
        a.alias.toLowerCase() === trimmed.toLowerCase() &&
        a.grade === grade
    );
    if (matchWithGrade) return matchWithGrade.canonicalSubject;
  }

  // Try exact match without grade restriction
  const matchGeneral = aliases.find(
    (a) => a.alias.toLowerCase() === trimmed.toLowerCase()
  );
  if (matchGeneral) return matchGeneral.canonicalSubject;

  return trimmed;
}

/**
 * Sorts timetable slots chronologically:
 * Day (2..7) -> Session (morning before afternoon) -> Period (1..5)
 */
export function sortSlotsChronologically<T extends { weekday: Weekday; session: string; period: number }>(
  slots: T[]
): T[] {
  return [...slots].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    if (a.session !== b.session) {
      return a.session === 'morning' ? -1 : 1;
    }
    return a.period - b.period;
  });
}

/**
 * Generate weekly lesson log from timetable and curriculum
 */
export function generateWeeklyLessonLog(params: {
  weekNumber: number;
  year: number;
  startMondayDate: string;
  timetable: TimetableSlot[];
  curriculum: CurriculumEntry[];
  aliases: SubjectAlias[];
  existingLogs: LessonLogEntry[];
  keepManualEdits?: boolean;
}): {
  newLogs: LessonLogEntry[];
  stats: {
    total: number;
    matched: number;
    unmatched: number;
    activities: number;
  };
} {
  const {
    weekNumber,
    year,
    startMondayDate,
    timetable,
    curriculum,
    aliases,
    existingLogs,
    keepManualEdits = true,
  } = params;

  // 1. Filter timetable slots for the target week
  const weekSlots = timetable.filter(
    (slot) => slot.weekNumber === weekNumber && !slot.isOff && (slot.className || slot.subject || slot.activity)
  );

  const sortedSlots = sortSlotsChronologically(weekSlots);

  // 2. Build prior progress counter per class + canonical subject
  // Count maximum curriculumPeriod used in previous weeks (< weekNumber)
  const classSubjectMaxPeriod: Record<string, number> = {};

  const priorLogs = existingLogs.filter((log) => log.weekNumber < weekNumber);
  for (const log of priorLogs) {
    if (log.className && log.subject && typeof log.curriculumPeriod === 'number') {
      const grade = extractGradeFromClass(log.className);
      const canonical = resolveCanonicalSubject(log.subject, aliases, grade);
      const key = `${log.className.toUpperCase()}__${canonical.toUpperCase()}`;
      if (!classSubjectMaxPeriod[key] || log.curriculumPeriod > classSubjectMaxPeriod[key]) {
        classSubjectMaxPeriod[key] = log.curriculumPeriod;
      }
    }
  }

  // Also check existing logs in current week if user wants to keep manual edits
  const currentWeekExisting = existingLogs.filter((log) => log.weekNumber === weekNumber);
  const existingMap = new Map<string, LessonLogEntry>();
  currentWeekExisting.forEach((log) => {
    // Key by slot ID or by day+session+period
    const key = log.timetableSlotId || `${log.weekday}_${log.session}_${log.period}`;
    existingMap.set(key, log);
  });

  const generatedLogs: LessonLogEntry[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let activityCount = 0;

  // Running counters for the current week
  const runningCounters: Record<string, number> = { ...classSubjectMaxPeriod };

  for (const slot of sortedSlots) {
    const slotKey = slot.id || `${slot.weekday}_${slot.session}_${slot.period}`;
    const existing = existingMap.get(slotKey);

    // Compute date for this slot
    const slotDateObj = getDateOfWeekDay(startMondayDate, weekNumber, slot.weekday);
    const dateStr = formatDateISO(slotDateObj);

    // If existing log is manually edited and keepManualEdits is true, preserve it
    if (existing && existing.isManuallyEdited && keepManualEdits) {
      generatedLogs.push({
        ...existing,
        date: dateStr,
        timetableSlotId: slot.id,
      });

      // Advance counter if it has a curriculum period
      if (existing.className && existing.subject && typeof existing.curriculumPeriod === 'number') {
        const grade = extractGradeFromClass(existing.className);
        const canonical = resolveCanonicalSubject(existing.subject, aliases, grade);
        const key = `${existing.className.toUpperCase()}__${canonical.toUpperCase()}`;
        if (!runningCounters[key] || existing.curriculumPeriod > runningCounters[key]) {
          runningCounters[key] = existing.curriculumPeriod;
        }
      }
      matchedCount++;
      continue;
    }

    // Check if slot is a special activity without formal curriculum
    const isSpecialActivity =
      Boolean(slot.activity) ||
      ['chào cờ', 'sinh hoạt', 'khai giảng', 'họp', 'ngoại khóa'].some((kw) =>
        (slot.rawText || '').toLowerCase().includes(kw)
      );

    if (isSpecialActivity) {
      activityCount++;
      const actTitle =
        slot.activity ||
        slot.rawText ||
        (slot.period === 1 && slot.weekday === 2 ? 'Chào cờ đầu tuần' : 'Sinh hoạt lớp');

      generatedLogs.push({
        id: existing?.id || `log-${weekNumber}-${slot.weekday}-${slot.session}-${slot.period}-${Date.now().toString(36)}`,
        weekNumber,
        year,
        date: dateStr,
        weekday: slot.weekday,
        session: slot.session,
        period: slot.period,
        subject: slot.subject || slot.activity || slot.rawText,
        className: slot.className || (slot.weekday === 2 && slot.period === 1 ? 'Toàn trường' : ''),
        curriculumPeriod: undefined,
        lessonTitle: existing?.lessonTitle || actTitle,
        adjustment: existing?.adjustment || '',
        status: existing?.status || 'pending',
        isManuallyEdited: false,
        activity: actTitle,
        timetableSlotId: slot.id,
      });
      continue;
    }

    // Regular lesson: find curriculum entry
    const grade = extractGradeFromClass(slot.className);
    const canonical = resolveCanonicalSubject(slot.subject, aliases, grade);
    const counterKey = `${slot.className.toUpperCase()}__${canonical.toUpperCase()}`;

    const currentPeriodNum = (runningCounters[counterKey] || 0) + 1;
    runningCounters[counterKey] = currentPeriodNum;

    // Search in PPCT by grade + subject + periodNumber
    let matchedCurriculum: CurriculumEntry | undefined;

    if (grade !== null) {
      matchedCurriculum = curriculum.find(
        (c) =>
          c.grade === grade &&
          c.periodNumber === currentPeriodNum &&
          c.subject.toLowerCase() === canonical.toLowerCase()
      );
    }

    // Fallback search without grade if not found
    if (!matchedCurriculum) {
      matchedCurriculum = curriculum.find(
        (c) =>
          c.periodNumber === currentPeriodNum &&
          c.subject.toLowerCase() === canonical.toLowerCase()
      );
    }

    if (matchedCurriculum) {
      matchedCount++;
      generatedLogs.push({
        id: existing?.id || `log-${weekNumber}-${slot.weekday}-${slot.session}-${slot.period}-${Date.now().toString(36)}`,
        weekNumber,
        year,
        date: dateStr,
        weekday: slot.weekday,
        session: slot.session,
        period: slot.period,
        subject: slot.subject || canonical,
        className: slot.className,
        curriculumPeriod: currentPeriodNum,
        lessonTitle: existing?.isManuallyEdited ? existing.lessonTitle : matchedCurriculum.lessonTitle,
        adjustment: existing?.adjustment || '',
        status: existing?.status || 'pending',
        isManuallyEdited: existing?.isManuallyEdited || false,
        timetableSlotId: slot.id,
      });
    } else {
      unmatchedCount++;
      generatedLogs.push({
        id: existing?.id || `log-${weekNumber}-${slot.weekday}-${slot.session}-${slot.period}-${Date.now().toString(36)}`,
        weekNumber,
        year,
        date: dateStr,
        weekday: slot.weekday,
        session: slot.session,
        period: slot.period,
        subject: slot.subject || canonical,
        className: slot.className,
        curriculumPeriod: currentPeriodNum,
        lessonTitle: existing?.lessonTitle || `Chưa ghép được bài PPCT (Tiết ${currentPeriodNum})`,
        adjustment: existing?.adjustment || '',
        status: existing?.status || 'pending',
        isManuallyEdited: false,
        timetableSlotId: slot.id,
        note: 'Chưa có trong danh mục PPCT',
      });
    }
  }

  return {
    newLogs: generatedLogs,
    stats: {
      total: generatedLogs.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      activities: activityCount,
    },
  };
}
