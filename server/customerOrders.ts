import {readQuery} from './data/firestoreQueries.ts';
import {queryPlans} from '../src/data/queryPlans.ts';
import {
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
/** Private per-customer index keeps history reads bounded; legacy orders are indexed once. */
export async function customerOrderHistory(db: Firestore, uid: string) {
  const meta = db.doc("customerOrderHistory/" + uid),
    history = meta.collection("orders");
  if (!(await meta.get()).data()?.initialized) {
    const legacy = await db
      .collection("orders")
      .where("profileId", "==", uid)
      .get();
    const ordered = legacy.docs
      .map((doc) => {
        const value = doc.data();
        const date =
          value.createdAt?.toDate?.() || new Date(value.createdAt || 0);
        return {
          id: doc.id,
          time: Number.isFinite(date.getTime()) ? date : new Date(0),
        };
      })
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 30);
    const batch = db.batch();
    for (const item of ordered)
      batch.set(history.doc(item.id), {
        createdAt: Timestamp.fromDate(item.time),
      });
    batch.set(
      meta,
      { initialized: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    await batch.commit();
  }
  const ids = (
    await readQuery(db,queryPlans.customerHistory(uid))
  ).docs.map((doc) => doc.id);
  if (!ids.length) return [];
  return (await db.getAll(...ids.map((id) => db.doc("orders/" + id))))
    .filter((doc) => doc.exists && doc.data()?.profileId === uid)
    .map((doc) => {
      const value = doc.data()!;
      return {
        ...value,
        id: doc.id,
        createdAt: value.createdAt?.toDate?.().toISOString() || value.createdAt,
      };
    });
}
