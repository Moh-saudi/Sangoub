import React from 'react';
import { Bell, X, CheckCircle2, Bike, Gift, AlertCircle, Clock } from 'lucide-react';
import type { AppNotification } from '../types/index.ts';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllAsRead: () => void;
  onSelectNotification?: (notif: AppNotification) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onSelectNotification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div
        className="bg-white w-full sm:max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] mt-12 sm:mt-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">إشعارات الحي الحكومي (FCM)</h3>
              <p className="text-[10px] text-slate-500">تحديثات الطلبات وتعيين المناديب الميدانيين</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-emerald-700 hover:underline font-semibold"
            >
              تحديد الكل كمقروء
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-300"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-3 overflow-y-auto space-y-2 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              لا توجد إشعارات حالية
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.read;
              return (
                <div
                  key={notif.id}
                  onClick={() => onSelectNotification?.(notif)}
                  className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                    isUnread
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-slate-100">
                    {notif.type === 'courier_assigned' ? (
                      <Bike className="w-4 h-4 text-emerald-600" />
                    ) : notif.type === 'order_update' ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Gift className="w-4 h-4 text-amber-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {notif.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {notif.body}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[10px] text-slate-400">
          متصل بنظام Firebase Cloud Messaging (FCM) المباشر
        </div>
      </div>
    </div>
  );
};

export const NotificationToast: React.FC<{
  notification: AppNotification | null;
  onDismiss: () => void;
  onOpenCenter: () => void;
}> = ({ notification, onDismiss, onOpenCenter }) => {
  if (!notification) return null;

  return (
    <div className="fixed top-14 sm:top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-in slide-in-from-top-4 duration-300">
      <div
        onClick={onOpenCenter}
        className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700/80 flex items-start justify-between gap-3 cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
          {notification.type === 'courier_assigned' ? (
            <Bike className="w-5 h-5" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-emerald-400 font-bold">
              إشعار فوري جديد (FCM)
            </span>
            <span className="text-[9px] text-slate-400 font-mono">الآن</span>
          </div>
          <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
            {notification.title}
          </h4>
          <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
            {notification.body}
          </p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-slate-400 hover:text-white p-1"
          aria-label="إغلاق الإشعار"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
