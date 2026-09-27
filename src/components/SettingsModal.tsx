import React from 'react';
import {
  Settings,
  User,
  School,
  Calendar,
  Save,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Key,
  KeyRound,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { AppSettings, TeacherProfile, UserAccount } from '../types';
import { GeminiApiKeyManager } from './GeminiApiKeyManager';
import { safeFetchJson } from '../utils/apiUtils';

interface SettingsModalProps {
  profile: TeacherProfile;
  setProfile: React.Dispatch<React.SetStateAction<TeacherProfile>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onResetAll: () => void;
  currentUser?: UserAccount | null;
  onOpenChangePasswordModal?: () => void;
  onOpenAdminModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  profile,
  setProfile,
  settings,
  setSettings,
  onResetAll,
  currentUser,
  onOpenChangePasswordModal,
  onOpenAdminModal,
}) => {
  const [savedNotice, setSavedNotice] = React.useState(false);

  const [geminiKey, setGeminiKey] = React.useState<string>(() => {
    return localStorage.getItem('GEMINI_USER_API_KEY') || '';
  });
  const [geminiModel, setGeminiModel] = React.useState<string>(() => {
    return localStorage.getItem('GEMINI_SELECTED_MODEL') || 'gemini-3.6-flash';
  });
  const [hasServerKey, setHasServerKey] = React.useState(false);

  React.useEffect(() => {
    safeFetchJson<{ hasServerApiKey: boolean }>('/api/gemini-status')
      .then((res) => {
        if (res.ok && res.data?.hasServerApiKey) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.username === 'sanginnova';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Account Info Card */}
      {currentUser && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-sky-900 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${isAdmin ? 'bg-amber-500 text-slate-950' : 'bg-white/20 text-white'}`}>
              {isAdmin ? '👑' : (currentUser?.teacherName || currentUser?.username || 'G').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">{currentUser?.teacherName || currentUser?.username || 'Giáo viên'}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isAdmin ? 'bg-amber-400 text-slate-950' : 'bg-white/20 text-white'}`}>
                  {isAdmin ? 'Quản trị viên (sanginnova)' : 'Giáo viên'}
                </span>
              </div>
              <p className="text-xs text-sky-200 mt-0.5">
                Tài khoản: <span className="font-mono font-semibold">@{currentUser?.username || 'user'}</span> • Dữ liệu được bảo vệ riêng biệt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenChangePasswordModal && (
              <button
                type="button"
                onClick={onOpenChangePasswordModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-white transition border border-white/20 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-sky-200" />
                <span>Đổi mật khẩu</span>
              </button>
            )}

            {isAdmin && onOpenAdminModal && (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 rounded-xl text-xs font-bold text-slate-950 transition shadow-xs cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-950" />
                <span>Quản trị tài khoản GV</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Cấu hình & Thông tin giáo viên</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Định dạng báo giảng
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thông tin này sẽ tự động xuất hiện trên tiêu đề báo giảng, bản in A4 và các file Excel xuất ra
          </p>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-semibold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Đã lưu thành công!</span>
          </div>
        )}
      </div>


      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Teacher Profile */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">Thông tin giáo viên & Trường</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Họ và tên giáo viên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.teacherName}
                onChange={(e) => setProfile({ ...profile, teacherName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tên trường / Cơ sở giáo dục <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.school}
                onChange={(e) => setProfile({ ...profile, school: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tổ chuyên môn / Khoa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.department}
                onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Năm học <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={profile.schoolYear}
                onChange={(e) => {
                  setProfile({ ...profile, schoolYear: e.target.value });
                  setSettings({ ...settings, schoolYear: e.target.value });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Học kỳ hiện tại</label>
              <select
                value={profile.semester}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    semester: e.target.value as 'Học kỳ I' | 'Học kỳ II',
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Học kỳ I">Học kỳ I</option>
                <option value="Học kỳ II">Học kỳ II</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Reviewer / Approver */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">Người ký duyệt báo giảng</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Họ và tên người duyệt
              </label>
              <input
                type="text"
                value={profile.reviewer}
                onChange={(e) => setProfile({ ...profile, reviewer: e.target.value })}
                placeholder="Ví dụ: Trần Thị Bích Thảo"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Chức vụ người duyệt (trên tiêu đề ký)
              </label>
              <input
                type="text"
                value={profile.reviewerTitle}
                onChange={(e) => setProfile({ ...profile, reviewerTitle: e.target.value })}
                placeholder="Tổ trưởng chuyên môn, Phó Hiệu trưởng..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Timetable & Calendar Settings */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">Cấu hình Thời khóa biểu & Tuần học</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ngày bắt đầu Thứ Hai của Tuần 1 (YYYY-MM-DD) <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={settings.startMondayDate}
                onChange={(e) => setSettings({ ...settings, startMondayDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Ngày thứ Hai khai giảng hoặc bắt đầu năm học để tính ngày các tuần tiếp theo.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.includeSaturday}
                  onChange={(e) => setSettings({ ...settings, includeSaturday: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Có dạy Thứ Bảy (hiển thị cột Thứ 7 trên TKB và Báo giảng)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.autoMatchPPCT}
                  onChange={(e) => setSettings({ ...settings, autoMatchPPCT: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Tự động khớp bài PPCT theo thứ tự tiết tăng dần theo từng lớp</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 4: Gemini AI Key & Models */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800">Cấu hình Trí tuệ nhân tạo Gemini AI</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Luôn ưu tiên khóa cá nhân
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Khóa API này được lưu vĩnh viễn trên trình duyệt của thầy/cô và dùng trực tiếp cho toàn bộ các tính năng AI:
            đọc ảnh chụp Thời khóa biểu, trích xuất bảng phân phối chương trình và tạo lịch báo giảng tự động.
          </p>

          <GeminiApiKeyManager
            apiKey={geminiKey}
            setApiKey={setGeminiKey}
            selectedModel={geminiModel}
            setSelectedModel={setGeminiModel}
            hasServerKey={hasServerKey}
          />
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-2">
          {isAdmin && onResetAll ? (
            <button
              type="button"
              onClick={onResetAll}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Khôi phục cài đặt gốc</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs sm:text-sm text-white rounded-xl shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Lưu tất cả thay đổi</span>
          </button>
        </div>
      </form>
    </div>
  );
};
