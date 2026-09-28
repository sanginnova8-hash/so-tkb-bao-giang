import React, { useState, useEffect, useMemo } from 'react';
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
  BookOpen,
  Save,
  Check,
  HelpCircle,
  Database,
  FileCode,
  Layers,
  GraduationCap,
  ClipboardPaste,
  Maximize2,
} from 'lucide-react';
import { CurriculumEntry } from '../types';
import { GeminiApiKeyManager } from './GeminiApiKeyManager';
import { safeFetchJson } from '../utils/apiUtils';

interface AiCurriculumParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEntries: (entries: CurriculumEntry[], mode: 'append' | 'replace') => void;
  currentSubject?: string;
  currentGrade?: number;
}

export const AiCurriculumParserModal: React.FC<AiCurriculumParserModalProps> = ({
  isOpen,
  onClose,
  onSaveEntries,
  currentSubject = 'Toán',
  currentGrade = 10,
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

  // Input modes: 'file' | 'text'
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

  // Dragging, Paste Toast & Lightbox
  const [isDragging, setIsDragging] = useState(false);
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Subject & Grade configuration
  const [subject, setSubject] = useState(currentSubject);
  const [selectedGrades, setSelectedGrades] = useState<number[]>([currentGrade || 10]);
  const [isAutoDetectGrades, setIsAutoDetectGrades] = useState(false);

  // Processing state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed preview
  const [parsedResult, setParsedResult] = useState<{
    subject: string;
    grade: number;
    detectedSubjects?: string[];
    detectedGrades?: number[];
    semester: 'Học kỳ I' | 'Học kỳ II';
    entries: {
      subject?: string;
      grade?: number;
      periodNumber: number;
      lessonTitle: string;
      category?: string;
      semester?: 'Học kỳ I' | 'Học kỳ II';
      note?: string;
    }[];
  } | null>(null);

  const [previewFilter, setPreviewFilter] = useState<'all' | string>('all');
  const [saveMode, setSaveMode] = useState<'append' | 'replace'>('append');

  // Sync props when modal opens
  useEffect(() => {
    if (isOpen) {
      setApiKey(localStorage.getItem('GEMINI_USER_API_KEY') || '');
      setSelectedModel(localStorage.getItem('GEMINI_SELECTED_MODEL') || 'gemini-3.6-flash');
      setSubject(currentSubject || 'Toán');
      setSelectedGrades([currentGrade || 10]);
      setIsAutoDetectGrades(false);
      setParsedResult(null);
      setErrorMessage(null);
      setPreviewFilter('all');
      setPasteToast(null);
      setIsImageModalOpen(false);
    }
  }, [isOpen, currentSubject, currentGrade]);

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

  // Preset combo helper
  const applyPreset = (presetSub: string, grades: number[], auto: boolean = false) => {
    setSubject(presetSub);
    setSelectedGrades(grades);
    setIsAutoDetectGrades(auto);
  };

  // Toggle single grade
  const toggleGrade = (g: number) => {
    setIsAutoDetectGrades(false);
    setSelectedGrades((prev) => {
      if (prev.includes(g)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((x) => x !== g);
      } else {
        return [...prev, g].sort((a, b) => a - b);
      }
    });
  };

  // Determine format type from file name and mime
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

  // Helper to process File (input, drag-drop, or paste)
  const processFile = (file: File | Blob, customName?: string, isPasted: boolean = false) => {
    setErrorMessage(null);
    const mime = file.type || 'image/png';
    const fileName = customName || (file as File).name || 'anh_ppct.png';
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
        setPasteToast('Đã dán ảnh chụp phân phối chương trình thành công!');
        setTimeout(() => setPasteToast(null), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  // Global paste handler (Ctrl + V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (inputMode === 'text' && target && target.tagName === 'TEXTAREA') {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              const timeStr = new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-');
              processFile(blob, `Anh_PPCT_Paste_${timeStr}.png`, true);
              return;
            }
          }
        }
      }

      const files = clipboardData.files;
      if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        e.preventDefault();
        const timeStr = new Date().toLocaleTimeString('vi-VN').replace(/:/g, '-');
        processFile(files[0], `Anh_PPCT_Paste_${timeStr}.png`, true);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, inputMode]);

  // Direct paste button
  const handlePasteFromClipboard = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.clipboard) {
        setErrorMessage('Vui lòng bấm tổ hợp phím Ctrl + V (hoặc Cmd + V trên Mac) để dán ảnh chụp PPCT.');
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
                new File([blob], `Anh_PPCT_Paste_${timeStr}.png`, { type: imageType }),
                `Anh_PPCT_Paste_${timeStr}.png`,
                true
              );
              return;
            }
          }
        } catch (readErr: any) {
          console.warn('navigator.clipboard.read error:', readErr);
        }
      }

      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setTextContent(text);
        setInputMode('text');
        setPasteToast('Đã dán văn bản PPCT từ Clipboard!');
        setTimeout(() => setPasteToast(null), 3000);
        return;
      }

      setErrorMessage(
        'Không tìm thấy ảnh chụp trong Clipboard. Hãy chụp màn hình (PrintScreen / Win+Shift+S) hoặc sao chép ảnh PPCT rồi bấm Ctrl + V.'
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

  const handleRunAiParser = async () => {
    setErrorMessage(null);

    if (!hasServerKey && !apiKey.trim()) {
      setErrorMessage('Vui lòng nhập API Key Gemini của bạn để tiếp tục.');
      return;
    }

    if (inputMode === 'file' && !selectedFile && !textContent) {
      setErrorMessage('Vui lòng chọn file Word (.docx), Excel (.xlsx), PDF hoặc dán ảnh chụp (Ctrl + V) để tải lên.');
      return;
    }

    if (inputMode === 'text' && !textContent.trim()) {
      setErrorMessage('Vui lòng dán nội dung văn bản phân phối chương trình.');
      return;
    }

    setIsLoading(true);

    try {
      const currentKey = apiKey.trim() || localStorage.getItem('GEMINI_USER_API_KEY')?.trim() || '';
      const currentModel = selectedModel || localStorage.getItem('GEMINI_SELECTED_MODEL') || 'gemini-3.6-flash';

      const payload: any = {
        apiKey: currentKey,
        model: currentModel,
        defaultSubject: subject.trim(),
        defaultGrade: selectedGrades[0] || 10,
        targetSubject: subject.trim(),
        targetGrades: isAutoDetectGrades ? [] : selectedGrades,
      };

      if (selectedFile?.base64) {
        payload.fileBase64 = selectedFile.base64;
        payload.mimeType = selectedFile.mimeType;
        payload.fileName = selectedFile.name;
      }

      if (textContent.trim()) {
        payload.contentText = textContent.trim();
      }

      const res = await safeFetchJson<{ success: boolean; data: any; error?: string }>('/api/parse-ppct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': currentKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.data?.success) {
        throw new Error(res.error || res.data?.error || 'Không thể trích xuất nội dung từ Gemini.');
      }

      setParsedResult(res.data.data);
      setPreviewFilter('all');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Lỗi khi gọi Gemini AI để trích xuất PPCT.');
    } finally {
      setIsLoading(false);
    }
  };

  // Distinct groups found in parsedResult
  const groups = useMemo(() => {
    if (!parsedResult || !parsedResult.entries) return [];
    const map = new Map<string, { subject: string; grade: number; count: number }>();
    parsedResult.entries.forEach((e) => {
      const s = e.subject || parsedResult.subject || subject || 'Toán';
      const g = e.grade ? Number(e.grade) : (parsedResult.grade || 10);
      const key = `${s}__${g}`;
      if (!map.has(key)) {
        map.set(key, { subject: s, grade: g, count: 0 });
      }
      map.get(key)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      return a.grade - b.grade;
    });
  }, [parsedResult, subject]);

  // Entries filtered by previewFilter
  const displayedEntries = useMemo(() => {
    if (!parsedResult || !parsedResult.entries) return [];
    if (previewFilter === 'all') return parsedResult.entries;
    return parsedResult.entries.filter((e) => {
      const s = e.subject || parsedResult.subject || subject;
      const g = e.grade ? Number(e.grade) : (parsedResult.grade || 10);
      return `${s}__${g}` === previewFilter;
    });
  }, [parsedResult, previewFilter, subject]);

  const handleConfirmSave = () => {
    if (!parsedResult || !parsedResult.entries) return;

    const entriesToSave: CurriculumEntry[] = parsedResult.entries.map((item, idx) => ({
      id: `ppct-ai-${Date.now().toString(36)}-${idx}`,
      subject: item.subject || parsedResult.subject || subject || 'Toán',
      grade: item.grade ? Number(item.grade) : (parsedResult.grade || 10),
      periodNumber: item.periodNumber,
      lessonTitle: item.lessonTitle,
      semester: item.semester || parsedResult.semester || 'Học kỳ I',
      category: item.category || '',
      note: item.note || 'Trích xuất tự động qua AI',
    }));

    onSaveEntries(entriesToSave, saveMode);
    onClose();
  };

  // Helper icon for file types
  const renderFileIcon = (format: 'word' | 'excel' | 'pdf' | 'image' | 'text') => {
    switch (format) {
      case 'word':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'excel':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'pdf':
        return <FileIcon className="w-5 h-5 text-rose-600" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-purple-600" />;
      default:
        return <FileCode className="w-5 h-5 text-slate-600" />;
    }
  };

  if (!isOpen) return null;

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
              <h3 className="font-bold text-base">Tải PPCT tự động bằng Gemini AI</h3>
              <p className="text-xs text-sky-100">
                Hỗ trợ trích xuất theo từng môn (Toán, HĐTNHN...), nhiều khối (10, 12 hoặc 10-12), dán ảnh (Ctrl + V)
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

          {/* Section 2: Input Document / Image */}
          {!parsedResult ? (
            <div className="space-y-4">
              {/* Quick Presets Bar */}
              <div className="bg-gradient-to-r from-indigo-50/80 to-sky-50/80 p-3.5 rounded-xl border border-indigo-100/90 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Chọn nhanh cấu hình Môn & Khối:</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Hoặc tự điền chi tiết ở dưới</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('Toán', [10], false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      subject === 'Toán' &&
                      !isAutoDetectGrades &&
                      selectedGrades.length === 1 &&
                      selectedGrades.includes(10)
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Toán 10
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('Toán', [10, 12], false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      subject === 'Toán' &&
                      !isAutoDetectGrades &&
                      selectedGrades.length === 2 &&
                      selectedGrades.includes(10) &&
                      selectedGrades.includes(12)
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Toán 10, 12
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('Toán', [10, 11, 12], false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      subject === 'Toán' &&
                      !isAutoDetectGrades &&
                      selectedGrades.length === 3 &&
                      selectedGrades.includes(10) &&
                      selectedGrades.includes(11) &&
                      selectedGrades.includes(12)
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Toán 10-12
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('HĐTN-HN', [10], false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      (subject === 'HĐTN-HN' || subject === 'HĐTNHN') &&
                      !isAutoDetectGrades &&
                      selectedGrades.length === 1 &&
                      selectedGrades.includes(10)
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    HĐTNHN 10
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('HĐTN-HN', [10, 11, 12], false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      (subject === 'HĐTN-HN' || subject === 'HĐTNHN') &&
                      !isAutoDetectGrades &&
                      selectedGrades.length === 3 &&
                      selectedGrades.includes(10) &&
                      selectedGrades.includes(11) &&
                      selectedGrades.includes(12)
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    HĐTNHN 10-12
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(subject || 'Toán', [], true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isAutoDetectGrades
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Tự động nhận diện từ file
                  </button>
                </div>
              </div>

              {/* Document info: Subject and Grade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Subject selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Môn học:</label>
                    <span className="text-[10px] text-slate-400">Gõ tên môn hoặc bấm gợi ý</span>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="VD: Toán, HĐTNHN, HĐTN-HN, Vật lí..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-xs bg-white"
                  />
                  {/* Subject pills */}
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {['Toán', 'HĐTN-HN', 'Ngữ văn', 'Tiếng Anh', 'Tin học', 'Vật lí', 'Hóa học', 'Sinh học'].map(
                      (sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSubject(sub)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            subject.trim().toLowerCase() === sub.toLowerCase() ||
                            (sub === 'HĐTN-HN' && subject.toUpperCase() === 'HĐTNHN')
                              ? 'bg-indigo-100 text-indigo-800 font-bold border border-indigo-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {sub}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Grade multi-selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Khối lớp áp dụng:</label>
                    <span className="text-[10px] font-bold text-indigo-700">
                      {isAutoDetectGrades
                        ? 'Tự động đọc khối từ tài liệu'
                        : `Khối: ${selectedGrades.sort((a, b) => a - b).join(', ')}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {[10, 11, 12, 9, 8, 7, 6].map((g) => {
                      const isSelected = !isAutoDetectGrades && selectedGrades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleGrade(g)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          K{g}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setIsAutoDetectGrades(!isAutoDetectGrades)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ml-auto ${
                        isAutoDetectGrades
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Tự động nhận diện tất cả các khối có trong tài liệu"
                    >
                      Tất cả khối
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500">
                    Bấm chọn nhiều khối (ví dụ <b>K10, K12</b> hoặc <b>K10, K11, K12</b>) nếu tài liệu gộp chung.
                  </p>
                </div>
              </div>

              {/* Supported format badges & Paste shortcut */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-700 mr-1">Định dạng hỗ trợ:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                    <FileText className="w-3 h-3" /> Word (.docx)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    <FileSpreadsheet className="w-3 h-3" /> Excel (.xlsx, .xls)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold border border-rose-200">
                    <FileIcon className="w-3 h-3" /> PDF (.pdf)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                    <ImageIcon className="w-3 h-3" /> Ảnh (.jpg, .png)
                  </span>
                </div>

                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  <kbd className="px-1 py-0.5 bg-white border border-indigo-300 rounded text-[10px] font-mono shadow-2xs">
                    Ctrl + V
                  </kbd>{' '}
                  để dán ảnh
                </span>
              </div>

              {/* Paste Toast */}
              {pasteToast && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs">{pasteToast}</span>
                  </div>
                  <button onClick={() => setPasteToast(null)} className="text-emerald-700 hover:text-emerald-900 p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Strict Preservation Notice */}
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-xl text-amber-950 flex items-start gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">Bảo lưu nguyên vẹn tên bài dạy gốc:</span> Hệ thống cam kết giữ nguyên 100% tên bài học trong phân phối chương trình gốc của bạn (không thêm bớt từ ngữ, không tự ý gán hậu tố Tiết 1, Tiết 2).
                </div>
              </div>

              {/* Input mode switcher + Paste action */}
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
                    <span>Tải tệp Docx / Excel / PDF / Ảnh</span>
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

                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-xs transition cursor-pointer hover:scale-105 active:scale-95"
                  title="Dán ảnh chụp PPCT từ bộ nhớ tạm Clipboard (hoặc nhấn phím Ctrl + V)"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-amber-300" />
                  <span>Dán ảnh từ Clipboard (Ctrl + V)</span>
                </button>
              </div>

              {/* Mode 1: File upload & Paste dropzone */}
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
                        <FileText className="w-5 h-5 text-blue-600" />
                        <ClipboardPaste className="w-5 h-5 text-indigo-600" />
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        <ImageIcon className="w-5 h-5 text-purple-600" />
                      </div>
                      <span className="font-bold text-slate-800 text-sm text-center">
                        Chọn file Word (.docx), Excel, PDF hoặc <span className="text-indigo-600">bấm Ctrl + V</span> để dán ảnh
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1 text-center max-w-md">
                        Hệ thống tự động đọc bảng tiết bài dạy và phân loại theo môn & khối lớp
                      </span>
                      <input
                        type="file"
                        accept=".docx,.doc,.xlsx,.xls,.xlsm,.csv,.pdf,image/*,.txt,.md"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

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

                  {/* Selected / Pasted File Card */}
                  {selectedFile && (
                    <div className="flex items-center justify-between p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl shadow-2xs animate-in fade-in">
                      <div className="flex items-center gap-3">
                        {selectedFile.previewUrl ? (
                          <div className="relative group/thumb cursor-pointer" onClick={() => setIsImageModalOpen(true)}>
                            <img
                              src={selectedFile.previewUrl}
                              alt="PPCT Preview"
                              className="w-14 h-14 object-cover rounded-lg border-2 border-indigo-300 shadow-xs group-hover/thumb:opacity-90 transition"
                            />
                            <div className="absolute inset-0 bg-slate-900/30 rounded-lg flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition text-white">
                              <Maximize2 className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-white rounded-lg shadow-2xs">
                            {renderFileIcon(selectedFile.formatType)}
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
                            {selectedFile.formatType === 'word'
                              ? 'Tài liệu Microsoft Word'
                              : selectedFile.formatType === 'excel'
                              ? 'Bảng tính Excel'
                              : selectedFile.formatType === 'pdf'
                              ? 'Tài liệu PDF'
                              : selectedFile.formatType === 'image'
                              ? 'Ảnh chụp giáo án / PPCT'
                              : 'Tệp văn bản'}
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
                        title="Hủy chọn tệp này"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Copy-paste text */}
              {inputMode === 'text' && (
                <div className="space-y-1.5">
                  <label className="block font-semibold text-slate-700">
                    Dán nội dung phân phối chương trình:
                  </label>
                  <textarea
                    rows={7}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Ví dụ:
PHÂN PHỐI CHƯƠNG TRÌNH MÔN TOÁN 10
Tiết 1: Bài 1. Mệnh đề (Tiết 1) - Đại số
Tiết 2: Bài 1. Mệnh đề (Tiết 2)
...
PHÂN PHỐI CHƯƠNG TRÌNH MÔN TOÁN 12
Tiết 1: Bài 1. Tính đơn điệu của hàm số..."
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
            /* Section 3: Parsed Results Review */
            <div className="space-y-4">
              {/* Header Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-950">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">
                      Đã trích xuất thành công {parsedResult.entries.length} bài học!
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {groups.map((grp) => (
                        <span
                          key={`${grp.subject}__${grp.grade}`}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-2xs"
                        >
                          <BookOpen className="w-3 h-3 text-emerald-600" />
                          <span>
                            {grp.subject} - Khối {grp.grade}: <b>{grp.count} bài</b>
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setParsedResult(null)}
                  className="text-xs px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg hover:bg-emerald-100 font-semibold transition shadow-2xs cursor-pointer shrink-0"
                >
                  Trích xuất lại
                </button>
              </div>

              {/* Options to append or replace */}
              <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-semibold text-slate-700">Tùy chọn lưu:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="saveMode"
                    checked={saveMode === 'append'}
                    onChange={() => setSaveMode('append')}
                    className="text-indigo-600"
                  />
                  <span>Thêm vào danh sách hiện có</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="saveMode"
                    checked={saveMode === 'replace'}
                    onChange={() => setSaveMode('replace')}
                    className="text-indigo-600"
                  />
                  <span>
                    Thay thế PPCT của{' '}
                    <b>{groups.map((g) => `${g.subject} khối ${g.grade}`).join(', ')}</b>
                  </span>
                </label>
              </div>

              {/* Filter tabs if multiple groups */}
              {groups.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                      previewFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({parsedResult.entries.length})
                  </button>
                  {groups.map((grp) => {
                    const key = `${grp.subject}__${grp.grade}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPreviewFilter(key)}
                        className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                          previewFilter === key
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {grp.subject} Khối {grp.grade} ({grp.count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 w-14 text-center">Tiết</th>
                      <th className="p-2 w-28">Môn học</th>
                      <th className="p-2 w-16 text-center">Khối</th>
                      <th className="p-2">Tên đầu bài dạy</th>
                      <th className="p-2 w-24">Phân loại</th>
                      <th className="p-2 w-20">Học kỳ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedEntries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-center font-extrabold text-indigo-700">
                          {item.periodNumber}
                        </td>
                        <td className="p-2 font-semibold text-slate-800">
                          {item.subject || parsedResult.subject || subject}
                        </td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 bg-slate-100 font-semibold rounded text-slate-700">
                            Khối {item.grade || parsedResult.grade || 10}
                          </span>
                        </td>
                        <td className="p-2 font-medium text-slate-900">{item.lessonTitle}</td>
                        <td className="p-2 text-slate-500">{item.category || '-'}</td>
                        <td className="p-2 text-slate-500">{item.semester || parsedResult.semester}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl flex items-center gap-2 text-[11px] text-sky-900">
                <Database className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  Sau khi bấm lưu, danh mục bài dạy này sẽ được đồng bộ vĩnh viễn vào Cloud Firestore và bộ nhớ máy. Lần sau thầy/cô không cần tải lên lại!
                </span>
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
                  <span>Gemini đang đọc và trích xuất PPCT...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    Trích xuất PPCT{' '}
                    {subject} {isAutoDetectGrades ? '(Đa khối)' : selectedGrades.join(', ')}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmSave}
              className="inline-flex items-center gap-2 px-5 py-2 font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Lưu vào hệ thống & Cloud Firestore ({parsedResult.entries.length} bài)</span>
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
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
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
                alt="Phân phối chương trình đầy đủ"
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
