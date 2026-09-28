/**
 * Authentication and User Account Management Service
 * Multi-user isolation with Cloud Firestore persistence & local fallback
 */

import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { db, ensureFirebaseAuthReady, saveUserDataToFirestore } from '../firebase';
import { getEmptyStorageData } from './storageService';
import { UserAccount } from '../types';

const ACTIVE_USER_KEY = 'SO_BAO_GIANG_ACTIVE_USER';
const LOCAL_ACCOUNTS_KEY = 'SO_BAO_GIANG_LOCAL_ACCOUNTS';

// Default Admin credentials requested by user
export const DEFAULT_ADMIN_USERNAME = 'sanginnova';
export const DEFAULT_ADMIN_PASSWORD_PLAIN = 'Baotran2010';

/**
 * Hash password securely using standard Web Crypto SHA-256
 */
export async function hashPassword(plain: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder();
      const data = enc.encode('sobaogiang_teacher_salt_' + plain.trim());
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('crypto.subtle not available, fallback hashing:', err);
  }
  // Simple deterministic fallback if crypto.subtle not available
  let hash = 0;
  const str = 'fallback_salt_' + plain.trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fb_' + Math.abs(hash).toString(16);
}

/**
 * Normalize username: lowercase, trimmed, alphanumeric and underscores only
 */
export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Get locally stored accounts
 */
function getLocalAccounts(): Record<string, UserAccount> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save locally stored accounts
 */
function saveLocalAccounts(accounts: Record<string, UserAccount>): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save local accounts:', err);
  }
}

/**
 * Ensure default Administrator account exists
 */
export async function ensureAdminInitialized(): Promise<UserAccount> {
  const username = DEFAULT_ADMIN_USERNAME;
  const passHash = await hashPassword(DEFAULT_ADMIN_PASSWORD_PLAIN);

  const adminAccount: UserAccount = {
    id: username,
    username: username,
    passwordHash: passHash,
    teacherName: 'Thầy Sáng (Quản trị viên)',
    school: 'Trường Cao đẳng nghề 1-BQP',
    department: 'Tổ Toán - Tin',
    role: 'admin',
    createdAt: '2026-09-01T00:00:00.000Z',
    lastLoginAt: new Date().toISOString(),
    status: 'active',
  };

  // 1. Check local storage and migrate legacy school name if needed
  const localAccounts = getLocalAccounts();
  if (!localAccounts[username]) {
    localAccounts[username] = adminAccount;
    saveLocalAccounts(localAccounts);
  } else if (
    !localAccounts[username].school ||
    localAccounts[username].school === 'Quản trị hệ thống' ||
    localAccounts[username].school === 'Trường THPT'
  ) {
    localAccounts[username].school = 'Trường Cao đẳng nghề 1-BQP';
    saveLocalAccounts(localAccounts);
  }

  // 2. Check Firestore and sync
  try {
    await ensureFirebaseAuthReady();
    const docRef = doc(db, 'accounts', username);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, adminAccount);
    }
  } catch (err) {
    console.warn('Could not sync admin to Firestore:', err);
  }

  return localAccounts[username] || adminAccount;
}

/**
 * Get currently authenticated user from localStorage session
 */
export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.username || !parsed.teacherName) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save current active user session
 */
export function setCurrentUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  } catch (err) {
    console.error('Failed to set current user:', err);
  }
}

/**
 * Log out
 */
export function logoutCurrentUser(): void {
  localStorage.removeItem(ACTIVE_USER_KEY);
}

/**
 * Fetch an account by username (from Firestore first, then local cache)
 */
export async function getAccountByUsername(username: string): Promise<UserAccount | null> {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  // Try Firestore
  try {
    const docRef = doc(db, 'accounts', normalized);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const acc = snap.data() as UserAccount;
      // cache locally
      const local = getLocalAccounts();
      local[normalized] = acc;
      saveLocalAccounts(local);
      return acc;
    }
  } catch (err) {
    console.warn('Firestore fetch failed, checking local accounts:', err);
  }

  // Fallback to local accounts
  const local = getLocalAccounts();
  return local[normalized] || null;
}

/**
 * Log in with username & password
 */
export async function loginWithCredentials(
  rawUsername: string,
  plainPassword: string
): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const username = normalizeUsername(rawUsername);
  if (!username) {
    return { success: false, error: 'Vui lòng nhập tên đăng nhập hợp lệ.' };
  }
  if (!plainPassword) {
    return { success: false, error: 'Vui lòng nhập mật khẩu.' };
  }

  // Special check for Admin default account bootstrapping
  if (username === DEFAULT_ADMIN_USERNAME && plainPassword === DEFAULT_ADMIN_PASSWORD_PLAIN) {
    const admin = await ensureAdminInitialized();
    admin.lastLoginAt = new Date().toISOString();
    setCurrentUser(admin);
    return { success: true, user: admin };
  }

  const account = await getAccountByUsername(username);
  if (!account) {
    return {
      success: false,
      error: 'Tài khoản không tồn tại. Vui lòng kiểm tra lại tên đăng nhập hoặc nhấn "Tạo tài khoản mới".',
    };
  }

  if (account.status === 'locked') {
    return {
      success: false,
      error: 'Tài khoản này hiện đang bị tạm khóa. Vui lòng liên hệ Quản trị viên để được hỗ trợ mở khóa.',
    };
  }

  const inputHash = await hashPassword(plainPassword);
  // Match hashed password or legacy plain match if applicable
  const matches =
    account.passwordHash === inputHash ||
    account.passwordHash === plainPassword ||
    (account.username === DEFAULT_ADMIN_USERNAME && plainPassword === DEFAULT_ADMIN_PASSWORD_PLAIN);

  if (!matches) {
    return { success: false, error: 'Mật khẩu không chính xác. Vui lòng thử lại!' };
  }

  // Update last login
  account.lastLoginAt = new Date().toISOString();
  if (account.passwordHash === plainPassword) {
    account.passwordHash = inputHash; // upgrade to hash
  }

  try {
    await setDoc(doc(db, 'accounts', username), account, { merge: true });
  } catch {
    // Ignore Firestore write error
  }

  const local = getLocalAccounts();
  local[username] = account;
  saveLocalAccounts(local);

  setCurrentUser(account);
  return { success: true, user: account };
}

/**
 * Register a new teacher account
 */
export async function registerNewTeacher(params: {
  username: string;
  password: string;
  teacherName: string;
  school: string;
  department?: string;
}): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
  const username = normalizeUsername(params.username);
  if (!username || username.length < 3) {
    return {
      success: false,
      error: 'Tên đăng nhập phải có ít nhất 3 ký tự (chỉ dùng chữ thường không dấu và số, không khoảng trắng).',
    };
  }

  if (!params.password || params.password.length < 4) {
    return {
      success: false,
      error: 'Mật khẩu phải có độ dài từ 4 ký tự trở lên để đảm bảo an toàn.',
    };
  }

  if (!params.teacherName.trim()) {
    return {
      success: false,
      error: 'Vui lòng nhập họ và tên giáo viên.',
    };
  }

  // Check if account already exists
  const existing = await getAccountByUsername(username);
  if (existing) {
    return {
      success: false,
      error: `Tên đăng nhập "${username}" đã có người sử dụng. Vui lòng chọn tên đăng nhập khác!`,
    };
  }

  const passHash = await hashPassword(params.password);
  const now = new Date().toISOString();

  const newAccount: UserAccount = {
    id: username,
    username: username,
    passwordHash: passHash,
    teacherName: params.teacherName.trim(),
    school: params.school.trim() || 'Trường Cao đẳng nghề 1-BQP',
    department: params.department?.trim() || 'Tổ bộ môn',
    role: 'teacher',
    status: 'active',
    createdAt: now,
    lastLoginAt: now,
    stats: {
      timetableSlots: 0,
      curriculumLessons: 0,
      lessonLogsCount: 0,
    },
  };

  // 1. Save to local storage
  const local = getLocalAccounts();
  local[username] = newAccount;
  saveLocalAccounts(local);

  // 2. Save to Firestore and initialize cloud workspace
  try {
    await ensureFirebaseAuthReady();
    const docRef = doc(db, 'accounts', username);
    await setDoc(docRef, newAccount);

    // Initialize cloud state for this teacher
    const freshData = getEmptyStorageData(newAccount);
    await saveUserDataToFirestore(username, freshData);
  } catch (err: any) {
    console.warn('Could not save new account to Firestore:', err);
  }

  setCurrentUser(newAccount);
  return { success: true, user: newAccount };
}

/**
 * Get all registered accounts (For Admin management)
 */
export async function getAllAccounts(): Promise<UserAccount[]> {
  const accountsMap = new Map<string, UserAccount>();

  // 1. Load local accounts
  const local = getLocalAccounts();
  Object.values(local).forEach((acc) => accountsMap.set(acc.username, acc));

  // 2. Load Firestore accounts
  try {
    const snapshot = await getDocs(collection(db, 'accounts'));
    snapshot.forEach((d) => {
      const data = d.data() as UserAccount;
      if (data && data.username) {
        accountsMap.set(data.username, data);
      }
    });
  } catch (err) {
    console.warn('Could not fetch accounts from Firestore:', err);
  }

  // Ensure admin is included
  if (!accountsMap.has(DEFAULT_ADMIN_USERNAME)) {
    const admin = await ensureAdminInitialized();
    accountsMap.set(admin.username, admin);
  }

  // Update local cache
  const mergedObj: Record<string, UserAccount> = {};
  accountsMap.forEach((v, k) => {
    mergedObj[k] = v;
  });
  saveLocalAccounts(mergedObj);

  return Array.from(accountsMap.values()).sort((a, b) => {
    if (a.role === 'admin') return -1;
    if (b.role === 'admin') return 1;
    return a.username.localeCompare(b.username);
  });
}

/**
 * Admin action: Reset password for any account
 */
export async function resetAccountPassword(username: string, newPlainPass: string): Promise<void> {
  const normalized = normalizeUsername(username);
  const passHash = await hashPassword(newPlainPass);

  const local = getLocalAccounts();
  if (local[normalized]) {
    local[normalized].passwordHash = passHash;
    saveLocalAccounts(local);
  }

  try {
    const docRef = doc(db, 'accounts', normalized);
    await setDoc(docRef, { passwordHash: passHash }, { merge: true });
  } catch (err) {
    console.error('Failed to reset password in Firestore:', err);
    throw err;
  }
}

/**
 * Admin action: Delete an account and its cloud state
 */
export async function deleteAccount(username: string): Promise<void> {
  const normalized = normalizeUsername(username);
  if (normalized === DEFAULT_ADMIN_USERNAME) {
    throw new Error('Không thể xóa tài khoản Quản trị viên hệ thống.');
  }

  const local = getLocalAccounts();
  delete local[normalized];
  saveLocalAccounts(local);

  try {
    await deleteDoc(doc(db, 'accounts', normalized));
    await deleteDoc(doc(db, 'users', normalized, 'appState', 'current'));
  } catch (err) {
    console.error('Failed to delete account in Firestore:', err);
  }
}

/**
 * Update stats for account
 */
export async function updateAccountStats(
  username: string,
  stats: { timetableSlots: number; curriculumLessons: number; lessonLogsCount: number }
): Promise<void> {
  const normalized = normalizeUsername(username);
  if (!normalized) return;

  const local = getLocalAccounts();
  if (local[normalized]) {
    local[normalized].stats = stats;
    saveLocalAccounts(local);
  }

  try {
    const docRef = doc(db, 'accounts', normalized);
    await setDoc(docRef, { stats }, { merge: true });
  } catch {
    // ignore
  }
}
