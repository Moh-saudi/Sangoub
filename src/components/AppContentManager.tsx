import { useEffect, useRef, useState, type FormEvent, useMemo } from 'react';
import {
  Plus, ArrowUp, ArrowDown, X, Megaphone, Image as ImageIcon, Upload, Check, Trash2, Eye, EyeOff,
  Search, ExternalLink, RefreshCw, Layers, LayoutGrid, List, Sparkles, ShoppingBag, Store as StoreIcon, Tag
} from 'lucide-react';
import type { Product, Store } from '../types';
import { defaultCustomerHome, type CustomerHome, type Promotion } from '../types/appContent';
import { operationsApi } from '../lib/operationsApi';
import { cairoDateInput, cairoInputToIso } from '../utils/cairoTime';
import { uploadCatalogImage } from '../lib/catalogImages';
import { DEFAULT_SANGOUB_BANNERS } from '../storefront/types/banner';
import { formatEGP } from '../utils/orderCalculations';

interface GalleryItem {
  id: string;
  title: string;
  url: string;
  addedAt: string;
}

const labels = { slider: 'سلايدر العروض', stores: 'المتاجر', offers: 'المنتجات المخفضة', products: 'المنتجات والتصنيفات' };

const FIX_APP_CONTENT_SQL = `-- تفعيل صلاحية حفظ وتعديل السلايدر في Supabase SQL Editor
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_content TO authenticated;
GRANT SELECT ON public.app_content TO anon;

ALTER TABLE public.app_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated all app_content" ON public.app_content;
CREATE POLICY "Allow authenticated all app_content" ON public.app_content
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read app_content" ON public.app_content;
CREATE POLICY "Public read app_content" ON public.app_content
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.app_content (id, content) VALUES (true, '{}'::jsonb) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.save_sangoub_app_content(p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.app_content (id, content, updated_at)
  VALUES (true, p_content, now())
  ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = now();
  RETURN p_content;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_sangoub_app_content(jsonb) TO authenticated, anon;`;

export function AppContentManager({ stores, products }: { stores: Store[]; products: Product[] }) {
  const [config, setConfig] = useState<CustomerHome>(structuredClone(defaultCustomerHome));
  const [campaigns, setCampaigns] = useState<Promotion[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [sqlCopied, setSqlCopied] = useState(false);

  // View mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Slide Editor State
  const [editor, setEditor] = useState<{ campaign?: Promotion } | null>(null);
  const [targetType, setTargetType] = useState<'product' | 'store' | 'category' | 'offers' | 'none' | 'url'>('product');
  const [targetId, setTargetId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [slidePriority, setSlidePriority] = useState(10);
  const [slideEnabled, setSlideEnabled] = useState(true);

  // Gallery & Direct Replacement Modals
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [targetCampaignForReplacement, setTargetCampaignForReplacement] = useState<Promotion | null>(null);

  const dialog = useRef<HTMLDialogElement>(null);
  const galleryDialog = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryUploadRef = useRef<HTMLInputElement>(null);
  const directReplaceInputRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  // Orange Mart Banner State
  const [martBanner, setMartBanner] = useState({
    enabled: true,
    title: 'سنجوب ماركت وكل طلبات البيت لحد بابك',
    badge: 'سنجوب بقالة ⚡',
    areaText: 'العاصمة وكافة المناطق',
    btnText: 'تسوق الآن',
    targetCategory: 'سوبرماركت',
    bgGradient: 'from-[#FF5900] via-[#FF6A1A] to-[#FF4500]'
  });
  const [martBannerSaving, setMartBannerSaving] = useState(false);

  // Initial Data Fetching & Sync
  useEffect(() => {
    let active = true;
    setError('');
    operationsApi('app-content', { action: 'admin' })
      .then(result => {
        if (!active) return;
        if (!dirty.current && result?.config) {
          setConfig({
            ...defaultCustomerHome,
            ...result.config,
            sections: Array.isArray(result.config?.sections) && result.config.sections.length > 0
              ? result.config.sections
              : defaultCustomerHome.sections
          });
        }

        // Initialize campaigns with default Sangoub slides if empty
        const incomingCampaigns: Promotion[] = (Array.isArray(result?.campaigns) && result.campaigns.length > 0)
          ? result.campaigns
          : (Array.isArray(result?.slides) && result.slides.length > 0)
          ? result.slides
          : DEFAULT_SANGOUB_BANNERS.map((b, idx) => ({
              id: String(b.id || `slide-${idx + 1}`),
              title: b.title || '',
              subtitle: b.subtitle || '',
              imageUrl: b.imageUrl || b.image || '',
              enabled: true,
              priority: (idx + 1) * 10,
              targetType: (b.targetType as any) || 'offers',
              targetId: b.targetId || '',
              startsAt: new Date(Date.now() - 86400000).toISOString(),
              endsAt: new Date(Date.now() + 365 * 86400000).toISOString(),
              hideOverlay: true,
              hideButton: true,
              btnText: '',
            }));

        setCampaigns(incomingCampaigns);

        // Initialize gallery with slide images if empty
        const incomingGallery: GalleryItem[] = (Array.isArray(result?.gallery) && result.gallery.length > 0)
          ? result.gallery
          : incomingCampaigns.map((c, i) => ({
              id: `gal-default-${i + 1}`,
              title: c.title || `صورة شريحة ${i + 1}`,
              url: c.imageUrl,
              addedAt: new Date().toISOString()
            }));

        setGallery(incomingGallery);

        if (result.martBanner) setMartBanner(result.martBanner);
        setReady(true);
        setLoaded(true);
      })
      .catch(err => {
        if (active) setError(err.message || 'تعذر تحميل بيانات السلايدر.');
      });
    return () => { active = false; };
  }, [revision]);

  // Handle Editor Open/Close
  useEffect(() => {
    if (editor) {
      const camp = editor.campaign;
      setCurrentImageUrl(camp?.imageUrl || '');
      setTargetType((camp?.targetType as any) || (products[0] ? 'product' : 'offers'));
      setTargetId(camp?.targetId || (camp?.targetType === 'product' ? (products[0]?.id || '') : ''));
      setSlidePriority(camp?.priority ?? (campaigns.length + 1) * 10);
      setSlideEnabled(camp?.enabled ?? true);
      setProductSearch('');
      setShowAdvancedSettings(Boolean(camp?.title || camp?.subtitle));
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [editor]);

  // Handle Gallery Modal
  useEffect(() => {
    if (isGalleryModalOpen) {
      galleryDialog.current?.showModal();
    } else {
      galleryDialog.current?.close();
    }
  }, [isGalleryModalOpen]);

  // Categories list derived from products
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered Products for Destination Picker
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 24);
    const q = productSearch.toLowerCase().trim();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.storeName && p.storeName.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [products, productSearch]);

  const selectedProductObj = useMemo(() => {
    if (targetType !== 'product' || !targetId) return null;
    return products.find(p => p.id === targetId) || null;
  }, [targetType, targetId, products]);

  const selectedStoreObj = useMemo(() => {
    if (targetType !== 'store' || !targetId) return null;
    return stores.find(s => s.id === targetId) || null;
  }, [targetType, targetId, stores]);

  // Core API Mutation
  async function perform(body: object, success: string, close = false) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operationsApi('app-content', body);
      if ((body as { action?: string }).action === 'save-home') {
        dirty.current = false;
        try {
          const cached = localStorage.getItem('sangoub_cached_app_content');
          const parsed = cached ? JSON.parse(cached) : {};
          parsed.config = (body as any).config;
          localStorage.setItem('sangoub_cached_app_content', JSON.stringify(parsed));
        } catch {}
      }
      try {
        localStorage.removeItem('sangoub_cached_banners_v2');
        window.dispatchEvent(new CustomEvent('sangoub_banners_updated'));
      } catch {}
      setNotice(success);
      if (close) setEditor(null);
      setRevision(value => value + 1);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setBusy(false);
    }
  }

  // Open Editor Modal for Add or Edit
  function openEditor(campaign?: Promotion) {
    setError('');
    setTargetCampaignForReplacement(null);
    setEditor({ campaign });
  }

  // Quick 1-Click Replace Trigger
  function triggerDirectImageReplace(campaign: Promotion) {
    setTargetCampaignForReplacement(campaign);
    directReplaceInputRef.current?.click();
  }

  // Upload and Apply Image Directly to a Slide
  async function handleDirectReplaceFile(file: File) {
    if (!targetCampaignForReplacement) return;
    setUploadingImage(true);
    setError('');
    setNotice('');
    try {
      const res = await uploadCatalogImage('banners', 'slider', file);
      await applyImageToCampaign(targetCampaignForReplacement, res.url);
    } catch (err: any) {
      setError(err.message || 'تعذر رفع واستبدال الصورة.');
    } finally {
      setUploadingImage(false);
      setTargetCampaignForReplacement(null);
    }
  }

  // Apply Selected Gallery or Uploaded Image to Slide
  async function applyImageToCampaign(campaign: Promotion, imageUrl: string) {
    setBusy(true);
    setError('');
    try {
      const updated: Promotion = {
        ...campaign,
        imageUrl,
        hideOverlay: true,
        hideButton: true,
      };
      await operationsApi('app-content', { action: 'save-campaign', id: campaign.id, campaign: updated });
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? updated : c));
      try {
        localStorage.removeItem('sangoub_cached_banners_v2');
        window.dispatchEvent(new CustomEvent('sangoub_banners_updated'));
      } catch {}
      setNotice('تم استبدال صورة الشريحة بنجاح وتحديث سلايدر المتجر فوراً! 🚀');
      setTargetCampaignForReplacement(null);
      setIsGalleryModalOpen(false);
      setRevision(v => v + 1);
    } catch (err: any) {
      setError(err.message || 'تعذر استبدال الصورة.');
    } finally {
      setBusy(false);
    }
  }

  // Upload Image to Gallery / Editor
  async function handleFileUpload(file: File, forEditor = false) {
    setUploadingImage(true);
    setError('');
    setNotice('');
    try {
      const res = await uploadCatalogImage('banners', 'slider', file);
      const newItem: GalleryItem = {
        id: `gal-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        url: res.url,
        addedAt: new Date().toISOString()
      };
      await operationsApi('app-content', { action: 'add-to-gallery', item: newItem });
      setGallery(prev => [newItem, ...prev.filter(g => g.url !== newItem.url)]);
      if (forEditor) {
        setCurrentImageUrl(res.url);
      }
      setNotice('تم رفع الصورة وحفظها بنجاح!');
    } catch (err: any) {
      setError(err.message || 'تعذر رفع الصورة.');
    } finally {
      setUploadingImage(false);
    }
  }

  // Toggle Active/Inactive
  async function toggleCampaign(id: string) {
    setBusy(true);
    setError('');
    try {
      await operationsApi('app-content', { action: 'toggle-campaign', id });
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
      setNotice('تم تحديث حالة ظهور الشريحة في المتجر.');
      setRevision(v => v + 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Delete from Gallery
  async function deleteFromGallery(id: string) {
    if (!window.confirm('هل تريد حذف هذه الصورة من المعرض؟')) return;
    try {
      await operationsApi('app-content', { action: 'delete-from-gallery', id });
      setGallery(prev => prev.filter(g => g.id !== id));
      setNotice('تم حذف الصورة من المعرض.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Save Slide (Add or Edit)
  async function handleSaveSlide(e: FormEvent) {
    e.preventDefault();
    if (!currentImageUrl.trim()) {
      setError('يرجى اختيار صورة لشريحة السلايدر أولاً.');
      return;
    }

    if (targetType === 'product' && !targetId) {
      setError('يرجى اختيار المنتج المستهدف عند النقر على الشريحة.');
      return;
    }

    if (targetType === 'store' && !targetId) {
      setError('يرجى اختيار المتجر المستهدف.');
      return;
    }

    try {
      const id = editor?.campaign?.id || `slide-${Date.now()}`;
      const payload: Promotion = {
        id,
        title: editor?.campaign?.title || '',
        subtitle: editor?.campaign?.subtitle || '',
        imageUrl: currentImageUrl.trim(),
        enabled: slideEnabled,
        priority: Number(slidePriority) || 10,
        targetType: targetType as any,
        targetId: targetId.trim(),
        startsAt: editor?.campaign?.startsAt || new Date(Date.now() - 86400000).toISOString(),
        endsAt: editor?.campaign?.endsAt || new Date(Date.now() + 365 * 86400000).toISOString(),
        hideOverlay: true,
        hideButton: true,
        btnText: '',
      };

      await perform(
        { action: 'save-campaign', id, campaign: payload },
        'تم حفظ شريحة السلايدر وتحديث المتجر فوراً! 🚀',
        true
      );
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الحفظ.');
    }
  }

  // Destination Text Helper
  function getDestinationDescription(camp: Promotion) {
    if (camp.targetType === 'product') {
      const prod = products.find(p => p.id === camp.targetId);
      return {
        icon: '🍔',
        typeLabel: 'منتج محدد',
        mainText: prod ? prod.name : 'منتج للطلب المباشر',
        subText: prod ? `${formatEGP(prod.price)} • ${prod.storeName || 'متجر سنجوب'}` : '',
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    }
    if (camp.targetType === 'store') {
      const st = stores.find(s => s.id === camp.targetId);
      return {
        icon: '🏪',
        typeLabel: 'متجر محدد',
        mainText: st ? st.name : 'متجر في سنجوب',
        subText: st?.category || '',
        badgeColor: 'bg-blue-50 text-blue-800 border-blue-200'
      };
    }
    if (camp.targetType === 'category') {
      return {
        icon: '📁',
        typeLabel: 'قسم / تصنيف',
        mainText: camp.targetId || 'كل الأقسام',
        subText: 'تصفية المنتجات حسب القسم',
        badgeColor: 'bg-purple-50 text-purple-800 border-purple-200'
      };
    }
    if (camp.targetType === 'none') {
      return {
        icon: '🖼️',
        typeLabel: 'للعرض فقط',
        mainText: 'صورة إعلانية بدون توجيه',
        subText: 'لا تنقل لصفحة أخرى عند النقر',
        badgeColor: 'bg-slate-50 text-slate-700 border-slate-200'
      };
    }
    return {
      icon: '🏷️',
      typeLabel: 'صفحة العروض',
      mainText: 'جميع العروض والتخفيضات الحصرية',
      subText: 'يوجه إلى /offers',
      badgeColor: 'bg-orange-50 text-orange-800 border-orange-200'
    };
  }

  return (
    <section className="space-y-6 font-['Cairo',sans-serif]" aria-label="إدارة واجهة التطبيق والسلايدر" dir="rtl">

      {/* Hidden File Inputs for Direct Operations */}
      <input
        type="file"
        ref={directReplaceInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleDirectReplaceFile(file);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={galleryUploadRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (targetCampaignForReplacement) {
              void handleDirectReplaceFile(file);
            } else {
              void handleFileUpload(file);
            }
          }
          e.target.value = '';
        }}
      />

      {/* ── Top Header ── */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-pulse"></span>
            <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">سلايدر الواجهة الرئيسية</p>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">إدارة صور السلايدر والوجهات</h1>
          <p className="text-xs text-slate-500 mt-1">
            تحكم كامل في صور السلايدر المعروضة للعميل. يمكنك استبدال الصور بضغطة واحدة، وتحديد وجهة النقر (منتج محدد، متجر، أو عروض) بدون أزرار مشوهة فوق الصورة.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            onClick={() => {
              setTargetCampaignForReplacement(null);
              setIsGalleryModalOpen(true);
            }}
          >
            <ImageIcon size={16} className="text-orange-600" />
            <span>معرض الصور ({gallery.length})</span>
          </button>

          <button
            type="button"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            disabled={!loaded || busy}
            onClick={() => openEditor()}
          >
            <Plus size={18} />
            <span>إضافة شريحة سلايدر جديدة</span>
          </button>
        </div>
      </header>

      {/* Notification and Error Alerts */}
      {error === 'PERMISSION_DENIED_APP_CONTENT' ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-3 font-bold text-amber-950 mb-2" dir="rtl">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="text-base">🔒</span>
            <span className="font-black text-sm">تعديل السلايدر يتطلب تشغيل سكريبت الصلاحيات لمرة واحدة في Supabase</span>
          </div>
          <p className="font-normal text-amber-900 leading-relaxed">
            تم حفظ تعديلاتك محلياً بشكل مؤقت. لكي يتم حفظ تعديلات السلايدر في قاعدة بيانات Supabase نهائياً وتظهر لجميع العملاء، يرجى تشغيل سكريبت الصلاحيات لمرة واحدة في <strong>Supabase Dashboard &gt; SQL Editor</strong>.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(FIX_APP_CONTENT_SQL);
                  setSqlCopied(true);
                  setTimeout(() => setSqlCopied(false), 3000);
                } catch {}
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <span>{sqlCopied ? 'تم نسخ كود SQL بنجاح ✓' : 'نسخ كود تفعيل الصلاحيات (SQL) 📋'}</span>
            </button>
            <span className="text-[11px] text-amber-700 font-normal">الكود متوفر أيضاً بالملف: <code>scripts/supabase_fix_app_content_and_analytics.sql</code></span>
          </div>
        </div>
      ) : error ? (
        <div role="alert" className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      ) : null}
      {notice && (
        <div role="status" className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <span>✅</span>
          <span>{notice}</span>
        </div>
      )}

      {!loaded ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200" role="status">
          <RefreshCw className="animate-spin text-orange-600 mx-auto mb-3" size={28} />
          <p className="text-sm font-bold text-slate-700">جارٍ تحميل وتحديث شرائح السلايدر…</p>
        </div>
      ) : (
        <>
          {/* ── Main Active Slides Section (Cards & Table) ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>شرائح السلايدر الحالية المعروضة في المتجر</span>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2.5 py-0.5 rounded-full font-black">
                    {campaigns.length} شرائح
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تظهر هذه الشرائح كبنرات مصممة نقية بدون أي نصوص أو أزرار إضافية فوق الصورة، وتوجه العميل فوراً عند النقر للوجهة المحددة.
                </p>
              </div>

              {/* View Switcher: Cards vs Table */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid size={14} />
                  <span>عرض الكروت المصورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-orange-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <List size={14} />
                  <span>عرض الجدول</span>
                </button>
              </div>
            </div>

            {/* 1. VISUAL CARDS VIEW */}
            {viewMode === 'cards' && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...campaigns].sort((a, b) => a.priority - b.priority).map((campaign, idx) => {
                  const dest = getDestinationDescription(campaign);
                  return (
                    <div
                      key={campaign.id}
                      className={`group relative bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                        campaign.enabled ? 'border-slate-200 hover:border-orange-400 hover:shadow-md' : 'border-slate-200 opacity-60 bg-slate-50'
                      }`}
                    >
                      {/* Slide Banner Image Preview */}
                      <div className="relative aspect-[16/7] w-full bg-slate-900 overflow-hidden">
                        <img
                          src={campaign.imageUrl}
                          alt={campaign.title || 'شريحة سلايدر'}
                          className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />

                        {/* Top Badges: Priority & Status */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                          <span className="bg-black/75 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                            ترتيب #{idx + 1}
                          </span>
                        </div>

                        <div className="absolute top-2.5 left-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black shadow-xs flex items-center gap-1 ${
                              campaign.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {campaign.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
                            <span>{campaign.enabled ? 'مفعلة' : 'موقوفة'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Destination Details / Map */}
                      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs">{dest.icon}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase">{dest.typeLabel}</span>
                          </div>
                          <h3 className="text-xs font-black text-slate-900 line-clamp-1">
                            {dest.mainText}
                          </h3>
                          {dest.subText && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {dest.subText}
                            </p>
                          )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => triggerDirectImageReplace(campaign)}
                            className="flex-1 py-1.5 px-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-black flex items-center justify-center gap-1 transition cursor-pointer"
                            title="رفع واستبدال صورة الشريحة مباشرة من جهازك"
                          >
                            <RefreshCw size={12} />
                            <span>استبدال الصورة 🔄</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditor(campaign)}
                            className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                            title="تعديل الوجهة وترتيب الشريحة"
                          >
                            تعديل
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleCampaign(campaign.id)}
                            className={`p-1.5 rounded-xl border transition cursor-pointer ${
                              campaign.enabled
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                            title={campaign.enabled ? 'إيقاف مؤقت' : 'تفعيل العرض'}
                          >
                            {campaign.enabled ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('هل تريد حذف هذه الشريحة من السلايدر؟ (ستظل صورتها محفوظة في الجاليري دائماً).')) {
                                void perform({ action: 'delete-campaign', id: campaign.id }, 'تم حذف الشريحة بنجاح.');
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                            title="حذف الشريحة"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. TABLE VIEW */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3">صورة البانر</th>
                      <th className="p-3">الوجهة عند النقر (Click Map)</th>
                      <th className="p-3">الترتيب</th>
                      <th className="p-3">حالة الظهور</th>
                      <th className="p-3 text-center">الإجراءات المباشرة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...campaigns].sort((a, b) => a.priority - b.priority).map((campaign, idx) => {
                      const dest = getDestinationDescription(campaign);
                      return (
                        <tr key={campaign.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3">
                            <div className="w-24 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shrink-0 shadow-2xs">
                              <img
                                src={campaign.imageUrl}
                                alt={campaign.title || 'شريحة'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span>{dest.icon}</span>
                              <span className="font-black text-slate-900">{dest.mainText}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${dest.badgeColor}`}>
                              {dest.typeLabel} {dest.subText ? `• ${dest.subText}` : ''}
                            </span>
                          </td>
                          <td className="p-3 font-black text-slate-700">
                            #{idx + 1}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => toggleCampaign(campaign.id)}
                              className={`px-2.5 py-1 rounded-xl font-black text-[11px] flex items-center gap-1 transition cursor-pointer ${
                                campaign.enabled
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              {campaign.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                              <span>{campaign.enabled ? 'مفعلة وتظهر' : 'موقوفة'}</span>
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => triggerDirectImageReplace(campaign)}
                                className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg font-black text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <RefreshCw size={11} />
                                <span>استبدال الصورة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditor(campaign)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition cursor-pointer"
                              >
                                تعديل
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('هل تريد حذف هذه الشريحة؟')) {
                                    void perform({ action: 'delete-campaign', id: campaign.id }, 'تم حذف الشريحة بنجاح.');
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Fixed Mart Banner Manager (شريط سنجوب ماركت الثابت) ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
                  <span>إدارة شريط سنجوب ماركت (البانر البرتقالي الثابت في الصفحة الرئيسية)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحكم في نصوص وشارة وزر هذا الشريط وظهوره أو إخفائه في واجهة العميل للويب والموبايل.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <span>حالة الظهور:</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={martBanner.enabled}
                    onChange={(e) => setMartBanner({ ...martBanner, enabled: e.target.checked })}
                  />
                  <span className={martBanner.enabled ? 'text-emerald-600 font-black' : 'text-slate-400'}>
                    {martBanner.enabled ? 'مفعّل ويظهر للعميل' : 'مخفي مؤقتاً'}
                  </span>
                </label>
              </div>
            </div>

            {/* Live Visual Preview of Mart Banner */}
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 mb-1.5">معاينة مباشرة للشريط كما يظهر للعميل:</p>
              <div className={`bg-gradient-to-r from-[#FF5900] via-[#FF6A1A] to-[#FF4500] rounded-2xl p-3 sm:p-4 text-white shadow-xs flex items-center justify-between gap-3 ${!martBanner.enabled ? 'opacity-50 grayscale-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white text-[#FF5900] flex items-center justify-center shrink-0 shadow-xs font-black">
                    ⚡
                  </div>
                  <div className="leading-tight">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] bg-white/20 text-white px-2 py-0.2 rounded-full font-black">
                        {martBanner.badge || 'سنجوب بقالة ⚡'}
                      </span>
                      {martBanner.areaText && (
                        <span className="text-[9px] bg-white text-[#FF5900] px-1.5 py-0.2 rounded-full font-black">
                          {martBanner.areaText}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs sm:text-sm font-black line-clamp-1">
                      {martBanner.title || 'سنجوب ماركت وكل طلبات البيت لحد بابك'}
                    </h3>
                  </div>
                </div>

                <span className="px-3.5 py-1.5 bg-white text-[#FF5900] rounded-xl text-xs font-black shrink-0 shadow-xs">
                  {martBanner.btnText || 'تسوق الآن'}
                </span>
              </div>
            </div>

            {/* Form Fields for Editing Mart Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان الرئيسي للبانر</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-hidden font-bold"
                  value={martBanner.title}
                  onChange={(e) => setMartBanner({ ...martBanner, title: e.target.value })}
                  placeholder="سنجوب ماركت وكل طلبات البيت لحد بابك"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الشارة الترويجية (Badge)</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-hidden font-bold"
                  value={martBanner.badge}
                  onChange={(e) => setMartBanner({ ...martBanner, badge: e.target.value })}
                  placeholder="سنجوب بقالة ⚡"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نص المنطقة أو التغطية</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-hidden font-bold"
                  value={martBanner.areaText}
                  onChange={(e) => setMartBanner({ ...martBanner, areaText: e.target.value })}
                  placeholder="العاصمة وكافة المناطق"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نص زر الإجراء</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:border-orange-500 focus:outline-hidden font-bold"
                  value={martBanner.btnText}
                  onChange={(e) => setMartBanner({ ...martBanner, btnText: e.target.value })}
                  placeholder="تسوق الآن"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                disabled={martBannerSaving}
                onClick={async () => {
                  setMartBannerSaving(true);
                  try {
                    await perform({ action: 'save-mart-banner', martBanner }, 'تم حفظ إعدادات شريط سنجوب ماركت بنجاح');
                  } finally {
                    setMartBannerSaving(false);
                  }
                }}
              >
                <span>{martBannerSaving ? 'جارٍ الحفظ…' : 'حفظ تعديلات الشريط'}</span>
              </button>
            </div>
          </section>

          {/* ── Visual Slider Image Gallery (Permanent Preservation) ── */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ImageIcon size={18} className="text-orange-600" />
                  <span>معرض صور السلايدر الدائم (Gallery)</span>
                  <span className="text-xs font-normal text-slate-400">({gallery.length} صورة محفوظة)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  جميع صور السلايدر التي ترفعها تظل محفوظة هنا دائماً؛ يمكنك استبدال الصور الحالية وإعادة استخدام الصور القديمة في أي وقت دون إعادة الرفع.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => galleryUploadRef.current?.click()}
                  className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  <span>{uploadingImage ? 'جارٍ رفع الصورة…' : 'رفع صورة جديدة للمعرض 📤'}</span>
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {gallery.map((item) => (
                <div key={item.id} className="group relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                  <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 flex items-center justify-between gap-1 bg-white">
                    <span className="text-[10px] font-bold text-slate-700 truncate">{item.title}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentImageUrl(item.url);
                          openEditor();
                        }}
                        className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-[10px] font-bold transition shadow-2xs cursor-pointer"
                        title="إنشاء شريحة جديدة بهذه الصورة"
                      >
                        استخدم
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFromGallery(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded"
                        title="حذف من المعرض"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Home Page Layout Configuration ── */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="mb-3">
              <h2 className="text-base font-black text-slate-900">ترتيب أقسام الواجهة الرئيسية</h2>
              <p className="text-xs text-slate-500">اختر الأقسام الظاهرة وقدم العروض أو المتاجر حسب خطة التشغيل.</p>
            </div>
            <div className="space-y-2 max-w-xl">
              {(Array.isArray(config?.sections) ? config.sections : defaultCustomerHome.sections).map((section, index, arr) => (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200" key={section.type}>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      disabled={busy}
                      onChange={event => {
                        dirty.current = true;
                        setConfig(previous => {
                          const base = previous || defaultCustomerHome;
                          const currentSections = Array.isArray(base.sections) ? base.sections : defaultCustomerHome.sections;
                          return {
                            ...base,
                            sections: currentSections.map(item => item.type === section.type ? { ...item, enabled: event.target.checked } : item)
                          };
                        });
                      }}
                      className="rounded text-orange-600"
                    />
                    <span>{labels[section.type]}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label={`تقديم ${labels[section.type]}`}
                      disabled={busy || index === 0}
                      onClick={() => {
                        dirty.current = true;
                        setConfig(previous => {
                          const base = previous || defaultCustomerHome;
                          const sections = [...(Array.isArray(base.sections) ? base.sections : defaultCustomerHome.sections)];
                          if (index - 1 < 0) return base;
                          [sections[index], sections[index - 1]] = [sections[index - 1], sections[index]];
                          return { ...base, sections };
                        });
                      }}
                      className="p-1 bg-white hover:bg-slate-200 rounded border border-slate-200 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label={`تأخير ${labels[section.type]}`}
                      disabled={busy || index === arr.length - 1}
                      onClick={() => {
                        dirty.current = true;
                        setConfig(previous => {
                          const base = previous || defaultCustomerHome;
                          const sections = [...(Array.isArray(base.sections) ? base.sections : defaultCustomerHome.sections)];
                          if (index + 1 >= sections.length) return base;
                          [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
                          return { ...base, sections };
                        });
                      }}
                      className="p-1 bg-white hover:bg-slate-200 rounded border border-slate-200 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-xs transition"
                onClick={() => perform({ action: 'save-home', config }, 'تم حفظ إعدادات وترتيب أقسام الصفحة الرئيسية بنجاح.')}
                disabled={busy}
              >
                حفظ ترتيب الأقسام
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── Modal: Streamlined Slider Slide Editor (With Click Destination Map) ── */}
      <dialog
        ref={dialog}
        className="fixed inset-0 m-auto z-50 rounded-3xl p-0 border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] backdrop:bg-black/60 overflow-y-auto font-['Cairo',sans-serif]"
        dir="rtl"
        aria-label="محرر شريحة السلايدر"
        onCancel={event => { if (busy) event.preventDefault(); else setEditor(null); }}
        onClose={() => { if (!busy) setEditor(null); }}
      >
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <h2 className="font-black text-base">
              {editor?.campaign ? 'تعديل شريحة السلايدر' : 'إضافة شريحة سلايدر جديدة'}
            </h2>
          </div>
          <button
            disabled={busy}
            aria-label="إغلاق"
            onClick={() => setEditor(null)}
            className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {editor && (
          <form className="p-5 space-y-4" onSubmit={handleSaveSlide}>
            
            {/* 1. Slide Banner Image Picker & Live Preview */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">
                صورة شريحة السلايدر (تصميم البانر النظيف)
              </label>

              {currentImageUrl ? (
                <div className="relative aspect-[16/7] w-full rounded-2xl overflow-hidden border-2 border-orange-500 bg-slate-900 shadow-sm">
                  <img src={currentImageUrl} alt="معاينة الشريحة" className="w-full h-full object-cover object-center" />
                  <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-full font-bold">
                    معاينة صورة البانر الحالية
                  </span>
                </div>
              ) : (
                <div className="aspect-[16/7] w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-4">
                  <ImageIcon size={32} className="mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">اختر صورة أو ارفعها من جهازك لعرضها كبانر في السلايدر</p>
                  <p className="text-[10px] text-slate-400 mt-1">يُفضل المقاس العريض (مثل 800 × 350 بكسل)</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file, true);
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  <span>{uploadingImage ? 'جارٍ رفع الصورة…' : 'رفع صورة من جهازك 📤'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsGalleryModalOpen(true)}
                  className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ImageIcon size={14} className="text-orange-600" />
                  <span>اختيار من المعرض 🖼️</span>
                </button>
              </div>

              {/* Direct Image URL input (optional fallback) */}
              <div className="pt-1">
                <input
                  type="url"
                  value={currentImageUrl}
                  onChange={(e) => setCurrentImageUrl(e.target.value)}
                  placeholder="أو الصق رابط صورة مباشر هنا (URL)..."
                  className="w-full p-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl font-medium outline-hidden focus:bg-white focus:border-orange-500"
                />
              </div>
            </div>

            {/* 2. CLICK DESTINATION MAP (خريطة توجيه النقرة) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-black text-slate-900 mb-0.5">
                  🎯 خريطة توجيه النقرة (أين يتوجه العميل عند لمس الشريحة؟)
                </label>
                <p className="text-[11px] text-slate-500">
                  حدد الهدف بدقة. عند نقر العميل على الشريحة، سيتم توجيهه فوراً إلى وجهتك المختارة بدون أزرار وسيطة.
                </p>
              </div>

              {/* 5 Primary Target Type Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType('product');
                    if (!targetId && products.length > 0) setTargetId(products[0].id);
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    targetType === 'product'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 font-black ring-2 ring-orange-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 font-bold hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg mb-0.5">🍔</span>
                  <span className="text-xs">منتج محدد</span>
                  <span className="text-[9px] text-orange-700 font-bold mt-0.5">للطلب الفوري</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetType('store');
                    if (stores.length > 0) setTargetId(stores[0].id);
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    targetType === 'store'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 font-black ring-2 ring-orange-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 font-bold hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg mb-0.5">🏪</span>
                  <span className="text-xs">متجر محدد</span>
                  <span className="text-[9px] text-slate-500 font-medium mt-0.5">صفحة المتجر</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetType('category');
                    if (availableCategories.length > 0) setTargetId(availableCategories[0]);
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    targetType === 'category'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 font-black ring-2 ring-orange-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 font-bold hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg mb-0.5">📁</span>
                  <span className="text-xs">قسم / تصنيف</span>
                  <span className="text-[9px] text-slate-500 font-medium mt-0.5">تصفية المنتجات</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetType('offers');
                    setTargetId('');
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    targetType === 'offers'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 font-black ring-2 ring-orange-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 font-bold hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg mb-0.5">🏷️</span>
                  <span className="text-xs">صفحة العروض</span>
                  <span className="text-[9px] text-slate-500 font-medium mt-0.5">كل التخفيضات</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetType('none');
                    setTargetId('');
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                    targetType === 'none'
                      ? 'bg-orange-50 border-orange-500 text-orange-950 font-black ring-2 ring-orange-500/20 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 font-bold hover:bg-slate-100'
                  }`}
                >
                  <span className="text-lg mb-0.5">🖼️</span>
                  <span className="text-xs">للعرض فقط</span>
                  <span className="text-[9px] text-slate-500 font-medium mt-0.5">بدون توجيه</span>
                </button>
              </div>

              {/* Sub-selector for Product: Instant Search & Filter */}
              {targetType === 'product' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-black text-slate-800">
                      اختر المنتج المستهدف للطلب المباشر:
                    </label>
                    {selectedProductObj && (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        تم اختيار: {selectedProductObj.name}
                      </span>
                    )}
                  </div>

                  {/* Search Input for Products */}
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="ابحث عن المنتج بالاسم أو الباركود..."
                      className="w-full pr-9 pl-3 py-2 text-xs bg-white border border-slate-300 rounded-xl font-bold focus:border-orange-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Fast Products Grid Selection */}
                  <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 p-1">
                    {filteredProducts.map(p => {
                      const isSelected = targetId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setTargetId(p.id)}
                          className={`p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition ${
                            isSelected ? 'bg-orange-50 text-orange-950 font-black' : 'hover:bg-slate-50 text-slate-700 font-bold'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="leading-tight">
                              <p className="text-xs truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-normal">{p.storeName || 'متجر سنجوب'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black text-orange-600">{formatEGP(p.price)}</span>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-selector for Store */}
              {targetType === 'store' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <label className="block text-xs font-black text-slate-800">
                    اختر المتجر أو المطعم:
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:border-orange-500 focus:outline-hidden"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.category || 'متجر'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sub-selector for Category */}
              {targetType === 'category' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <label className="block text-xs font-black text-slate-800">
                    اختر القسم أو التصنيف:
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:border-orange-500 focus:outline-hidden"
                  >
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 3. Priority & Status */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  أولوية الترتيب في السلايدر
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={slidePriority}
                  onChange={(e) => setSlidePriority(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-end">
                <label className="w-full flex items-center gap-2 text-xs font-black text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slideEnabled}
                    onChange={(e) => setSlideEnabled(e.target.checked)}
                    className="rounded text-orange-600"
                  />
                  <span>تفعيل الشريحة في المتجر</span>
                </label>
              </div>
            </div>

            {/* 4. Action Buttons */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 active:scale-98 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={16} strokeWidth={3} />
                <span>{busy ? 'جارٍ الحفظ وتحديث السلايدر…' : 'حفظ الشريحة وعرضها في السلايدر فوراً 🚀'}</span>
              </button>
            </div>
          </form>
        )}
      </dialog>

      {/* ── Modal: Gallery Picker (Direct Selection for Slide) ── */}
      <dialog
        ref={galleryDialog}
        className="fixed inset-0 m-auto z-50 rounded-3xl p-0 border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[88vh] backdrop:bg-black/60 overflow-hidden font-['Cairo',sans-serif]"
        dir="rtl"
        aria-label="معرض صور السلايدر"
        onCancel={() => setIsGalleryModalOpen(false)}
        onClose={() => setIsGalleryModalOpen(false)}
      >
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-orange-500" />
            <h2 className="font-black text-base">
              {targetCampaignForReplacement
                ? `استبدال صورة الشريحة "${targetCampaignForReplacement.title || 'المحددة'}"`
                : 'معرض صور السلايدر (اضغط على الصورة لاختيارها)'}
            </h2>
          </div>
          <button onClick={() => setIsGalleryModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2 bg-orange-50 p-3 rounded-2xl border border-orange-200">
            <p className="text-xs text-orange-900 font-bold">
              {targetCampaignForReplacement
                ? 'اضغط على أي صورة لاستبدال صورة هذه الشريحة بها فوراً وتحديث المتجر.'
                : 'اضغط على أي صورة لاختيارها فوراً لشريحة السلايدر.'}
            </p>
            <button
              type="button"
              disabled={uploadingImage}
              onClick={() => galleryUploadRef.current?.click()}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shrink-0 transition cursor-pointer disabled:opacity-50"
            >
              <Upload size={13} />
              <span>{uploadingImage ? 'جارٍ الرفع…' : 'رفع صورة جديدة 📤'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gallery.map((item) => (
              <div
                key={item.id}
                onClick={async () => {
                  if (targetCampaignForReplacement) {
                    await applyImageToCampaign(targetCampaignForReplacement, item.url);
                  } else {
                    setCurrentImageUrl(item.url);
                    setIsGalleryModalOpen(false);
                  }
                }}
                className={`group relative rounded-2xl overflow-hidden border-2 cursor-pointer transition flex flex-col justify-between ${
                  currentImageUrl === item.url ? 'border-orange-600 ring-2 ring-orange-600/30 shadow-md' : 'border-slate-200 hover:border-orange-400'
                }`}
              >
                <div className="aspect-video w-full bg-slate-100 overflow-hidden relative">
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  {currentImageUrl === item.url && (
                    <span className="absolute top-2 right-2 bg-orange-600 text-white rounded-full p-1 shadow-md">
                      <Check size={14} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="p-2 bg-white text-right">
                  <p className="text-[11px] font-black text-slate-800 truncate">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </dialog>

    </section>
  );
}
