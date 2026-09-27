import React, { useState, useEffect, useRef } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Cpu,
  Sparkles,
  HelpCircle,
  Zap,
  Check,
  ShieldCheck,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { safeFetchJson } from '../utils/apiUtils';

export interface GeminiModelInfo {
  id: string;
  name: string;
  badge?: string;
  isLatest?: boolean;
  description: string;
}

const DEFAULT_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Thế hệ 3.6 - Khuyên dùng',
    isLatest: false,
    description: 'Tốc độ cực nhanh, ổn định cao, nhận diện hoàn hảo ảnh chụp TKB và bảng PPCT.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'Mới nhất 3.8',
    isLatest: true,
    description: 'Thế hệ mô hình mới nhất của Google, hiệu năng xử lý văn bản xuất sắc.',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Thế hệ 3.7',
    isLatest: false,
    description: 'Mô hình thế hệ 3.7 kết hợp giữa tốc độ và tư duy xử lý logic.',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Thế hệ 3.5',
    isLatest: false,
    description: 'Mô hình thế hệ 3.5 tốc độ cao, khả năng trích xuất nhanh.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Suy luận sâu',
    isLatest: false,
    description: 'Mô hình suy luận nâng cao dành cho tài liệu dài hoặc bảng biểu phức tạp.',
  },
];

interface GeminiApiKeyManagerProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  hasServerKey?: boolean;
}

export const GeminiApiKeyManager: React.FC<GeminiApiKeyManagerProps> = ({
  apiKey,
  setApiKey,
  selectedModel = 'gemini-3.6-flash',
  setSelectedModel,
  hasServerKey = false,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    isUserKey?: boolean;
  } | null>(null);

  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsList, setModelsList] = useState<GeminiModelInfo[]>(DEFAULT_MODELS);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [searchModelQuery, setSearchModelQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync with localStorage on mount and across window updates
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('GEMINI_USER_API_KEY') || '';
      if (stored && stored !== apiKey) {
        setApiKey(stored);
      }
      const storedModel = localStorage.getItem('GEMINI_SELECTED_MODEL');
      if (storedModel && storedModel !== selectedModel) {
        setSelectedModel(storedModel);
      }
    };

    window.addEventListener('gemini-key-updated', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('gemini-key-updated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [apiKey, selectedModel, setApiKey, setSelectedModel]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  // Handle immediate change & auto-save to localStorage
  const handleInputChange = (val: string) => {
    setApiKey(val);
    setTestResult(null);

    const trimmed = val.trim();
    if (trimmed) {
      localStorage.setItem('GEMINI_USER_API_KEY', trimmed);
      window.dispatchEvent(new Event('gemini-key-updated'));
    } else {
      localStorage.removeItem('GEMINI_USER_API_KEY');
      window.dispatchEvent(new Event('gemini-key-updated'));
    }
  };

  // Manual save handler with visual feedback
  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('GEMINI_USER_API_KEY', trimmed);
      window.dispatchEvent(new Event('gemini-key-updated'));
      setSaveStatus('Đã lưu khóa API an toàn! Hệ thống sẽ luôn dùng khóa này.');
    } else {
      localStorage.removeItem('GEMINI_USER_API_KEY');
      window.dispatchEvent(new Event('gemini-key-updated'));
      setSaveStatus('Đã xóa khóa riêng, sử dụng khóa hệ thống.');
    }
    setTimeout(() => setSaveStatus(null), 3500);
  };

  // Clear key
  const handleClearKey = () => {
    setApiKey('');
    localStorage.removeItem('GEMINI_USER_API_KEY');
    window.dispatchEvent(new Event('gemini-key-updated'));
    setTestResult(null);
    setSaveStatus('Đã xóa khóa nạp vào.');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // Test API Key connection
  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);

    const keyToTest = apiKey.trim() || localStorage.getItem('GEMINI_USER_API_KEY')?.trim() || '';
    if (!keyToTest && !hasServerKey) {
      setIsTesting(false);
      setTestResult({
        success: false,
        message: 'Vui lòng nhập API Key để kiểm tra kết nối.',
      });
      return;
    }

    try {
      const res = await safeFetchJson<{
        success: boolean;
        message?: string;
        latencyMs?: number;
        isUserKey?: boolean;
        error?: string;
      }>('/api/test-gemini-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': keyToTest,
        },
        body: JSON.stringify({
          apiKey: keyToTest,
          model: selectedModel || 'gemini-3.6-flash',
        }),
      });

      if (!res.ok || !res.data?.success) {
        throw new Error(res.error || res.data?.error || 'Kiểm tra thất bại. Vui lòng kiểm tra lại mã API Key.');
      }

      const data = res.data;
      setTestResult({
        success: true,
        message: data.message || `Kết nối thành công với ${selectedModel}!`,
        latencyMs: data.latencyMs,
        isUserKey: data.isUserKey,
      });

      // Auto save on successful test if key provided
      if (keyToTest) {
        localStorage.setItem('GEMINI_USER_API_KEY', keyToTest);
        window.dispatchEvent(new Event('gemini-key-updated'));
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Lỗi kết nối tới máy chủ AI.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Load available models from Google API
  const handleLoadModels = async () => {
    setIsLoadingModels(true);
    const keyToUse = apiKey.trim() || localStorage.getItem('GEMINI_USER_API_KEY')?.trim() || '';
    try {
      const res = await safeFetchJson<{
        success: boolean;
        models?: GeminiModelInfo[];
      }>('/api/list-gemini-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': keyToUse,
        },
        body: JSON.stringify({
          apiKey: keyToUse,
        }),
      });

      const data = res.data;
      if (res.ok && data?.success && Array.isArray(data.models) && data.models.length > 0) {
        setModelsList(data.models);
        setIsModelDropdownOpen(true);
        setSaveStatus(`Đã tải thành công ${data.models.length} model từ Google API (bao gồm 3.6, 3.8, 3.7)!`);
      } else {
        setModelsList(DEFAULT_MODELS);
        setIsModelDropdownOpen(true);
      }
    } catch {
      setModelsList(DEFAULT_MODELS);
      setIsModelDropdownOpen(true);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('GEMINI_SELECTED_MODEL', modelId);
    setIsModelDropdownOpen(false);
    setSearchModelQuery('');
    setSaveStatus(`Đã chọn model: ${modelId}`);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const hasUserKey = Boolean(apiKey.trim());

  // Filter models by query
  const filteredModels = modelsList.filter((m) => {
    const q = searchModelQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      (m.badge && m.badge.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-2xs">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
          <Key className="w-4 h-4 text-indigo-600" />
          <span>API Key Gemini</span>
        </label>

        <div className="flex items-center gap-3">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Lấy khóa miễn phí tại Google AI Studio</span>
            <HelpCircle className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Input Field & Inline Toggle */}
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={
            hasServerKey
              ? 'Đã có API Key từ hệ thống (hoặc dán API key riêng của bạn AIzaSy...)'
              : 'Dán mã API Key Gemini của bạn tại đây (AIzaSy...)'
          }
          className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-xs bg-white shadow-2xs"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          title={showKey ? 'Ẩn khóa' : 'Hiện khóa'}
        >
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Prominent Active Key Notice: ALWAYS Prioritize User Key */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasUserKey ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 shadow-2xs animate-in fade-in">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Luôn sử dụng API Key bạn nạp vào:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded-md text-[11px] text-emerald-800 border border-emerald-200">
              {apiKey.trim().slice(0, 6)}...{apiKey.trim().slice(-4)}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/60 px-1.5 py-0.5 rounded">
              Ưu tiên số 1
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>
              Chưa nạp khóa riêng.{' '}
              {hasServerKey ? 'Hệ thống đang dùng khóa dự phòng.' : 'Vui lòng dán API Key để sử dụng AI.'}
            </span>
          </div>
        )}

        {hasUserKey && (
          <button
            type="button"
            onClick={handleClearKey}
            className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 font-semibold transition cursor-pointer px-2 py-1 rounded hover:bg-rose-50"
            title="Xóa khóa đã nạp và đặt lại"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa khóa nạp</span>
          </button>
        )}
      </div>

      {/* Action Buttons: Lưu Key, Test Key, Tải Models, Phím tắt Model */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Nút Lưu API Key */}
          <button
            type="button"
            onClick={handleSaveKey}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
            title="Lưu khóa API vào trình duyệt"
          >
            <Save className="w-3.5 h-3.5 text-indigo-600" />
            <span>Lưu API Key</span>
          </button>

          {/* Nút Test API Key */}
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestKey}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95 disabled:opacity-50"
            title="Gửi kiểm tra kết nối với Gemini API"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Đang kiểm tra...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Test API Key</span>
              </>
            )}
          </button>

          {/* Nút Tải & Chọn Model với Search Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              disabled={isLoadingModels}
              onClick={() => {
                if (!isModelDropdownOpen) {
                  handleLoadModels();
                } else {
                  setIsModelDropdownOpen(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs rounded-lg border border-sky-300 transition cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
              title="Tải toàn bộ danh sách model từ Google Gemini API"
            >
              {isLoadingModels ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
              ) : (
                <Cpu className="w-3.5 h-3.5 text-sky-600" />
              )}
              <span>Tải & Chọn Model</span>
              <span className="text-[10px] bg-sky-200/80 text-sky-900 px-1 rounded font-mono">
                {modelsList.length}
              </span>
            </button>

            {/* Model Dropdown Menu with Search */}
            {isModelDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 z-50 w-84 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-300 p-3 space-y-2.5 animate-in fade-in">
                {/* Dropdown Header */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-sky-600" />
                    <span className="font-bold text-xs text-slate-800">
                      Chọn mô hình Google Gemini AI
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModelDropdownOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Search Bar inside dropdown */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchModelQuery}
                    onChange={(e) => setSearchModelQuery(e.target.value)}
                    placeholder="Tìm kiếm model (ví dụ: 3.6, flash, pro...)"
                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  />
                  {searchModelQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchModelQuery('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Model Items List */}
                <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100/60">
                  {filteredModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectModel(m.id)}
                        className={`w-full text-left p-2 rounded-xl transition flex items-start justify-between cursor-pointer pt-2 ${
                          isSelected
                            ? 'bg-sky-50 border border-sky-300 text-sky-950 font-semibold'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{m.name}</span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              {m.id}
                            </span>
                            {m.badge && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  m.id.includes('3.6')
                                    ? 'bg-amber-100 text-amber-800'
                                    : m.isLatest
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : m.id.includes('2.5')
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {m.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {m.description}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Option to type and apply custom model if not found */}
                  {searchModelQuery.trim() &&
                    !filteredModels.some(
                      (m) => m.id.toLowerCase() === searchModelQuery.toLowerCase().trim()
                    ) && (
                      <button
                        type="button"
                        onClick={() => handleSelectModel(searchModelQuery.trim())}
                        className="w-full text-left p-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 transition flex items-center justify-between cursor-pointer mt-1"
                      >
                        <div>
                          <p className="text-xs font-bold text-amber-900">
                            Sử dụng mã model tùy chỉnh này:
                          </p>
                          <p className="font-mono text-xs text-amber-700 font-bold">
                            {searchModelQuery.trim()}
                          </p>
                        </div>
                        <Check className="w-4 h-4 text-amber-700 shrink-0" />
                      </button>
                    )}
                </div>

                {/* Dropdown Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Tổng số: {modelsList.length} models từ Google</span>
                  <button
                    type="button"
                    onClick={handleLoadModels}
                    className="text-sky-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Làm mới danh sách</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nhóm phím tắt chọn nhanh Model: 3.6 Flash (theo yêu cầu), 3.7 Flash, 3.8 Flash */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Nút Gemini 3.6 Flash */}
          <button
            type="button"
            onClick={() => handleSelectModel('gemini-3.6-flash')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
              selectedModel === 'gemini-3.6-flash'
                ? 'bg-amber-600 text-white shadow-xs border-amber-600'
                : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-300'
            }`}
            title="Mô hình thế hệ 3.6 cực nhanh và chuẩn xác, không bị nghẽn 503"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>Gemini 3.6 Flash</span>
          </button>

          {/* Nút Gemini 3.7 Flash */}
          <button
            type="button"
            onClick={() => handleSelectModel('gemini-3.7-flash')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
              selectedModel === 'gemini-3.7-flash'
                ? 'bg-emerald-600 text-white shadow-xs border-emerald-600'
                : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-300'
            }`}
            title="Mô hình thế hệ 3.7 cân bằng giữa tốc độ và tư duy logic"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
            <span>Gemini 3.7 Flash</span>
          </button>

          {/* Nút Gemini 3.8 Flash */}
          <button
            type="button"
            onClick={() => handleSelectModel('gemini-3.8-flash')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
              selectedModel === 'gemini-3.8-flash'
                ? 'bg-indigo-600 text-white shadow-xs border-indigo-600'
                : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-300'
            }`}
            title="Mô hình mới nhất 3.8"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            <span>Gemini 3.8 Flash</span>
          </button>
        </div>
      </div>

      {/* Save Notification Status */}
      {saveStatus && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Test Result Message & 503 Recovery Button */}
      {testResult && (
        <div
          className={`p-3 rounded-xl border flex flex-col gap-2 text-xs animate-in fade-in ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-bold">{testResult.message}</p>
              {testResult.success && (
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {testResult.isUserKey
                    ? `Hệ thống đã kích hoạt và luôn ưu tiên sử dụng khóa API nạp vào này với model ${selectedModel}.`
                    : `Model sẵn sàng: ${selectedModel}.`}
                </p>
              )}
            </div>
          </div>

          {/* Special 503 high demand auto-fix button */}
          {!testResult.success &&
            (testResult.message.includes('503') ||
              testResult.message.includes('high demand') ||
              testResult.message.includes('UNAVAILABLE') ||
              testResult.message.includes('overloaded')) && (
              <div className="mt-1 p-2.5 bg-white border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                <div className="text-[11px] text-rose-900">
                  <span className="font-bold text-rose-700">💡 Khắc phục tức thì:</span> Model{' '}
                  <b>{selectedModel}</b> đang quá tải trên máy chủ Google. Thầy/cô hãy đổi sang{' '}
                  <b>Gemini 3.6 Flash</b> hoặc <b>Gemini 3.7 Flash</b> (tốc độ cao, không bị lỗi 503).
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectModel('gemini-3.6-flash');
                      setTimeout(() => handleTestKey(), 300);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <span>Dùng 3.6 Flash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectModel('gemini-3.7-flash');
                      setTimeout(() => handleTestKey(), 300);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <span>Dùng 3.7 Flash</span>
                  </button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Helper Footer Information */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
        <span>Khóa API được lưu vĩnh viễn trên trình duyệt của bạn, tự động nạp mỗi khi mở ứng dụng.</span>
        <div className="flex items-center gap-2">
          {hasUserKey ? (
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Dùng API Key cá nhân</span>
            </span>
          ) : (
            hasServerKey && (
              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                Khóa dự phòng hệ thống
              </span>
            )
          )}
          <span className="text-indigo-800 font-mono text-[10px] bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
            Model: {selectedModel}
          </span>
        </div>
      </div>
    </div>
  );
};
