import React, { useRef, useState } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  FileDown,
  Info,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { AppSettings, LessonLogEntry, TeacherProfile } from '../types';
import { formatDateVN, getWeekDateRangeVN, WEEKDAYS } from '../utils/dateUtils';
import { exportLessonLogToExcel } from '../utils/excelUtils';
import {
  generatePrintableHTML,
  printViaIframe,
  downloadPrintableHTMLFile,
  exportDirectPDFFromElement,
  exportToWordDoc,
} from '../utils/printUtils';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: TeacherProfile;
  settings: AppSettings;
  lessonLogs: LessonLogEntry[];
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  profile,
  settings,
  lessonLogs,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  if (!isOpen) return null;

  const currentWeek = settings.currentWeek;
  const currentWeekLogs = lessonLogs.filter((l) => l.weekNumber === currentWeek);
  const weekRange = getWeekDateRangeVN(settings.startMondayDate, currentWeek, settings.includeSaturday);

  // Statistics
  const totalCount = currentWeekLogs.length;
  const taughtCount = currentWeekLogs.filter((l) => l.status === 'taught').length;
  const pendingCount = currentWeekLogs.filter((l) => l.status === 'pending').length;

  const safeTeacherName = (profile.teacherName || 'GiaoVien').replace(/[^a-zA-Z0-9_-]/g, '_');
  const baseFileName = `Lich_Bao_Giang_Tuan_${currentWeek}_${safeTeacherName}`;

  // 1. Tải trực tiếp PDF không qua popup hay máy in
  const handleDownloadPDF = async () => {
    if (!paperRef.current) return;
    setIsExportingPDF(true);
    try {
      await exportDirectPDFFromElement(paperRef.current, `${baseFileName}.pdf`);
    } catch (err) {
      console.error('Lỗi xuất PDF trực tiếp:', err);
      // Fallback tải file HTML chuẩn in
      handleDownloadHTML();
    } finally {
      setIsExportingPDF(false);
    }
  };

  // 2. Tải trực tiếp file Word (.doc)
  const handleDownloadWord = () => {
    const html = generatePrintableHTML({
      logs: lessonLogs,
      profile,
      settings,
      weekNumber: currentWeek,
    });
    exportToWordDoc(html, `${baseFileName}.doc`);
  };

  // 3. Tải file HTML
  const handleDownloadHTML = () => {
    const html = generatePrintableHTML({
      logs: lessonLogs,
      profile,
      settings,
      weekNumber: currentWeek,
    });
    downloadPrintableHTMLFile(html, `${baseFileName}.html`);
  };

  // 4. Lệnh in qua trình duyệt (dành cho người có máy in kết nối trực tiếp)
  const handleBrowserPrint = () => {
    const html = generatePrintableHTML({
      logs: lessonLogs,
      profile,
      settings,
      weekNumber: currentWeek,
    });
    printViaIframe(html);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl max-w-6xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        {/* Top Control Bar (Hidden on print) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Xuất bản & In Lịch Báo Giảng</h3>
              <p className="text-xs text-slate-300">
                Tuần {currentWeek} • Định dạng văn bản hành chính giáo dục chuẩn (Khổ A4 ngang)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Direct PDF Download (NO POPUP - SOLVES USER ISSUE) */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isExportingPDF || totalCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Tải trực tiếp file PDF về máy tính (Không cần kết nối máy in, không popup)"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Đang tạo PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-rose-200" />
                  <span>Tải file PDF (Trực tiếp)</span>
                </>
              )}
            </button>

            {/* Word .doc export */}
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={totalCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Tải file Word (.doc) chuẩn văn bản hành chính để chỉnh sửa hoặc in từ Microsoft Word"
            >
              <FileText className="w-4 h-4 text-blue-200" />
              <span>Tải file Word (.doc)</span>
            </button>

            {/* Excel export */}
            <button
              type="button"
              onClick={() =>
                exportLessonLogToExcel({
                  logs: currentWeekLogs,
                  profile,
                  weekNumber: currentWeek,
                  dateRangeStr: weekRange.displayRange,
                })
              }
              disabled={totalCount === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Xuất bảng tính Excel (.xlsx) đầy đủ dữ liệu"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Xuất Excel</span>
            </button>

            {/* Browser print button (optional alternative for physical printer) */}
            <button
              type="button"
              onClick={handleBrowserPrint}
              disabled={totalCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Gửi lệnh in trực tiếp đến máy in vật lý đã cắm dây"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>In qua máy in</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition ml-1 cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Guidance Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-900 print:hidden">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Không cần kết nối máy in:</strong> Bạn chỉ cần bấm <strong>"Tải file PDF (Trực tiếp)"</strong> hoặc <strong>"Tải file Word (.doc)"</strong> để lưu file về máy tính, gửi Zalo cho đồng nghiệp hoặc in bất kỳ lúc nào mà không gặp bất kỳ lỗi popup nào!
            </span>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible flex justify-center">
          {/* Simulated A4 Paper (Ref attached for direct PDF generation) */}
          <div
            ref={paperRef}
            className="bg-white max-w-[297mm] w-full p-8 sm:p-12 shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 print:max-w-none text-slate-900 font-serif leading-relaxed text-[13px]"
          >

            {/* Header: School and Republic */}
            <div className="flex justify-between items-start border-b border-transparent pb-4">
              <div className="text-center font-sans">
                <p className="font-bold text-[12px] uppercase text-slate-800">{profile.school || 'TRƯỜNG CAO ĐẲNG NGHỀ 1-BQP'}</p>
                <p className="font-semibold text-[12px] uppercase text-slate-700">{profile.department}</p>
                <div className="w-24 h-0.5 bg-slate-800 mx-auto mt-1" />
              </div>

              <div className="text-center font-sans">
                <p className="font-bold text-[12px] uppercase text-slate-900">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </p>
                <p className="font-semibold text-[12px] text-slate-800 underline decoration-slate-400 underline-offset-4">
                  Độc lập - Tự do - Hạnh phúc
                </p>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-6">
              <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wide text-slate-900 font-sans">
                LỊCH BÁO GIẢNG NĂM HỌC {profile.schoolYear || '2026 - 2027'}
              </h1>
              <p className="text-sm font-bold uppercase mt-1 text-slate-800 font-sans">
                TUẦN {currentWeek} ({weekRange.displayRange})
              </p>
              <p className="text-xs italic text-slate-700 mt-1">
                Họ và tên giáo viên: <span className="font-bold font-sans not-italic text-slate-900">{profile.teacherName}</span> • Tổ chuyên môn: <span className="font-bold font-sans not-italic text-slate-900">{profile.department}</span>
              </p>
            </div>

            {/* Official Table */}
            <table className="w-full border-collapse border border-slate-900 text-left my-4 text-xs font-sans print:text-[11px]">
              <thead>
                <tr className="bg-slate-100 print:bg-slate-50 border-b border-slate-900 text-center font-bold">
                  <th className="border border-slate-900 p-2 w-10">STT</th>
                  <th className="border border-slate-900 p-2 w-20">Ngày</th>
                  <th className="border border-slate-900 p-2 w-16">Thứ/Buổi</th>
                  <th className="border border-slate-900 p-2 w-10">Tiết</th>
                  <th className="border border-slate-900 p-2 w-20">Môn</th>
                  <th className="border border-slate-900 p-2 w-16">Lớp</th>
                  <th className="border border-slate-900 p-2 w-14">Tiết PPCT</th>
                  <th className="border border-slate-900 p-2">Tên đầu bài dạy</th>
                  <th className="border border-slate-900 p-2 w-32">Điều chỉnh</th>
                </tr>
              </thead>
              <tbody>
                {currentWeekLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border border-slate-900 p-6 text-center italic text-slate-500">
                      Chưa có tiết báo giảng nào trong tuần {currentWeek}
                    </td>
                  </tr>
                ) : (
                  currentWeekLogs.map((log, idx) => {
                    const weekdayObj = WEEKDAYS.find((w) => w.key === log.weekday);
                    const sessionLabel = log.session === 'morning' ? 'S' : 'C';

                    return (
                      <tr key={log.id} className="border-b border-slate-900">
                        <td className="border border-slate-900 p-1.5 text-center font-semibold">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-900 p-1.5 whitespace-nowrap text-center">
                          {formatDateVN(log.date)}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-center font-medium">
                          {weekdayObj?.shortLabel || `T${log.weekday}`} ({sessionLabel})
                        </td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">
                          {log.period}
                        </td>
                        <td className="border border-slate-900 p-1.5 font-medium">
                          {log.subject}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">
                          {log.className || '-'}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-center font-bold">
                          {log.curriculumPeriod ?? '-'}
                        </td>
                        <td className="border border-slate-900 p-1.5">
                          {log.lessonTitle}
                        </td>
                        <td className="border border-slate-900 p-1.5 italic text-slate-700">
                          {log.adjustment || ''}
                        </td>
                      </tr>
                    );
                  })
                )}
                {/* Summary Row */}
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
                  <td colSpan={9} className="border border-slate-900 p-2 text-right">
                    Tổng số tiết thực hiện trong tuần: <span className="font-extrabold text-sm">{totalCount}</span> tiết (Đã dạy: {taughtCount} tiết | Chưa dạy: {pendingCount} tiết)
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Signature Block */}
            <div className="grid grid-cols-2 gap-8 mt-10 pt-4 text-center font-sans text-xs sm:text-sm">
              <div>
                <p className="font-bold uppercase text-slate-800">NGƯỜI DUYỆT BÁO GIẢNG</p>
                <p className="text-xs italic text-slate-600 mt-0.5">({profile.reviewerTitle})</p>
                <div className="h-20" />
                <p className="font-bold text-slate-900">{profile.reviewer}</p>
              </div>

              <div>
                <p className="text-xs italic text-slate-600 mb-0.5">
                  Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                </p>
                <p className="font-bold uppercase text-slate-800">GIÁO VIÊN BÁO GIẢNG</p>
                <p className="text-xs italic text-slate-600 mt-0.5">(Ký và ghi rõ họ tên)</p>
                <div className="h-20" />
                <p className="font-bold text-slate-900">{profile.teacherName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
