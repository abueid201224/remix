import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocFromServer,
  type Unsubscribe 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ReturnReport, AuditDiscrepancy, AppSettings } from '../types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore & Auth
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection to Firestore (Non-intrusive, offline-aware)
export async function testFirestoreConnection(timeoutMs = 2500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const testPromise = getDocFromServer(doc(db, 'test', 'connection'));
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('offline')), timeoutMs)
    );
    await Promise.race([testPromise, timeoutPromise]);
    return true;
  } catch (_error: unknown) {
    // In offline-first systems, failing to reach the cloud server is expected when offline or restricted
    return false;
  }
}

// Auth Helpers
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await fbSignOut(auth);
}

// Cloud Persistence Helpers for Return Reports
export async function syncReturnReportToCloud(report: ReturnReport): Promise<void> {
  const user = auth.currentUser;
  const path = `returns/${report.id}`;
  try {
    const payload = {
      ...report,
      userId: user ? user.uid : 'anonymous',
      userEmail: user?.email || null,
      syncedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'returns', report.id), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchReturnReportsFromCloud(): Promise<ReturnReport[]> {
  const path = 'returns';
  try {
    const q = collection(db, path);
    const snap = await getDocs(q);
    const results: ReturnReport[] = [];
    snap.forEach(d => {
      results.push(d.data() as ReturnReport);
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeToReturnReports(onData: (reports: ReturnReport[]) => void): Unsubscribe {
  const path = 'returns';
  return onSnapshot(collection(db, path), (snap) => {
    const reports: ReturnReport[] = [];
    snap.forEach(docSnap => {
      reports.push(docSnap.data() as ReturnReport);
    });
    onData(reports);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

// Cloud Persistence for Discrepancies
export async function syncDiscrepancyToCloud(disc: AuditDiscrepancy): Promise<void> {
  const user = auth.currentUser;
  const docId = `disc-${disc.invoiceNo}-${disc.itemCode}-${Date.now()}`;
  const path = `audit_discrepancies/${docId}`;
  try {
    const payload = {
      ...disc,
      id: docId,
      userId: user ? user.uid : 'anonymous',
      userEmail: user?.email || null,
      syncedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'audit_discrepancies', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Cloud Settings Sync
export async function syncUserSettingsToCloud(settings: AppSettings): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const path = `users/${user.uid}/settings/current`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'settings', 'current'), {
      ...settings,
      userId: user.uid,
      userEmail: user.email,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
