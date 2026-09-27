export type Weekday = 2 | 3 | 4 | 5 | 6 | 7; // 2 = Thứ 2, 7 = Thứ 7

export type SessionType = 'morning' | 'afternoon';

export type LessonStatus = 'pending' | 'taught' | 'adjusted' | 'cancelled';

export interface TeacherProfile {
  teacherName: string;
  school: string;
  department: string;
  reviewer: string;
  reviewerTitle: string;
  schoolYear: string;
  semester: 'Học kỳ I' | 'Học kỳ II';
}

export interface TimetableSlot {
  id: string;
  weekNumber: number;
  year: number; // e.g. 2024
  weekday: Weekday;
  session: SessionType;
  period: number; // 1 to 5
  rawText: string; // e.g. "10A8-Toán" or "Chào cờ"
  className: string; // e.g. "10A8"
  subject: string; // e.g. "Toán"
  activity?: string; // e.g. "Chào cờ", "Khai giảng", "Sinh hoạt lớp"
  isOff?: boolean; // Nghỉ
  room?: string;
  note?: string;
}

export interface CurriculumEntry {
  id: string;
  subject: string; // e.g. "Toán"
  grade: number; // 10, 11, 12, etc.
  periodNumber: number; // 1, 2, 3...
  lessonTitle: string; // "Bài 1: Mệnh đề (T1)"
  semester: 'Học kỳ I' | 'Học kỳ II';
  category?: string; // "Đại số", "Hình học", "Kiểm tra", "Chuyên đề"
  note?: string;
}

export interface LessonLogEntry {
  id: string;
  weekNumber: number;
  year: number;
  date: string; // YYYY-MM-DD
  weekday: Weekday;
  session: SessionType;
  period: number; // 1 to 5
  subject: string;
  className: string;
  curriculumPeriod?: number; // Tiết theo PPCT
  lessonTitle: string;
  adjustment?: string; // Điều chỉnh / Ghi chú
  status: LessonStatus;
  isManuallyEdited?: boolean;
  activity?: string;
  note?: string;
  timetableSlotId?: string;
}

export interface SubjectAlias {
  id: string;
  alias: string; // e.g. "ĐS", "GT", "HH"
  canonicalSubject: string; // e.g. "Toán"
  grade?: number; // optional, e.g. 10
}

export interface AppSettings {
  schoolYear: string;
  currentWeek: number;
  startMondayDate: string; // YYYY-MM-DD of Week 1 Monday
  includeSaturday: boolean;
  morningPeriods: number; // 5
  afternoonPeriods: number; // 5
  autoMatchPPCT: boolean;
}

export interface UserAccount {
  id: string; // usually username
  username: string;
  passwordHash: string;
  teacherName: string;
  school: string;
  department: string;
  role: 'admin' | 'teacher';
  createdAt: string;
  lastLoginAt: string;
  status: 'active' | 'locked';
  stats?: {
    timetableSlots: number;
    curriculumLessons: number;
    lessonLogsCount: number;
  };
}

export interface AuthSession {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export interface StorageData {
  profile: TeacherProfile;
  settings: AppSettings;
  timetable: TimetableSlot[];
  curriculum: CurriculumEntry[];
  lessonLogs: LessonLogEntry[];
  aliases: SubjectAlias[];
  lastUpdated: string;
}
