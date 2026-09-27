import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Database,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  CheckCircle,
  X,
  ArrowRight,
  Info,
  Trash2,
} from 'lucide-react';
import {
  AppSettings,
  CurriculumEntry,
  LessonLogEntry,
  StorageData,
  SubjectAlias,
  TeacherProfile,
  TimetableSlot,
  Weekday,
} from '../types';
import {
  downloadSampleCurriculumTemplate,
  downloadSampleTimetableTemplate,
  exportCurriculumToExcel,
  exportLessonLogToExcel,
  exportTimetableToExcel,
} from '../utils/excelUtils';
import { exportBackupJSON, getInitialStorageData } from '../services/storageService';
import { getWeekDateRangeVN } from '../utils/dateUtils';
import { generateWeeklyLessonLog } from '../utils/lessonLogGenerator';
import { AiCurriculumParserModal } from './AiCurriculumParserModal';
import { AiTimetableParserModal } from './AiTimetableParserModal';

interface DataImportExportProps {
  storageData: StorageData;
  setProfile: React.Dispatch<React.SetStateAction<TeacherProfile>>;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  setTimetable: React.Dispatch<React.SetStateAction<TimetableSlot[]>>;
  setCurriculum: React.Dispatch<React.SetStateAction<CurriculumEntry[]>>;
  setLessonLogs: React.Dispatch<React.SetStateAction<LessonLogEntry[]>>;
  setAliases: React.Dispatch<React.SetStateAction<SubjectAlias[]>>;
  onLoadSampleData: () => void;
  onClearSampleData: () => void;
}

export const DataImportExport: React.FC<DataImportExportProps> = ({
  storageData,
  setProfile,
  setSettings,
  setTimetable,
  setCurriculum,
  setLessonLogs,
  setAliases,
  onLoadSampleData,
  onClearSampleData,
}) => {
  // Import modal / step state
  const [importType, setImportType] = useState<'ppct' | 'tkb' | 'backup' | null>(null);
  const [importedRawData, setImportedRawData] = useState<any[]>([]);
  const [importSheetNames, setImportSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<{
    validItems: any[];
    invalidItems: { row: number; error: string; raw: any }[];
  } | null>(null);

  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiTkbModalOpen, setIsAiTkbModalOpen] = useState(false);

  // File handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'ppct' | 'tkb' | 'backup') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportType(type);
    setParsedPreview(null);
    setImportSuccessMsg(null);

    if (type === 'backup') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content) as StorageData;
          if (!parsed.profile || !parsed.timetable || !parsed.curriculum) {
            throw new Error('Cấu trúc file sao lưu JSON không đúng định dạng!');
          }
          setProfile(parsed.profile);
          setSettings(parsed.settings);
          setTimetable(parsed.timetable);
          setCurriculum(parsed.curriculum);
          setLessonLogs(parsed.lessonLogs || []);
          setAliases(parsed.aliases || []);
          setImportSuccessMsg('Khôi phục toàn bộ dữ liệu từ bản sao lưu thành công!');
          setImportType(null);
        } catch (err: any) {
          alert('Lỗi đọc file sao lưu: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    // Excel / CSV File reader
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        const wb = XLSX.read(buffer, { type: 'array' });
        setImportSheetNames(wb.SheetNames);
        const defaultSheet = wb.SheetNames[0];
        setSelectedSheet(defaultSheet);

        parseSheetData(wb, defaultSheet, type);
      } catch (err: any) {
        alert('Lỗi đọc file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const parseSheetData = (wb: XLSX.WorkBook, sheetName: string, type: 'ppct' | 'tkb') => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    if (type === 'ppct') {
      const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      if (rows.length < 2) {
        alert('Sheet không có dữ liệu!');
        return;
      }

      // Detect header row (contains 'tiết' or 'bài' or 'môn')
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const rowStr = JSON.stringify(rows[i] || '').toLowerCase();
        if (rowStr.includes('môn') || rowStr.includes('tiết') || rowStr.includes('bài')) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = (rows[headerRowIndex] || []).map((h: any) => String(h || '').trim().toLowerCase());
      const subjectCol = headers.findIndex((h: string) => h.includes('môn'));
      const gradeCol = headers.findIndex((h: string) => h.includes('khối') || h.includes('lớp'));
      const periodCol = headers.findIndex((h: string) => h.includes('tiết') || h.includes('stt'));
      const titleCol = headers.findIndex((h: string) => h.includes('tên') || h.includes('bài'));
      const semesterCol = headers.findIndex((h: string) => h.includes('kỳ'));
      const categoryCol = headers.findIndex((h: string) => h.includes('loại') || h.includes('mảng'));
      const noteCol = headers.findIndex((h: string) => h.includes('ghi chú'));

      const validItems: CurriculumEntry[] = [];
      const invalidItems: { row: number; error: string; raw: any }[] = [];

      for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === '')) {
          continue;
        }

        const rawPeriod = periodCol >= 0 ? row[periodCol] : null;
        const rawTitle = titleCol >= 0 ? row[titleCol] : null;
        const rawSubject = subjectCol >= 0 ? row[subjectCol] : 'Toán';
        const rawGrade = gradeCol >= 0 ? row[gradeCol] : 10;

        const periodNum = Number(rawPeriod);
        if (isNaN(periodNum) || periodNum <= 0) {
          invalidItems.push({
            row: r + 1,
            error: 'Tiết PPCT phải là số nguyên dương hợp lệ',
            raw: row,
          });
          continue;
        }

        if (!rawTitle || String(rawTitle).trim() === '') {
          invalidItems.push({
            row: r + 1,
            error: 'Tên bài dạy không được để trống',
            raw: row,
          });
          continue;
        }

        validItems.push({
          id: `ppct-import-${r}-${Date.now().toString(36)}`,
          subject: String(rawSubject || 'Toán').trim(),
          grade: Number(rawGrade) || 10,
          periodNumber: periodNum,
          lessonTitle: String(rawTitle).trim(),
          semester: semesterCol >= 0 && String(row[semesterCol]).includes('II') ? 'Học kỳ II' : 'Học kỳ I',
          category: categoryCol >= 0 ? String(row[categoryCol] || '').trim() : '',
          note: noteCol >= 0 ? String(row[noteCol] || '').trim() : '',
        });
      }

      setParsedPreview({ validItems, invalidItems });
    } else if (type === 'tkb') {
      // Grid parser for timetable
      const rows = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
      const validItems: TimetableSlot[] = [];
      const invalidItems: { row: number; error: string; raw: any }[] = [];

      // Find headers containing day names
      let dayCols: { colIndex: number; weekday: Weekday }[] = [];
      let startRow = 0;

      for (let r = 0; r < Math.min(rows.length, 5); r++) {
        const row = rows[r] || [];
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').toLowerCase();
          if (val.includes('thứ 2') || val === 't2' || val.includes('hai')) {
            dayCols.push({ colIndex: c, weekday: 2 });
          } else if (val.includes('thứ 3') || val === 't3' || val.includes('ba')) {
            dayCols.push({ colIndex: c, weekday: 3 });
          } else if (val.includes('thứ 4') || val === 't4' || val.includes('tư')) {
            dayCols.push({ colIndex: c, weekday: 4 });
          } else if (val.includes('thứ 5') || val === 't5' || val.includes('năm')) {
            dayCols.push({ colIndex: c, weekday: 5 });
          } else if (val.includes('thứ 6') || val === 't6' || val.includes('sáu')) {
            dayCols.push({ colIndex: c, weekday: 6 });
          } else if (val.includes('thứ 7') || val === 't7' || val.includes('bảy')) {
            dayCols.push({ colIndex: c, weekday: 7 });
          }
        }
        if (dayCols.length >= 3) {
          startRow = r + 1;
          break;
        }
      }

      if (dayCols.length === 0) {
        // Fallback default columns: col 2 = T2, col 3 = T3, col 4 = T4, col 5 = T5, col 6 = T6
        dayCols = [
          { colIndex: 2, weekday: 2 },
          { colIndex: 3, weekday: 3 },
          { colIndex: 4, weekday: 4 },
          { colIndex: 5, weekday: 5 },
          { colIndex: 6, weekday: 6 },
        ];
        startRow = 1;
      }

      let currentSession: 'morning' | 'afternoon' = 'morning';

      for (let r = startRow; r < rows.length; r++) {
        const row = rows[r] || [];
        const sessionColVal = String(row[0] || '').toLowerCase();
        if (sessionColVal.includes('chiều') || sessionColVal.includes('p.m')) {
          currentSession = 'afternoon';
        } else if (sessionColVal.includes('sáng') || sessionColVal.includes('a.m')) {
          currentSession = 'morning';
        }

        const periodVal = Number(row[1]);
        const periodNum = !isNaN(periodVal) && periodVal >= 1 && periodVal <= 5 ? periodVal : ((r - startRow) % 5) + 1;

        for (const dc of dayCols) {
          const rawCell = String(row[dc.colIndex] || '').trim();
          if (!rawCell) continue;

          // Parse raw cell text (e.g. "10A8-Toán", "Chào cờ", "12B1")
          let className = '';
          let subject = '';
          let activity = '';

          const isActivity = ['chào cờ', 'sinh hoạt', 'khai giảng', 'ngoại khóa', 'nghỉ'].some((act) =>
            rawCell.toLowerCase().includes(act)
          );

          if (isActivity) {
            activity = rawCell;
          } else if (rawCell.includes('-')) {
            const parts = rawCell.split('-');
            className = parts[0]?.trim() || '';
            subject = parts.slice(1).join('-')?.trim() || '';
          } else {
            // Check if matches class like 10A8
            const matchClass = rawCell.match(/^(\d{1,2}[A-Za-z0-9]+)/);
            if (matchClass) {
              className = matchClass[1];
              subject = rawCell.replace(className, '').trim() || 'Toán';
            } else {
              subject = rawCell;
            }
          }

          validItems.push({
            id: `tkb-import-${r}-${dc.weekday}-${Date.now().toString(36)}`,
            weekNumber: storageData.settings.currentWeek,
            year: 2024,
            weekday: dc.weekday,
            session: currentSession,
            period: periodNum,
            rawText: rawCell,
            className,
            subject,
            activity,
            isOff: rawCell.toLowerCase() === 'nghỉ',
          });
        }
      }

      setParsedPreview({ validItems, invalidItems });
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview || !importType) return;

    if (importType === 'ppct') {
      setCurriculum((prev) => [...prev, ...parsedPreview.validItems]);
      setImportSuccessMsg(`Đã nhập thành công ${parsedPreview.validItems.length} bài vào phân phối chương trình!`);
    } else if (importType === 'tkb') {
      // Replace or merge into current week
      setTimetable((prev) => {
        const withoutCurrentWeek = prev.filter((s) => s.weekNumber !== storageData.settings.currentWeek);
        return [...withoutCurrentWeek, ...parsedPreview.validItems];
      });
      setImportSuccessMsg(
        `Đã nhập thành công ${parsedPreview.validItems.length} tiết vào thời khóa biểu Tuần ${storageData.settings.currentWeek}!`
      );
    }

    setImportType(null);
    setParsedPreview(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Dữ liệu & Nhập / Xuất</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Lưu trữ an toàn trên máy
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Nhập file Excel/CSV, tải file mẫu, sao lưu toàn bộ ứng dụng và khôi phục khi cần thiết
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportBackupJSON(storageData)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Sao lưu toàn bộ (JSON)</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {importSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{importSuccessMsg}</span>
          </div>
          <button
            onClick={() => setImportSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Import PPCT */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800">Phân phối chương trình (PPCT)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Nhập danh sách bài dạy từ file Excel có sẵn. Hệ thống hỗ trợ đọc các cột Môn, Khối, Tiết PPCT, Tên bài.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Tải ảnh chụp / Văn bản qua AI</span>
            </button>

            <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span>Tải file Excel / CSV PPCT</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, 'ppct')}
                className="hidden"
              />
            </label>

            <button
              onClick={downloadSampleCurriculumTemplate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file mẫu PPCT chuẩn (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Card 2: Import Timetable */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800">Thời khóa biểu dạng lưới</h3>
            <p className="text-xs text-slate-500 mt-1">
              Nhập bảng thời khóa biểu dạng lưới hàng tuần (Sáng/Chiều, Tiết 1-5, Thứ 2 đến Thứ 6) vào tuần hiện tại.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsAiTkbModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-sky-600 via-indigo-600 to-indigo-700 hover:from-sky-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Tải ảnh chụp / Excel TKB qua AI</span>
            </button>

            <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs rounded-xl cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span>Tải file Excel TKB dạng chuẩn</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileUpload(e, 'tkb')}
                className="hidden"
              />
            </label>

            <button
              onClick={downloadSampleTimetableTemplate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-sky-600 hover:bg-slate-50 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file mẫu TKB dạng lưới (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Card 3: Backup & Restore */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-800">Sao lưu & Khôi phục</h3>
            <p className="text-xs text-slate-500 mt-1">
              Toàn bộ dữ liệu của thầy/cô (TKB các tuần, PPCT, Báo giảng đã lập) có thể lưu thành 1 file duy nhất để chuyển sang máy tính khác.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl cursor-pointer transition">
              <Upload className="w-4 h-4" />
              <span>Khôi phục từ file JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={(e) => handleFileUpload(e, 'backup')}
                className="hidden"
              />
            </label>

            <button
              onClick={() => exportBackupJSON(storageData)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải bản sao lưu hiện tại (.json)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sample Data Control & Reset Box */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Quản lý dữ liệu mẫu minh họa
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu mẫu giúp thầy/cô dễ dàng hình dung quy trình vận hành trước khi nhập dữ liệu thực tế của mình.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onLoadSampleData}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 transition cursor-pointer"
          >
            Nạp lại dữ liệu mẫu
          </button>
          <button
            onClick={onClearSampleData}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-700 text-slate-700 transition cursor-pointer"
          >
            Xóa dữ liệu để làm mới
          </button>
        </div>
      </div>

      {/* Import Preview Modal */}
      {parsedPreview && importType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  Xem trước và xác nhận dữ liệu nhập ({importType === 'ppct' ? 'PPCT' : 'Thời khóa biểu'})
                </h3>
                <p className="text-xs text-slate-300">
                  Kiểm tra kết quả đọc file trước khi ghi vào hệ thống
                </p>
              </div>
              <button
                onClick={() => setParsedPreview(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Status Banner */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                  <p className="font-semibold text-sm">Hợp lệ: {parsedPreview.validItems.length} dòng</p>
                  <p className="text-[11px] text-emerald-700">Sẵn sàng để nạp vào hệ thống</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  <p className="font-semibold text-sm">Không hợp lệ: {parsedPreview.invalidItems.length} dòng</p>
                  <p className="text-[11px] text-rose-700">Bị bỏ qua do thiếu cột hoặc sai định dạng</p>
                </div>
              </div>

              {/* Errors list if any */}
              {parsedPreview.invalidItems.length > 0 && (
                <div className="border border-rose-200 rounded-xl p-3 bg-rose-50/50 space-y-1">
                  <p className="font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Chi tiết các dòng bị lỗi:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-rose-700 pl-2">
                    {parsedPreview.invalidItems.map((err, i) => (
                      <div key={i}>
                        Dòng {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div>
                <p className="font-bold text-slate-700 mb-2">Mẫu một số dòng đọc thành công:</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                      <tr>
                        {importType === 'ppct' ? (
                          <>
                            <th className="p-2">Tiết</th>
                            <th className="p-2">Môn</th>
                            <th className="p-2">Khối</th>
                            <th className="p-2">Tên bài dạy</th>
                          </>
                        ) : (
                          <>
                            <th className="p-2">Thứ</th>
                            <th className="p-2">Buổi</th>
                            <th className="p-2">Tiết</th>
                            <th className="p-2">Nội dung</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedPreview.validItems.slice(0, 8).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {importType === 'ppct' ? (
                            <>
                              <td className="p-2 font-bold text-indigo-700">{item.periodNumber}</td>
                              <td className="p-2 font-semibold">{item.subject}</td>
                              <td className="p-2">K{item.grade}</td>
                              <td className="p-2">{item.lessonTitle}</td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 font-bold text-slate-700">T{item.weekday}</td>
                              <td className="p-2">{item.session === 'morning' ? 'Sáng' : 'Chiều'}</td>
                              <td className="p-2 font-semibold">T{item.period}</td>
                              <td className="p-2 font-bold text-indigo-700">{item.rawText}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setParsedPreview(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={parsedPreview.validItems.length === 0}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs disabled:opacity-40"
              >
                Xác nhận nạp vào sổ ({parsedPreview.validItems.length} mục)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Curriculum Parser Modal */}
      <AiCurriculumParserModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSaveEntries={(newEntries, mode) => {
          if (newEntries.length === 0) return;

          setCurriculum((prev) => {
            if (mode === 'replace') {
              const replaceKeys = new Set(
                newEntries.map((c) => `${c.subject.trim().toLowerCase()}__${c.grade}`)
              );
              const remaining = prev.filter(
                (c) => !replaceKeys.has(`${c.subject.trim().toLowerCase()}__${c.grade}`)
              );
              return [...remaining, ...newEntries];
            }
            return [...prev, ...newEntries];
          });

          const distinctPairs = Array.from(
            new Set(newEntries.map((e) => `${e.subject} ${e.grade}`))
          ).join(', ');

          setImportSuccessMsg(
            `Đã trích xuất và lưu vĩnh viễn ${newEntries.length} bài PPCT (${distinctPairs}) vào hệ thống & Cloud Firestore!`
          );
        }}
      />

      {/* AI Timetable Parser Modal */}
      <AiTimetableParserModal
        isOpen={isAiTkbModalOpen}
        onClose={() => setIsAiTkbModalOpen(false)}
        initialWeek={storageData.settings.currentWeek}
        startMondayDate={storageData.settings.startMondayDate}
        onSaveTimetable={(newSlots, targetWeek, autoGenerateSchedule, teacherMeta) => {
          setTimetable((prev) => [
            ...prev.filter((s) => s.weekNumber !== targetWeek),
            ...newSlots,
          ]);

          if (storageData.settings.currentWeek !== targetWeek) {
            setSettings((prev) => ({ ...prev, currentWeek: targetWeek }));
          }

          if (teacherMeta) {
            setProfile((prev) => ({
              ...prev,
              teacherName: teacherMeta.teacherName || prev.teacherName,
              schoolYear: teacherMeta.schoolYear || prev.schoolYear,
              semester: (teacherMeta.semester as any) || prev.semester,
            }));
          }

          if (autoGenerateSchedule) {
            const updatedTimetable = [
              ...storageData.timetable.filter((s) => s.weekNumber !== targetWeek),
              ...newSlots,
            ];

            const { newLogs, stats } = generateWeeklyLessonLog({
              weekNumber: targetWeek,
              year: 2026,
              startMondayDate: storageData.settings.startMondayDate,
              timetable: updatedTimetable,
              curriculum: storageData.curriculum,
              aliases: storageData.aliases,
              existingLogs: storageData.lessonLogs,
              keepManualEdits: false,
            });

            setLessonLogs((prev) => [
              ...prev.filter((l) => l.weekNumber !== targetWeek),
              ...newLogs,
            ]);

            setImportSuccessMsg(
              `Đã tải ${newSlots.length} tiết TKB và tự động tạo Lịch Báo Giảng Tuần ${targetWeek} (${stats.matched} tiết khớp PPCT nối tiếp tuần trước, tổng cộng ${stats.total} tiết)!`
            );
          } else {
            setImportSuccessMsg(`Đã lưu ${newSlots.length} tiết TKB cho Tuần ${targetWeek}!`);
          }
        }}
      />
    </div>
  );
};
