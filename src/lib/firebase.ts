import { adminApi } from "./adminApi";
import { initializeApp } from "firebase/app";
import { apiUrl } from "./apiUrl";
import { normalizeOrder } from "../utils/orderIntegration";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  connectFirestoreEmulator,
  runTransaction,
  type QueryConstraint,
} from "firebase/firestore";
import savedConfig from "../../firebase-applet-config.json";
import type { Order, Profile, UserRole } from "../types/index.ts";

export const firebaseConfig = {
  ...savedConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || savedConfig.apiKey,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || savedConfig.projectId,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || savedConfig.authDomain,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || savedConfig.appId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || savedConfig.storageBucket,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID ||
    savedConfig.firestoreDatabaseId,
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true"
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export { onAuthStateChanged, type FirebaseUser };
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
export const isVerifiedIdentity = (user: FirebaseUser | null) =>
  Boolean(user && (user.emailVerified || user.phoneNumber));
export async function signInWithFirebaseGoogle(defaults?: Partial<Profile>) {
  const { user } = await signInWithPopup(auth, googleProvider);
  return syncUserProfileToFirestore(user, defaults);
}
export async function signOutFromFirebase() {
  await signOut(auth);
}

export async function syncUserProfileToFirestore(
  user: FirebaseUser,
  defaults: Partial<Profile> = {},
): Promise<Profile> {
  if (!isVerifiedIdentity(user))
    throw new Error("يرجى تأكيد بريدك الإلكتروني أولاً ثم تسجيل الدخول.");
  const ref = doc(db, "users", user.uid);
  const data = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists()
      ? snapshot.data()
      : {
          uid: user.uid,
          fullName: user.displayName || defaults.fullName || "",
          email: user.email || "",
          phone: user.phoneNumber || defaults.phone || "",
          ministry: defaults.ministry || "",
          floorNumber: defaults.floorNumber || "",
          roomNumber: defaults.roomNumber || "",
          role: "employee",
          walletBalance: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
    if (!snapshot.exists()) transaction.set(ref, data);
    return data;
  });
  // The profile's editable fields and localStorage never grant permissions.
  const [admin, staff] = await Promise.all([
    getDoc(doc(db, "admins", user.uid)),
    getDoc(doc(db, "staff", user.uid)),
  ]);
  const assignment = staff.data();
  const role: UserRole = admin.exists()
    ? "admin"
    : assignment?.role === "courier" || assignment?.role === "restaurant"
      ? assignment.role
      : "employee";
  return {
    id: user.uid,
    fullName: data.fullName,
    email: user.email || "",
    phone: data.phone || "",
    ministry: data.ministry,
    floorNumber: data.floorNumber,
    roomNumber: data.roomNumber,
    walletBalance: 0,
    role,
    ...(data.coordinates ? { coordinates: data.coordinates } : {}),
    ...(assignment?.storeId ? { storeId: assignment.storeId } : {}),
    ...(user.photoURL ? { avatarUrl: user.photoURL } : {}),
    isGuest: false,
    authProvider: user.providerData.some((p) => p.providerId === "google.com")
      ? "google"
      : user.phoneNumber
        ? "phone"
        : "email",
  };
}

export async function updateUserLocationInFirestore(
  uid: string,
  ministry: string,
  floorNumber: string,
  roomNumber: string,
  fullName?: string,
  phone?: string,
  coordinates?: Profile["coordinates"],
) {
  if (auth.currentUser?.uid !== uid) throw new Error("يرجى تسجيل الدخول.");
  await updateDoc(doc(db, "users", uid), {
    ministry,
    floorNumber,
    roomNumber,
    updatedAt: serverTimestamp(),
    ...(fullName !== undefined ? { fullName } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(coordinates ? { coordinates } : {}),
  });
}
export const cleanData = <T>(data: T): T => JSON.parse(JSON.stringify(data));
export async function saveRecord(name: string, id: string, data: object) {
  await adminApi("data", { action: "save", collection: name, id, data: cleanData(data) });
}
export async function deleteRecord(name: string, id: string) {
  await adminApi("data", { action: "delete", collection: name, id });
}
export async function updateOrderRecord(id: string, changes: Partial<Order>) {
  await adminApi("data", { action: "save", collection: "orders", id, data: cleanData(changes) });
}
export function watchCollection<T>(
  name: string,
  onData: (data: T[]) => void,
  onError: (error: Error) => void,
  constraints: QueryConstraint[] = [],
  onConnection?: (connected: boolean) => void,
) {
  return onSnapshot(
    query(collection(db, name), ...constraints),
    { includeMetadataChanges: true },
    (snapshot) => {
      onConnection?.(!snapshot.metadata.fromCache);
      onData(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            ...data,
            id: item.id,
            ...(data.createdAt?.toDate
              ? { createdAt: data.createdAt.toDate().toISOString() }
              : {}),
          } as T;
        }),
      );
    },
    (error) => {
      onConnection?.(false);
      onError(error);
    },
  );
}
export function subscribeToOrders(
  profile: Profile,
  onData: (orders: Order[]) => void,
  onError: (error: Error) => void,
  onConnection?: (connected: boolean) => void,
) {
  const constraints =
    profile.role === "admin"
      ? []
      : profile.role === "restaurant" && profile.storeId
        ? [where("storeIds", "array-contains", profile.storeId)]
        : profile.role === "courier"
          ? [where("courierId", "==", profile.id)]
          : [where("profileId", "==", profile.id)];
  return watchCollection<Order>(
    "orders",
    (orders) =>
      onData(
        orders
          .map(normalizeOrder)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    onError,
    constraints,
    onConnection,
  );
}

export async function updateKitchenStage(id: string, storeId: string, next: "preparing" | "ready") {
  await adminApi("data", { action: "kitchen", id, storeId, next });
}
export async function saveOrderToFirestore(order: Order): Promise<Order> {
  if (!auth.currentUser) throw new Error("يرجى تسجيل الدخول.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(apiUrl("/api/orders"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(order),
  });
  const result = await response.json().catch(() => ({
    error: "خدمة الطلبات غير متاحة. تحقق من إعدادات الخادم.",
  }));
  if (!response.ok) throw new Error(result.error || "تعذر حفظ الطلب.");
  return result.order;
}
export async function approvePartner(partnerId: string, store: import("../types/index.ts").Store) {
  await adminApi("data", { action: "approve", collection: "partnerApplications", id: partnerId, store: cleanData(store) });
}
