import { useEffect, useState } from 'react';
import { operationsApi } from '../lib/operationsApi';
import { formatEGP } from '../utils/orderCalculations';
import { customerMessage } from '../utils/customerMessage';
import { Users, CreditCard, ShieldCheck, ShoppingBag, Sparkles, Clock, RefreshCw, AlertCircle, ArrowUpRight } from 'lucide-react';

export function MerchantRecords({ kind, storeId }: { kind: 'customers' | 'payments'; storeId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setItems([]);
    setCursor(null);

    operationsApi('operations', { action: 'store-' + kind, storeId })
      .then((r) => {
        if (active) {
          setItems(Array.isArray(r.items) ? r.items : []);
          setCursor(r.nextCursor || null);
          setTruncated(Boolean(r.truncated));
        }
      })
      .catch((e) => {
        if (active) setError(customerMessage(e, 'تعذر تحميل السجلات.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [kind, storeId, revision]);

  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    setError('');
    try {
      const r = await operationsApi('operations', { action: 'store-' + kind, storeId, cursor });
      setItems((previous) => [...new Map([...previous, ...(r.items || [])].map((v) => [v.id, v])).values()]);
      setCursor(r.nextCursor || null);
    } catch (e) {
      setError(customerMessage(e, 'تعذر تحميل المزيد.'));
    } finally {
      setLoading(false);
    }
  }

  // Summary Metrics
  const totalCustomers = items.length;
  const loyalCustomers = items.filter((c) => (c.orderCount || c.orderIds?.length || 0) >= 2).length;
  const totalSpend = items.reduce((sum, c) => sum + (Number(c.totalSpent) || 0), 0);

  return (
    <section className="space-y-5 animate-in fade-in duration-200" aria-label={kind === 'customers' ? 'عملاء المتجر' : 'تسويات المتجر'} dir="rtl">
      {/* ── Top Header Card ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-2xs ${
              kind === 'customers' ? 'bg-orange-600' : 'bg-emerald-600'
            }`}>
              {kind === 'customers' ? <Users size={22} /> : <CreditCard size={22} />}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {kind === 'customers' ? 'العملاء المرتبطون بطلبات المتجر' : 'سجل التسويات والتحصيلات المعتمدة'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {kind === 'customers'
                  ? 'سجل العملاء الذين قاموا بالطلب من متجرك عبر المنظومة مع مؤشرات التكرار والولاء.'
                  : 'بيانات التسويات المحاسبية للمبيعات المنجزة ونسب العمولات المعتمدة من الإدارة.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRevision((v) => v + 1)}
            disabled={loading}
            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>تحديث</span>
          </button>
        </div>

        {/* ── Privacy & Platform Policy Banner ── */}
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldCheck size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold">سياسة حماية المنظومة وخصوصية العملاء: </strong>
            <span className="text-amber-800">
              {kind === 'customers'
                ? 'تظهر أسماء العملاء ومراجع فواتيرهم المباشرة لمتجرك لخدمة المتابعة التشغيلية وقياس الولاء. تُحجب أرقام الهواتف الشخصية والعناوين الدائمة لحماية خصوصية العملاء والتوافق مع معايير المنصة.'
                : 'هذه السجلات للمبيعات المكتملة المسلمة وفق معايير اللوحة المركزية وتخضع للمراجعة الدورية.'}
            </span>
          </div>
        </div>

        {/* ── Quick KPI Stat Pills (for customers) ── */}
        {kind === 'customers' && !loading && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 block">إجمالي العملاء المباشرين</span>
              <strong className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{totalCustomers}</strong>
            </div>
            <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-200/60">
              <span className="text-[10px] font-bold text-indigo-700 block">عملاء دائمون (متكررو الطلب)</span>
              <strong className="text-lg font-black text-indigo-900 font-mono mt-0.5 block">{loyalCustomers}</strong>
            </div>
            {totalSpend > 0 && (
              <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-emerald-700 block">إجمالي مشترياتهم من متجرك</span>
                <strong className="text-lg font-black text-emerald-900 font-mono mt-0.5 block">{formatEGP(totalSpend)}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
          <RefreshCw size={24} className="animate-spin text-orange-600 mx-auto" />
          <p className="text-xs font-bold text-slate-600">جارٍ تحميل بيانات المتجر من قاعدة البيانات…</p>
        </div>
      )}

      {/* ── Error State ── */}
      {error && !loading && (
        <div className="p-5 bg-rose-50 text-rose-800 rounded-3xl border border-rose-200 flex items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setRevision((v) => v + 1)}
            className="px-3 py-1 bg-white hover:bg-rose-100 rounded-xl border border-rose-300 cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && items.length === 0 && (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
            {kind === 'customers' ? <Users size={28} /> : <CreditCard size={28} />}
          </div>
          <h3 className="text-sm font-black text-slate-800">
            {kind === 'customers' ? 'لا توجد طلبات عملاء مسجلة لهذا المتجر بعد' : 'لا توجد تسويات مالية مسجلة بعد'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {kind === 'customers'
              ? 'عند إتمام أول طلب ناجح من قِبل عملاء المنصة لمتجرك، سيظهر العميل هنا تلقائياً مع عدد طلباته ومراجع فواتيره.'
              : 'تظهر التسويات هنا بعد تسليم الطلبات واحتساب نسبة العمولة المعتمدة.'}
          </p>
        </div>
      )}

      {/* ── Data Grid ── */}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {items.map((item) => {
            const count = item.orderCount || item.orderIds?.length || 1;
            const isLoyal = count >= 2;

            return (
              <article
                key={item.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-orange-300 transition-all shadow-2xs space-y-3 flex flex-col justify-between"
              >
                {kind === 'customers' ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center text-xs font-black shrink-0">
                          {item.name ? item.name.slice(0, 2) : '👤'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 truncate">{item.name}</h4>
                          <span className="text-[10px] text-slate-400 block truncate">
                            معرّف العميل: {String(item.id).slice(0, 8)}…
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                          isLoyal ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isLoyal ? 'عميل دائم 🌟' : 'طلب أول 🌱'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">الطلبات المسجلة:</span>
                        <strong className="text-slate-900 font-black font-mono">{count} طلب</strong>
                      </div>
                      {item.totalSpent > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold">إجمالي المشتريات:</span>
                          <strong className="text-emerald-700 font-black font-mono">{formatEGP(item.totalSpent)}</strong>
                        </div>
                      )}
                      {item.lastOrderAt && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-200/60">
                          <span>آخر طلب:</span>
                          <span>{new Date(item.lastOrderAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      )}
                    </div>

                    {/* Order Reference Badges */}
                    {Array.isArray(item.orderIds) && item.orderIds.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block">مراجع الفواتير والطلبات:</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {item.orderIds.slice(0, 4).map((oid: string) => (
                            <span
                              key={oid}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-mono font-bold"
                            >
                              #{String(oid).slice(-6)}
                            </span>
                          ))}
                          {item.orderIds.length > 4 && (
                            <span className="text-[10px] text-slate-400 font-bold">+{item.orderIds.length - 4} طلبات أخرى</span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-slate-900">تسوية مالية #{String(item.id).slice(-8)}</h4>
                        <span className="text-[10px] text-slate-400 block">{item.reference || 'مبيعات طلبات منجزة'}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        معتمدة ✓
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">إجمالي المبيعات:</span>
                        <strong className="text-slate-900 font-black font-mono">{formatEGP(item.gross)}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">عمولة المنصة:</span>
                        <strong className="text-rose-600 font-black font-mono">-{formatEGP(item.commission)}</strong>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-emerald-800 font-black">الصافي للمتجر:</span>
                        <strong className="text-emerald-700 font-black font-mono text-sm">{formatEGP(item.net)}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{item.orderCount} طلب مكتمل</span>
                      {item.createdAt && <span>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── Pagination / Load More ── */}
      {cursor && (
        <div className="text-center pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void more()}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            تحميل المزيد من السجلات
          </button>
        </div>
      )}
    </section>
  );
}
