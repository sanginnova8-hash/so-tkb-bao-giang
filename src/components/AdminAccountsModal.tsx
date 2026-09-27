import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  KeyRound,
  Trash2,
  RefreshCw,
  Search,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Database,
  Building,
  GraduationCap,
} from 'lucide-react';
import {
  getAllAccounts,
  resetAccountPassword,
  deleteAccount,
  registerNewTeacher,
  DEFAULT_ADMIN_USERNAME,
} from '../services/authService';
import { UserAccount } from '../types';

interface AdminAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onSwitchToTeacher: (targetAccount: UserAccount) => void;
  onRefreshData?: () => void;
}

export const AdminAccountsModal: React.FC<AdminAccountsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSwitchToTeacher,
  onRefreshData,
}) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reset password state
  const [resetModalAccount, setResetModalAccount] = useState<UserAccount | null>(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Create new account from Admin state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newSchool, setNewSchool] = useState('Trường Cao đẳng nghề 1-BQP');
  const [newDepartment, setNewDepartment] = useState('Tổ Toán - Tin');

  // Admin change own password
  const [isAdminPassModalOpen, setIsAdminPassModalOpen] = useState(false);
  const [adminNewPass, setAdminNewPass] = useState('');
  const [adminConfirmPass, setAdminConfirmPass] = useState('');

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const list = await getAllAccounts();
      setAccounts(list);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Không thể tải danh sách tài khoản: ' + err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalAccount) return;
    if (newPasswordForUser.length < 4) {
      setFeedback({ type: 'error', message: 'Mật khẩu mới phải có tối thiểu 4 ký tự.' });
      return;
    }

    try {
      await resetAccountPassword(resetModalAccount.username, newPasswordForUser);
      setFeedback({
        type: 'success',
        message: `Đã cấp lại mật khẩu mới cho tài khoản "${resetModalAccount.username}" thành công!`,
      });
      setResetModalAccount(null);
      setNewPasswordForUser('');
      await loadAccounts();
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Lỗi đặt lại mật khẩu: ' + err.message });
    }
  };

  const handleDelete = async (account: UserAccount) => {
    if (account.username === DEFAULT_ADMIN_USERNAME) {
      alert('Không thể xóa tài khoản Quản trị viên hệ thống!');
      return;
    }

    if (
      window.confirm(
        `XÁC NHẬN: Bạn có chắc chắn muốn xóa tài khoản giáo viên "${account.teacherName}" (${account.username}) không? Toàn bộ dữ liệu của tài khoản này sẽ bị xóa khỏi hệ thống.`
      )
    ) {
      try {
        await deleteAccount(account.username);
        setFeedback({
          type: 'success',
          message: `Đã xóa tài khoản "${account.username}" khỏi hệ thống.`,
        });
        await loadAccounts();
      } catch (err: any) {
        setFeedback({ type: 'error', message: 'Lỗi khi xóa tài khoản: ' + err.message });
      }
    }
  };

  const handleCreateByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await registerNewTeacher({
        username: newUsername,
        password: newPassword,
        teacherName: newTeacherName,
        school: newSchool || 'Trường THPT',
        department: newDepartment,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Đã tạo thành công tài khoản giáo viên cho "${newTeacherName}"!`,
        });
        setIsCreatingNew(false);
        setNewUsername('');
        setNewPassword('');
        setNewTeacherName('');
        setNewSchool('');
        await loadAccounts();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Lỗi khi tạo tài khoản.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Lỗi khi tạo tài khoản: ' + err.message });
    }
  };

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminNewPass !== adminConfirmPass) {
      setFeedback({ type: 'error', message: 'Mật khẩu xác nhận không khớp!' });
      return;
    }
    if (adminNewPass.length < 4) {
      setFeedback({ type: 'error', message: 'Mật khẩu phải có ít nhất 4 ký tự.' });
      return;
    }

    try {
      await resetAccountPassword(DEFAULT_ADMIN_USERNAME, adminNewPass);
      setFeedback({
        type: 'success',
        message: 'Đã đổi mật khẩu Quản trị viên (sanginnova) thành công!',
      });
      setIsAdminPassModalOpen(false);
      setAdminNewPass('');
      setAdminConfirmPass('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Lỗi khi đổi mật khẩu Admin: ' + err.message });
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      acc.username.toLowerCase().includes(q) ||
      acc.teacherName.toLowerCase().includes(q) ||
      (acc.school && acc.school.toLowerCase().includes(q)) ||
      (acc.department && acc.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Bảng Quản Trị Hệ Thống Giáo Viên</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                  ADMIN: {DEFAULT_ADMIN_USERNAME}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Quản lý tài khoản giáo viên, cấp lại mật khẩu và bảo vệ an toàn dữ liệu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-3 text-xs font-semibold flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
              ✕
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Quick stats and top controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Tổng số tài khoản</p>
                <p className="text-xl font-bold text-slate-900">{accounts.length} Giáo viên</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Quyền hạn</p>
                <p className="text-sm font-bold text-slate-900">Toàn quyền Quản trị viên</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Mật khẩu Admin</p>
                  <p className="text-xs font-semibold text-slate-700">sanginnova</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminPassModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
              >
                Đổi mật khẩu
              </button>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên đăng nhập, họ tên giáo viên, trường..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAccounts}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreatingNew(!isCreatingNew)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isCreatingNew ? 'Đóng tạo mới' : 'Cấp tài khoản GV mới'}</span>
              </button>
            </div>
          </div>

          {/* Inline Create Account by Admin Form */}
          {isCreatingNew && (
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                  Cấp tài khoản giáo viên mới trực tiếp
                </h3>
              </div>
              <form onSubmit={handleCreateByAdmin} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tên đăng nhập (username) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="ví dụ: thayminh"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Mật khẩu cấp ban đầu *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mật khẩu cho GV"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Họ tên giáo viên *
                    </label>
                    <input
                      type="text"
                      required
                      value={newTeacherName}
                      onChange={(e) => setNewTeacherName(e.target.value)}
                      placeholder="ví dụ: Thầy Lê Văn Minh"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Trường học
                    </label>
                    <input
                      type="text"
                      value={newSchool}
                      onChange={(e) => setNewSchool(e.target.value)}
                      placeholder="Trường Cao đẳng nghề 1-BQP"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tổ / Bộ môn
                    </label>
                    <input
                      type="text"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      placeholder="Tổ Toán..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
                  >
                    Tạo tài khoản giáo viên
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Accounts List Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tài khoản & Họ tên</th>
                    <th className="py-3 px-4">Đơn vị & Tổ</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Ngày tạo / Đăng nhập</th>
                    <th className="py-3 px-4 text-center">Thao tác Quản trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAccounts.map((account) => {
                    const isAdmin = account.role === 'admin' || account.username === DEFAULT_ADMIN_USERNAME;
                    return (
                      <tr
                        key={account.username}
                        className={`hover:bg-slate-50 transition ${
                          isAdmin ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isAdmin
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {isAdmin ? '👑' : (account?.teacherName || account?.username || 'G').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                {account?.teacherName || account?.username || 'Giáo viên'}
                                {isAdmin && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 font-semibold border border-amber-300">
                                    Quản trị viên
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] font-mono text-slate-500">
                                @{account?.username || 'user'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <p className="font-medium text-slate-800">{account.school || 'Chưa cập nhật'}</p>
                          <p className="text-[11px] text-slate-500">{account.department || 'Tổ bộ môn'}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              isAdmin
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          <p>Tạo: {new Date(account.createdAt || Date.now()).toLocaleDateString('vi-VN')}</p>
                          <p className="text-slate-400">
                            Đăng nhập: {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa có'}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Switch to this teacher's workspace */}
                            <button
                              type="button"
                              onClick={() => {
                                onSwitchToTeacher(account);
                                onClose();
                              }}
                              className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                              title="Chuyển sang xem và thao tác sổ của giáo viên này"
                            >
                              Xem sổ GV
                            </button>

                            {/* Reset password */}
                            <button
                              type="button"
                              onClick={() => {
                                setResetModalAccount(account);
                                setNewPasswordForUser('');
                              }}
                              className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                              title="Đặt lại mật khẩu cho tài khoản này"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* Delete account */}
                            {!isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(account)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Xóa tài khoản này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        Không tìm thấy tài khoản nào khớp với từ khóa "{searchTerm}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">
            Dữ liệu mỗi giáo viên hoàn toàn độc lập, lưu trên Cloud Firestore và máy tính.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl shadow-2xs transition"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Sub-modal: Reset password for specific account */}
      {resetModalAccount && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-sm text-slate-900">Đặt lại mật khẩu</h4>
              </div>
              <button onClick={() => setResetModalAccount(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Cấp mật khẩu mới cho tài khoản:{' '}
              <strong className="text-slate-900 font-bold">{resetModalAccount.teacherName}</strong> (
              <span className="font-mono">@{resetModalAccount.username}</span>)
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPasswordForUser}
                    onChange={(e) => setNewPasswordForUser(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalAccount(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  Lưu mật khẩu mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-modal: Admin change own password */}
      {isAdminPassModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-sm text-slate-900">Đổi mật khẩu Quản trị viên</h4>
              </div>
              <button onClick={() => setIsAdminPassModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Tài khoản Quản trị viên: <strong className="text-slate-900 font-bold">sanginnova</strong>
              <br />
              <span className="text-[11px] text-slate-500">Mật khẩu mặc định hiện tại: Baotran2010</span>
            </p>

            <form onSubmit={handleAdminChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu Admin mới:
                </label>
                <input
                  type="password"
                  required
                  value={adminNewPass}
                  onChange={(e) => setAdminNewPass(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Xác nhận lại mật khẩu mới:
                </label>
                <input
                  type="password"
                  required
                  value={adminConfirmPass}
                  onChange={(e) => setAdminConfirmPass(e.target.value)}
                  placeholder="Nhập lại mật khẩu..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminPassModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Cập nhật mật khẩu Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
