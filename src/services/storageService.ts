import { StorageData, UserAccount } from '../types';
import {
  INITIAL_ALIASES,
  INITIAL_CURRICULUM,
  INITIAL_LESSON_LOGS,
  INITIAL_PROFILE,
  INITIAL_SETTINGS,
  INITIAL_TIMETABLE,
} from '../utils/sampleData';

const BASE_STORAGE_KEY = 'SO_BAO_GIANG_APP_STATE_V1';

export function getUserStorageKey(username?: string): string {
  if (!username) return BASE_STORAGE_KEY;
  return `SO_BAO_GIANG_APP_STATE_${username.trim().toLowerCase()}`;
}

export function getInitialStorageData(account?: UserAccount | null): StorageData {
  const profile = account
    ? {
        ...INITIAL_PROFILE,
        teacherName: account.teacherName || INITIAL_PROFILE.teacherName,
        school: account.school || INITIAL_PROFILE.school,
        department: account.department || INITIAL_PROFILE.department,
      }
    : INITIAL_PROFILE;

  return {
    profile,
    settings: INITIAL_SETTINGS,
    timetable: INITIAL_TIMETABLE,
    curriculum: INITIAL_CURRICULUM,
    lessonLogs: INITIAL_LESSON_LOGS,
    aliases: INITIAL_ALIASES,
    lastUpdated: new Date().toISOString(),
  };
}

export function getEmptyStorageData(account?: UserAccount | null): StorageData {
  return {
    profile: {
      teacherName: account?.teacherName || '',
      school: account?.school || 'Trường Cao đẳng nghề 1-BQP',
      department: account?.department || 'Tổ bộ môn',
      reviewer: '',
      reviewerTitle: 'Tổ trưởng chuyên môn',
      schoolYear: '2026 - 2027',
      semester: 'Học kỳ I',
    },
    settings: INITIAL_SETTINGS,
    timetable: [],
    curriculum: [],
    lessonLogs: [],
    aliases: INITIAL_ALIASES,
    lastUpdated: new Date().toISOString(),
  };
}

export function loadAppState(username?: string, account?: UserAccount | null): StorageData {
  const key = getUserStorageKey(username);
  try {
    let raw = localStorage.getItem(key);

    // If no data for this specific user, check if we can migrate from legacy base key (e.g. for admin)
    if (!raw && (!username || username === 'sanginnova')) {
      const legacy = localStorage.getItem(BASE_STORAGE_KEY);
      if (legacy) {
        raw = legacy;
        // Copy over to user-specific key
        localStorage.setItem(key, legacy);
      }
    }

    if (!raw) {
      // If it's a new teacher account, create clean workspace
      if (username && username !== 'sanginnova') {
        const fresh = getEmptyStorageData(account);
        saveAppState(fresh, username);
        return fresh;
      }
      const initial = getInitialStorageData(account);
      saveAppState(initial, username);
      return initial;
    }

    const parsed = JSON.parse(raw);
    const rawProfile = parsed.profile || (account ? getEmptyStorageData(account).profile : INITIAL_PROFILE);
    const rawSettings = parsed.settings || INITIAL_SETTINGS;

    // Automatic migration to new school and schoolYear defaults
    const migratedSchool =
      !rawProfile.school ||
      rawProfile.school === 'Trường THPT' ||
      rawProfile.school === 'Trường THPT Lê Hồng Phong' ||
      rawProfile.school === 'Trường THPT Chu Văn An' ||
      rawProfile.school === 'Quản trị hệ thống'
        ? 'Trường Cao đẳng nghề 1-BQP'
        : rawProfile.school;

    const migratedSchoolYear =
      !rawProfile.schoolYear ||
      rawProfile.schoolYear === '2024 - 2025' ||
      rawProfile.schoolYear === '2024-2025'
        ? '2026 - 2027'
        : rawProfile.schoolYear;

    const migratedSettingsYear =
      !rawSettings.schoolYear ||
      rawSettings.schoolYear === '2024 - 2025' ||
      rawSettings.schoolYear === '2024-2025'
        ? '2026 - 2027'
        : rawSettings.schoolYear;

    const migratedStartMonday =
      !rawSettings.startMondayDate || rawSettings.startMondayDate === '2024-09-02'
        ? '2026-09-07'
        : rawSettings.startMondayDate;

    return {
      profile: {
        ...rawProfile,
        school: migratedSchool,
        schoolYear: migratedSchoolYear,
      },
      settings: {
        ...rawSettings,
        schoolYear: migratedSettingsYear,
        startMondayDate: migratedStartMonday,
      },
      timetable: parsed.timetable || [],
      curriculum: parsed.curriculum || [],
      lessonLogs: parsed.lessonLogs || [],
      aliases: parsed.aliases || INITIAL_ALIASES,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Error loading app state for ${key}:`, err);
    return getInitialStorageData(account);
  }
}

export function saveAppState(data: StorageData, username?: string): void {
  const key = getUserStorageKey(username);
  try {
    const updatedData: StorageData = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(updatedData));
  } catch (err) {
    console.error(`Failed to save to localStorage (${key}):`, err);
  }
}

export function exportBackupJSON(data: StorageData, teacherName?: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (teacherName || 'GiaoVien').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `SoBaoGiang_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

