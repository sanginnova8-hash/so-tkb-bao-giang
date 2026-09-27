import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  Upload,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Calendar,
  HelpCircle,
  Database,
  ArrowRight,
  BookOpen,
  ClipboardPaste,
  Maximize2,
} from 'lucide-react';
import { AppSettings, SessionType, TimetableSlot, Weekday } from '../types';
import { formatDateVN, getDateOfWeekDay, getWeekDateRangeVN, parseDate, WEEKDAYS } from '../utils/dateUtils';
import { GeminiApiKeyManager } from './GeminiApiKeyManager';
import { safeFetchJson } from '../utils/apiUtils';

interface AiTimetableParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeek: number;
  startMondayDate: string;
  onSaveTimetable: (
    slots: TimetableSlot[],
    targetWeek: number,
    autoGenerateSchedule: boolean,
    teacherMeta?: { teacherName?: string; schoolYear?: string; semester?: string }
  ) => void;
}

export const AiTimetableParserModal: React.FC<AiTimetableParserModalProps> = ({
  isOpen,
  onClose,
  initialWeek = 1,
  startMondayDate,
  onSaveTimetable,
}) => {
  // Stored API key & Model
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('GEMINI_USER_API_KEY') || '';
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('GEMINI_SELECTED_MODEL') || 'gemini-3.8-flash';
  });
  const [showKey, setShowKey] = useState(false);
  const [hasServerKey, setHasServerKey] = useState(false);

  // Selected week
  const [targetWeek, setTargetWeek] = useState<number>(initialWeek);
  const [autoGenerateSchedule, setAutoGenerateSchedule] = useState<boolean>(true);

  // Input mode & file
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    mimeType: string;
    base64?: string;
    formatType: 'word' | 'excel' | 'pdf' | 'image' | 'text';
    previewUrl?: string;
    isPasted?: boolean;
  } | null>(null);

  // Dragging & Paste Toast
  const [isDragging, setIsDragging] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Loading & error
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed result
  const [parsedResult, setParsedResult] = useState<{
    teacherName?: string;
    schoolYear?: string;
    semester?: string;
    effectiveDate?: string;
    detectedWeek?: number;
    slots: {
      weekday: Weekday;
      session: SessionType;
      period: number;
      className?: string;
      subject?: string;
      activity?: string;
      rawText: string;
      room?: string;
      note?: string;
    }[];
  } | null>(null);

  // Update targetWeek if initialWeek changes when opening
  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('GEMINI_USER_API_KEY') || '');
      setSelectedModel(localStorage.getItem('GEMINI_SELECTED_MODEL') || 'gemini-3.6-flash');
      setTargetWeek(initialWeek);
      setParsedResult(null);
      setErrorMessage(null);
      setPasteToast(null);
      setIsImageModalOpen(false);
    }
  }, [isOpen, initialWeek]);

  // Check if server has API key configured
  useEffect(() => {
    safeFetchJson<{ hasServerApiKey: boolean }>('/api/gemini-status')
      .then((res) => {
        if (res.ok && res.data?.hasServerApiKey) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});
  }, []);

  // Detect file format type
  const getFileFormatType = (name: string, mime: string): 'word' | 'excel' | 'pdf' | 'image' | 'text' => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.docx') || lower.endsWith('.doc') || mime.includes('word')) {
      return 'word';
    }
    if (
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls') ||
      lower.endsWith('.xlsm') ||
      lower.endsWith('.csv') ||
      mime.includes('spreadsheet') ||
      mime.includes('excel')
    ) {
      return 'excel';
    }
    if (lower.endsWith('.pdf') || mime === 'application/pdf') {
      return 'pdf';
    }
    if (
      mime.startsWith('image/') ||
      ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.heic'].some((ext) => lower.endsWith(ext))
    ) {
      return 'image';
    }
    return 'text';
  };

  // Helper to process File (from input, drag-and-drop, or clipboard paste)
  const processFile = (file: File | Blob, customName?: string, isPasted: boolean = false) => {
    setErrorMessage(null);
    const mime = file.type || 'image/png';
    const fileName = customName || (file as File).name || 'anh_tkb.png';
    const format = getFileFormatType(fileName, mime);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64 = result.split(',')[1] || '';

      setSelectedFile({
        name: fileName,
        size: file.size,
        mimeType: mime,
        base64: base64,
        formatType: format,
        previewUrl: format === 'image' ? result : undefined,
        isPasted: isPasted,
      });

      setInputMode('file');
      if (isPasted) {
        setPasteToast('Đã dán ảnh chụp Thời khóa biểu từ Clipboard!');
        setTimeout(() => setPasteToast(null), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  // Global paste handler (Ctrl + V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing into text mode textarea
      const target = e.target as HTMLElement;
      if (inputMode === 'text' && target && target.tagName === 'TEXTAREA') {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // 1. Check for image in clipboard items
      const items = clipboardData.items;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              const timeStr = new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-');
              processFile(blob, `Anh_TKB_Paste_${timeStr}.png`, true);
              return;
            }
          }
        }
      }

      // 2. Check for image in clipboard files
      const files = clipboardData.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          const timeStr = new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-');
          processFile(file, `Anh_TKB_Paste_${timeStr}.png`, true);
          return;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, inputMode]);

  // Direct paste button using clipboard API
  const handlePasteFromClipboard = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.clipboard) {
        setErrorMessage('Vui lòng bấm tổ hợp phím Ctrl + V (hoặc Cmd + V trên Mac) để dán ảnh chụp TKB.');
        return;
      }

      if (navigator.clipboard.read) {
        try {
          const clipboardItems = await navigator.clipboard.read();
          for (const item of clipboardItems) {
            const imageType = item.types.find((t) => t.startsWith('image/'));
            if (imageType) {
              const blob = await item.getType(imageType);
              const timeStr = new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-');
              processFile(
                new File([blob], `Anh_TKB_Paste_${timeStr}.png`, { type: imageType }),
                `Anh_TKB_Paste_${timeStr}.png`,
                true
              );
              return;
            }
          }
        } catch (readErr: any) {
          console.warn('navigator.clipboard.read error:', readErr);
        }
      }

      // If no image found or permission blocked, try reading text
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setTextContent(text);
        setInputMode('text');
        setPasteToast('Đã dán văn bản TKB từ Clipboard!');
        setTimeout(() => setPasteToast(null), 3000);
        return;
      }

      setErrorMessage(
        'Không tìm thấy ảnh chụp trong Clipboard. Hãy chụp màn hình (PrintScreen / Win+Shift+S / Snipping Tool) hoặc sao chép ảnh TKB rồi bấm Ctrl + V.'
      );
    } catch {
      setErrorMessage(
        'Trình duyệt hạn chế truy cập Clipboard tự động. Thầy/cô chỉ cần bấm phím Ctrl + V (hoặc Cmd + V) trực tiếp trên bàn phím là được nhé!'
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    if (val.trim()) {
      localStorage.setItem('GEMINI_USER_API_KEY', val.trim());
    } else {
      localStorage.removeItem('GEMINI_USER_API_KEY');
    }
  };

  // Helper to calculate week number from date string e.g. "21/9/2026"
  const calculateWeekFromDate = (dateStr: string): number | null => {
    try {
      const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (!match) return null;
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);

      const targetDate = new Date(year, month - 1, day, 0, 0, 0);
      const baseMonday = parseDate(startMondayDate);

      const diffMs = targetDate.getTime() - baseMonday.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const week = Math.floor(diffDays / 7) + 1;
      return week > 0 && week <= 45 ? week : null;
    } catch {
      return null;
    }
  };

  const handleRunAiParser = async () => {
    setErrorMessage(null);

    if (!hasServerKey && !apiKey.trim()) {
      setErrorMessage('Vui lòng nhập API Key Gemini của bạn để tiếp tục.');
      return;
    }

    if (inputMode === 'file' && !selectedFile && !textContent) {
      setErrorMessage('Vui lòng chọn ảnh chụp TKB hoặc dán ảnh (Ctrl + V) để tải lên.');
      return;
    }

    if (inputMode === 'text' && !textContent.trim()) {
      setErrorMessage('Vui lòng dán nội dung văn bản thời khóa biểu.');
      return;
    }

    setIsLoading(true);

    try {
      const currentKey = apiKey.trim() || localStorage.getItem('GEMINI_USER_API_KEY')?.trim() || '';
      const currentModel = selectedModel || localStorage.getItem('GEMINI_SELECTED_MODEL') || 'gemini-3.6-flash';

      const payload: any = {
        apiKey: currentKey,
        model: currentModel,
        targetWeek: targetWeek,
        startMondayDate: startMondayDate,
      };

      if (selectedFile?.base64) {
        payload.fileBase64 = selectedFile.base64;
        payload.mimeType = selectedFile.mimeType;
        payload.fileName = selectedFile.name;
      }

      if (textContent.trim()) {
        payload.contentText = textContent.trim();
      }

      const res = await safeFetchJson<{ success: boolean; data: any; error?: string }>('/api/parse-tkb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': currentKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.data?.success) {
        throw new Error(res.error || res.data?.error || 'Không thể trích xuất thời khóa biểu.');
      }

      const data = res.data.data;
      setParsedResult(data);

      // Check if effectiveDate can suggest targetWeek
      if (data.effectiveDate) {
        const calculatedWeek = calculateWeekFromDate(data.effectiveDate);
        if (calculatedWeek) {
          setTargetWeek(calculatedWeek);
        }
      } else if (data.detectedWeek && typeof data.detectedWeek === 'number') {
        setTargetWeek(data.detectedWeek);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Lỗi khi gọi Gemini AI để trích xuất Thời khóa biểu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSave = () => {
    if (!parsedResult || !parsedResult.slots) return;

    const slotsToSave: TimetableSlot[] = parsedResult.slots.map((item, idx) => ({
      id: `tkb-${targetWeek}-${item.weekday}-${item.session}-${item.period}-${Date.now().toString(36)}-${idx}`,
      weekNumber: targetWeek,
      year: 2026,
      weekday: item.weekday,
      session: item.session,
      period: item.period,
      rawText: item.rawText || `${item.className || ''}-${item.subject || ''}`,
      className: item.className || '',
      subject: item.subject || '',
      activity: item.activity || '',
      room: item.room || '',
      note: item.note || '',
      isOff: false,
    }));

    onSaveTimetable(slotsToSave, targetWeek, autoGenerateSchedule, {
      teacherName: parsedResult.teacherName,
      schoolYear: parsedResult.schoolYear,
      semester: parsedResult.semester,
    });
    onClose();
  };

  if (!isOpen) return null;

  const weekRange = getWeekDateRangeVN(startMondayDate, targetWeek, true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">Tải TKB tuần bằng AI & Sinh Lịch Báo Giảng</h3>
              <p className="text-xs text-sky-100">
                Chụp ảnh & dán nhanh (Ctrl + V), tải file Excel hoặc PDF TKB tuần
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Section 1: API Key & Model Config */}
          <GeminiApiKeyManager
            apiKey={apiKey}
            setApiKey={setApiKey}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            hasServerKey={hasServerKey}
          />

          {/* Section 2: Target Week Selection */}
          <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="font-bold text-slate-900 block">Chọn tuần áp dụng thời khóa biểu:</label>
                <p className="text-[11px] text-slate-600">
                  {weekRange.displayRange} (Căn cứ theo ngày bắt đầu năm học)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={targetWeek}
                onChange={(e) => setTargetWeek(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-indigo-300 rounded-xl font-bold text-indigo-700 text-sm outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                {Array.from({ length: 40 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Tuần {w}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: File Upload, Paste or Text Input */}
          {!parsedResult ? (
            <div className="space-y-3.5">
              {/* Badges & Paste notification toast */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-700 mr-1">Định dạng hỗ trợ:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                    <ImageIcon className="w-3 h-3" /> Ảnh chụp / Clipboard TKB (.png, .jpg)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    <FileSpreadsheet className="w-3 h-3" /> File Excel TKB (.xlsx, .xls)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold border border-rose-200">
                    <FileIcon className="w-3 h-3" /> File PDF (.pdf)
                  </span>
                </div>

                {/* Paste shortcut badge */}
                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  <kbd className="px-1 py-0.5 bg-white border border-indigo-300 rounded text-[10px] font-mono shadow-2xs">
                    Ctrl + V
                  </kbd>{' '}
                  để dán ảnh
                </span>
              </div>

              {/* Paste Toast message */}
              {pasteToast && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs">{pasteToast}</span>
                  </div>
                  <button
                    onClick={() => setPasteToast(null)}
                    className="text-emerald-700 hover:text-emerald-900 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Input mode switcher + Quick Paste button */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('file')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      inputMode === 'file'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải ảnh hoặc file Excel TKB</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('text')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      inputMode === 'text'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Dán nội dung văn bản</span>
                  </button>
                </div>

                {/* Direct Paste Action button */}
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-xs transition cursor-pointer hover:scale-105 active:scale-95"
                  title="Bấm để dán ảnh chụp màn hình TKB từ bộ nhớ tạm Clipboard (hoặc nhấn Ctrl + V)"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-amber-300" />
                  <span>Dán ảnh từ Clipboard (Ctrl + V)</span>
                </button>
              </div>

              {/* Mode 1: File / Image Upload & Paste Dropzone */}
              {inputMode === 'file' && (
                <div className="space-y-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
                    }`}
                  >
                    <label className="w-full flex flex-col items-center justify-center cursor-pointer group">
                      <div className="flex items-center gap-2 p-3 bg-white rounded-2xl shadow-xs group-hover:scale-105 transition mb-2">
                        <ImageIcon className="w-6 h-6 text-purple-600" />
                        <ClipboardPaste className="w-6 h-6 text-indigo-600" />
                        <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                      </div>
                      <span className="font-bold text-slate-800 text-sm text-center">
                        Chọn ảnh chụp TKB, file Excel hoặc <span className="text-indigo-600">bấm Ctrl + V</span> để dán ảnh
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1 text-center max-w-md">
                        Hỗ trợ ảnh chụp màn hình từ Zalo, Paint, Snipping Tool, Facebook, web hoặc file Excel
                      </span>
                      <input
                        type="file"
                        accept="image/*,.xlsx,.xls,.xlsm,.csv,.pdf,.docx,.txt"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {/* Quick paste helper badge */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePasteFromClipboard}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Bấm vào đây để dán ảnh đã copy</span>
                      </button>
                    </div>
                  </div>

                  {/* Selected / Pasted File Preview Card */}
                  {selectedFile && (
                    <div className="flex items-center justify-between p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-3">
                        {/* Thumbnail if image */}
                        {selectedFile.previewUrl ? (
                          <div className="relative group/thumb cursor-pointer" onClick={() => setIsImageModalOpen(true)}>
                            <img
                              src={selectedFile.previewUrl}
                              alt="TKB Preview"
                              className="w-14 h-14 object-cover rounded-lg border-2 border-indigo-300 shadow-xs group-hover/thumb:opacity-90 transition"
                            />
                            <div className="absolute inset-0 bg-slate-900/30 rounded-lg flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition text-white">
                              <Maximize2 className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-white rounded-lg shadow-2xs">
                            {selectedFile.formatType === 'excel' ? (
                              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                            ) : (
                              <FileIcon className="w-6 h-6 text-slate-600" />
                            )}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 max-w-sm truncate">{selectedFile.name}</p>
                            {selectedFile.isPasted && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                Dán từ Clipboard
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {(selectedFile.size / 1024).toFixed(1)} KB •{' '}
                            {selectedFile.formatType === 'excel'
                              ? 'Bảng tính Excel TKB'
                              : selectedFile.formatType === 'image'
                              ? 'Ảnh chụp thời khóa biểu'
                              : 'Tài liệu TKB'}
                          </p>
                          {selectedFile.previewUrl && (
                            <button
                              type="button"
                              onClick={() => setIsImageModalOpen(true)}
                              className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-semibold mt-0.5 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> Xem ảnh kích thước lớn
                            </button>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-white transition cursor-pointer"
                        title="Hủy chọn ảnh này"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Text input */}
              {inputMode === 'text' && (
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700">
                    Dán nội dung thời khóa biểu:
                  </label>
                  <textarea
                    rows={7}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Ví dụ:
Thứ 2: Sáng Tiết 1 10A8-HĐTN-HN, Tiết 3 10A8-Toán, Tiết 4 10A8-Toán
Thứ 3: Sáng Tiết 2 12B6-Toán, Tiết 3 12B1-Toán...
hoặc dán nguyên bảng copy từ Word / Excel..."
                    className="w-full p-3 border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
                  />
                </div>
              )}

              {/* Error display */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* Section 4: Parsed Review & Confirmation */
            <div className="space-y-4">
              {/* Success Badge & Meta info */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-sm">
                        Đã trích xuất thành công {parsedResult.slots.length} tiết dạy cho Tuần {targetWeek}!
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        {parsedResult.teacherName && (
                          <span>
                            Giáo viên: <b>{parsedResult.teacherName}</b> •{' '}
                          </span>
                        )}
                        {parsedResult.effectiveDate && (
                          <span>
                            Thực hiện từ: <b>{parsedResult.effectiveDate}</b> •{' '}
                          </span>
                        )}
                        {parsedResult.schoolYear && (
                          <span>
                            Năm học: <b>{parsedResult.schoolYear}</b>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setParsedResult(null)}
                    className="text-xs px-3 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg hover:bg-emerald-100 font-medium transition shadow-2xs cursor-pointer"
                  >
                    Tải lại file khác
                  </button>
                </div>

                {parsedResult.effectiveDate && (
                  <div className="pt-2 border-t border-emerald-200/60 flex items-center gap-2 text-[11px] text-emerald-800">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Thời khóa biểu thực hiện từ ngày <b>{parsedResult.effectiveDate}</b> đã được gán vào <b>Tuần {targetWeek}</b> ({weekRange.displayRange}).
                    </span>
                  </div>
                )}
              </div>

              {/* Option to automatically generate lesson log */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateSchedule}
                    onChange={(e) => setAutoGenerateSchedule(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800">
                      Tự động sinh Lịch Báo Giảng cho Tuần {targetWeek} ngay sau khi lưu
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Hệ thống tự động đọc Lịch Báo Giảng của Tuần 1 và các tuần trước để đánh số tiết PPCT nối tiếp chính xác!
                    </p>
                  </div>
                </label>
              </div>

              {/* Visual Grid Preview of the Week's TKB */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between">
                  <span>Bảng xem trước TKB Tuần {targetWeek} ({parsedResult.slots.length} tiết)</span>
                  <span className="text-[11px] text-slate-500 font-normal">Thứ 2 đến Thứ 6</span>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0">
                      <tr>
                        <th className="p-2 w-14 text-center border-r border-slate-200">Buổi</th>
                        <th className="p-2 w-12 text-center border-r border-slate-200">Tiết</th>
                        {[2, 3, 4, 5, 6].map((day) => (
                          <th key={day} className="p-2 border-r border-slate-200 last:border-r-0 text-center font-bold">
                            Thứ {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Morning periods 1..5 */}
                      {[1, 2, 3, 4, 5].map((period, idx) => (
                        <tr key={`morning-${period}`} className="hover:bg-slate-50">
                          {idx === 0 && (
                            <td
                              rowSpan={5}
                              className="p-2 text-center font-bold text-amber-700 bg-amber-50/50 border-r border-slate-200 w-14"
                            >
                              Sáng
                            </td>
                          )}
                          <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-200">
                            T{period}
                          </td>
                          {[2, 3, 4, 5, 6].map((day) => {
                            const slot = parsedResult.slots.find(
                              (s) => s.weekday === day && s.session === 'morning' && s.period === period
                            );
                            return (
                              <td
                                key={day}
                                className={`p-1.5 border-r border-slate-200 last:border-r-0 text-center ${
                                  slot ? 'bg-indigo-50/60 font-semibold text-indigo-900' : 'text-slate-300'
                                }`}
                              >
                                {slot ? (
                                  <span className="inline-block px-1.5 py-0.5 bg-white border border-indigo-200 rounded text-[11px] shadow-2xs font-bold text-indigo-700">
                                    {slot.rawText || `${slot.className}-${slot.subject}`}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Afternoon periods 1..5 */}
                      {[1, 2, 3, 4, 5].map((period, idx) => (
                        <tr key={`afternoon-${period}`} className="hover:bg-slate-50">
                          {idx === 0 && (
                            <td
                              rowSpan={5}
                              className="p-2 text-center font-bold text-indigo-700 bg-indigo-50/50 border-r border-slate-200 w-14"
                            >
                              Chiều
                            </td>
                          )}
                          <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-200">
                            T{period}
                          </td>
                          {[2, 3, 4, 5, 6].map((day) => {
                            const slot = parsedResult.slots.find(
                              (s) => s.weekday === day && s.session === 'afternoon' && s.period === period
                            );
                            return (
                              <td
                                key={day}
                                className={`p-1.5 border-r border-slate-200 last:border-r-0 text-center ${
                                  slot ? 'bg-sky-50/60 font-semibold text-sky-900' : 'text-slate-300'
                                }`}
                              >
                                {slot ? (
                                  <span className="inline-block px-1.5 py-0.5 bg-white border border-sky-200 rounded text-[11px] shadow-2xs font-bold text-sky-700">
                                    {slot.rawText || `${slot.className}-${slot.subject}`}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Hủy
          </button>

          {!parsedResult ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={handleRunAiParser}
              className="inline-flex items-center gap-2 px-5 py-2 font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Gemini đang đọc bảng Thời khóa biểu...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Trích xuất TKB Tuần {targetWeek}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmSave}
              className="inline-flex items-center gap-2 px-5 py-2 font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {autoGenerateSchedule
                  ? `Lưu TKB Tuần ${targetWeek} & Sinh Lịch Báo Giảng`
                  : `Lưu TKB Tuần ${targetWeek}`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Lightbox Modal for Large Image Preview */}
      {isImageModalOpen && selectedFile?.previewUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-800">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[80vh] flex items-center justify-center">
              <img
                src={selectedFile.previewUrl}
                alt="Thời khóa biểu đầy đủ"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
