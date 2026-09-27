import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Printer,
  FileDown,
  Sparkles,
  BookOpen,
  FileSpreadsheet,
  GraduationCap,
  CalendarCheck,
  Check,
} from 'lucide-react';
import { AppSettings, CurriculumEntry, LessonLogEntry, TeacherProfile, TimetableSlot } from '../types';
import { formatDateVN, getWeekDateRangeVN, WEEKDAYS } from '../utils/dateUtils';
import { ActiveTab } from './Navbar';

interface DashboardProps {
  settings: AppSettings;
  profile: TeacherProfile;
  timetable: TimetableSlot[];
  curriculum: CurriculumEntry[];
  lessonLogs: LessonLogEntry[];
  setActiveTab: (tab: ActiveTab) => void;
  onOpenPrintModal: () => void;
  onGenerateLog: () => void;
  onUpdateLogStatus: (id: string, status: 'pending' | 'taught') => void;
  isSampleDataActive: boolean;
  onClearSampleData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  settings,
  profile,
  timetable,
  curriculum,
  lessonLogs,
  setActiveTab,
  onOpenPrintModal,
  onGenerateLog,
  onUpdateLogStatus,
  isSampleDataActive,
  onClearSampleData,
}) => {
  const currentWeekLogs = lessonLogs.filter((l) => l.weekNumber === settings.currentWeek);
  const weekRange = getWeekDateRangeVN(settings.startMondayDate, settings.currentWeek, settings.includeSaturday);

  // Metrics
  const totalScheduled = currentWeekLogs.length;
  const taughtCount = currentWeekLogs.filter((l) => l.status === 'taught').length;
  const pendingCount = currentWeekLogs.filter((l) => l.status === 'pending').length;
  const missingPPCTCount = currentWeekLogs.filter(
    (l) => l.lessonTitle.includes('Chưa ghép được bài') || (!l.activity && !l.lessonTitle)
  ).length;

  // Distinct classes
  const classes = Array.from(
    new Set(currentWeekLogs.map((l) => l.className).filter(Boolean))
  );

  // Today's lessons detection (match local weekday 2..7)
  const today = new Date();
  const dayIndex = today.getDay(); // 0 is Sun, 1 is Mon, 2 is Tue ...
  // Map JS day to our Weekday: Mon=2, Tue=3, Wed=4, Thu=5, Fri=6, Sat=7
  const currentWeekday = (dayIndex === 0 ? 8 : dayIndex + 1) as number;
  const todayLogs = currentWeekLogs
    .filter((l) => l.weekday === currentWeekday)
    .sort((a, b) => {
      if (a.session !== b.session) return a.session === 'morning' ? -1 : 1;
      return a.period - b.period;
    });

  const completionPct = totalScheduled > 0 ? Math.round((taughtCount / totalScheduled) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Sample data banner if active */}
      {isSampleDataActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Đang hiển thị dữ liệu mẫu minh họa</p>
              <p className="text-xs text-amber-700">
                Bao gồm TKB, PPCT môn Toán khối 10 & 12, HĐTN-HN và báo giảng Tuần 1. Bạn có thể sửa trực tiếp hoặc xóa để nhập dữ liệu của mình.
              </p>
            </div>
          </div>
          <button
            onClick={onClearSampleData}
            className="self-start sm:self-auto text-xs px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 rounded-lg font-medium transition cursor-pointer"
          >
            Xóa dữ liệu mẫu
          </button>
        </div>
      )}

      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium backdrop-blur-xs mb-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Năm học {profile.schoolYear} • {profile.semester}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Xin chào thầy/cô {profile.teacherName}
            </h1>
            <p className="text-indigo-100 text-sm mt-1 max-w-xl">
              {profile.school} • {profile.department}
            </p>
            <p className="text-white/80 text-xs mt-2 font-medium">
              Lịch báo giảng <span className="font-bold text-white">Tuần {settings.currentWeek}</span> ({weekRange.displayRange})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onGenerateLog}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold text-xs sm:text-sm rounded-xl shadow-md transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Tự động lập báo giảng
            </button>
            <button
              onClick={onOpenPrintModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/40 hover:bg-indigo-500/60 border border-white/20 text-white font-medium text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              Xuất PDF / In báo giảng
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total periods */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tổng số tiết tuần
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDaysIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">{totalScheduled}</span>
            <span className="text-xs text-slate-500">tiết giảng</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Dạy trên {classes.length} lớp: {classes.slice(0, 3).join(', ')}{classes.length > 3 ? '...' : ''}
          </p>
        </div>

        {/* Card 2: Taught periods */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tiết đã dạy
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{taughtCount}</span>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {completionPct}%
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>

        {/* Card 3: Pending periods */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tiết chưa dạy
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">{pendingCount}</span>
            <span className="text-xs text-slate-500">tiết còn lại</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Theo lịch đến hết {settings.includeSaturday ? 'thứ 7' : 'thứ 6'}
          </p>
        </div>

        {/* Card 4: Missing PPCT matches */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Chưa khớp PPCT
            </span>
            <div className={`p-2 rounded-xl ${missingPPCTCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${missingPPCTCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {missingPPCTCount}
            </span>
            <span className="text-xs text-slate-500">tiết cần xem xét</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {missingPPCTCount > 0 ? 'Bấm vào Báo giảng để gán bài' : 'Đã khớp toàn bộ bài học'}
          </p>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Teaching Schedule (2 columns on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-indigo-600" />
                Lịch dạy hôm nay ({WEEKDAYS.find((w) => w.key === currentWeekday)?.label || 'Ngày nghỉ'})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Các tiết được phân công trong ngày của tuần {settings.currentWeek}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('lessonLog')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              Xem cả tuần <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayLogs.length === 0 ? (
            <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">Hôm nay không có tiết dạy theo thời khóa biểu</p>
              <p className="text-xs text-slate-400 mt-1">
                Hoặc hôm nay là cuối tuần. Hãy chọn tab "Báo giảng" để xem toàn bộ lịch tuần này!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayLogs.map((log) => {
                const isTaught = log.status === 'taught';
                return (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      isTaught
                        ? 'bg-slate-50/80 border-slate-200 text-slate-500'
                        : 'bg-white border-slate-200 hover:border-indigo-200 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Period Badge */}
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-100 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                          {log.session === 'morning' ? 'Sáng' : 'Chiều'}
                        </span>
                        <span className="text-sm font-extrabold text-slate-800">T{log.period}</span>
                      </div>

                      {/* Lesson info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {log.className || 'Toàn trường'}
                          </span>
                          <span className="text-xs font-semibold text-slate-700">{log.subject}</span>
                          {log.curriculumPeriod && (
                            <span className="text-[11px] font-medium text-slate-500">
                              (Tiết PPCT: {log.curriculumPeriod})
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-1 font-medium ${isTaught ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {log.lessonTitle}
                        </p>
                        {log.adjustment && (
                          <p className="text-[11px] text-amber-600 mt-0.5">
                            * Điều chỉnh: {log.adjustment}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action: Mark Taught */}
                    <button
                      onClick={() => onUpdateLogStatus(log.id, isTaught ? 'pending' : 'taught')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                        isTaught
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isTaught ? 'Đã dạy' : 'Đánh dấu đã dạy'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Access & Guide (1 column on lg) */}
        <div className="space-y-4">
          {/* Quick shortcuts */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Thao tác nhanh</h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('timetable')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-100">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Quản lý Thời khóa biểu</p>
                    <p className="text-[11px] text-slate-500">Xem và sửa lịch tiết học tuần {settings.currentWeek}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </button>

              <button
                onClick={() => setActiveTab('curriculum')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Phân phối chương trình</p>
                    <p className="text-[11px] text-slate-500">
                      Hiện có {curriculum.length} bài học trong hệ thống
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </button>

              <button
                onClick={() => setActiveTab('data')}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-indigo-300 transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Nhập / Xuất Excel & Sao lưu</p>
                    <p className="text-[11px] text-slate-500">Nhập file TKB/PPCT và tải file mẫu</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              </button>
            </div>
          </div>

          {/* Workflow Guide Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              Quy trình làm việc chuẩn
            </h4>
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal pl-4">
              <li>
                <span className="font-semibold text-slate-800">Thời khóa biểu:</span> Lên lịch các tiết trong tuần.
              </li>
              <li>
                <span className="font-semibold text-slate-800">PPCT:</span> Cung cấp danh mục bài dạy theo môn/khối.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Báo giảng:</span> Bấm "Tự động sinh báo giảng", hệ thống tự đếm số tiết PPCT riêng cho từng lớp và khớp tên bài.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Xuất/In:</span> Kiểm tra, ghi điều chỉnh và xuất file Excel hoặc in A4 nộp tổ chuyên môn.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

function CalendarDaysIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
