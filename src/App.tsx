/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  AppSettings,
  CurriculumEntry,
  LessonLogEntry,
  StorageData,
  SubjectAlias,
  TeacherProfile,
  TimetableSlot,
  UserAccount,
} from './types';
import {
  getInitialStorageData,
  getEmptyStorageData,
  loadAppState,
  saveAppState,
} from './services/storageService';
import {
  getCurrentUser,
  setCurrentUser,
  logoutCurrentUser,
  ensureAdminInitialized,
  updateAccountStats,
  DEFAULT_ADMIN_USERNAME,
} from './services/authService';
import { ActiveTab, Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { PublicLanding } from './components/PublicLanding';
import { TimetableManager } from './components/TimetableManager';
import { CurriculumManager } from './components/CurriculumManager';
import { LessonLogManager } from './components/LessonLogManager';
import { DataImportExport } from './components/DataImportExport';
import { SettingsModal } from './components/SettingsModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { CloudAccountModal } from './components/CloudAccountModal';
import { AuthModal } from './components/AuthModal';
import { AdminAccountsModal } from './components/AdminAccountsModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { generateWeeklyLessonLog } from './utils/lessonLogGenerator';
import {
  initAuthListener,
  loadUserDataFromFirestore,
  saveUserDataToFirestore,
  ensureFirebaseAuthReady,
  auth,
  CloudSyncState,
} from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { CheckCircle2, AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { User } from 'firebase/auth';

export default function App() {
  // 1. Current authenticated account
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(() => getCurrentUser());
  // If admin is viewing another teacher's schedule to inspect/assist
  const [viewingTeacher, setViewingTeacher] = useState<UserAccount | null>(null);

  // Active target username for data reads/writes
  const activeUsername = useMemo(() => {
    const candidate = viewingTeacher?.username || currentUser?.username;
    if (candidate && candidate !== 'undefined' && candidate !== 'null') {
      return candidate;
    }
    return '';
  }, [viewingTeacher, currentUser]);

  // Active account metadata
  const activeAccount = useMemo(() => {
    return viewingTeacher || currentUser;
  }, [viewingTeacher, currentUser]);

  // 2. Data state loaded for active user
  const [initialData] = useState<StorageData>(() => {
    const active = getCurrentUser();
    if (active?.username) {
      return loadAppState(active.username, active);
    }
    return getEmptyStorageData();
  });

  const [profile, setProfile] = useState<TeacherProfile>(initialData.profile);
  const [settings, setSettings] = useState<AppSettings>(initialData.settings);
  const [timetable, setTimetable] = useState<TimetableSlot[]>(initialData.timetable);
  const [curriculum, setCurriculum] = useState<CurriculumEntry[]>(initialData.curriculum);
  const [lessonLogs, setLessonLogs] = useState<LessonLogEntry[]>(initialData.lessonLogs);
  const [aliases, setAliases] = useState<SubjectAlias[]>(initialData.aliases);
  const [lastUpdated, setLastUpdated] = useState<string>(initialData.lastUpdated);

  // 3. Navigation & Modal states
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 4. Cloud Sync State
  const [syncState, setSyncState] = useState<CloudSyncState>({
    status: 'connecting',
    lastSynced: null,
    user: null,
    isAnonymous: true,
  });

  const currentUserRef = useRef<User | null>(null);
  const isFirstLoadDone = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 5. Initialize Admin account in database (does NOT auto-login as admin)
  useEffect(() => {
    ensureAdminInitialized().catch((err) => {
      console.warn('Admin account initialization notice:', err);
    });
  }, []);

  // 6. Function to load data when user or active view changes
  const loadUserData = useCallback(async (username: string, accountMeta: UserAccount | null) => {
    if (!username) return;
    const validUsername = username;

    // A. Load from local storage immediately for zero-delay UI render
    const localData = loadAppState(validUsername, accountMeta);
    setProfile(localData.profile);
    setSettings(localData.settings);
    setTimetable(localData.timetable);
    setCurriculum(localData.curriculum);
    setLessonLogs(localData.lessonLogs);
    setAliases(localData.aliases);
    setLastUpdated(localData.lastUpdated);

    // B. Fetch latest from Cloud Firestore
    try {
      await ensureFirebaseAuthReady();
      const cloudData = await loadUserDataFromFirestore(validUsername);
      if (cloudData) {
        setProfile(cloudData.profile);
        setSettings(cloudData.settings);
        setTimetable(cloudData.timetable);
        setCurriculum(cloudData.curriculum);
        setLessonLogs(cloudData.lessonLogs);
        setAliases(cloudData.aliases);
        setLastUpdated(cloudData.lastUpdated);
        saveAppState(cloudData, validUsername);
        setSyncState({
          status: 'synced',
          lastSynced: new Date().toISOString(),
          user: auth.currentUser,
          isAnonymous: !auth.currentUser,
        });
      } else {
        // Upload initial local data for this user to Firestore
        await saveUserDataToFirestore(validUsername, localData);
        setSyncState({
          status: 'synced',
          lastSynced: new Date().toISOString(),
          user: auth.currentUser,
          isAnonymous: !auth.currentUser,
        });
      }
    } catch (err: any) {
      console.warn(`Firestore sync for ${validUsername} error:`, err);
    }
  }, []);

  // 7. Initialize Firebase Auth listener and default Cloud Firestore connection
  useEffect(() => {
    const unsubscribe = initAuthListener((user) => {
      currentUserRef.current = user;
      setSyncState((prev) => ({
        ...prev,
        user,
        isAnonymous: !user,
      }));
    });

    const initCloudState = async () => {
      if (isFirstLoadDone.current) return;
      if (!activeUsername) {
        isFirstLoadDone.current = true;
        return;
      }
      try {
        const target = activeUsername;
        const cloudData = await loadUserDataFromFirestore(target);
        if (cloudData) {
          setProfile(cloudData.profile);
          setSettings(cloudData.settings);
          setTimetable(cloudData.timetable);
          setCurriculum(cloudData.curriculum);
          setLessonLogs(cloudData.lessonLogs);
          setAliases(cloudData.aliases);
          setLastUpdated(cloudData.lastUpdated);
          saveAppState(cloudData, target);
        } else {
          const currentData: StorageData = {
            profile,
            settings,
            timetable,
            curriculum,
            lessonLogs,
            aliases,
            lastUpdated: new Date().toISOString(),
          };
          await saveUserDataToFirestore(target, currentData);
        }
        setSyncState({
          status: 'synced',
          lastSynced: new Date().toISOString(),
          user: auth.currentUser,
          isAnonymous: !auth.currentUser,
        });
      } catch (err: any) {
        console.warn('Initial Firestore sync error, fallback to local:', err);
      } finally {
        isFirstLoadDone.current = true;
      }
    };

    initCloudState();

    return () => unsubscribe();
  }, [activeUsername]);

  // 8. Auto-save to LocalStorage + Always-on Debounced Save to Cloud Firestore
  useEffect(() => {
    const dataToSave: StorageData = {
      profile,
      settings,
      timetable,
      curriculum,
      lessonLogs,
      aliases,
      lastUpdated: new Date().toISOString(),
    };

    // Do not save when user is not logged in (guest browsing public landing page)
    if (!currentUser && !viewingTeacher) {
      return;
    }

    const targetUser = activeUsername;
    if (!targetUser || targetUser === 'undefined' || targetUser === 'null') return;

    // Save locally immediately for this specific user
    saveAppState(dataToSave, targetUser);
    setLastUpdated(dataToSave.lastUpdated);

    // Always save to Cloud Firestore so teachers never lose any data
    if (isFirstLoadDone.current) {
      setSyncState((prev) => ({ ...prev, status: 'saving' }));

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await ensureFirebaseAuthReady();
          await saveUserDataToFirestore(targetUser, dataToSave);
          // Update account statistics
          updateAccountStats(targetUser, {
            timetableSlots: dataToSave.timetable.length,
            curriculumLessons: dataToSave.curriculum.length,
            lessonLogsCount: dataToSave.lessonLogs.length,
          });
          setSyncState({
            status: 'synced',
            lastSynced: new Date().toISOString(),
            user: auth.currentUser,
            isAnonymous: auth.currentUser?.isAnonymous ?? true,
          });
        } catch (err: any) {
          console.error('Firestore save failed:', err);
          setSyncState((prev) => ({
            ...prev,
            status: 'offline',
            errorMessage: err.message,
          }));
        }
      }, 800);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [profile, settings, timetable, curriculum, lessonLogs, aliases, activeUsername]);

  // Manual Cloud Sync trigger
  const handleManualSync = async () => {
    if (!currentUserRef.current) {
      throw new Error('Chưa kết nối tài khoản Firebase');
    }
    const currentData: StorageData = {
      profile,
      settings,
      timetable,
      curriculum,
      lessonLogs,
      aliases,
      lastUpdated: new Date().toISOString(),
    };
    await saveUserDataToFirestore(activeUsername, currentData);
    setSyncState((prev) => ({
      ...prev,
      status: 'synced',
      lastSynced: new Date().toISOString(),
    }));
  };

  // Sample data detection
  const isSampleDataActive = useMemo(() => {
    return Boolean(
      currentUser &&
      profile.teacherName === 'Nguyễn Văn An' &&
      timetable.some((s) => s.id.startsWith('tkb-w1-'))
    );
  }, [currentUser, profile, timetable]);

  // Load sample data
  const handleLoadSampleData = () => {
    if (window.confirm('Nạp lại dữ liệu mẫu sẽ thay thế dữ liệu hiện tại bằng dữ liệu minh họa. Bạn có muốn tiếp tục?')) {
      const sample = getInitialStorageData(activeAccount);
      setProfile(sample.profile);
      setSettings(sample.settings);
      setTimetable(sample.timetable);
      setCurriculum(sample.curriculum);
      setLessonLogs(sample.lessonLogs);
      setAliases(sample.aliases);
      showToast('Đã nạp lại dữ liệu mẫu thành công!');
    }
  };

  // Clear sample data
  const handleClearSampleData = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa dữ liệu mẫu để nhập dữ liệu riêng của mình?')) {
      setTimetable([]);
      setCurriculum([]);
      setLessonLogs([]);
      showToast('Đã xóa dữ liệu mẫu. Sổ đã sẵn sàng để bạn nhập dữ liệu mới!');
    }
  };

  // Reset all
  const handleResetAll = () => {
    if (window.confirm('CẢNH BÁO: Thao tác này sẽ xóa toàn bộ thời khóa biểu, PPCT và báo giảng đã lập về trạng thái mặc định ban đầu. Bạn có chắc chắn không?')) {
      const sample = getInitialStorageData(activeAccount);
      setProfile(sample.profile);
      setSettings(sample.settings);
      setTimetable(sample.timetable);
      setCurriculum(sample.curriculum);
      setLessonLogs(sample.lessonLogs);
      setAliases(sample.aliases);
      showToast('Đã khôi phục cài đặt gốc thành công!');
    }
  };

  // Fast generate lesson log for current week
  const handleGenerateLog = useCallback(() => {
    const { newLogs, stats } = generateWeeklyLessonLog({
      weekNumber: settings.currentWeek,
      year: 2024,
      startMondayDate: settings.startMondayDate,
      timetable,
      curriculum,
      aliases,
      existingLogs: lessonLogs,
      keepManualEdits: true,
    });

    if (newLogs.length === 0) {
      alert(`Thời khóa biểu Tuần ${settings.currentWeek} chưa có tiết học nào. Vui lòng xếp TKB trước!`);
      setActiveTab('timetable');
      return;
    }

    setLessonLogs((prev) => {
      const otherWeeks = prev.filter((l) => l.weekNumber !== settings.currentWeek);
      return [...otherWeeks, ...newLogs];
    });

    showToast(`Đã sinh báo giảng Tuần ${settings.currentWeek}: ${stats.total} tiết (${stats.matched} khớp PPCT)!`);
    setActiveTab('lessonLog');
  }, [settings.currentWeek, settings.startMondayDate, timetable, curriculum, aliases, lessonLogs]);

  // Update status from dashboard or lesson log
  const handleUpdateLogStatus = (id: string, status: 'pending' | 'taught') => {
    setLessonLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status, isManuallyEdited: true } : l))
    );
    showToast(status === 'taught' ? 'Đã đánh dấu tiết đã dạy' : 'Đã chuyển về chưa dạy');
  };

  // Auth Handlers
  const handleTabChange = (tab: ActiveTab) => {
    if (!currentUser && tab !== 'dashboard') {
      setAuthModalTab('login');
      setIsAuthModalOpen(true);
      showToast('Chức năng này yêu cầu đăng nhập. Thầy/cô vui lòng đăng nhập hoặc tạo tài khoản mới.');
      return;
    }
    setActiveTab(tab);
  };

  const handleLoginSuccess = async (user: UserAccount) => {
    setCurrentUserState(user);
    setViewingTeacher(null);
    setIsAuthModalOpen(false);
    await loadUserData(user.username, user);
    showToast(`Chào mừng ${user.teacherName}! Chúc thầy/cô một tuần dạy tốt.`);
  };

  const handleLogout = () => {
    logoutCurrentUser();
    setCurrentUserState(null);
    setViewingTeacher(null);
    setActiveTab('dashboard');
    const empty = getEmptyStorageData();
    setProfile(empty.profile);
    setSettings(empty.settings);
    setTimetable(empty.timetable);
    setCurriculum(empty.curriculum);
    setLessonLogs(empty.lessonLogs);
    setAliases(empty.aliases);
    showToast('Đã đăng xuất an toàn. Bạn đang ở trang chủ giới thiệu.');
  };

  const handleSwitchToTeacher = async (targetAccount: UserAccount) => {
    setViewingTeacher(targetAccount);
    await loadUserData(targetAccount.username, targetAccount);
    showToast(`Quản trị viên đang xem sổ của giáo viên: ${targetAccount.teacherName}`);
  };

  const handleReturnToAdmin = async () => {
    setViewingTeacher(null);
    const adminUser = currentUser || (await ensureAdminInitialized());
    if (adminUser) {
      await loadUserData(adminUser.username || DEFAULT_ADMIN_USERNAME, adminUser);
      showToast(`Đã quay lại sổ của Quản trị viên: ${adminUser.teacherName || 'Admin'}`);
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.username === DEFAULT_ADMIN_USERNAME;

  const handleOpenCloudModal = () => {
    if (!isAdmin) {
      showToast('Chỉ Quản trị viên mới có quyền cấu hình hoặc can thiệp CSDL.');
      return;
    }
    setIsCloudModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Inspector Banner when viewing another teacher */}
      {viewingTeacher && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-950 shrink-0" />
            <span>
              Quản trị viên đang xem sổ của giáo viên:{' '}
              <strong className="underline">{viewingTeacher.teacherName}</strong> (@{viewingTeacher.username}) - {viewingTeacher.school}
            </span>
          </div>
          <button
            type="button"
            onClick={handleReturnToAdmin}
            className="flex items-center gap-1 px-3 py-1 bg-slate-950 text-white rounded-lg hover:bg-slate-800 transition cursor-pointer font-bold text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại sổ Quản trị viên</span>
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        settings={settings}
        setSettings={setSettings}
        profile={profile}
        lastUpdated={lastUpdated}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        isSampleDataActive={isSampleDataActive}
        syncState={syncState}
        onOpenCloudModal={handleOpenCloudModal}
        currentUser={currentUser}
        onOpenAuthModal={(tab = 'login') => {
          setAuthModalTab(tab);
          setIsAuthModalOpen(true);
        }}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenChangePasswordModal={() => setIsChangePasswordModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!currentUser ? (
          <PublicLanding
            onOpenAuthModal={(tab = 'login') => {
              setAuthModalTab(tab);
              setIsAuthModalOpen(true);
            }}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                settings={settings}
                profile={profile}
                timetable={timetable}
                curriculum={curriculum}
                lessonLogs={lessonLogs}
                setActiveTab={handleTabChange}
                onOpenPrintModal={() => setIsPrintModalOpen(true)}
                onGenerateLog={handleGenerateLog}
                onUpdateLogStatus={handleUpdateLogStatus}
                isSampleDataActive={isSampleDataActive}
                onClearSampleData={handleClearSampleData}
              />
            )}

            {activeTab === 'timetable' && (
              <TimetableManager
                settings={settings}
                setSettings={setSettings}
                timetable={timetable}
                setTimetable={setTimetable}
                curriculum={curriculum}
                aliases={aliases}
                lessonLogs={lessonLogs}
                setLessonLogs={setLessonLogs}
                setProfile={setProfile}
              />
            )}

            {activeTab === 'curriculum' && (
              <CurriculumManager
                curriculum={curriculum}
                setCurriculum={setCurriculum}
                aliases={aliases}
                setAliases={setAliases}
              />
            )}

            {activeTab === 'lessonLog' && (
              <LessonLogManager
                settings={settings}
                setSettings={setSettings}
                profile={profile}
                setProfile={setProfile}
                timetable={timetable}
                setTimetable={setTimetable}
                curriculum={curriculum}
                aliases={aliases}
                lessonLogs={lessonLogs}
                setLessonLogs={setLessonLogs}
                onOpenPrintModal={() => setIsPrintModalOpen(true)}
              />
            )}

            {activeTab === 'data' && (
              <DataImportExport
                storageData={{
                  profile,
                  settings,
                  timetable,
                  curriculum,
                  lessonLogs,
                  aliases,
                  lastUpdated,
                }}
                setProfile={setProfile}
                setSettings={setSettings}
                setTimetable={setTimetable}
                setCurriculum={setCurriculum}
                setLessonLogs={setLessonLogs}
                setAliases={setAliases}
                onLoadSampleData={handleLoadSampleData}
                onClearSampleData={handleClearSampleData}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsModal
                profile={profile}
                setProfile={setProfile}
                settings={settings}
                setSettings={setSettings}
                onResetAll={handleResetAll}
                currentUser={currentUser}
                onOpenChangePasswordModal={() => setIsChangePasswordModalOpen(true)}
                onOpenAdminModal={() => setIsAdminModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        profile={profile}
        settings={settings}
        lessonLogs={lessonLogs}
      />

      {/* Cloud Account & Firestore Sync Modal - ONLY FOR ADMIN */}
      {isAdmin && (
        <CloudAccountModal
          isOpen={isCloudModalOpen}
          onClose={() => setIsCloudModalOpen(false)}
          syncState={syncState}
          onManualSync={handleManualSync}
          databaseId={firebaseConfig.firestoreDatabaseId}
          isAdmin={isAdmin}
        />
      )}

      {/* Auth Modal (Login / Register Teacher) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        isMandatory={!currentUser}
        defaultTab={authModalTab}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Admin Accounts Management Modal */}
      {currentUser && (
        <AdminAccountsModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          currentUser={currentUser}
          onSwitchToTeacher={handleSwitchToTeacher}
        />
      )}

      {/* Change Password Modal */}
      {currentUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordModalOpen}
          onClose={() => setIsChangePasswordModalOpen(false)}
          currentUser={currentUser}
          onPasswordChanged={() => showToast('Mật khẩu tài khoản đã được cập nhật thành công!')}
        />
      )}
    </div>
  );
}
