import React, { useState } from 'react';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  User as UserIcon,
  LogOut,
  LogIn,
  X,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { loginWithGoogle, logoutUser, CloudSyncState } from '../firebase';

interface CloudAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: CloudSyncState;
  onManualSync: () => Promise<void>;
  databaseId: string;
  isAdmin?: boolean;
}

export const CloudAccountModal: React.FC<CloudAccountModalProps> = ({
  isOpen,
  onClose,
  syncState,
  onManualSync,
  databaseId,
  isAdmin = false,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // Strict RBAC: Non-admin teachers cannot intervene or disconnect database
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-base">Quyền hạn bị giới hạn</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-4 text-xs text-slate-700">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Chỉ dành cho Quản trị viên</p>
                <p className="mt-1 leading-relaxed text-slate-700">
                  Tài khoản Giáo viên không có quyền can thiệp, cấu hình hoặc ngắt kết nối Cơ sở dữ liệu Cloud Firestore. Hệ thống đang tự động lưu trữ và đồng bộ hóa an toàn mọi dữ liệu báo giảng và thời khóa biểu của thầy/cô.
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs cursor-pointer"
              >
                Đã hiểu và Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setMsg(null);
    try {
      await loginWithGoogle();
      setMsg({ type: 'success', text: 'Đăng nhập Google thành công! Dữ liệu đã được liên kết.' });
    } catch (err: any) {
      console.error(err);
      setMsg({ type: 'error', text: 'Không thể đăng nhập Google: ' + (err.message || 'Hủy thao tác') });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setMsg({ type: 'success', text: 'Đã chuyển về phiên làm việc ẩn danh.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Lỗi đăng xuất: ' + err.message });
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setMsg(null);
    try {
      await onManualSync();
      setMsg({ type: 'success', text: 'Đã đồng bộ toàn bộ dữ liệu lên Cloud Firestore thành công!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Lỗi đồng bộ: ' + err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 to-sky-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
              <Cloud className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Lưu trữ Cloud Firestore</h3>
              <p className="text-xs text-sky-100">Bảo mật dữ liệu trên máy chủ Google Firebase</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          {msg && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2 font-medium ${
                msg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Sync Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Trạng thái đồng bộ:</span>
              <span className="font-bold flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {syncState.status === 'saving'
                  ? 'Đang lưu lên Firestore...'
                  : syncState.status === 'synced'
                  ? 'Đã đồng bộ đám mây'
                  : syncState.status === 'connecting'
                  ? 'Đang kết nối Firestore'
                  : 'Hoạt động cục bộ'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Đồng bộ lần cuối:</span>
              <span className="font-semibold text-slate-700">
                {syncState.lastSynced
                  ? new Date(syncState.lastSynced).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Vừa xong'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-indigo-500" />
                Cơ sở dữ liệu Firestore:
              </span>
              <span className="font-mono text-[10px] text-slate-600 truncate max-w-[180px]" title={databaseId}>
                {databaseId.slice(0, 20)}...
              </span>
            </div>
          </div>

          {/* User Account Info */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              {syncState.user?.photoURL ? (
                <img
                  src={syncState.user.photoURL}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <UserIcon className="w-5 h-5" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">
                  {syncState.user?.displayName || (syncState.isAnonymous ? 'Giáo viên (Phiên ẩn danh bảo mật)' : 'Tài khoản người dùng')}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {syncState.user?.email || `Mã định danh cá nhân: ${syncState.user?.uid.slice(0, 12)}...`}
                </p>
              </div>
            </div>

            {/* Actions for Auth */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {syncState.isAnonymous ? (
                <button
                  type="button"
                  disabled={isLoggingIn}
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition shadow-2xs cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isLoggingIn ? 'Đang xác thực Google...' : 'Đăng nhập Google để đồng bộ đa thiết bị'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất tài khoản Google</span>
                </button>
              )}
            </div>
          </div>

          {/* Privacy & Security note */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-indigo-900">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Bảo mật dữ liệu cá nhân</p>
              <p className="text-indigo-800/80 mt-0.5">
                Mỗi tài khoản giáo viên có một khoang lưu trữ riêng biệt trên Firestore được bảo vệ bằng Security Rules. Chỉ có chính thầy/cô mới có quyền xem và sửa sổ của mình.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
