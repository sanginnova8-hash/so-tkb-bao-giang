import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { StorageData } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom database ID if specified
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

export interface CloudSyncState {
  status: 'connecting' | 'synced' | 'saving' | 'offline' | 'error';
  lastSynced: string | null;
  user: User | null;
  isAnonymous: boolean;
  errorMessage?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate Connection to Firestore on boot as required by Firebase skill
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, retrying...');
      return false;
    }
    // Non-offline errors mean the server was reached successfully!
    return true;
  }
}

// Automatically test connection on boot
testConnection().catch(() => {});

/**
 * Resolves current user or null safely without calling unsupported anonymous auth.
 */
export async function ensureFirebaseAuthReady(): Promise<User | null> {
  return auth.currentUser || null;
}

/**
 * Initializes authentication listener for Google or custom accounts.
 */
export function initAuthListener(onUserChanged: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    onUserChanged(user);
  });
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Log out from Firebase Auth
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Loads user state from Firestore for a specific user ID or username.
 * Returns null if no document exists yet.
 */
export async function loadUserDataFromFirestore(userId: string): Promise<StorageData | null> {
  const safeUserId = (userId || '').trim();
  if (!safeUserId || safeUserId === 'undefined' || safeUserId === 'null') {
    return null;
  }

  const path = `users/${safeUserId}/appState/current`;
  try {
    const docRef = doc(db, 'users', safeUserId, 'appState', 'current');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        profile: data.profile,
        settings: data.settings,
        timetable: data.timetable || [],
        curriculum: data.curriculum || [],
        lessonLogs: data.lessonLogs || [],
        aliases: data.aliases || [],
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Saves entire user state to Cloud Firestore under /users/{userId}/appState/current
 */
export async function saveUserDataToFirestore(userId: string, data: StorageData): Promise<void> {
  const safeUserId = (userId || '').trim();
  if (!safeUserId || safeUserId === 'undefined' || safeUserId === 'null') {
    return;
  }

  const path = `users/${safeUserId}/appState/current`;
  try {
    const docRef = doc(db, 'users', safeUserId, 'appState', 'current');
    await setDoc(
      docRef,
      {
        profile: data.profile,
        settings: data.settings,
        timetable: data.timetable,
        curriculum: data.curriculum,
        lessonLogs: data.lessonLogs,
        aliases: data.aliases,
        lastUpdated: data.lastUpdated,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
