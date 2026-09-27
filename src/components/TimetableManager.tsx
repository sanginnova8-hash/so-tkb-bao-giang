import React, { useState } from 'react';
import {
  Calendar,
  Copy,
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Check,
  X,
  Edit2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { AppSettings, CurriculumEntry, LessonLogEntry, SessionType, SubjectAlias, TeacherProfile, TimetableSlot, Weekday } from '../types';
import { formatDateVN, getDateOfWeekDay, getWeekDateRangeVN, WEEKDAYS } from '../utils/dateUtils';
import { exportTimetableToExcel } from '../utils/excelUtils';
import { generateWeeklyLessonLog } from '../utils/lessonLogGenerator';
import { AiTimetableParserModal } from './AiTimetableParserModal';

interface TimetableManagerProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  timetable: TimetableSlot[];
  setTimetable: React.Dispatch<React.SetStateAction<TimetableSlot[]>>;
  onAfterTKBModified?: () => void;
  curriculum?: CurriculumEntry[];
  aliases?: SubjectAlias[];
  lessonLogs?: LessonLogEntry[];
  setLessonLogs?: React.Dispatch<React.SetStateAction<LessonLogEntry[]>>;
  setProfile?: React.Dispatch<React.SetStateAction<TeacherProfile>>;
}

export const TimetableManager: React.FC<TimetableManagerProps> = ({
  settings,
  setSettings,
  timetable,
  setTimetable,
  onAfterTKBModified,
  curriculum = [],
  aliases = [],
  lessonLogs = [],
  setLessonLogs,
  setProfile,
}) => {
  const currentWeek = settings.currentWeek;
  const currentWeekSlots = timetable.filter((s) => s.weekNumber === currentWeek);
  const weekRange = getWeekDateRangeVN(settings.startMondayDate, currentWeek, settings.includeSaturday);

  const days: Weekday[] = settings.includeSaturday ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6];

  // AI Timetable Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Cell editing state
  const [editingSlot, setEditingSlot] = useState<{
    weekday: Weekday;
    session: SessionType;
    period: number;
    existing?: TimetableSlot;
    rawText: string;
    className: string;
    subject: string;
    activity: string;
    isOff: boolean;
    note: string;
  } | null>(null);

  // Copy modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceWeek, setCopySourceWeek] = useState(Math.max(1, currentWeek - 1));
  const [copyOverwriteOption, setCopyOverwriteOption] = useState<'replace' | 'merge'>('replace');

  // Quick suggestion lists
  const commonClasses = ['10A8', '10A11', '10A15', '12B1', '12B6', '12B7'];
  const commonSubjects = ['Toán', 'HĐTN-HN', 'Ôn Toán', 'Đại số', 'Giải tích', 'Hình học'];
  const commonActivities = ['Chào cờ', 'Sinh hoạt lớp', 'Khai giảng', 'Ngoại khóa', 'Họp tổ CM'];

  // Check for duplicate / conflict warnings
  const slotCount = currentWeekSlots.filter((s) => !s.isOff && (s.className || s.subject || s.activity)).length;

  const handleOpenEditSlot = (weekday: Weekday, session: SessionType, period: number) => {
    const existing = currentWeekSlots.find(
      (s) => s.weekday === weekday && s.session === session && s.period === period
    );

    setEditingSlot({
      weekday,
      session,
      period,
      existing,
      rawText: existing?.rawText || '',
      className: existing?.className || '',
      subject: existing?.subject || '',
      activity: existing?.activity || '',
      isOff: existing?.isOff || false,
      note: existing?.note || '',
    });
  };

  const handleSaveSlot = () => {
    if (!editingSlot) return;

    const { weekday, session, period, className, subject, activity, isOff, note, existing } = editingSlot;

    // Build rawText
    let rawText = '';
    if (activity) {
      rawText = activity;
    } else if (className && subject) {
      rawText = `${className}-${subject}`;
    } else if (className) {
      rawText = className;
    } else if (subject) {
      rawText = subject;
    }

    const updatedSlot: TimetableSlot = {
      id: existing?.id || `tkb-w${currentWeek}-${weekday}-${session[0]}-${period}-${Date.now().toString(36)}`,
      weekNumber: currentWeek,
      year: 2024,
      weekday,
      session,
      period,
      rawText,
      className: className.trim(),
      subject: subject.trim(),
      activity: activity.trim(),
      isOff,
      note: note.trim(),
    };

    setTimetable((prev) => {
      // Remove previous entry at this weekday, session, period in currentWeek
      const filtered = prev.filter(
        (s) =>
          !(s.weekNumber === currentWeek && s.weekday === weekday && s.session === session && s.period === period)
      );
      // Only keep if slot has some data or isOff
      if (rawText || className || subject || activity || isOff) {
        return [...filtered, updatedSlot];
      }
      return filtered;
    });

    setEditingSlot(null);
    onAfterTKBModified?.();
  };

  const handleDeleteSlot = () => {
    if (!editingSlot) return;
    const { weekday, session, period } = editingSlot;
    setTimetable((prev) =>
      prev.filter(
        (s) =>
          !(s.weekNumber === currentWeek && s.weekday === weekday && s.session === session && s.period === period)
      )
    );
    setEditingSlot(null);
    onAfterTKBModified?.();
  };

  const handleCopyWeek = () => {
    const sourceSlots = timetable.filter((s) => s.weekNumber === copySourceWeek);
    if (sourceSlots.length === 0) {
      alert(`Tuần ${copySourceWeek} chưa có dữ liệu thời khóa biểu để sao chép!`);
      return;
    }

    setTimetable((prev) => {
      let filtered = prev;
      if (copyOverwriteOption === 'replace') {
        filtered = prev.filter((s) => s.weekNumber !== currentWeek);
      }

      const cloned = sourceSlots.map((s) => ({
        ...s,
        id: `tkb-w${currentWeek}-${s.weekday}-${s.session[0]}-${s.period}-${Date.now().toString(36)}`,
        weekNumber: currentWeek,
      }));

      if (copyOverwriteOption === 'merge') {
        // Merge without overwriting occupied slots in current week
        const newSlotsToAdd = cloned.filter((cloneSlot) => {
          const exists = prev.some(
            (p) =>
              p.weekNumber === currentWeek &&
              p.weekday === cloneSlot.weekday &&
              p.session === cloneSlot.session &&
              p.period === cloneSlot.period
          );
          return !exists;
        });
        return [...filtered, ...newSlotsToAdd];
      }

      return [...filtered, ...cloned];
    });

    setIsCopyModalOpen(false);
    onAfterTKBModified?.();
  };

  const handleSaveTimetableFromAi = (
    newSlots: TimetableSlot[],
    targetWeek: number,
    autoGenerateSchedule: boolean,
    teacherMeta?: { teacherName?: string; schoolYear?: string; semester?: string }
  ) => {
    setTimetable((prev) => [
      ...prev.filter((s) => s.weekNumber !== targetWeek),
      ...newSlots,
    ]);

    if (settings.currentWeek !== targetWeek) {
      setSettings((prev) => ({ ...prev, currentWeek: targetWeek }));
    }

    if (teacherMeta && setProfile) {
      setProfile((prev) => ({
        ...prev,
        teacherName: teacherMeta.teacherName || prev.teacherName,
        schoolYear: teacherMeta.schoolYear || prev.schoolYear,
        semester: (teacherMeta.semester as any) || prev.semester,
      }));
    }

    if (autoGenerateSchedule && setLessonLogs) {
      const updatedTimetable = [
        ...timetable.filter((s) => s.weekNumber !== targetWeek),
        ...newSlots,
      ];

      const { newLogs } = generateWeeklyLessonLog({
        weekNumber: targetWeek,
        year: 2026,
        startMondayDate: settings.startMondayDate,
        timetable: updatedTimetable,
        curriculum,
        aliases,
        existingLogs: lessonLogs,
        keepManualEdits: false,
      });

      setLessonLogs((prev) => [
        ...prev.filter((l) => l.weekNumber !== targetWeek),
        ...newLogs,
      ]);
    }

    onAfterTKBModified?.();
  };

  const handleClearWeek = () => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa toàn bộ thời khóa biểu của Tuần ${currentWeek}?`)) {
      setTimetable((prev) => prev.filter((s) => s.weekNumber !== currentWeek));
      onAfterTKBModified?.();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              Thời khóa biểu - Tuần {currentWeek}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              {slotCount} tiết đã xếp
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {weekRange.displayRange} • Nhấn vào từng ô để thêm hoặc sửa lớp/môn/hoạt động
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week navigation buttons */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            <button
              onClick={() =>
                setSettings((p) => ({
                  ...p,
                  currentWeek: Math.max(1, p.currentWeek - 1),
                }))
              }
              className="p-1.5 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700">
              T{currentWeek}
            </span>
            <button
              onClick={() =>
                setSettings((p) => ({
                  ...p,
                  currentWeek: Math.min(40, p.currentWeek + 1),
                }))
              }
              className="p-1.5 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* AI Upload TKB */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 hover:from-indigo-700 hover:to-sky-700 transition cursor-pointer shadow-md shadow-indigo-100"
            title="Tải ảnh chụp hoặc file Excel TKB tuần để AI tự động trích xuất và sinh lịch báo giảng"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Tải TKB bằng AI</span>
          </button>

          {/* Copy from another week */}
          <button
            onClick={() => setIsCopyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-600" />
            <span>Sao chép tuần</span>
          </button>

          {/* Export TKB Excel */}
          <button
            onClick={() => exportTimetableToExcel(timetable, currentWeek, settings.includeSaturday)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          {/* Clear week */}
          <button
            onClick={handleClearWeek}
            disabled={slotCount === 0}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Xóa TKB tuần này"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timetable Grid View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[750px]">
            {/* Table Header: Days of the week */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <th className="p-3 w-16 text-center font-bold border-r border-slate-200 bg-slate-100/70">
                  Buổi
                </th>
                <th className="p-3 w-14 text-center font-bold border-r border-slate-200 bg-slate-100/70">
                  Tiết
                </th>
                {days.map((d) => {
                  const w = WEEKDAYS.find((item) => item.key === d);
                  const dateObj = getDateOfWeekDay(settings.startMondayDate, currentWeek, d);
                  return (
                    <th key={d} className="p-3 font-bold border-r border-slate-200 last:border-r-0">
                      <div className="text-slate-800 font-semibold">{w?.label || `Thứ ${d}`}</div>
                      <div className="text-[11px] font-normal text-slate-500">
                        {formatDateVN(dateObj.toISOString().slice(0, 10))}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: Morning (1..5) & Afternoon (1..5) */}
            <tbody className="divide-y divide-slate-200 text-xs">
              {/* MORNING SESSIONS */}
              {[1, 2, 3, 4, 5].map((period, pIndex) => (
                <tr key={`morning-${period}`} className="hover:bg-slate-50/50 transition">
                  {pIndex === 0 && (
                    <td
                      rowSpan={5}
                      className="p-3 text-center font-bold text-amber-700 bg-amber-50/60 border-r border-slate-200 align-middle"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <span>SÁNG</span>
                      </div>
                    </td>
                  )}
                  <td className="p-2.5 text-center font-bold text-slate-600 bg-slate-50/40 border-r border-slate-200">
                    Tiết {period}
                  </td>
                  {days.map((d) => {
                    const slot = currentWeekSlots.find(
                      (s) => s.weekday === d && s.session === 'morning' && s.period === period
                    );
                    return (
                      <td
                        key={`cell-m-${d}-${period}`}
                        onClick={() => handleOpenEditSlot(d, 'morning', period)}
                        className="p-2 border-r border-slate-200 last:border-r-0 align-top cursor-pointer hover:bg-indigo-50/50 transition"
                      >
                        <TimetableCellContent slot={slot} />
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Session Divider */}
              <tr className="bg-slate-100 text-[11px] text-slate-500 font-medium">
                <td colSpan={2 + days.length} className="px-4 py-1.5 bg-slate-100/90 text-center">
                  -- NGHỈ TRƯA --
                </td>
              </tr>

              {/* AFTERNOON SESSIONS */}
              {[1, 2, 3, 4, 5].map((period, pIndex) => (
                <tr key={`afternoon-${period}`} className="hover:bg-slate-50/50 transition">
                  {pIndex === 0 && (
                    <td
                      rowSpan={5}
                      className="p-3 text-center font-bold text-indigo-700 bg-indigo-50/60 border-r border-slate-200 align-middle"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Moon className="w-4 h-4 text-indigo-500" />
                        <span>CHIỀU</span>
                      </div>
                    </td>
                  )}
                  <td className="p-2.5 text-center font-bold text-slate-600 bg-slate-50/40 border-r border-slate-200">
                    Tiết {period}
                  </td>
                  {days.map((d) => {
                    const slot = currentWeekSlots.find(
                      (s) => s.weekday === d && s.session === 'afternoon' && s.period === period
                    );
                    return (
                      <td
                        key={`cell-a-${d}-${period}`}
                        onClick={() => handleOpenEditSlot(d, 'afternoon', period)}
                        className="p-2 border-r border-slate-200 last:border-r-0 align-top cursor-pointer hover:bg-indigo-50/50 transition"
                      >
                        <TimetableCellContent slot={slot} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slot Edit Modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  Cập nhật tiết học (Tuần {currentWeek})
                </h3>
                <p className="text-xs text-indigo-100">
                  {WEEKDAYS.find((w) => w.key === editingSlot.weekday)?.label} •{' '}
                  {editingSlot.session === 'morning' ? 'Buổi Sáng' : 'Buổi Chiều'} • Tiết{' '}
                  {editingSlot.period}
                </p>
              </div>
              <button
                onClick={() => setEditingSlot(null)}
                className="p-1 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Special Activity vs Class+Subject Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hoạt động đặc biệt (Chào cờ, Sinh hoạt, Khai giảng...)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {commonActivities.map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() =>
                        setEditingSlot((prev) =>
                          prev ? { ...prev, activity: act, className: '', subject: '' } : null
                        )
                      }
                      className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                        editingSlot.activity === act
                          ? 'bg-amber-100 text-amber-800 border-amber-300 font-semibold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                  {editingSlot.activity && (
                    <button
                      type="button"
                      onClick={() => setEditingSlot((p) => (p ? { ...p, activity: '' } : null))}
                      className="text-xs px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                {editingSlot.activity && (
                  <input
                    type="text"
                    value={editingSlot.activity}
                    onChange={(e) =>
                      setEditingSlot((prev) => (prev ? { ...prev, activity: e.target.value } : null))
                    }
                    placeholder="Tên hoạt động..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {!editingSlot.activity && (
                <>
                  {/* Class Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lớp giảng dạy <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingSlot.className}
                      onChange={(e) =>
                        setEditingSlot((prev) => (prev ? { ...prev, className: e.target.value } : null))
                      }
                      placeholder="Ví dụ: 10A8, 12B1..."
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[11px] text-slate-400 self-center mr-1">Gợi ý:</span>
                      {commonClasses.map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          onClick={() =>
                            setEditingSlot((prev) => (prev ? { ...prev, className: cls } : null))
                          }
                          className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
                        >
                          {cls}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Môn học <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingSlot.subject}
                      onChange={(e) =>
                        setEditingSlot((prev) => (prev ? { ...prev, subject: e.target.value } : null))
                      }
                      placeholder="Ví dụ: Toán, HĐTN-HN, Ôn Toán..."
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[11px] text-slate-400 self-center mr-1">Gợi ý:</span>
                      {commonSubjects.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() =>
                            setEditingSlot((prev) => (prev ? { ...prev, subject: sub } : null))
                          }
                          className="text-[11px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md"
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Note / Off flag */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSlot.isOff}
                    onChange={(e) =>
                      setEditingSlot((prev) => (prev ? { ...prev, isOff: e.target.checked } : null))
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Đánh dấu là Tiết nghỉ (không sinh vào báo giảng)</span>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú phòng / nội dung</label>
                  <input
                    type="text"
                    value={editingSlot.note}
                    onChange={(e) =>
                      setEditingSlot((prev) => (prev ? { ...prev, note: e.target.value } : null))
                    }
                    placeholder="Phòng học, dặn dò..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {editingSlot.existing ? (
                <button
                  type="button"
                  onClick={handleDeleteSlot}
                  className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 rounded-lg transition"
                >
                  Xóa ô này
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveSlot}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Week Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Copy className="w-4 h-4 text-indigo-400" />
                Sao chép Thời khóa biểu
              </h3>
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Sao chép lịch học từ một tuần trước đó vào <span className="font-bold text-indigo-700">Tuần {currentWeek}</span>. Bạn có thể kiểm tra và chỉnh sửa chi tiết từng tiết sau khi sao chép.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chọn tuần nguồn để sao chép:
                </label>
                <select
                  value={copySourceWeek}
                  onChange={(e) => setCopySourceWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden font-medium"
                >
                  {Array.from({ length: 37 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Tuần {w} ({timetable.filter((s) => s.weekNumber === w).length} tiết)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700">Chế độ ghi đè:</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="copyOpt"
                    checked={copyOverwriteOption === 'replace'}
                    onChange={() => setCopyOverwriteOption('replace')}
                    className="text-indigo-600"
                  />
                  <span>Thay thế hoàn toàn TKB Tuần {currentWeek}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="copyOpt"
                    checked={copyOverwriteOption === 'merge'}
                    onChange={() => setCopyOverwriteOption('merge')}
                    className="text-indigo-600"
                  />
                  <span>Chỉ thêm vào các ô còn trống (giữ lại các ô đã nhập)</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleCopyWeek}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
              >
                Tiến hành sao chép
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Timetable Parser & Generator Modal */}
      <AiTimetableParserModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialWeek={currentWeek}
        startMondayDate={settings.startMondayDate}
        onSaveTimetable={handleSaveTimetableFromAi}
      />
    </div>
  );
};

/**
 * Individual cell render with pleasant color tag
 */
function TimetableCellContent({ slot }: { slot?: TimetableSlot }) {
  if (!slot || (!slot.className && !slot.subject && !slot.activity && !slot.isOff)) {
    return (
      <div className="h-14 flex items-center justify-center border border-dashed border-slate-200/80 rounded-lg group-hover:border-indigo-300 group-hover:bg-indigo-50/30 transition text-slate-300">
        <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
      </div>
    );
  }

  if (slot.isOff) {
    return (
      <div className="h-14 p-2 bg-slate-100 rounded-lg border border-slate-200 text-slate-400 flex flex-col justify-center items-center text-[11px] font-medium">
        <span>Nghỉ</span>
      </div>
    );
  }

  if (slot.activity) {
    return (
      <div className="h-14 p-2 bg-amber-50/90 hover:bg-amber-100/90 rounded-lg border border-amber-200/80 text-amber-900 flex flex-col justify-center transition">
        <span className="font-bold text-xs line-clamp-1">{slot.activity}</span>
        {slot.className && <span className="text-[10px] text-amber-700">{slot.className}</span>}
      </div>
    );
  }

  // Regular Class-Subject
  const isMath = (slot.subject || '').toLowerCase().includes('toán');
  const isExperiential = (slot.subject || '').toLowerCase().includes('hđtn');

  const bgStyle = isMath
    ? 'bg-blue-50/90 hover:bg-blue-100/90 border-blue-200/90 text-blue-900'
    : isExperiential
    ? 'bg-emerald-50/90 hover:bg-emerald-100/90 border-emerald-200/90 text-emerald-900'
    : 'bg-indigo-50/90 hover:bg-indigo-100/90 border-indigo-200/90 text-indigo-900';

  return (
    <div className={`h-14 p-2 rounded-lg border flex flex-col justify-center transition ${bgStyle}`}>
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-xs">{slot.className}</span>
        <span className="text-[10px] font-medium opacity-80">{slot.subject}</span>
      </div>
      {slot.note && (
        <span className="text-[10px] text-slate-500 truncate mt-0.5">{slot.note}</span>
      )}
    </div>
  );
}
