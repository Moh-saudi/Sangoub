import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { operationsApi } from './operationsApi';
export function useActivePortalOrders(uid: string | undefined, storeId?: string) {
  const [items, setItems] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [live, setLive] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [updatedAt, setUpdatedAt] = useState(''),
    [truncated, setTruncated] = useState(false);
  const refresher = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refresher.current(), []);
  useEffect(() => {
    setItems([]);
    setUpdatedAt('');
    setError('');
    setLoading(!!uid);
    setLive(false);
    if (!uid) return;
    let active = true,
      inflight = false,
      again = false,
      liveConnected = false;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (!active || auth.currentUser?.uid !== uid) return;
      if (inflight) {
        again = true;
        return;
      }
      inflight = true;
      try {
        const result = await operationsApi('operations', {
          action: 'portal-active'
        });
        if (active && auth.currentUser?.uid === uid) {
          setItems(result.items);
          setTruncated(result.truncated === true);
          setError('');
          setUpdatedAt(new Date().toISOString());
        }
      } catch (e) {
        if (active) {
          const status = (e as any).status;
          if (status === 401 || status === 403) setItems([]);
          setError(status === 403 ? 'تغيرت صلاحياتك؛ أعد تسجيل الدخول.' : 'تعذر تحديث المهام. البيانات السابقة ليست مؤكدة؛ أعد المحاولة.');
        }
      } finally {
        inflight = false;
        if (active) {
          setLoading(false);
          if (again) {
            again = false;
            queued = setTimeout(() => void load(), 100);
          }
        }
      }
    };
    refresher.current = load;
    void load();
    const stop = onSnapshot(query(collection(db, storeId ? `storeOrderSignals/${storeId}/orders` : `courierOrderSignals/${uid}/orders`), where('active', '==', true), limit(50)), {
      includeMetadataChanges: true
    }, snapshot => {
      if (!active) return;
      liveConnected = !snapshot.metadata.fromCache;
      setLive(liveConnected);
      if (liveConnected) {
        clearTimeout(queued);
        queued = setTimeout(() => void load(), 100);
      }
    }, e => {
      if (!active) return;
      liveConnected = false;
      setLive(false);
      if (e.code === 'permission-denied') setItems([]);
    });
    const reconnect = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void load();else setLive(false);
    };
    const visible = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', reconnect);
    document.addEventListener('visibilitychange', visible);
    // Reconcile old clients/server-only integrations too; this is visibly a fallback when signals are unavailable.
    const timer = setInterval(() => {
      if (!document.hidden && navigator.onLine) void load();
    }, 30000);
    return () => {
      active = false;
      stop();
      clearInterval(timer);
      clearTimeout(queued);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', reconnect);
      document.removeEventListener('visibilitychange', visible);
      refresher.current = async () => {};
    };
  }, [uid, storeId]);
  return {
    items,
    loading,
    error,
    live,
    online,
    updatedAt,
    truncated,
    refresh
  };
}
