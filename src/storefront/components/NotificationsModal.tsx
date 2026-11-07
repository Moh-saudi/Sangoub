import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  CheckCheck, 
  ChevronLeft, 
  Loader2, 
  Package, 
  Tag, 
  X 
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { authenticatedApi } from '../../lib/authenticatedApi';
import { supabase } from '../../lib/supabase';

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
    if (isOpen && user && !user.isGuest) {
      void fetchNotifications();
    }
  }, [isOpen, user]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        const { data: rows, error } = await supabase
          .from('notifications')
          .select('id,title,body,type,data,is_read,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && Array.isArray(rows)) {
          const mapped = rows.map((r: any) => ({
            id: r.id,
            title: r.title || 'إشعار جديد',
            body: r.body || '',
            type: r.type || 'operational',
            targetScreen: r.data?.screen || 'orders',
            targetId: r.data?.targetId || '',
            is_read: Boolean(r.is_read),
            created_at: r.created_at,
          }));
          setNotificationsList(mapped);
          const unread = mapped.filter((n: any) => !n.is_read).length;
          setUnreadNotificationsCount(unread);
        }
      }
    } catch (err) {
      console.warn('Could not fetch notifications from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id?: string) => {
    try {
      if (id) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id)
          .eq('user_id', user?.id);
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
      navigate('/my-orders');
    } else if (item.targetScreen === 'offers' || item.targetScreen === 'coupons') {
      navigate('/offers');
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
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
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-4 sm:p-5 w-full max-w-md shadow-2xl space-y-3.5 max-h-[85vh] flex flex-col"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F0F1F3] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FFF2EC] text-[#FF5900] flex items-center justify-center">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                التنبيهات والإشعارات
              </h3>
              {unreadNotificationsCount > 0 && (
                <span className="text-[10px] font-bold text-[#FF5900]">
                  {unreadNotificationsCount} إشعار جديد غير مقروء
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAsRead()}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="تعليم الكل كمقروء"
              >
                <CheckCheck size={13} />
                <span>قراءة الكل</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto space-y-2.5 flex-1 pr-0.5 -mr-0.5">
          {isLoading ? (
            <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-[#FF5900]" />
              <span className="text-xs font-bold">جارٍ تحميل التنبيهات...</span>
            </div>
          ) : !user || user.isGuest ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF5900] flex items-center justify-center mx-auto">
                <Bell size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">سجّل الدخول أولاً</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                سجّل دخولك لمتابعة تحديثات طلباتك لحظة بلحظة واستقبال العروض الحصرية.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/login');
                }}
                className="px-5 py-2 rounded-xl bg-[#FF5900] text-white text-xs font-bold hover:bg-[#E04E00] transition-colors cursor-pointer"
              >
                تسجيل الدخول / إنشاء حساب
              </button>
            </div>
          ) : notificationsList.length > 0 ? (
            notificationsList.map((item) => {
              const isOrder =
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
                      ? 'bg-[#FFF7ED] border-[#FDBA74] shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-[#F0F1F3]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isOrder
                          ? 'bg-orange-100 text-[#FF5900]'
                          : isOffer
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {isOrder ? (
                        <Package size={18} />
                      ) : isOffer ? (
                        <Tag size={18} />
                      ) : (
                        <Bell size={18} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4
                          className={`text-xs sm:text-sm font-black truncate ${
                            !item.is_read ? 'text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {item.body}
                      </p>
                      {(item.targetScreen === 'orders' ||
                        item.targetScreen === 'track' ||
                        item.targetScreen === 'offers') && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-black text-[#FF5900]">
                          <span>عرض التفاصيل</span>
                          <ChevronLeft size={13} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Unread indicator dot */}
                  {!item.is_read && (
                    <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-[#FF5900]" />
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF5900] flex items-center justify-center mx-auto">
                <Bell size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">لا توجد إشعارات حالياً</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                ستصلك هنا إشعارات فورية بكل مرحلة من مراحل طلبك، والعروض الخاصة أولاً بأول.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-[#F0F1F3] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

