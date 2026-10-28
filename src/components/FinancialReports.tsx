import {adminApi} from '../lib/adminApi';
import React, { useState, useMemo, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Store as StoreIcon,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Printer,
  ChevronDown,
  Building,
  CreditCard,
  Banknote,
  Search,
} from "lucide-react";
import type { Order, Store } from "../types";
import { formatEGP } from "../utils/orderCalculations";
import { cairoDay } from "../utils/orderIntegration";

interface StoreSettlement {
  storeId: string;
  storeName: string;
  category: string;
  deliveredOrdersCount: number;
  grossSales: number;
  platformCommission: number;
  netPayout: number;
  commissionRate: number; // e.g. 10%
  payoutStatus: "pending" | "settled";
}

export function FinancialReports({
  orders,
  stores,
}: {
  orders: Order[];
  stores: Store[];
}) {
  const [datePeriod, setDatePeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [ledger,setLedger]=useState<any[]>([]);const [financeError,setFinanceError]=useState('');const [saving,setSaving]=useState(false);
  async function loadLedger(){try{const result=await adminApi('data',{action:'settlement-list'});setLedger(result.records);}catch(e){setFinanceError(e instanceof Error?e.message:'تعذر تحميل التسويات.');}}
  useEffect(()=>{void loadLedger()},[]);
  const settledStores=useMemo(()=>Object.fromEntries(stores.filter(store=>{const ids=orders.filter(o=>o.orderStatus==='delivered'&&o.items.some(i=>i.product.storeId===store.id)).map(o=>o.id);const paid=new Set(ledger.filter(r=>r.storeId===store.id).flatMap(r=>r.orderIds));return ids.length>0&&ids.every(id=>paid.has(id));}).map(store=>{const record=ledger.find(r=>r.storeId===store.id);return [store.id,{ref:record?.reference||'',date:record?.createdAt?new Date(record.createdAt).toLocaleDateString('ar-EG'):''}]})),[stores,orders,ledger]);

  // 1. Filter delivered orders based on period
  const deliveredOrders = useMemo(() => {
    const todayStr = cairoDay(new Date());
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      if (o.orderStatus !== "delivered") return false;

      // Date filtering
      if (datePeriod === "today") {
        const orderDay = cairoDay(o.deliveredAt || o.createdAt || "");
        if (orderDay !== todayStr) return false;
      } else if (datePeriod === "week") {
        const orderTime = new Date(o.deliveredAt || o.createdAt || 0).getTime();
        if (orderTime < oneWeekAgo) return false;
      } else if (datePeriod === "month") {
        const orderTime = new Date(o.deliveredAt || o.createdAt || 0).getTime();
        if (orderTime < oneMonthAgo) return false;
      }

      // Payment filter
      if (paymentFilter !== "all" && o.paymentMethod !== paymentFilter) return false;

      // Store filter
      if (selectedStoreId !== "all") {
        const hasStoreItem = o.items.some((i) => i.product.storeId === selectedStoreId);
        if (!hasStoreItem) return false;
      }

      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrder = String(o.orderNumber || "").includes(q);
        const matchesCustomer = (o.profileName || "").toLowerCase().includes(q);
        const matchesMinistry = (o.ministry || "").toLowerCase().includes(q);
        if (!matchesOrder && !matchesCustomer && !matchesMinistry) return false;
      }

      return true;
    });
  }, [orders, datePeriod, selectedStoreId, paymentFilter, searchQuery]);

  // 2. High-level financial totals
  const totalDeliveredOrders = deliveredOrders.length;
  const grossFoodSales = deliveredOrders.reduce((sum, o) => sum + (o.subtotal - (o.discount || 0)), 0);
  const totalDeliveryFees = deliveredOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
  const totalTips = deliveredOrders.reduce((sum, o) => sum + (o.tip || 0), 0);
  const totalGrossRevenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0);

  // Default platform commission: 10%
  const DEFAULT_COMMISSION_RATE = 0; // Uncontracted stores never inherit an invented 10% fee.
  const platformCommissionTotal = deliveredOrders.reduce((sum,o)=>sum+o.items.reduce((total,i)=>total+(i.product.price+i.extraPrice)*i.quantity*((stores.find(s=>s.id===i.product.storeId)?.commissionRate||0)/100),0),0);
  const netDueToRestaurants = grossFoodSales - platformCommissionTotal;

  // 3. Store-level settlement calculation
  const storeSettlements = useMemo<StoreSettlement[]>(() => {
    return stores.map<StoreSettlement>((store) => {
      let storeOrdersCount = 0;
      let storeGross = 0;

      deliveredOrders.forEach((o) => {
        const storeItems = o.items.filter((i) => i.product.storeId === store.id);
        if (storeItems.length > 0) {
          storeOrdersCount++;
          const itemsTotal = storeItems.reduce(
            (sum, item) => sum + (item.product.price + item.extraPrice) * item.quantity,
            0
          );
          storeGross += itemsTotal;
        }
      });

      const commission = storeGross * ((store.commissionRate||0)/100);
      const net = storeGross - commission;
      const isSettled = Boolean(settledStores[store.id]);

      return {
        storeId: store.id,
        storeName: store.name,
        category: store.category || "مطعم",
        deliveredOrdersCount: storeOrdersCount,
        grossSales: storeGross,
        platformCommission: commission,
        netPayout: net,
        commissionRate: store.commissionRate??0,
        payoutStatus: isSettled ? "settled" : "pending",
      };
    }).filter((s) => s.deliveredOrdersCount > 0 || selectedStoreId === "all");
  }, [stores, deliveredOrders, settledStores, selectedStoreId]);

  const handleSettleStore = async (storeId:string,_storeName:string) => {
    if(saving)return;setFinanceError('');setSaving(true);
    try{const paid=new Set(ledger.filter(r=>r.storeId===storeId).flatMap(r=>r.orderIds));const orderIds=deliveredOrders.filter(o=>!paid.has(o.id)&&o.items.some(i=>i.product.storeId===storeId)).map(o=>o.id);
      if(!orderIds.length)throw new Error('لا توجد طلبات جديدة للتسوية في الفترة المحددة.');
      const preview=await adminApi('data',{action:'settlement-preview',storeId,orderIds});
      if(!confirm(`صافي التسوية ${formatEGP(preview.quote.net)}، العمولة ${formatEGP(preview.quote.commission)}. تُسجّل هذه العملية تحويلًا منفذًا خارج المنصة ولا تنفذ تحويلًا بنكيًا. هل تتابع؟`))return;
      const reference=prompt('اكتب مرجع التحويل الفعلي:');if(!reference?.trim())return;
      await adminApi('data',{action:'settlement-save',id:crypto.randomUUID(),storeId,orderIds,quoteHash:preview.quoteHash,reference});await loadLedger();
    }catch(e){setFinanceError(e instanceof Error?e.message:'تعذر تسجيل التسوية.');}finally{setSaving(false);}
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section dir="rtl" className="financial-reports-section space-y-6" aria-label="التقارير المالية وفواتير المتاجر">
      {financeError&&<p role="alert" className="p-3 text-red-800 bg-red-50">{financeError}</p>}<p className="p-3 text-sm text-slate-600">الأرقام تقديرية؛ المبلغ النهائي ونسبة التعاقد يراجعان من الخادم قبل تسجيل التحويل الفعلي.</p>
      {/* Top Header Bar */}
      <header className="bg-white p-5 rounded-3xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              <DollarSign size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 m-0">التقارير المالية وحسابات المتاجر</h1>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                تصفية الإيرادات، عمولات المنصة، وصافي مستحقات أصحاب المطابخ والمتاجر
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Selector */}
          <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            {(
              [
                ["today", "اليوم"],
                ["week", "آخر 7 أيام"],
                ["month", "هذا الشهر"],
                ["all", "كل الفترات"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDatePeriod(key)}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  datePeriod === key
                    ? "bg-white text-slate-900 shadow-xs font-black"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Printer size={15} />
            طباعة التقرير
          </button>
        </div>
      </header>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Delivered Value */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي تحصيلات الطلبات</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Receipt size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-slate-900 block font-mono">
            {formatEGP(totalGrossRevenue)}
          </strong>
          <p className="text-[11px] text-slate-400 m-0">من {totalDeliveredOrders} طلب مسلّم بالحي الحكومي</p>
        </div>

        {/* Metric 2: Net Food Sales */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">مبيعات الأصناف (الأغذية)</span>
            <span className="w-8 h-8 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
              <StoreIcon size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-slate-900 block font-mono">
            {formatEGP(grossFoodSales)}
          </strong>
          <p className="text-[11px] text-slate-400 m-0">مستحقات المتاجر + عمولة المنصة</p>
        </div>

        {/* Metric 3: Platform Commission */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">عمولة المنصة التقديرية حسب التعاقد</span>
            <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <TrendingUp size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-purple-900 block font-mono">
            {formatEGP(platformCommissionTotal)}
          </strong>
          <p className="text-[11px] text-purple-600 m-0">صافي عائد سنجوب</p>
        </div>

        {/* Metric 4: Due to Stores */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">صافي مستحقات المتاجر</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Banknote size={17} />
            </span>
          </div>
          <strong className="text-2xl font-black text-blue-900 block font-mono">
            {formatEGP(netDueToRestaurants)}
          </strong>
          <p className="text-[11px] text-blue-600 m-0">واجبة التحويل لأصحاب المطاعم</p>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الطلب، العميل، أو الوزارة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>

          {/* Filter by store */}
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold"
          >
            <option value="all">كل المتاجر ({stores.length})</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Filter by payment method */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold"
          >
            <option value="all">كل طرق الدفع</option>
            <option value="cash">كاش عند الاستلام</option>
            <option value="instapay">إنستا باي (InstaPay)</option>
            <option value="geidea">بطاقة جيديا (Geidea)</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          تم العثور على <b>{deliveredOrders.length}</b> طلب تسليم مكتمل
        </div>
      </div>

      {/* Store Settlements Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 m-0">تسوية مستحقات المطاعم والمتاجر</h2>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              حساب نسب العمولة وصافي المبالغ المحولة لكل شريك
            </p>
          </div>
          <span className="text-xs font-bold bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
            العمولة حسب نسبة التعاقد المسجلة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">المتجر / الشريك</th>
                <th className="py-3 px-4 font-bold text-center">الطلبات المسلمة</th>
                <th className="py-3 px-4 font-bold">إجمالي المبيعات</th>
                <th className="py-3 px-4 font-bold">عمولة المنصة</th>
                <th className="py-3 px-4 font-bold">صافي مستحق المتجر</th>
                <th className="py-3 px-4 font-bold text-center">حالة التحويل</th>
                <th className="py-3 px-4 font-bold text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storeSettlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا توجد مبيعات مسجلة لهذه الفترة
                  </td>
                </tr>
              ) : (
                storeSettlements.map((settlement) => {
                  const settledInfo = settledStores[settlement.storeId];

                  return (
                    <tr key={settlement.storeId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 text-sm">{settlement.storeName}</div>
                        <span className="text-[10px] text-slate-400">{settlement.category}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold font-mono">
                          {settlement.deliveredOrdersCount}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {formatEGP(settlement.grossSales)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700">
                        {formatEGP(settlement.platformCommission)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-black text-blue-700 text-sm">
                        {formatEGP(settlement.netPayout)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {settledInfo ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px] flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              تم التحويل
                            </span>
                            <span className="text-[9px] text-slate-400 mt-0.5" title={settledInfo.ref}>
                              {settledInfo.date}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px] flex items-center gap-1">
                            <Clock size={12} />
                            معلق للتسوية
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          disabled={saving || Boolean(settledInfo)} onClick={() => void handleSettleStore(settlement.storeId, settlement.storeName)}
                          className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition-colors"
                        >
                          {settledInfo ? "تعديل المرجع" : "تسجيل التحويل"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
