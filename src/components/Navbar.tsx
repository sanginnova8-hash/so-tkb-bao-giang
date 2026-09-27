import React, { useState } from 'react';
import {
  CalendarDays,
  FileSpreadsheet,
  BookOpen,
  LayoutDashboard,
  Printer,
  Settings,
  Database,
  CheckCircle2,
  Clock,
  Sparkles,
  Cloud,
  CloudCheck,
  User as UserIcon,
  ShieldAlert,
  LogOut,
  KeyRound,
  ChevronDown,
  UserPlus,
} from 'lucide-react';
import { AppSettings, TeacherProfile, UserAccount } from '../types';
import { CloudSyncState } from '../firebase';

export type ActiveTab = 'dashboard' | 'timetable' | 'curriculum' | 'lessonLog' | 'data' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  profile: TeacherProfile;
  lastUpdated: string;
  onOpenPrintModal: () => void;
  isSampleDataActive: boolean;
  syncState: CloudSyncState;
  onOpenCloudModal: () => void;
  currentUser: UserAccount | null;
  onOpenAuthModal: (tab?: 'login' | 'register') => void;
  onOpenAdminModal: () => void;
  onOpenChangePasswordModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  settings,
  setSettings,
  profile,
  lastUpdated,
  onOpenPrintModal,
  isSampleDataActive,
  syncState,
  onOpenCloudModal,
  currentUser,
  onOpenAuthModal,
  onOpenAdminModal,
  onOpenChangePasswordModal,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username === 'sanginnova';

  const formatTimeAgo = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'timetable', label: 'Thời khóa biểu', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'curriculum', label: 'PPCT', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'lessonLog', label: 'Báo giảng', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'data', label: 'Dữ liệu', icon: <Database className="w-4 h-4" /> },
    { id: 'settings', label: 'Cài đặt', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs print:hidden">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-base sm:text-lg tracking-tight">
                  SỔ BÁO GIẢNG TỰ ĐỘNG
                </span>
                {isSampleDataActive && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Dữ liệu mẫu
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {profile.school || 'Trường Cao đẳng nghề 1-BQP'} • {currentUser?.teacherName || profile.teacherName} ({profile.schoolYear})
              </p>
            </div>
          </div>

          {/* Quick Controls: Admin, Cloud Sync, Week, User */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Admin Badge button (For Admin 'sanginnova') */}
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition shadow-2xs cursor-pointer border border-amber-600/30"
                title="Bảng điều hành quản trị viên hệ thống"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-950" />
                <span className="hidden sm:inline">Quản trị viên</span>
              </button>
            )}

            {/* Cloud Firestore Status Button - Only interactive for Admin, Read-only badge for Teachers */}
            {isAdmin ? (
              <button
                type="button"
                onClick={onOpenCloudModal}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                  syncState.status === 'saving'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : syncState.status === 'synced'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                }`}
                title="Quản trị kết nối Cloud Firestore (Dành cho Quản trị viên)"
              >
                <Cloud className={`w-3.5 h-3.5 ${syncState.status === 'saving' ? 'animate-bounce text-amber-600' : 'text-emerald-600'}`} />
                <span className="hidden lg:inline font-semibold">
                  {syncState.status === 'saving'
                    ? 'Đang lưu Cloud...'
                    : syncState.status === 'synced'
                    ? 'CSDL: Đã kết nối'
                    : 'CSDL Firestore'}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            ) : (
              <div
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-emerald-50/80 text-emerald-800 border-emerald-200 select-none cursor-default"
                title="CSDL Cloud Firestore luôn tự động bảo vệ dữ liệu. Giáo viên không được can thiệp hoặc ngắt kết nối CSDL."
              >
                <Cloud className={`w-3.5 h-3.5 ${syncState.status === 'saving' ? 'animate-bounce text-amber-600' : 'text-emerald-600'}`} />
                <span className="hidden lg:inline font-medium text-[11px]">
                  {syncState.status === 'saving' ? 'Đang lưu...' : 'CSDL an toàn'}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}

            {/* Week selector */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
              <span className="text-slate-500 px-2 font-medium hidden md:inline">Tuần:</span>
              <select
                value={settings.currentWeek}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    currentWeek: Number(e.target.value),
                  }))
                }
                className="bg-white text-slate-800 font-semibold px-2 py-1 rounded shadow-xs border-0 outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer text-xs"
              >
                {Array.from({ length: 37 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Tuần {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Print button */}
            <button
              onClick={onOpenPrintModal}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs cursor-pointer"
              title="Xem trước & In Lịch Báo Giảng"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">In sổ</span>
            </button>

            {/* User Account Button & Dropdown */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 border border-slate-200 transition cursor-pointer"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${isAdmin ? 'bg-amber-500' : 'bg-indigo-600'}`}>
                    {isAdmin ? '👑' : (currentUser?.teacherName || currentUser?.username || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <p className="font-bold text-slate-800 max-w-[110px] truncate text-xs">
                      {currentUser?.teacherName || currentUser?.username || 'Giáo viên'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-normal">
                      @{currentUser?.username || 'user'}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-3.5 py-2.5 border-b border-slate-100">
                      <p className="font-bold text-slate-900 truncate">
                        {currentUser?.teacherName || currentUser?.username || 'Giáo viên'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Tài khoản: @{currentUser?.username || 'user'}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-indigo-50 text-indigo-700'}`}>
                        {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
                      </span>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenAdminModal();
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-900 text-left font-medium transition"
                      >
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>Quản lý tài khoản giáo viên</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenChangePasswordModal();
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 text-left font-medium transition"
                    >
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      <span>Đổi mật khẩu tài khoản</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenAuthModal('register');
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 text-left font-medium transition"
                    >
                      <UserPlus className="w-4 h-4 text-slate-500" />
                      <span>Tạo thêm tài khoản mới</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2 text-rose-600 hover:bg-rose-50 text-left font-semibold transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất (Bảo vệ dữ liệu)</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('login')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 sm:space-x-2 border-t border-slate-100 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold border-b-2 border-indigo-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

