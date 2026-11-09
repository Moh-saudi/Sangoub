import { useCallback, useEffect, useRef, useState } from 'react';
import { operationsApi } from './operationsApi';
import { supabase, resolveSupabaseStoreUuid } from './supabase';
import { playAirportChime } from '../utils/audioAlerts';
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
    const targetStoreUuid = storeId ? resolveSupabaseStoreUuid(storeId) : undefined;
    const load = async () => {
      if (!active || !uid) return;
      if (inflight) {
        again = true;
        return;
      }
      inflight = true;
      try {
        const result = await operationsApi('operations', {
          action: 'portal-active',
          ...(targetStoreUuid ? { storeId: targetStoreUuid } : storeId ? { storeId } : {}),
          ...(uid && !storeId ? { courierId: uid } : {})
        });
        if (active) {
          setItems(Array.isArray(result?.items) ? result.items : []);
          setTruncated(result?.truncated === true);
          setError('');
          setUpdatedAt(new Date().toISOString());
        }
      } catch (e) {
        if (active) {
          const status = (e as any).status;
          setItems([]);
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
    const filter = targetStoreUuid ? `store_id=eq.${targetStoreUuid}` : (uid ? `courier_id=eq.${uid}` : undefined);
    const channel = supabase.channel(`portal-orders:${targetStoreUuid || storeId || uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', ...(filter ? { filter } : {}) }, () => {
        if (!active) return;
        liveConnected = true;
        setLive(true);
        void playAirportChime();
        clearTimeout(queued);
        queued = setTimeout(() => void load(), 100);
      })
      .subscribe(status => {
        if (!active) return;
        liveConnected = status === 'SUBSCRIBED';
        setLive(liveConnected);
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
    // Auto-refresh active portal orders every 8 seconds for responsive merchant dispatch
    const timer = setInterval(() => {
      if (!document.hidden && navigator.onLine) void load();
    }, 8000);
    return () => {
      active = false;
      void supabase.removeChannel(channel);
      clearInterval(timer);
      clearTimeout(queued);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', reconnect);
      document.removeEventListener('visibilitychange', visible);
      refresher.current = async () => {};
    };
  }, [uid, storeId]);
  return {
    items: Array.isArray(items) ? items : [],
    loading,
    error,
    live,
    online,
    updatedAt,
    truncated,
    refresh
  };
}
