import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  ChevronLeft, 
  Loader2, 
  Package, 
  Tag, 
  X,
  Volume2
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { supabase } from '../../lib/supabase';
import { playAirportChime } from '../../utils/audioAlerts';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, navigate, unreadNotificationsCount, setUnreadNotificationsCount } = useStore();
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void fetchNotifications();
    }
  }, [isOpen, user]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const localNotifs: any[] = [];
      try {
        const stored = localStorage.getItem('sangoub_guest_notifications');
        if (stored) {
          localNotifs.push(...JSON.parse(stored));
        }
      } catch {}

      let dbNotifs: any[] = [];
      if (user?.id) {
        try {
          const { data: rows, error } = await supabase
            .from('notifications')
            .select('id,title,body,type,data,is_read,created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && Array.isArray(rows)) {
            dbNotifs = rows.map((r: any) => ({
              id: r.id,
              title: r.title || 'إشعار جديد',
              body: r.body || '',
              type: r.type || 'order',
              targetScreen: r.data?.screen || 'orders',
              targetId: r.data?.orderId || r.data?.targetId || '',
              is_read: Boolean(r.is_read),
              created_at: r.created_at,
            }));
          }
        } catch (dbErr) {
          console.warn('Could not fetch notifications from Supabase:', dbErr);
        }
      }

      // Combine DB and local notifications without duplicates
      const mergedMap = new Map<string, any>();
      [...dbNotifs, ...localNotifs].forEach((n) => {
        if (!mergedMap.has(n.id)) {
          mergedMap.set(n.id, n);
        }
      });

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at || b.createdAt).getTime() - new Date(a.created_at || a.createdAt).getTime()
      );

      setNotificationsList(merged);
      const unread = merged.filter((n: any) => !n.is_read).length;
      setUnreadNotificationsCount(unread);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id?: string) => {
    // 1. Update localStorage notifications
    try {
      const stored = localStorage.getItem('sangoub_guest_notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        const updated = parsed.map((n: any) =>
          !id || n.id === id ? { ...n, is_read: true } : n
        );
        localStorage.setItem('sangoub_guest_notifications', JSON.stringify(updated));
      }
    } catch {}

    // 2. Update Supabase if user is logged in
    try {
      if (id && user?.id) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id)
          .eq('user_id', user.id);
      } else if (user?.id) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
      }
    } catch {}

    if (id) {
      setNotificationsList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadNotificationsCount((c) => Math.max(0, c - 1));
    } else {
      setNotificationsList((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadNotificationsCount(0);
    }
  };

  const handleNotificationClick = (item: any) => {
    if (!item.is_read) {
      void handleMarkAsRead(item.id);
    }
    onClose();
    if (item.targetScreen === 'orders' || item.targetScreen === 'track') {
      navigate('/orders');
    } else if (item.targetScreen === 'offers' || item.targetScreen === 'coupons') {
      navigate('/offers');
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'الآن';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'الآن';
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (diffSec < 60) return 'الآن';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `منذ ${diffDays} يوم`;
      return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    } catch {
      return 'الآن';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-4 sm:p-5 w-full max-w-md shadow-2xl space-y-3.5 max-h-[85vh] flex flex-col border border-slate-100"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F0F1F3] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Bell size={18} />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                التنبيهات
              </h3>
              {unreadNotificationsCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-black flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAsRead()}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
                title="تحديد الكل كمقروء"
                aria-label="تحديد الكل كمقروء"
              >
                <CheckCheck size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={15} />
            </button>
          </div>
        </div>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto space-y-2 flex-1 pr-0.5 -mr-0.5">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
              <span className="text-xs font-bold">جارٍ تحميل التنبيهات...</span>
            </div>
          ) : notificationsList.length > 0 ? (
            notificationsList.map((item) => {
              const isOrder =
                item.type === 'order' ||
                item.type === 'operational' ||
                item.targetScreen === 'orders' ||
                item.targetScreen === 'track';
              const isOffer = item.targetScreen === 'offers' || item.targetScreen === 'coupons';

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer relative ${
                    !item.is_read
                      ? 'bg-orange-50/70 border-orange-200/80 shadow-2xs hover:bg-orange-50'
                      : 'bg-white hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isOrder
                          ? 'bg-orange-100 text-orange-600'
                          : isOffer
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {isOrder ? (
                        <Package size={16} />
                      ) : isOffer ? (
                        <Tag size={16} />
                      ) : (
                        <Bell size={16} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!item.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0 animate-pulse" />
                          )}
                          <h4
                            className={`text-xs font-black truncate ${
                              !item.is_read ? 'text-slate-900' : 'text-slate-700'
                            }`}
                          >
                            {item.title}
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTimeAgo(item.created_at || item.createdAt)}
                        </span>
                      </div>

                      <p className="text-[11.5px] text-slate-600 leading-relaxed font-normal">
                        {item.body}
                      </p>

                      <div className="mt-1.5 flex items-center gap-1 text-[10.5px] font-black text-orange-600 hover:text-orange-700">
                        <span>عرض ومتابعة الطلب</span>
                        <ChevronLeft size={12} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto">
                <Bell size={20} />
              </div>
              <h4 className="font-bold text-slate-800 text-xs sm:text-sm">لا توجد تنبيهات جديدة</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                ستصلك هنا إشعارات فورية بكل مرحلة من مراحل تجهيز وتوصيل طلباتك، مصحوبة بنغمة المطار المميزة.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
