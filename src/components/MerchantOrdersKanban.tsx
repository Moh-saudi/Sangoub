import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  BellOff,
  Clock,
  Package,
  CheckCircle2,
  Truck,
  Search,
  ChevronDown,
  Phone,
  Eye,
  Check,
  RotateCw,
  Printer,
  Copy,
  ShoppingBag,
  AlertCircle,
  X,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  User,
  MapPin,
  Calendar,
  Layers,
  Archive,
  Send,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import type { Order, Store, Product } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import { cleanCourierName, cleanCustomerName } from '../utils/sanitizeName';
import { CustomerPOSReceipt } from './CustomerPOSReceipt';
import { supabase } from '../lib/supabase';
import { operationsApi } from '../lib/operationsApi';

export interface MerchantOrdersKanbanProps {
  orders: Order[];
  stores: Store[];
  fixedStoreId?: string;
  products?: Product[];
  couriers?: any[];
  connected: boolean;
  userStore: Store;
  onToggleStoreStatus?: (storeId: string) => void;
  onAssignCourier?: (orderId: string, courierId: string, courierName?: string, courierPhone?: string) => Promise<void>;
  onChange: (id: string, storeId: string, stage: 'preparing' | 'ready') => Promise<void>;
  onNavigateRadar?: () => void;
  onNavigateHistory?: () => void;
  onUpdateOrderStatus?: (orderId: string, status: Order['orderStatus']) => Promise<void>;
  onRefreshOrders?: () => void;
}

type KanbanColumnId = 'new' | 'review' | 'preparing' | 'ready';
type FilterTabId = 'all' | 'new' | 'review' | 'preparing' | 'ready' | 'with_courier' | 'archive';
type SortOption = 'newest' | 'oldest' | 'highest_value' | 'most_items';

export function MerchantOrdersKanban({
  orders,
  stores,
  fixedStoreId,
  products = [],
  couriers = [],
  connected,
  userStore,
  onToggleStoreStatus,
  onAssignCourier,
  onChange,
  onNavigateRadar,
  onNavigateHistory,
  onUpdateOrderStatus,
  onRefreshOrders,
}: MerchantOrdersKanbanProps) {
  // Store context
  const currentStoreId = fixedStoreId || userStore.id;

  // Filter & Search states
  const [activeFilter, setActiveFilter] = useState<FilterTabId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Selected Order for the 560px Drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Printing Order
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Sound Notification state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousIncomingIdsRef = useRef<Set<string> | null>(null);

  // Operational states
  const [processingOrderIds, setProcessingOrderIds] = useState<Record<string, boolean>>({});
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<KanbanColumnId | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Local courier assignment inside drawer
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [assigningCourier, setAssigningCourier] = useState(false);

  // Edit item quantity state in drawer
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // Auto-timer for elapsed update
  useEffect(() => {
    const timer = setInterval(() => {
      const diffMs = Date.now() - lastRefreshedAt.getTime();
      setElapsedMinutes(Math.floor(diffMs / 60000));
    }, 30000);
    return () => clearInterval(timer);
  }, [lastRefreshedAt]);

  // Product catalog lookup map for real images
  const productsCatalogMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p.id) map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Store-isolated couriers
  const storeFleet = useMemo(() => {
    return couriers.filter((c: any) => {
      const sId = c.storeId || c.store_id;
      if (!sId) return true; // platform or unassigned
      return sId === currentStoreId;
    });
  }, [couriers, currentStoreId]);

  // Relevant store orders (orders containing items from this store or storeId matched)
  const storeOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.storeIds && order.storeIds.length > 0) {
        return order.storeIds.includes(currentStoreId);
      }
      return order.storeId === currentStoreId;
    });
  }, [orders, currentStoreId]);

  // Map order to Kanban Column
  function getOrderColumn(order: Order): KanbanColumnId | 'with_courier' | 'archive' {
    const status = order.orderStatus;
    if (status === 'delivered' || status === 'cancelled') return 'archive';
    if (status === 'with_courier' || status === 'picked_up' || status === 'assigned') return 'with_courier';
    if (status === 'ready') return 'ready';
    if (status === 'preparing') return 'preparing';

    // In 'received' / 'pending' status:
    // Determine if it requires review (e.g. has customer notes, items need substitution, or review flag)
    if (order.notes && order.notes.trim().length > 0) {
      return 'review';
    }
    if (order.restaurantStatus === 'pending' || order.orderStatus === 'received') {
      return 'new';
    }
    return 'new';
  }

  // Sound chime on new orders
  useEffect(() => {
    const newOrders = storeOrders.filter(o => getOrderColumn(o) === 'new');
    const newIds = new Set(newOrders.map(o => o.id));

    if (previousIncomingIdsRef.current && soundEnabled) {
      const hasBrandNew = [...newIds].some(id => !previousIncomingIdsRef.current!.has(id));
      if (hasBrandNew) {
        try {
          if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioContextRef.current;
          if (ctx.state === 'running') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
          }
        } catch (e) {
          console.warn('Audio chime error:', e);
        }
      }
    }
    previousIncomingIdsRef.current = newIds;
  }, [storeOrders, soundEnabled]);

  // Notification Toast Helper
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1-Click Copy Order Number
  const copyOrderNumber = (orderNumber: string) => {
    navigator.clipboard.writeText(orderNumber);
    setCopiedOrderId(orderNumber);
    showToast(`تم نسخ رقم الطلب #${orderNumber}`, 'success');
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Grouped Orders by Column
  const groupedOrders = useMemo(() => {
    const groups: Record<KanbanColumnId | 'with_courier' | 'archive', Order[]> = {
      new: [],
      review: [],
      preparing: [],
      ready: [],
      with_courier: [],
      archive: [],
    };

    for (const order of storeOrders) {
      const col = getOrderColumn(order);
      groups[col].push(order);
    }

    return groups;
  }, [storeOrders]);

  // Counts for Metrics
  const metrics = useMemo(() => {
    return {
      newCount: groupedOrders.new.length,
      reviewCount: groupedOrders.review.length,
      preparingCount: groupedOrders.preparing.length,
      readyCount: groupedOrders.ready.length,
      completedCount: storeOrders.filter(o => o.orderStatus === 'delivered' || o.orderStatus === 'ready').length,
    };
  }, [groupedOrders, storeOrders]);

  // Filtered & Sorted orders for each column
  const filterAndSort = (items: Order[]) => {
    let result = [...items];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(o => {
        const numMatch = (o.orderNumber || o.id).toLowerCase().includes(q);
        const nameMatch = (o.profileName || '').toLowerCase().includes(q);
        const phoneMatch = (o.phone || '').includes(q);
        return numMatch || nameMatch || phoneMatch;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'highest_value') {
        return (b.total || 0) - (a.total || 0);
      }
      if (sortBy === 'most_items') {
        return (b.items?.length || 0) - (a.items?.length || 0);
      }
      return 0;
    });

    return result;
  };

  // Elapsed time formatter
  function formatElapsedTime(createdAt: string | undefined): string {
    if (!createdAt) return 'الآن';
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const diffMin = Math.max(0, Math.floor((now - created) / 60000));

    if (diffMin < 1) return 'منذ دقيقة';
    if (diffMin === 1) return 'منذ دقيقة واحدة';
    if (diffMin === 2) return 'منذ دقيقتين';
    if (diffMin < 11) return `منذ ${diffMin} دقائق`;
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours === 1) return 'منذ ساعة';
    if (diffHours === 2) return 'منذ ساعتين';
    if (diffHours < 11) return `منذ ${diffHours} ساعات`;
    return `منذ ${diffHours} ساعة`;
  }

  // Handle Order Stage Progression
  async function handleAdvanceStage(order: Order, targetStage: 'review' | 'preparing' | 'ready') {
    setProcessingOrderIds(prev => ({ ...prev, [order.id]: true }));
    try {
      if (targetStage === 'preparing') {
        await onChange(order.id, currentStoreId, 'preparing');
        showToast(`تم قبول الطلب #${order.orderNumber} وبدء التجهيز ⚙️`, 'success');
      } else if (targetStage === 'ready') {
        await onChange(order.id, currentStoreId, 'ready');
        showToast(`تم تجهيز الطلب #${order.orderNumber} وهو جاهز للتوصيل ✓`, 'success');
      } else if (targetStage === 'review') {
        // Move to review or mark note reviewed
        showToast(`تمت مراجعة أصناف الطلب #${order.orderNumber}`, 'success');
      }

      // Update selectedOrder if open
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({
          ...selectedOrder,
          orderStatus: targetStage === 'ready' ? 'ready' : 'preparing',
        });
      }
    } catch (err: any) {
      console.error('Failed to advance order stage:', err);
      showToast(err?.message || 'تعذر تحديث حالة الطلب', 'error');
    } finally {
      setProcessingOrderIds(prev => ({ ...prev, [order.id]: false }));
    }
  }

  // Assign courier directly
  async function handleAssignCourierToOrder(order: Order, courierId: string) {
    if (!courierId) return;
    setAssigningCourier(true);
    try {
      const courier = storeFleet.find(c => c.id === courierId);
      if (onAssignCourier) {
        await onAssignCourier(order.id, courierId, courier?.name || courier?.full_name, courier?.phone);
      } else {
        await operationsApi('operations', {
          action: 'assign-courier',
          orderId: order.id,
          courierId,
          courierName: courier?.name || courier?.full_name || 'كابتن توصيل',
          courierPhone: courier?.phone || '',
          orderNumber: order.orderNumber,
          nextStatus: 'ready'
        });
      }
      showToast(`تم إسناد الطلب #${order.orderNumber} إلى الكابتن ${courier?.name || courier?.full_name || ''} بنجاح 🚀`, 'success');
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder({
          ...selectedOrder,
          courierId,
          courierName: courier?.name || courier?.full_name,
          courierPhone: courier?.phone,
          orderStatus: 'ready',
        });
      }
    } catch (err: any) {
      console.error('Assign courier error:', err);
      showToast(err?.message || 'تعذر إسناد المندوب', 'error');
    } finally {
      setAssigningCourier(false);
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('text/plain', orderId);
    setDraggedOrderId(orderId);
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanColumnId) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCol: KanbanColumnId) => {
    e.preventDefault();
    setDragOverCol(null);
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    if (!orderId) return;

    const order = storeOrders.find(o => o.id === orderId);
    if (!order) return;

    const currentCol = getOrderColumn(order);
    if (currentCol === targetCol) return;

    if (targetCol === 'preparing') {
      await handleAdvanceStage(order, 'preparing');
    } else if (targetCol === 'ready') {
      await handleAdvanceStage(order, 'ready');
    }
    setDraggedOrderId(null);
  };

  // Helper to open drawer and init item quantities
  const openOrderDrawer = (order: Order) => {
    setSelectedOrder(order);
    const qtys: Record<string, number> = {};
    for (const it of order.items || []) {
      qtys[it.id] = it.quantity || 1;
    }
    setItemQuantities(qtys);
  };

  // Adjust item quantity in drawer
  const adjustItemQuantity = (itemId: string, delta: number) => {
    setItemQuantities(prev => {
      const current = prev[itemId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  return (
    <div dir="rtl" className="w-full space-y-4 font-['Tajawal'] text-slate-800 antialiased select-none">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-sm font-bold flex items-center gap-2 transition-all transform animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toastMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          1. TOP ROW: HEADER BANNER & STATISTIC METRIC CARDS
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch">
        {/* Main Title & Store Status Card (Spans on mobile, standard card on desktop) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-black text-slate-900 font-['Cairo'] tracking-tight">
                    استقبال وإدارة الطلبات
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    تابع طلبات عملائك وقم بإدارتها بسهولة
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">المتجر قيد التشغيل</span>
            {onToggleStoreStatus && (
              <button
                type="button"
                onClick={() => onToggleStoreStatus(userStore.id)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                  userStore.isActive !== false ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title={userStore.isActive !== false ? 'المتجر يستقبل طلبات الآن' : 'المتجر متوقف مؤقتاً'}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    userStore.isActive !== false ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Metric 1: طلبات جديدة */}
        <div
          onClick={() => setActiveFilter('new')}
          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between ${
            activeFilter === 'new' ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shadow-2xs">
              <Bell size={18} />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cairo'] tabular-nums">
              {metrics.newCount}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-bold text-slate-600 font-['Cairo']">طلبات جديدة</span>
          </div>
        </div>

        {/* Metric 2: طلبات قيد المراجعة */}
        <div
          onClick={() => setActiveFilter('review')}
          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between ${
            activeFilter === 'review' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-2xs">
              <Clock size={18} />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cairo'] tabular-nums">
              {metrics.reviewCount}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-slate-600 font-['Cairo']">طلبات قيد المراجعة</span>
          </div>
        </div>

        {/* Metric 3: طلبات قيد التجهيز */}
        <div
          onClick={() => setActiveFilter('preparing')}
          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between ${
            activeFilter === 'preparing' ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shadow-2xs">
              <Package size={18} />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cairo'] tabular-nums">
              {metrics.preparingCount}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-slate-600 font-['Cairo']">طلبات قيد التجهيز</span>
          </div>
        </div>

        {/* Metric 4: طلب مكتمل / جاهز */}
        <div
          onClick={() => setActiveFilter('ready')}
          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between ${
            activeFilter === 'ready' ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200/90'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-2xs">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-['Cairo'] tabular-nums">
              {metrics.completedCount}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-slate-600 font-['Cairo']">طلب مكتمل / جاهز</span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          2. TOOLBAR: FILTERS PILLS, SEARCH BAR, SORT & SOUND TOGGLE
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Right side: Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('new')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'new'
                ? 'bg-red-500 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeFilter === 'new' ? 'bg-white' : 'bg-red-500'}`} />
            <span>جديدة</span>
            <span className="text-[10px] opacity-80">({metrics.newCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('review')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'review'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeFilter === 'review' ? 'bg-white' : 'bg-amber-500'}`} />
            <span>قيد المراجعة</span>
            <span className="text-[10px] opacity-80">({metrics.reviewCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('preparing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'preparing'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeFilter === 'preparing' ? 'bg-white' : 'bg-blue-500'}`} />
            <span>قيد التجهيز</span>
            <span className="text-[10px] opacity-80">({metrics.preparingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('ready')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'ready'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeFilter === 'ready' ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>جاهزة للتوصيل</span>
            <span className="text-[10px] opacity-80">({metrics.readyCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('with_courier')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'with_courier'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Truck size={13} />
            <span>مع المندوب</span>
            <span className="text-[10px] opacity-80">({groupedOrders.with_courier.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateHistory ? onNavigateHistory() : setActiveFilter('archive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeFilter === 'archive'
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Archive size={13} />
            <span>سجل الطلبات</span>
          </button>
        </div>

        {/* Left side: Search, Sort & Audio Toggle */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث برقم الطلب أو اسم العميل..."
              className="w-full h-9 pr-9 pl-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="h-9 px-3 pr-7 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer appearance-none"
            >
              <option value="newest">الأحدث أولاً</option>
              <option value="oldest">الأقدم أولاً</option>
              <option value="highest_value">الأعلى قيمة</option>
              <option value="most_items">الأكثر أصنافاً</option>
            </select>
            <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Sound Alert Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
            }`}
            title={soundEnabled ? 'تنبيهات الصوت مفعلة' : 'تنبيهات الصوت معطلة'}
          >
            {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          </button>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => {
              setLastRefreshedAt(new Date());
              setElapsedMinutes(0);
              onRefreshOrders?.();
              showToast('تم تحديث قائمة الطلبات لحظياً ✓', 'success');
            }}
            className="h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer"
            title="تحديث البيانات لحظياً"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          3. KANBAN BOARD COLUMNS OR ARCHIVE LIST VIEW
          ════════════════════════════════════════════════════════════════════════ */}
      {activeFilter === 'archive' ? (
        /* Historical Archive View */
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Archive size={18} className="text-slate-600" />
              <h2 className="text-sm font-black text-slate-900 font-['Cairo']">
                سجل الطلبات السابقة (المكتملة والملغاة)
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-bold">
              إجمالي {groupedOrders.archive.length} طلب
            </span>
          </div>

          {filterAndSort(groupedOrders.archive).length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              لا توجد طلبات سابقة في السجل حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filterAndSort(groupedOrders.archive).map(order => (
                <KanbanOrderCard
                  key={order.id}
                  order={order}
                  columnId="ready"
                  productsCatalogMap={productsCatalogMap}
                  elapsedText={formatElapsedTime(order.createdAt)}
                  onCopyNumber={copyOrderNumber}
                  isCopied={copiedOrderId === order.orderNumber}
                  onOpenDrawer={openOrderDrawer}
                  onAdvance={() => {}}
                  isProcessing={Boolean(processingOrderIds[order.id])}
                  onDragStart={handleDragStart}
                  readOnly={true}
                />
              ))}
            </div>
          )}
        </div>
      ) : activeFilter === 'with_courier' ? (
        /* With Courier View */
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 font-['Cairo']">
                الطلبات في طريقها للعميل مع المناديب
              </h2>
            </div>
            {onNavigateRadar && (
              <button
                type="button"
                onClick={onNavigateRadar}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                <span>فتح رادار تتبع المناديب</span>
                <ChevronRight size={14} className="rotate-180" />
              </button>
            )}
          </div>

          {filterAndSort(groupedOrders.with_courier).length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              لا توجد طلبات جارية مع المناديب حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filterAndSort(groupedOrders.with_courier).map(order => (
                <KanbanOrderCard
                  key={order.id}
                  order={order}
                  columnId="ready"
                  productsCatalogMap={productsCatalogMap}
                  elapsedText={formatElapsedTime(order.createdAt)}
                  onCopyNumber={copyOrderNumber}
                  isCopied={copiedOrderId === order.orderNumber}
                  onOpenDrawer={openOrderDrawer}
                  onAdvance={() => {}}
                  isProcessing={Boolean(processingOrderIds[order.id])}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* The 4-Column Live Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
          {/* ════ Column 1: طلبات جديدة ════ */}
          {(activeFilter === 'all' || activeFilter === 'new') && (
            <KanbanColumn
              id="new"
              title="طلبات جديدة"
              count={filterAndSort(groupedOrders.new).length}
              icon={<Bell size={16} className="text-red-500" />}
              headerBg="bg-red-50/70 border-red-200/80 text-red-900"
              badgeBg="bg-red-100 text-red-700"
              orders={filterAndSort(groupedOrders.new)}
              productsCatalogMap={productsCatalogMap}
              formatElapsedTime={formatElapsedTime}
              onCopyNumber={copyOrderNumber}
              copiedOrderId={copiedOrderId}
              onOpenDrawer={openOrderDrawer}
              onAdvance={order => handleAdvanceStage(order, 'preparing')}
              processingOrderIds={processingOrderIds}
              onDragStart={handleDragStart}
              onDragOver={e => handleDragOver(e, 'new')}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, 'new')}
              isDragOver={dragOverCol === 'new'}
              emptyMessage="لا توجد طلبات جديدة بانتظار التأكيد حالياً."
              advanceLabel="قبول الطلب"
              advanceIcon={<Check size={14} />}
              advanceBtnClass="bg-amber-500 hover:bg-amber-600 text-white"
            />
          )}

          {/* ════ Column 2: قيد المراجعة ════ */}
          {(activeFilter === 'all' || activeFilter === 'review') && (
            <KanbanColumn
              id="review"
              title="قيد المراجعة"
              count={filterAndSort(groupedOrders.review).length}
              icon={<Clock size={16} className="text-amber-500" />}
              headerBg="bg-amber-50/70 border-amber-200/80 text-amber-900"
              badgeBg="bg-amber-100 text-amber-800"
              orders={filterAndSort(groupedOrders.review)}
              productsCatalogMap={productsCatalogMap}
              formatElapsedTime={formatElapsedTime}
              onCopyNumber={copyOrderNumber}
              copiedOrderId={copiedOrderId}
              onOpenDrawer={openOrderDrawer}
              onAdvance={order => handleAdvanceStage(order, 'preparing')}
              processingOrderIds={processingOrderIds}
              onDragStart={handleDragStart}
              onDragOver={e => handleDragOver(e, 'review')}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, 'review')}
              isDragOver={dragOverCol === 'review'}
              emptyMessage="لا توجد طلبات معلقة للمراجعة."
              advanceLabel="بدء التجهيز"
              advanceIcon={<Package size={14} />}
              advanceBtnClass="bg-slate-900 hover:bg-slate-800 text-white"
            />
          )}

          {/* ════ Column 3: قيد التجهيز ════ */}
          {(activeFilter === 'all' || activeFilter === 'preparing') && (
            <KanbanColumn
              id="preparing"
              title="قيد التجهيز"
              count={filterAndSort(groupedOrders.preparing).length}
              icon={<Package size={16} className="text-blue-500" />}
              headerBg="bg-blue-50/70 border-blue-200/80 text-blue-900"
              badgeBg="bg-blue-100 text-blue-800"
              orders={filterAndSort(groupedOrders.preparing)}
              productsCatalogMap={productsCatalogMap}
              formatElapsedTime={formatElapsedTime}
              onCopyNumber={copyOrderNumber}
              copiedOrderId={copiedOrderId}
              onOpenDrawer={openOrderDrawer}
              onAdvance={order => handleAdvanceStage(order, 'ready')}
              processingOrderIds={processingOrderIds}
              onDragStart={handleDragStart}
              onDragOver={e => handleDragOver(e, 'preparing')}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, 'preparing')}
              isDragOver={dragOverCol === 'preparing'}
              emptyMessage="لا توجد طلبات جاري تحضيرها الآن."
              advanceLabel="جاهز للتوصيل"
              advanceIcon={<CheckCircle2 size={14} />}
              advanceBtnClass="bg-blue-600 hover:bg-blue-700 text-white"
            />
          )}

          {/* ════ Column 4: جاهزة للتوصيل ════ */}
          {(activeFilter === 'all' || activeFilter === 'ready') && (
            <KanbanColumn
              id="ready"
              title="جاهزة للتوصيل"
              count={filterAndSort(groupedOrders.ready).length}
              icon={<CheckCircle2 size={16} className="text-emerald-500" />}
              headerBg="bg-emerald-50/70 border-emerald-200/80 text-emerald-900"
              badgeBg="bg-emerald-100 text-emerald-800"
              orders={filterAndSort(groupedOrders.ready)}
              productsCatalogMap={productsCatalogMap}
              formatElapsedTime={formatElapsedTime}
              onCopyNumber={copyOrderNumber}
              copiedOrderId={copiedOrderId}
              onOpenDrawer={openOrderDrawer}
              onAdvance={order => openOrderDrawer(order)}
              processingOrderIds={processingOrderIds}
              onDragStart={handleDragStart}
              onDragOver={e => handleDragOver(e, 'ready')}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, 'ready')}
              isDragOver={dragOverCol === 'ready'}
              emptyMessage="لا توجد طلبات جاهزة للتسليم."
              advanceLabel="إرسال للتوصيل"
              advanceIcon={<Truck size={14} />}
              advanceBtnClass="bg-emerald-600 hover:bg-emerald-700 text-white"
            />
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          4. FOOTER STATUS BAR & HINT
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 font-bold">💡 ملاحظة:</span>
          <span>يمكنك سحب البطاقة لتغيير حالتها أو الضغط على «عرض التفاصيل» للمعاينة والتعديل.</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
          <RotateCw size={12} className={connected ? 'text-emerald-500' : 'text-amber-500'} />
          <span>
            {elapsedMinutes === 0
              ? 'آخر تحديث: منذ ثوانٍ معدودة'
              : elapsedMinutes === 1
              ? 'آخر تحديث: منذ دقيقة واحدة'
              : `آخر تحديث: منذ ${elapsedMinutes} دقيقة`}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          5. THE 560px SIDE DRAWER (ORDER DETAILS & REVIEW)
          ════════════════════════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <OrderDetailsDrawer
          order={selectedOrder}
          productsCatalogMap={productsCatalogMap}
          storeFleet={storeFleet}
          itemQuantities={itemQuantities}
          onAdjustQuantity={adjustItemQuantity}
          onClose={() => setSelectedOrder(null)}
          onPrint={() => setPrintingOrder(selectedOrder)}
          onAdvance={stage => handleAdvanceStage(selectedOrder, stage)}
          onAssignCourier={courierId => handleAssignCourierToOrder(selectedOrder, courierId)}
          isProcessing={Boolean(processingOrderIds[selectedOrder.id])}
          isAssigningCourier={assigningCourier}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          6. POS THERMAL RECEIPT PRINT MODAL
          ════════════════════════════════════════════════════════════════════════ */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-4 sm:p-6 relative">
            <button
              type="button"
              onClick={() => setPrintingOrder(null)}
              className="absolute left-4 top-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <CustomerPOSReceipt
              order={printingOrder}
              stores={stores}
              selectedStoreId={currentStoreId}
              onClose={() => setPrintingOrder(null)}
              showTabs={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KANBAN COLUMN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface KanbanColumnProps {
  id: KanbanColumnId;
  title: string;
  count: number;
  icon: React.ReactNode;
  headerBg: string;
  badgeBg: string;
  orders: Order[];
  productsCatalogMap: Map<string, Product>;
  formatElapsedTime: (dateStr?: string) => string;
  onCopyNumber: (num: string) => void;
  copiedOrderId: string | null;
  onOpenDrawer: (order: Order) => void;
  onAdvance: (order: Order) => void;
  processingOrderIds: Record<string, boolean>;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
  emptyMessage: string;
  advanceLabel: string;
  advanceIcon: React.ReactNode;
  advanceBtnClass: string;
}

function KanbanColumn({
  id,
  title,
  count,
  icon,
  headerBg,
  badgeBg,
  orders,
  productsCatalogMap,
  formatElapsedTime,
  onCopyNumber,
  copiedOrderId,
  onOpenDrawer,
  onAdvance,
  processingOrderIds,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  emptyMessage,
  advanceLabel,
  advanceIcon,
  advanceBtnClass,
}: KanbanColumnProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex flex-col rounded-2xl bg-slate-50/70 border transition-all ${
        isDragOver ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-50/40' : 'border-slate-200/80'
      }`}
    >
      {/* Column Header */}
      <div className={`p-3 rounded-t-2xl border-b flex items-center justify-between ${headerBg}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xs sm:text-sm font-black font-['Cairo'] tracking-tight">
            {title}
          </h2>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-black font-['Cairo'] tabular-nums ${badgeBg}`}>
          {count}
        </span>
      </div>

      {/* Cards List */}
      <div className="p-2 sm:p-2.5 space-y-2.5 min-h-[460px] max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
        {orders.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <Package size={28} className="opacity-40 mb-1.5" />
            <p className="text-xs font-medium">{emptyMessage}</p>
          </div>
        ) : (
          orders.map(order => (
            <KanbanOrderCard
              key={order.id}
              order={order}
              columnId={id}
              productsCatalogMap={productsCatalogMap}
              elapsedText={formatElapsedTime(order.createdAt)}
              onCopyNumber={onCopyNumber}
              isCopied={copiedOrderId === order.orderNumber}
              onOpenDrawer={onOpenDrawer}
              onAdvance={onAdvance}
              isProcessing={Boolean(processingOrderIds[order.id])}
              onDragStart={onDragStart}
              advanceLabel={advanceLabel}
              advanceIcon={advanceIcon}
              advanceBtnClass={advanceBtnClass}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KANBAN ORDER CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface KanbanOrderCardProps {
  order: Order;
  columnId: KanbanColumnId;
  productsCatalogMap: Map<string, Product>;
  elapsedText: string;
  onCopyNumber: (num: string) => void;
  isCopied: boolean;
  onOpenDrawer: (order: Order) => void;
  onAdvance: (order: Order) => void;
  isProcessing: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  advanceLabel?: string;
  advanceIcon?: React.ReactNode;
  advanceBtnClass?: string;
  readOnly?: boolean;
}

function KanbanOrderCard({
  order,
  columnId,
  productsCatalogMap,
  elapsedText,
  onCopyNumber,
  isCopied,
  onOpenDrawer,
  onAdvance,
  isProcessing,
  onDragStart,
  advanceLabel,
  advanceIcon,
  advanceBtnClass,
  readOnly = false,
}: KanbanOrderCardProps) {
  // Counts: items = distinct products count, pieces = sum of quantity
  const distinctCount = order.items?.length || 0;
  const totalPieces = (order.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

  // Extract up to 3 thumbnails
  const thumbnails = useMemo(() => {
    return (order.items || []).slice(0, 3).map(item => {
      const catProduct = productsCatalogMap.get(item.product?.id || '');
      const img = item.product?.imageUrl || catProduct?.imageUrl || '';
      return {
        id: item.id,
        name: item.product?.name || 'منتج',
        imageUrl: img,
      };
    });
  }, [order.items, productsCatalogMap]);

  // Operational message badge text based on column
  const operationalNotice = useMemo(() => {
    if (columnId === 'new') {
      return { text: 'مطلوب تأكيد الطلب', color: 'text-red-600 bg-red-50 border-red-100', dot: 'bg-red-500' };
    }
    if (columnId === 'review') {
      if (order.notes && order.notes.trim()) {
        return { text: `ملاحظة: ${order.notes.slice(0, 28)}...`, color: 'text-amber-700 bg-amber-50 border-amber-100', dot: 'bg-amber-500' };
      }
      return { text: 'انتظار تأكيد توفر المنتجات', color: 'text-amber-700 bg-amber-50 border-amber-100', dot: 'bg-amber-500' };
    }
    if (columnId === 'preparing') {
      return { text: 'جاري تجهيز المنتجات بالمحل', color: 'text-blue-700 bg-blue-50 border-blue-100', dot: 'bg-blue-500' };
    }
    if (columnId === 'ready') {
      return { text: 'تم تجهيز الطلب - جاهز للتوصيل', color: 'text-emerald-700 bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' };
    }
    return null;
  }, [columnId, order.notes]);

  return (
    <div
      draggable={!readOnly}
      onDragStart={e => onDragStart(e, order.id)}
      className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-2.5 cursor-grab active:cursor-grabbing group"
    >
      {/* Top Header Row: Order Number + Elapsed Time */}
      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
        <button
          type="button"
          onClick={() => onCopyNumber(order.orderNumber || order.id)}
          className="font-bold text-slate-800 hover:text-orange-600 flex items-center gap-1 cursor-pointer font-['Cairo'] tracking-tight"
          title="اضغط لنسخ رقم الطلب"
        >
          <span>#{order.orderNumber || order.id.slice(0, 7)}</span>
          <Copy size={11} className={isCopied ? 'text-emerald-500' : 'text-slate-400 group-hover:text-slate-600'} />
        </button>

        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
          <Clock size={11} />
          <span>{elapsedText}</span>
        </span>
      </div>

      {/* Customer Information Row */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <User size={11} />
          </div>
          <span className="font-bold text-slate-800 line-clamp-1">
            {order.profileName || 'عميل سنجوب'}
          </span>
        </div>

        {order.phone && (
          <a
            href={`tel:${order.phone}`}
            onClick={e => e.stopPropagation()}
            className="text-[11px] text-slate-400 hover:text-orange-600 flex items-center gap-1 transition-colors"
            title="اتصال هاتفي"
          >
            <Phone size={10} />
            <span dir="ltr" className="tabular-nums font-mono">{order.phone.slice(-9)}</span>
          </a>
        )}
      </div>

      {/* Summary: Product Count & Financial Amount + Thumbnails */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="text-xs font-bold text-slate-700">
            {distinctCount} منتج <span className="text-[10px] text-slate-400 font-normal">({totalPieces} قطعة)</span>
          </div>
          <div className="text-sm font-black text-slate-900 font-['Tajawal'] tabular-nums tracking-tight">
            {formatEGP(order.total)}
          </div>
        </div>

        {/* Product Image Thumbnails */}
        <div className="flex items-center -space-x-2 space-x-reverse">
          {thumbnails.map(thumb => (
            <div
              key={thumb.id}
              className="w-7 h-7 rounded-lg border border-white bg-slate-100 overflow-hidden shadow-2xs shrink-0 relative"
              title={thumb.name}
            >
              {thumb.imageUrl ? (
                <img
                  src={thumb.imageUrl}
                  alt={thumb.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-bold bg-slate-50">
                  {thumb.name.charAt(0)}
                </div>
              )}
            </div>
          ))}

          {distinctCount > 3 && (
            <div className="w-7 h-7 rounded-lg border border-white bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shadow-2xs shrink-0">
              +{distinctCount - 3}
            </div>
          )}
        </div>
      </div>

      {/* Operational Notice / Banner */}
      {operationalNotice && (
        <div className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 ${operationalNotice.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${operationalNotice.dot}`} />
          <span className="line-clamp-1">{operationalNotice.text}</span>
        </div>
      )}

      {/* Card Action Buttons Footer */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
          {advanceLabel && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onAdvance(order)}
              className={`flex-1 h-8 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 ${advanceBtnClass}`}
            >
              {isProcessing ? (
                <RotateCw size={13} className="animate-spin" />
              ) : (
                <>
                  {advanceIcon}
                  <span>{advanceLabel}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenDrawer(order)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0"
            title="عرض كامل التفاصيل والأصناف"
          >
            <Eye size={13} className="text-slate-500" />
            <span>عرض التفاصيل</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 560px SIDE DRAWER (ORDER DETAILS & REVIEW)
// ─────────────────────────────────────────────────────────────────────────────
interface OrderDetailsDrawerProps {
  order: Order;
  productsCatalogMap: Map<string, Product>;
  storeFleet: any[];
  itemQuantities: Record<string, number>;
  onAdjustQuantity: (itemId: string, delta: number) => void;
  onClose: () => void;
  onPrint: () => void;
  onAdvance: (targetStage: 'review' | 'preparing' | 'ready') => Promise<void>;
  onAssignCourier: (courierId: string) => Promise<void>;
  isProcessing: boolean;
  isAssigningCourier: boolean;
}

function OrderDetailsDrawer({
  order,
  productsCatalogMap,
  storeFleet,
  itemQuantities,
  onAdjustQuantity,
  onClose,
  onPrint,
  onAdvance,
  onAssignCourier,
  isProcessing,
  isAssigningCourier,
}: OrderDetailsDrawerProps) {
  const [selectedCourier, setSelectedCourier] = useState(order.courierId || '');

  // Calculate distinct items and total pieces
  const distinctCount = order.items?.length || 0;
  const totalPieces = (order.items || []).reduce(
    (sum, it) => sum + (itemQuantities[it.id] !== undefined ? itemQuantities[it.id] : it.quantity || 1),
    0
  );

  // Status Badge Helper
  const statusBadge = useMemo(() => {
    const s = order.orderStatus;
    if (s === 'delivered') return { label: 'تم التسليم بنجاح ✓', bg: 'bg-emerald-100 text-emerald-800' };
    if (s === 'with_courier' || s === 'picked_up' || s === 'assigned') return { label: 'مع المندوب 🚚', bg: 'bg-indigo-100 text-indigo-800' };
    if (s === 'ready') return { label: 'جاهز للتوصيل ✓', bg: 'bg-emerald-100 text-emerald-800' };
    if (s === 'preparing') return { label: 'قيد التجهيز ⚙️', bg: 'bg-blue-100 text-blue-800' };
    if (order.notes && order.notes.trim()) return { label: 'قيد المراجعة ⏱', bg: 'bg-amber-100 text-amber-800' };
    return { label: 'طلب جديد 🔔', bg: 'bg-red-100 text-red-800' };
  }, [order.orderStatus, order.notes]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Drawer Container (560px on desktop, full screen on mobile) */}
      <aside
        dir="rtl"
        className="relative w-full sm:w-[560px] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250 border-r border-slate-200"
      >
        {/* Fixed Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
            <h2 className="text-sm sm:text-base font-black text-slate-900 font-['Cairo']">
              تفاصيل الطلب #{order.orderNumber || order.id.slice(0, 7)}
            </h2>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-xs font-black font-['Cairo'] ${statusBadge.bg}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Customer Card */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/90 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    {order.profileName || 'عميل سنجوب'}
                  </h3>
                  <p className="text-[11px] text-slate-500">عميل سنجوب المميز</p>
                </div>
              </div>

              {order.phone && (
                <a
                  href={`tel:${order.phone}`}
                  className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
                >
                  <Phone size={13} />
                  <span>اتصال بالعميل</span>
                </a>
              )}
            </div>

            {/* Delivery Details */}
            {(order.deliveryAddress || order.ministry) && (
              <div className="pt-2 border-t border-slate-200/80 flex items-start gap-1.5 text-xs text-slate-600">
                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <span>
                  {order.deliveryAddress || `${order.ministry} ${order.floorNumber ? `- دور ${order.floorNumber}` : ''} ${order.roomNumber ? `- مكتب ${order.roomNumber}` : ''}`}
                </span>
              </div>
            )}

            {/* Payment Method & Status Badge */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-bold">
                السداد: {
                  order.paymentMethod === 'cash'
                    ? 'نقدًا كاش عند الاستلام'
                    : (order.paymentMethod === 'card' || (order.paymentMethod as string) === 'geidea')
                    ? 'بطاقة بنكية (فيزا / ماستركارد / ميزة) - جيديا'
                    : order.paymentMethod === 'instapay'
                    ? 'تحويل إنستاباي'
                    : order.paymentMethod === 'vodafone_cash'
                    ? 'محفظة فودافون كاش'
                    : 'دفع إلكتروني'
                }
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                order.paymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : order.paymentMethod === 'cash'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {order.paymentStatus === 'paid' ? 'تم استلام المبلغ بنكياً ✓' : order.paymentMethod === 'cash' ? 'تحصيل كاش عند التسليم' : 'بانتظار التحصيل'}
              </span>
            </div>
          </div>

          {/* Products List Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 font-['Cairo'] flex items-center gap-1.5">
                <Layers size={14} className="text-orange-500" />
                <span>المنتجات المطلوبة ({distinctCount})</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500">
                إجمالي {totalPieces} قطعة
              </span>
            </div>

            <div className="space-y-2">
              {order.items?.map(item => {
                const catProduct = productsCatalogMap.get(item.product?.id || '');
                const img = item.product?.imageUrl || catProduct?.imageUrl || '';
                const currentQty = itemQuantities[item.id] !== undefined ? itemQuantities[item.id] : item.quantity || 1;
                const unitPrice = item.product?.price || 0;
                const itemTotal = unitPrice * currentQty;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3"
                  >
                    {/* Product Image & Info */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {img ? (
                          <img
                            src={img}
                            alt={item.product?.name}
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package size={20} className="text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                          {item.product?.name}
                        </h4>
                        <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          سعر القطعة: {formatEGP(unitPrice)}
                        </div>
                        {item.notes && (
                          <p className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                            ملاحظة الصنف: {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls & Line Price */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => onAdjustQuantity(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-slate-900 tabular-nums">
                          {currentQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdjustQuantity(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      <div className="text-xs font-black text-slate-900 font-['Tajawal'] tabular-nums">
                        {formatEGP(itemTotal)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial Breakdown Summary */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>إجمالي المنتجات ({totalPieces} قطع)</span>
              <span className="font-bold tabular-nums">{formatEGP(order.subtotal || order.total)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Truck size={12} className="text-slate-400" />
                <span>رسوم التوصيل</span>
              </span>
              <span className="font-bold tabular-nums">{formatEGP(order.deliveryFee || 0)}</span>
            </div>

            {(order.discount || 0) > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-700">
                <span>خصم العرض</span>
                <span className="font-bold tabular-nums">- {formatEGP(order.discount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 font-['Cairo']">
                الإجمالي النهائي
              </span>
              <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-900 text-sm font-black font-['Tajawal'] tabular-nums">
                {formatEGP(order.total)}
              </span>
            </div>
          </div>

          {/* Customer Notes Banner */}
          <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-200/70 space-y-1">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
              <span>💬 ملاحظات العميل:</span>
            </span>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              {order.notes && order.notes.trim() ? order.notes : 'لا توجد ملاحظات إضافية مسجلة من العميل لهذا الطلب.'}
            </p>
          </div>

          {/* Courier Assignment Section (Visible if order is preparing or ready) */}
          {(order.orderStatus === 'preparing' || order.orderStatus === 'ready') && (
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 font-['Cairo'] flex items-center gap-1.5">
                  <Truck size={14} className="text-indigo-600" />
                  <span>تعيين مندوب للتوصيل</span>
                </h4>
                {order.courierName && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    المندوب الحالي: {order.courierName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCourier}
                  onChange={e => setSelectedCourier(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value="">اختر مندوباً من أسطول المتجر...</option>
                  {storeFleet.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.full_name || 'مندوب'} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!selectedCourier || isAssigningCourier}
                  onClick={() => onAssignCourier(selectedCourier)}
                  className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {isAssigningCourier ? <RotateCw size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>تكليف</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Sticky Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
          {/* Print Invoice Button */}
          <button
            type="button"
            onClick={onPrint}
            className="h-10 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
            title="طباعة فاتورة حرارية أو تقرير POS"
          >
            <Printer size={15} />
            <span>طباعة الفاتورة</span>
          </button>

          {/* Primary Action Button (Transitions status) */}
          {order.orderStatus === 'received' || order.orderStatus === 'pending' ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onAdvance('preparing')}
              className="flex-1 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? <RotateCw size={14} className="animate-spin" /> : <Check size={16} />}
              <span>قبول الطلب وبدء التجهيز</span>
            </button>
          ) : order.orderStatus === 'preparing' ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onAdvance('ready')}
              className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? <RotateCw size={14} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>تأكيد جاهزية الطلب للتسليم</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>إغلاق التفاصيل</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

