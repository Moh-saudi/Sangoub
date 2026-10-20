import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Order, Profile, UserRole } from '../types/index.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { firebaseConfig, onAuthStateChanged, type FirebaseUser };

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Helper to sanitize strings to match firebase-blueprint.json maxLength constraints
function sanitizeString(val: string | undefined, fallback: string, maxLen: number): string {
  const cleaned = (val || fallback).trim();
  if (!cleaned) return fallback.slice(0, maxLen);
  return cleaned.slice(0, maxLen);
}

export async function signInWithFirebaseGoogle(defaults?: {
  ministry?: string;
  floorNumber?: string;
  roomNumber?: string;
}): Promise<Profile> {
  const credential = await signInWithPopup(auth, googleProvider);
  const fbUser = credential.user;
  return await syncUserProfileToFirestore(fbUser, defaults);
}

export async function signOutFromFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function syncUserProfileToFirestore(
  fbUser: FirebaseUser,
  defaults?: {
    ministry?: string;
    floorNumber?: string;
    roomNumber?: string;
  }
): Promise<Profile> {
  const userPath = `users/${fbUser.uid}`;
  const userRef = doc(db, 'users', fbUser.uid);

  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      return {
        id: fbUser.uid,
        fullName: data.fullName || fbUser.displayName || 'موظف العاصمة الإدارية',
        email: data.email || fbUser.email || 'employee@gov.eg',
        phone: data.phone || fbUser.phoneNumber || '01091234567',
        ministry: data.ministry || defaults?.ministry || 'وزارة النقل',
        floorNumber: data.floorNumber || defaults?.floorNumber || 'الدور الخامس',
        roomNumber: data.roomNumber || defaults?.roomNumber || 'مكتب 504',
        walletBalance: typeof data.walletBalance === 'number' ? data.walletBalance : 350,
        role: (data.role as UserRole) || 'employee',
        avatarUrl: data.avatarUrl || fbUser.photoURL || undefined,
        isGuest: false,
        authProvider: 'google',
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  // Create new profile adhering strictly to firebase-blueprint.json and firestore.rules
  const isAdminUser = fbUser.email === 'el7lm25@gmail.com';
  const assignedRole: UserRole = isAdminUser ? 'admin' : 'employee';
  const initialWallet = isAdminUser ? 5000 : 350;

  const newProfileData: Record<string, unknown> = {
    uid: sanitizeString(fbUser.uid, 'user-id', 128),
    fullName: sanitizeString(fbUser.displayName || 'موظف العاصمة الإدارية', 'موظف العاصمة', 120),
    email: sanitizeString(fbUser.email || 'user@gov.eg', 'user@gov.eg', 160),
    phone: sanitizeString(fbUser.phoneNumber || '01091234567', '01091234567', 30),
    ministry: sanitizeString(defaults?.ministry, 'وزارة النقل', 120),
    floorNumber: sanitizeString(defaults?.floorNumber, 'الدور الخامس', 60),
    roomNumber: sanitizeString(defaults?.roomNumber, 'مكتب 504', 80),
    role: assignedRole,
    walletBalance: initialWallet,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (fbUser.photoURL) {
    newProfileData.avatarUrl = sanitizeString(fbUser.photoURL, '', 500);
  }

  try {
    await setDoc(userRef, newProfileData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  return {
    id: fbUser.uid,
    fullName: newProfileData.fullName as string,
    email: newProfileData.email as string,
    phone: newProfileData.phone as string,
    ministry: newProfileData.ministry as string,
    floorNumber: newProfileData.floorNumber as string,
    roomNumber: newProfileData.roomNumber as string,
    walletBalance: initialWallet,
    role: assignedRole,
    avatarUrl: fbUser.photoURL || undefined,
    isGuest: false,
    authProvider: 'google',
  };
}

export async function updateUserLocationInFirestore(
  uid: string,
  ministry: string,
  floorNumber: string,
  roomNumber: string,
  fullName?: string,
  phone?: string
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const updates: Record<string, unknown> = {
    ministry: sanitizeString(ministry, 'وزارة النقل', 120),
    floorNumber: sanitizeString(floorNumber, 'الدور الخامس', 60),
    roomNumber: sanitizeString(roomNumber, 'مكتب 504', 80),
    updatedAt: serverTimestamp(),
  };

  if (fullName) updates.fullName = sanitizeString(fullName, 'موظف العاصمة', 120);
  if (phone) updates.phone = sanitizeString(phone, '01091234567', 30);

  try {
    await updateDoc(userRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function saveOrderToFirestore(order: Order): Promise<void> {
  if (!auth.currentUser) return;
  const cleanOrderId = order.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const orderPath = `orders/${cleanOrderId}`;
  const orderRef = doc(db, 'orders', cleanOrderId);

  const itemsSummary = order.items
    .map((i) => `${i.quantity}x ${i.product.name}`)
    .join(' + ')
    .slice(0, 1000);

  const payload: Record<string, unknown> = {
    orderNumber: sanitizeString(order.orderNumber, 'ORD-100', 40),
    profileId: auth.currentUser.uid,
    profileName: sanitizeString(order.profileName, 'موظف العاصمة', 120),
    phone: sanitizeString(order.phone, '01091234567', 30),
    ministry: sanitizeString(order.ministry, 'وزارة النقل', 120),
    floorNumber: sanitizeString(order.floorNumber, 'الدور الخامس', 60),
    roomNumber: sanitizeString(order.roomNumber, 'مكتب 504', 80),
    itemsSummary: sanitizeString(itemsSummary, 'وجبة فود كورت', 1000),
    total: Math.max(0, Math.min(100000, Number(order.total) || 0)),
    paymentMethod: ['instapay', 'geidea', 'cash'].includes(order.paymentMethod)
      ? order.paymentMethod
      : 'cash',
    orderStatus: 'received',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (order.scheduledDeliveryTime) {
    payload.scheduledDeliveryTime = sanitizeString(order.scheduledDeliveryTime, '', 100);
  }

  try {
    await setDoc(orderRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, orderPath);
  }
}

export function subscribeToUserOrders(
  uid: string,
  onOrdersSynced: (cloudOrdersCount: number) => void
) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return () => {};
  const ordersPath = 'orders';
  const q = query(collection(db, 'orders'), where('profileId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      onOrdersSynced(snapshot.size);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, ordersPath);
    }
  );
}
