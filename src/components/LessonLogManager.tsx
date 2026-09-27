import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Printer,
  Download,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Check,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  AppSettings,
  CurriculumEntry,
  LessonLogEntry,
  LessonStatus,
  SubjectAlias,
  TeacherProfile,
  TimetableSlot,
  Weekday,
} from '../types';
import { formatDateVN, getDateOfWeekDay, getWeekDateRangeVN, WEEKDAYS } from '../utils/dateUtils';
import { exportLessonLogToExcel } from '../utils/excelUtils';
import { exportToWordDoc, generatePrintableHTML } from '../utils/printUtils';
import { generateWeeklyLessonLog } from '../utils/lessonLogGenerator';
import { AiTimetableParserModal } from './AiTimetableParserModal';

interface LessonLogManagerProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  profile: TeacherProfile;
  setProfile?: React.Dispatch<React.SetStateAction<TeacherProfile>>;
  timetable: TimetableSlot[];
  setTimetable?: React.Dispatch<React.SetStateAction<TimetableSlot[]>>;
  curriculum: CurriculumEntry[];
  aliases: SubjectAlias[];
  lessonLogs: LessonLogEntry[];
  setLessonLogs: React.Dispatch<React.SetStateAction<LessonLogEntry[]>>;
  onOpenPrintModal: () => void;
}

export const LessonLogManager: React.FC<LessonLogManagerProps> = ({
  settings,
  setSettings,
  profile,
  setProfile,
  timetable,
  setTimetable,
  curriculum,
  aliases,
  lessonLogs,
  setLessonLogs,
  onOpenPrintModal,
}) => {
  const currentWeek = settings.currentWeek;
  const weekRange = getWeekDateRangeVN(settings.startMondayDate, currentWeek, settings.includeSaturday);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // AI Timetable Modal
  const [isAiTkbModalOpen, setIsAiTkbModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Inline / Modal editing
  const [editingLog, setEditingLog] = useState<LessonLogEntry | null>(null);

  // History for Undo
  const [undoStack, setUndoStack] = useState<LessonLogEntry[][]>([]);

  // Logs for current week
  const currentWeekLogs = lessonLogs.filter((l) => l.weekNumber === currentWeek);

  // Filtered logs
  const filteredLogs = currentWeekLogs.filter((l) => {
    const matchSearch =
      searchTerm === '' ||
      l.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.adjustment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.className || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchClass = filterClass === 'all' || l.className === filterClass;
    const matchSubject = filterSubject === 'all' || l.subject === filterSubject;
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;

    return matchSearch && matchClass && matchSubject && matchStatus;
  });

  // Extract distinct classes and subjects in current week
  const distinctClasses = Array.from(new Set(currentWeekLogs.map((l) => l.className).filter(Boolean)));
  const distinctSubjects = Array.from(new Set(currentWeekLogs.map((l) => l.subject).filter(Boolean)));

  // Statistics
  const totalCount = currentWeekLogs.length;
  const taughtCount = currentWeekLogs.filter((l) => l.status === 'taught').length;
  const pendingCount = currentWeekLogs.filter((l) => l.status === 'pending').length;
  const adjustedCount = currentWeekLogs.filter((l) => l.status === 'adjusted').length;
  const unmatchedCount = currentWeekLogs.filter(
    (l) => l.lessonTitle.includes('Chưa ghép được bài') || (!l.activity && !l.lessonTitle)
  ).length;

  // Push current week logs to undo stack
  const pushToUndo = () => {
    setUndoStack((prev) => [...prev.slice(-10), currentWeekLogs]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    setLessonLogs((prev) => {
      const otherWeeks = prev.filter((l) => l.weekNumber !== currentWeek);
      return [...otherWeeks, ...previousState];
    });
  };

  // Generate / Regenerate draft
  const handleAutoGenerate = (forceOverwrite: boolean = false) => {
    pushToUndo();

    const { newLogs, stats } = generateWeeklyLessonLog({
      weekNumber: currentWeek,
      year: 2024,
      startMondayDate: settings.startMondayDate,
      timetable,
      curriculum,
      aliases,
      existingLogs: lessonLogs,
      keepManualEdits: !forceOverwrite,
    });

    if (newLogs.length === 0) {
      alert(`Thời khóa biểu Tuần ${currentWeek} chưa có tiết học nào. Vui lòng xếp TKB trước!`);
      return;
    }

    setLessonLogs((prev) => {
      const otherWeeks = prev.filter((l) => l.weekNumber !== currentWeek);
      return [...otherWeeks, ...newLogs];
    });
  };

  // Handle saving TKB from AI parser and auto-generating schedule
  const handleSaveTimetableFromAi = (
    newSlots: TimetableSlot[],
    targetWeek: number,
    autoGenerateSchedule: boolean,
    teacherMeta?: { teacherName?: string; schoolYear?: string; semester?: string }
  ) => {
    // 1. Update timetable for targetWeek
    if (setTimetable) {
      setTimetable((prev) => [
        ...prev.filter((s) => s.weekNumber !== targetWeek),
        ...newSlots,
      ]);
    }

    // 2. Switch to targetWeek if different
    if (settings.currentWeek !== targetWeek) {
      setSettings((prev) => ({ ...prev, currentWeek: targetWeek }));
    }

    // 3. Update teacher profile if provided
    if (teacherMeta && setProfile) {
      setProfile((prev) => ({
        ...prev,
        teacherName: teacherMeta.teacherName || prev.teacherName,
        schoolYear: teacherMeta.schoolYear || prev.schoolYear,
        semester: (teacherMeta.semester as any) || prev.semester,
      }));
    }

    // 4. Auto-generate schedule
    if (autoGenerateSchedule) {
      pushToUndo();
      const updatedTimetable = [
        ...timetable.filter((s) => s.weekNumber !== targetWeek),
        ...newSlots,
      ];

      const { newLogs, stats } = generateWeeklyLessonLog({
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

      setSuccessNotice(
        `Đã tải ${newSlots.length} tiết TKB và tự động tạo Lịch Báo Giảng Tuần ${targetWeek} (${stats.matched} tiết khớp PPCT nối tiếp tuần trước, tổng cộng ${stats.total} tiết)!`
      );
    } else {
      setSuccessNotice(`Đã lưu ${newSlots.length} tiết TKB cho Tuần ${targetWeek}!`);
    }
  };

  // Status toggle
  const handleToggleStatus = (id: string, newStatus: LessonStatus) => {
    pushToUndo();
    setLessonLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus, isManuallyEdited: true } : l))
    );
  };

  // Delete entry
  const handleDeleteLog = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa dòng báo giảng này?')) {
      pushToUndo();
      setLessonLogs((prev) => prev.filter((l) => l.id !== id));
    }
  };

  // Move row up / down
  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredLogs.length) return;

    pushToUndo();

    const currentItem = filteredLogs[index];
    const targetItem = filteredLogs[targetIndex];

    setLessonLogs((prev) => {
      const itemA = prev.find((x) => x.id === currentItem.id);
      const itemB = prev.find((x) => x.id === targetItem.id);
      if (!itemA || !itemB) return prev;

      // Swap positions in array
      const newArray = [...prev];
      const idxA = newArray.indexOf(itemA);
      const idxB = newArray.indexOf(itemB);
      newArray[idxA] = itemB;
      newArray[idxB] = itemA;
      return newArray;
    });
  };

  // Save edit modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    pushToUndo();
    setLessonLogs((prev) =>
      prev.map((l) =>
        l.id === editingLog.id
          ? {
              ...editingLog,
              isManuallyEdited: true,
            }
          : l
      )
    );
    setEditingLog(null);
  };

  // Add ad-hoc lesson row
  const handleAddCustomLog = () => {
    pushToUndo();
    const defaultDate = getDateOfWeekDay(settings.startMondayDate, currentWeek, 2);
    const newEntry: LessonLogEntry = {
      id: `log-custom-${Date.now().toString(36)}`,
      weekNumber: currentWeek,
      year: 2024,
      date: defaultDate.toISOString().slice(0, 10),
      weekday: 2,
      session: 'morning',
      period: 1,
      subject: 'Toán',
      className: '10A8',
      curriculumPeriod: undefined,
      lessonTitle: 'Bài học mới',
      adjustment: '',
      status: 'pending',
      isManuallyEdited: true,
    };
    setLessonLogs((prev) => [...prev, newEntry]);
    setEditingLog(newEntry);
  };

  const handleDownloadWord = () => {
    const html = generatePrintableHTML({
      logs: lessonLogs,
      profile,
      settings,
      weekNumber: currentWeek,
    });
    const safeName = (profile.teacherName || 'GiaoVien').replace(/[^a-zA-Z0-9_-]/g, '_');
    exportToWordDoc(html, `Lich_Bao_Giang_Tuan_${currentWeek}_${safeName}.doc`);
    setSuccessNotice(`Đã tải file Word (.doc) Tuần ${currentWeek} thành công!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">
              Lịch Báo Giảng - Tuần {currentWeek}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              {totalCount} tiết
            </span>
            {unmatchedCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                {unmatchedCount} tiết chưa khớp PPCT
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {weekRange.displayRange} • Phân phối chương trình được tự động tính lũy tiến theo từng lớp và môn
          </p>
        </div>

        {/* Action Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Upload TKB & Generate Schedule */}
          <button
            onClick={() => setIsAiTkbModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 hover:from-indigo-700 hover:to-sky-700 transition cursor-pointer shadow-md shadow-indigo-100"
            title="Tải ảnh chụp hoặc file Excel TKB để AI tự động trích xuất và sinh Lịch Báo Giảng nối tiếp tuần trước"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Tải TKB tuần {currentWeek} & Sinh lịch</span>
          </button>

          {/* Auto generate button */}
          <button
            onClick={() => handleAutoGenerate(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer shadow-2xs"
            title="Đọc TKB tuần này, tính số tiết PPCT tiếp theo cho từng lớp và điền bài dạy"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Tự động sinh báo giảng</span>
          </button>

          {/* Add custom line */}
          <button
            onClick={handleAddCustomLog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Thêm dòng</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={() =>
              exportLessonLogToExcel({
                logs: currentWeekLogs,
                profile,
                weekNumber: currentWeek,
                dateRangeStr: weekRange.displayRange,
              })
            }
            disabled={totalCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer shadow-2xs disabled:opacity-40"
            title="Xuất bảng tính Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          {/* Direct Word Export (No popup) */}
          <button
            onClick={handleDownloadWord}
            disabled={totalCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition cursor-pointer shadow-2xs disabled:opacity-40"
            title="Tải trực tiếp file Word (.doc) chuẩn văn bản hành chính"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Tải Word (.doc)</span>
          </button>

          {/* Print preview / PDF download */}
          <button
            onClick={onOpenPrintModal}
            disabled={totalCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer disabled:opacity-40 shadow-xs"
            title="Mở bảng xem trước, tải PDF trực tiếp hoặc gửi lệnh in"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Xem & Tải PDF / In</span>
          </button>

          {/* Undo */}
          {undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Hoàn tác thay đổi gần nhất"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successNotice && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold">{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên bài dạy, điều chỉnh, môn, lớp..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Class */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium">Lớp:</span>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả lớp</option>
            {distinctClasses.map((c) => (
              <option key={c} value={c}>
                Lớp {c}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Subject */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium">Môn:</span>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả môn</option>
            {distinctSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Status */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium">Trạng thái:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-hidden font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chưa dạy ({pendingCount})</option>
            <option value="taught">Đã dạy ({taughtCount})</option>
            <option value="adjusted">Có điều chỉnh ({adjustedCount})</option>
            <option value="cancelled">Hủy / Hoãn</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3 w-24">Ngày</th>
                <th className="py-3 px-3 w-20">Thứ / Buổi</th>
                <th className="py-3 px-2 w-12 text-center">Tiết</th>
                <th className="py-3 px-3 w-28">Môn</th>
                <th className="py-3 px-3 w-20">Lớp</th>
                <th className="py-3 px-3 w-24 text-center">Tiết PPCT</th>
                <th className="py-3 px-4">Tên đầu bài dạy</th>
                <th className="py-3 px-4 w-44">Điều chỉnh</th>
                <th className="py-3 px-3 w-28 text-center">Trạng thái</th>
                <th className="py-3 px-3 w-24 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700 text-sm">
                      Chưa có dữ liệu báo giảng cho Tuần {currentWeek}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Thầy/cô có thể tải ảnh chụp hoặc file Excel TKB tuần này để AI tự động trích xuất và sinh lịch nối tiếp các tuần trước.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
                      <button
                        onClick={() => setIsAiTkbModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Tải ảnh/Excel TKB Tuần {currentWeek} & Sinh lịch</span>
                      </button>
                      <button
                        onClick={() => handleAutoGenerate(false)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-xs shadow-2xs transition cursor-pointer"
                      >
                        <span>Sinh lịch từ TKB sẵn có</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const weekdayObj = WEEKDAYS.find((w) => w.key === log.weekday);
                  const isUnmatched = log.lessonTitle.includes('Chưa ghép được bài');
                  const isTaught = log.status === 'taught';

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isTaught ? 'bg-slate-50/40 text-slate-600' : ''
                      }`}
                    >
                      {/* STT */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                        {index + 1}
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap text-slate-700">
                        {formatDateVN(log.date)}
                      </td>

                      {/* Weekday & Session */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        <div>{weekdayObj?.shortLabel || `T${log.weekday}`}</div>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            log.session === 'morning'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {log.session === 'morning' ? 'Sáng' : 'Chiều'}
                        </span>
                      </td>

                      {/* Period */}
                      <td className="py-2.5 px-2 text-center font-extrabold text-slate-800">
                        T{log.period}
                      </td>

                      {/* Subject */}
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {log.subject}
                      </td>

                      {/* Class */}
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-extrabold text-xs">
                          {log.className || '-'}
                        </span>
                      </td>

                      {/* Curriculum Period */}
                      <td className="py-2.5 px-3 text-center">
                        {log.curriculumPeriod ? (
                          <span className="font-extrabold text-indigo-700 text-xs bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            {log.curriculumPeriod}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Lesson Title */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-medium ${
                              isUnmatched
                                ? 'text-rose-600 font-semibold flex items-center gap-1'
                                : isTaught
                                ? 'line-through text-slate-500'
                                : 'text-slate-900'
                            }`}
                          >
                            {isUnmatched && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                            {log.lessonTitle}
                          </span>
                          {log.isManuallyEdited && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded shrink-0">
                              (sửa tay)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Adjustment */}
                      <td className="py-2.5 px-4 text-slate-600">
                        {log.adjustment ? (
                          <span className="text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-100">
                            {log.adjustment}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Status Button Toggle */}
                      <td className="py-2.5 px-3 text-center">
                        <select
                          value={log.status}
                          onChange={(e) => handleToggleStatus(log.id, e.target.value as LessonStatus)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-md border outline-hidden cursor-pointer ${
                            log.status === 'taught'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : log.status === 'adjusted'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : log.status === 'cancelled'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="pending">Chưa dạy</option>
                          <option value="taught">Đã dạy</option>
                          <option value="adjusted">Điều chỉnh</option>
                          <option value="cancelled">Hủy/Nghỉ</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingLog(log)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                            title="Sửa chi tiết"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveRow(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                            title="Chuyển lên"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveRow(index, 'down')}
                            disabled={index === filteredLogs.length - 1}
                            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                            title="Chuyển xuống"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        {currentWeekLogs.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-slate-700">
              <span className="font-bold text-slate-900">
                Tổng cộng: <span className="text-indigo-700">{totalCount} tiết</span>
              </span>
              <span className="text-emerald-700 font-medium">
                • Đã dạy: {taughtCount} tiết ({totalCount > 0 ? Math.round((taughtCount / totalCount) * 100) : 0}%)
              </span>
              <span className="text-amber-700 font-medium">
                • Chưa dạy: {pendingCount} tiết
              </span>
              {adjustedCount > 0 && (
                <span className="text-blue-700 font-medium">
                  • Có điều chỉnh: {adjustedCount} tiết
                </span>
              )}
            </div>

            <p className="text-slate-500 text-[11px]">
              Tổ trưởng chuyên môn: <span className="font-semibold text-slate-700">{profile.reviewer}</span>
            </p>
          </div>
        )}
      </div>

      {/* Edit Entry Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Chỉnh sửa dòng báo giảng</h3>
                <p className="text-xs text-slate-300">
                  {WEEKDAYS.find((w) => w.key === editingLog.weekday)?.label} ({formatDateVN(editingLog.date)}) •{' '}
                  {editingLog.session === 'morning' ? 'Sáng' : 'Chiều'} • Tiết {editingLog.period}
                </p>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn học *</label>
                  <input
                    type="text"
                    required
                    value={editingLog.subject}
                    onChange={(e) => setEditingLog({ ...editingLog, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lớp *</label>
                  <input
                    type="text"
                    value={editingLog.className}
                    onChange={(e) => setEditingLog({ ...editingLog, className: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tiết theo PPCT (để trống nếu là hoạt động)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingLog.curriculumPeriod || ''}
                    onChange={(e) =>
                      setEditingLog({
                        ...editingLog,
                        curriculumPeriod: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="Ví dụ: 1, 2, 3..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trạng thái</label>
                  <select
                    value={editingLog.status}
                    onChange={(e) =>
                      setEditingLog({
                        ...editingLog,
                        status: e.target.value as LessonStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden font-medium"
                  >
                    <option value="pending">Chưa dạy</option>
                    <option value="taught">Đã dạy</option>
                    <option value="adjusted">Có điều chỉnh</option>
                    <option value="cancelled">Hủy / Hoãn</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Tên đầu bài dạy *</label>
                  {/* Select from existing PPCT helper */}
                  {curriculum.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const matched = curriculum.find(
                          (c) =>
                            c.subject.toLowerCase() === editingLog.subject.toLowerCase() &&
                            c.periodNumber === editingLog.curriculumPeriod
                        );
                        if (matched) {
                          setEditingLog({ ...editingLog, lessonTitle: matched.lessonTitle });
                        } else {
                          alert('Không tìm thấy bài phù hợp trong PPCT với môn và tiết này!');
                        }
                      }}
                      className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Sparkles className="w-3 h-3" />
                      Tìm từ PPCT
                    </button>
                  )}
                </div>
                <textarea
                  rows={3}
                  required
                  value={editingLog.lessonTitle}
                  onChange={(e) => setEditingLog({ ...editingLog, lessonTitle: e.target.value })}
                  placeholder="Nhập tên bài học hoặc chọn từ PPCT..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Điều chỉnh / Ghi chú
                </label>
                <input
                  type="text"
                  value={editingLog.adjustment || ''}
                  onChange={(e) => setEditingLog({ ...editingLog, adjustment: e.target.value })}
                  placeholder="Dạy bù, thay đổi giáo án, học trực tuyến..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Timetable Parser & Generator Modal */}
      <AiTimetableParserModal
        isOpen={isAiTkbModalOpen}
        onClose={() => setIsAiTkbModalOpen(false)}
        initialWeek={currentWeek}
        startMondayDate={settings.startMondayDate}
        onSaveTimetable={handleSaveTimetableFromAi}
      />
    </div>
  );
};
