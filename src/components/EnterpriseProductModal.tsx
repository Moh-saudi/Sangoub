import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, Store, Category, ProductOptionGroup } from '../types';
import { getCategoryBreadcrumb } from '../lib/categoryTree';
import {
  searchMatchingCatalog,
  generateProductDetailsWithAI,
  detectCategoryFromName,
  POPULAR_MASTER_CATALOG,
  type MatchingProduct,
  type DetectedCategoryResult,
} from '../utils/aiProductGenerator';
import { uploadCatalogImage } from '../lib/catalogImages';
import {
  X,
  Package,
  Layers,
  Barcode,
  Sliders,
  Image as ImageIcon,
  Save,
  Plus,
  Trash2,
  Search,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  Info,
  Wand2,
  UploadCloud,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface EnterpriseProductModalProps {
  product?: Product | null;
  stores: Store[];
  preselectedStoreId?: string;
  busy?: boolean;
  onClose: () => void;
  onSave: (data: Partial<Product> & { categoryId?: string; barcode?: string; merchantPosSku?: string; optionGroups?: ProductOptionGroup[] }) => Promise<void>;
}

export function EnterpriseProductModal({
  product,
  stores,
  preselectedStoreId,
  busy = false,
  onClose,
  onSave,
}: EnterpriseProductModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'pricing' | 'modifiers' | 'media'>('info');

  // Categories taxonomy
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');

  // Selected Category
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(product?.categoryId || '');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(product?.category || '');

  // Cascading Selection state (Level 1, Level 2, Level 3)
  const [l1Id, setL1Id] = useState<string>('');
  const [l2Id, setL2Id] = useState<string>('');

  // Form Basic Info
  const [storeId, setStoreId] = useState<string>(product?.storeId || preselectedStoreId || stores[0]?.id || '');
  const [name, setName] = useState<string>(product?.name || '');
  const [nameEn, setNameEn] = useState<string>(product?.nameEn || '');
  const [description, setDescription] = useState<string>(product?.description || '');
  const [badge, setBadge] = useState<string>(product?.badge || '');

  // AI & Master Catalog Matching States
  const [matchingCatalogItems, setMatchingCatalogItems] = useState<MatchingProduct[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [autoDetectedCategory, setAutoDetectedCategory] = useState<DetectedCategoryResult | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiNotice, setAiNotice] = useState<string>('');
  const searchTimeoutRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNameDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form Pricing & Inventory
  const [price, setPrice] = useState<string>(product?.price !== undefined ? String(product.price) : '');
  const [originalPrice, setOriginalPrice] = useState<string>(product?.originalPrice ? String(product.originalPrice) : '');
  const [barcode, setBarcode] = useState<string>(product?.barcode || '');
  const [merchantPosSku, setMerchantPosSku] = useState<string>(product?.merchantPosSku || '');
  const [inStock, setInStock] = useState<boolean>(product?.inStock !== undefined ? product.inStock : true);
  const [isPopular, setIsPopular] = useState<boolean>(product?.isPopular || false);

  // Form Modifiers
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroup[]>(product?.optionGroups || []);

  // Form Media & Image Upload
  const [imageUrl, setImageUrl] = useState<string>(product?.imageUrl || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch hierarchical categories from Supabase
  useEffect(() => {
    async function loadTaxonomy() {
      setCategoriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('display_order', { ascending: true });

        if (error) throw error;
        setCategories((data as Category[]) || []);

        if (product?.categoryId && data) {
          const currentCat = data.find(c => c.id === product.categoryId);
          if (currentCat) {
            setSelectedCategoryName(currentCat.name_ar);
            if (currentCat.parent_id) {
              const parent = data.find(c => c.id === currentCat.parent_id);
              if (parent?.parent_id) {
                setL1Id(parent.parent_id);
                setL2Id(parent.id);
              } else if (parent) {
                setL1Id(parent.id);
                setL2Id(currentCat.id);
              }
            } else {
              setL1Id(currentCat.id);
            }
          }
        }
      } catch (err) {
        console.error('Error loading taxonomy:', err);
      } finally {
        setCategoriesLoading(false);
      }
    }

    void loadTaxonomy();
  }, [product?.categoryId]);

  // Hierarchical category levels
  const l1Categories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);
  const l2Categories = useMemo(() => categories.filter(c => c.parent_id === l1Id), [categories, l1Id]);
  const l3Categories = useMemo(() => categories.filter(c => c.parent_id === l2Id), [categories, l2Id]);

  // Search filtered categories
  const searchedCategories = useMemo(() => {
    if (!categorySearch.trim()) return [];
    const q = categorySearch.toLowerCase().trim();
    return categories.filter(
      c => c.name_ar.toLowerCase().includes(q) || (c.name_en && c.name_en.toLowerCase().includes(q))
    );
  }, [categories, categorySearch]);

  const discountPercentage = useMemo(() => {
    const p = parseFloat(price);
    const orig = parseFloat(originalPrice);
    if (!p || !orig || orig <= p) return null;
    return Math.round(((orig - p) / orig) * 100);
  }, [price, originalPrice]);

  function handleSelectCategory(cat: Category) {
    setSelectedCategoryId(cat.id);
    setSelectedCategoryName(cat.name_ar);
    setCategorySearch('');
  }

  // ── Instant Real-Time Autocomplete & Smart Category Classifier ───────────
  function handleNameChange(val: string) {
    setName(val);
    setAiNotice('');

    if (!val || !val.trim()) {
      setMatchingCatalogItems([]);
      setShowNameDropdown(false);
      setAutoDetectedCategory(null);
      return;
    }

    const clean = val.trim().toLowerCase();
    setShowNameDropdown(true);

    // 1. بحث فوري في الذاكرة (0ms) من الكتالوج الشائع
    const instantLocal = POPULAR_MASTER_CATALOG.filter(item => {
      const ar = item.name_ar.toLowerCase();
      const en = (item.name_en || '').toLowerCase();
      return ar.includes(clean) || en.includes(clean);
    });
    setMatchingCatalogItems(instantLocal);

    // 2. كاشف التصنيف الذكي التلقائي بمجرد الكتابة
    const detected = detectCategoryFromName(val, categories);
    if (detected) {
      setAutoDetectedCategory(detected);
      setSelectedCategoryId(detected.category.id);
      setSelectedCategoryName(detected.category.name_ar);
      if (detected.l1Id) setL1Id(detected.l1Id);
      if (detected.l2Id) setL2Id(detected.l2Id);
    }

    // 3. بحث تكميلي غير متزامن من الخادم (Master SPU + Products)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingCatalog(true);
      try {
        const matches = await searchMatchingCatalog(val);
        if (matches && matches.length > 0) {
          setMatchingCatalogItems(matches);
        }
      } catch (err) {
        console.warn('Autocomplete fetch error:', err);
      } finally {
        setSearchingCatalog(false);
      }
    }, 180);
  }

  // Import existing Master SPU item with 1-Click
  function handleImportExistingItem(item: MatchingProduct) {
    setName(item.name_ar);
    if (item.name_en) setNameEn(item.name_en);
    if (item.description) setDescription(item.description);
    if (item.barcode) setBarcode(item.barcode);
    if (item.image_url) setImageUrl(item.image_url);
    if (item.suggested_price && !price) setPrice(String(item.suggested_price));

    // تحديد التصنيف
    let categoryFound = false;
    if (item.category_id) {
      const cat = categories.find(c => c.id === item.category_id);
      if (cat) {
        const hierarchy = detectCategoryFromName(cat.name_ar, categories);
        if (hierarchy) {
          setAutoDetectedCategory(hierarchy);
          setSelectedCategoryId(hierarchy.category.id);
          setSelectedCategoryName(hierarchy.category.name_ar);
          if (hierarchy.l1Id) setL1Id(hierarchy.l1Id);
          if (hierarchy.l2Id) setL2Id(hierarchy.l2Id);
        } else {
          setSelectedCategoryId(cat.id);
          setSelectedCategoryName(cat.name_ar);
        }
        categoryFound = true;
      }
    }

    if (!categoryFound) {
      const detected = detectCategoryFromName(item.name_ar, categories);
      if (detected) {
        setAutoDetectedCategory(detected);
        setSelectedCategoryId(detected.category.id);
        setSelectedCategoryName(detected.category.name_ar);
        if (detected.l1Id) setL1Id(detected.l1Id);
        if (detected.l2Id) setL2Id(detected.l2Id);
      } else if (item.category) {
        setSelectedCategoryName(item.category);
      }
    }

    setShowNameDropdown(false);
    setAiNotice(`✨ تم استيراد بيانات الصنف "${item.name_ar}" وتصنيفه تلقائياً بنجاح!`);
  }

  // ── AI Copilot Auto-Generation ────────────────────────────────────────────
  async function handleAIGenerate() {
    if (!name.trim()) {
      setErrorMsg('اكتب اسم الصنف بالعربية أولاً لتوليد البيانات بالذكاء الاصطناعي.');
      return;
    }

    setAiGenerating(true);
    setErrorMsg('');
    setAiNotice('');

    try {
      const result = await generateProductDetailsWithAI(name, categories);
      if (result.nameEn && !nameEn) setNameEn(result.nameEn);
      if (result.description && (!description || description.length < 15)) setDescription(result.description);
      if (result.badge && !badge) setBadge(result.badge);
      if (result.suggestedPrice && !price) setPrice(String(result.suggestedPrice));
      if (result.modifiers && result.modifiers.length > 0 && optionGroups.length === 0) {
        setOptionGroups(result.modifiers);
      }

      setAiNotice('✨ تم توليد الاسم الإنجليزي والوصف التسويقي والخيارات المقترحة بالذكاء الاصطناعي!');
    } catch (err: any) {
      console.error('AI generation error:', err);
      setErrorMsg('تعذر التوليد بالذكاء الاصطناعي حالياً. يمكنك إدخال البيانات يدوياً.');
    } finally {
      setAiGenerating(false);
    }
  }

  // ── High-Speed Image Direct Upload ────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setUploadNotice('');
    setErrorMsg('');

    try {
      const prodId = product?.id || 'prod-' + Date.now();
      const res = await uploadCatalogImage('products', prodId, file);
      setImageUrl(res.url);
      setUploadNotice('✅ تم رفع وحفظ صورة الصنف بنجاح!');
    } catch (err: any) {
      console.error('Upload error:', err);
      setErrorMsg(err.message || 'تعذر رفع الصورة.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Modifiers Management
  function addOptionGroup() {
    setOptionGroups(prev => [
      ...prev,
      {
        id: 'group-' + Date.now(),
        title: 'اختر الحجم أو الإضافة',
        required: false,
        options: [
          { name: 'عادي / وسط', price: 0 },
          { name: 'كبير / دبل', price: 15 },
        ],
      },
    ]);
  }

  function removeOptionGroup(idx: number) {
    setOptionGroups(prev => prev.filter((_, i) => i !== idx));
  }

  function updateOptionGroup(idx: number, patch: Partial<ProductOptionGroup>) {
    setOptionGroups(prev => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function addOptionToGroup(groupIdx: number) {
    setOptionGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, options: [...g.options, { name: 'إضافة جديدة', price: 5 }] }
          : g
      )
    );
  }

  function removeOptionFromGroup(groupIdx: number, optIdx: number) {
    setOptionGroups(prev =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, options: g.options.filter((_, idx) => idx !== optIdx) }
          : g
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setActiveTab('info');
      setErrorMsg('يرجى إدخال اسم المنتج.');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setActiveTab('pricing');
      setErrorMsg('يرجى إدخال سعر بيع صحيح.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const selectedStore = stores.find(s => s.id === storeId);
      const payload = {
        storeId,
        storeName: selectedStore?.name || product?.storeName || '',
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        description: description.trim(),
        price: numPrice,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        category: selectedCategoryName || 'عام',
        categoryId: selectedCategoryId || undefined,
        barcode: barcode.trim() || undefined,
        merchantPosSku: merchantPosSku.trim() || undefined,
        badge: badge.trim() || undefined,
        inStock,
        isPopular,
        imageUrl: imageUrl.trim() || undefined,
        optionGroups: optionGroups.length ? optionGroups : undefined,
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      console.error('Error in EnterpriseProductModal:', err);
      setErrorMsg(err.message || 'تعذر حفظ المنتج.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* ── Modal Header ─────────────────────────────────────────────────── */}
        <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md">
              <Package size={22} />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-lg">
                {product?.id ? `تعديل الصنف: ${product.name}` : 'إضافة صنف جديد'}
              </h2>
              <p className="text-xs text-slate-500">
                إدارة بيانات الصنف والتسعير والتصنيف والخيارات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {/* ── Navigation Tabs ───────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-200 bg-white px-6 shrink-0 gap-1 overflow-x-auto">
          {[
            { id: 'info', label: 'البيانات والتصنيف الهرمي', icon: Layers },
            { id: 'pricing', label: 'التسعير والمخزون ونقاط البيع (POS)', icon: Barcode },
            { id: 'modifiers', label: `الخيارات والإضافات (${optionGroups.length})`, icon: Sliders },
            { id: 'media', label: 'صورة الصنف', icon: ImageIcon },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'border-orange-600 text-orange-600 bg-orange-50/50 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Notices & Alert Banners ───────────────────────────────────────── */}
        {errorMsg && (
          <div role="alert" className="mx-6 mt-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {aiNotice && (
          <div role="status" className="mx-6 mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between shrink-0">
            <span>{aiNotice}</span>
            <button onClick={() => setAiNotice('')} className="text-xs text-amber-700 underline cursor-pointer">إغلاق</button>
          </div>
        )}

        {/* ── Main Form Content ─────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ═════════ TAB 1: BASIC INFO & TAXONOMY ═════════ */}
          {activeTab === 'info' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {/* Store Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  المتجر المسؤول عن الصنف <span className="text-red-500">*</span>
                </label>
                <select
                  value={storeId}
                  onChange={e => setStoreId(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-orange-600 font-medium"
                >
                  <option value="" disabled>اختر المتجر</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>
                      {store.name} ({store.type || 'متجر'}) · {store.locationInDistrict || 'الحي الحكومي'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Name with AI Copilot trigger & Instant Real-Time Autocomplete */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    اسم المنتج بالعربية <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    disabled={aiGenerating || !name.trim()}
                    onClick={handleAIGenerate}
                    className="px-3 py-1 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {aiGenerating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                    {aiGenerating ? 'جارٍ التوليد بالذكاء الاصطناعي…' : '✨ إكمال بالذكاء الاصطناعي (AI)'}
                  </button>
                </div>

                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    required
                    placeholder="اكتب اسم الصنف هنا (مثلاً: شاي، جبنة، برجر، مياه)…"
                    value={name}
                    onChange={e => handleNameChange(e.target.value)}
                    onFocus={() => {
                      if (name.trim()) setShowNameDropdown(true);
                    }}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-600 font-bold"
                  />

                  {searchingCatalog && (
                    <div className="absolute left-3 top-3.5">
                      <Loader2 size={16} className="animate-spin text-orange-600" />
                    </div>
                  )}

                  {/* ── القائمة المنسدلة العائمة التفاعلية مع كل حرف ── */}
                  {showNameDropdown && name.trim().length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                      {matchingCatalogItems.length > 0 ? (
                        <>
                          <div className="px-3.5 py-2 bg-linear-to-r from-orange-50 to-amber-50 border-b border-orange-100 flex items-center justify-between text-xs font-bold text-orange-950">
                            <span className="flex items-center gap-1.5">
                              <Sparkles size={14} className="text-orange-600" />
                              أصناف مطابقة في الكتالوج الموحد ({matchingCatalogItems.length}):
                            </span>
                            <span className="text-[10px] text-orange-700 bg-white px-2 py-0.5 rounded-md border border-orange-200">
                              اختر للاستيراد وتحديد القسم فوراً
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {matchingCatalogItems.map(item => (
                              <div
                                key={item.id}
                                onClick={() => handleImportExistingItem(item)}
                                className="p-3 hover:bg-orange-50/80 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-orange-100/70 border border-orange-200 text-orange-700 font-bold flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.image_url ? (
                                      <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <Package size={18} />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 group-hover:text-orange-700 flex items-center gap-2">
                                      <span className="truncate">{item.name_ar}</span>
                                      {item.category && (
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal shrink-0">
                                          {item.category}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 truncate mt-0.5">
                                      {item.name_en && <span className="truncate">{item.name_en}</span>}
                                      {item.barcode && <span>• باركود: {item.barcode}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-left shrink-0">
                                  {item.suggested_price ? (
                                    <span className="text-xs font-black text-slate-800 block">{item.suggested_price} ج.م</span>
                                  ) : null}
                                  <span className="text-[11px] text-orange-600 font-bold group-hover:underline flex items-center gap-1">
                                    استيراد ⚡
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-600 bg-slate-50">
                          <p className="font-bold text-slate-800">
                            ✍️ صنف جديد غير مسجل في الكتالوج الموحد
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            يمكنك إكمال الاسم بحرية، وسيتولى المساعد الذكي تصنيفه واقتراح بياناته تلقائياً.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── التحديد التلقائي للقسم بالذكاء الاصطناعي ── */}
                {autoDetectedCategory && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-emerald-600 shrink-0" />
                      <span>
                        ✨ تم التعرف التلقائي على القسم:{' '}
                        <strong className="text-emerald-950 font-black">
                          {autoDetectedCategory.pathDisplay}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold shrink-0">
                      تحديد تلقائي ✓
                    </span>
                  </div>
                )}
              </div>

              {/* English Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المنتج بالإنجليزية (مترجم للـ SEO وتطبيقات التوصيل)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="e.g. Double Cheeseburger, Farm Feta Cheese"
                  value={nameEn}
                  onChange={e => setNameEn(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-orange-600 text-right"
                />
              </div>

              {/* ── Hierarchical Taxonomy Picker ── */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-orange-600" />
                    <span className="font-bold text-sm text-slate-900">التصنيف الهرمي للصنف</span>
                  </div>
                  {selectedCategoryName && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <Check size={13} />
                      {selectedCategoryName}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث مباشرة في آلاف التصنيفات بالاسم (مثل: تونة، ألبان، شاورما)…"
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-3 py-2 text-xs focus:outline-none focus:border-orange-600"
                  />
                </div>

                {categorySearch.trim() && (
                  <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 space-y-1 shadow-md">
                    {searchedCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat)}
                        className="w-full text-right p-2 rounded-lg text-xs hover:bg-orange-50 hover:text-orange-700 flex items-center justify-between transition-colors"
                      >
                        <span className="font-bold">{cat.name_ar}</span>
                        <span className="text-[11px] text-slate-400">{getCategoryBreadcrumb(categories, cat.id)}</span>
                      </button>
                    ))}
                    {!searchedCategories.length && (
                      <p className="p-3 text-center text-xs text-slate-400">لا توجد أقسام مطابقة.</p>
                    )}
                  </div>
                )}

                {!categorySearch.trim() && (
                  <div className="grid sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-500 mb-1">1. القسم الرئيسي (L1)</span>
                      <select
                        value={l1Id}
                        onChange={e => {
                          setL1Id(e.target.value);
                          setL2Id('');
                          const cat = categories.find(c => c.id === e.target.value);
                          if (cat) handleSelectCategory(cat);
                        }}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-medium focus:outline-none focus:border-orange-600"
                      >
                        <option value="">اختر القسم الرئيسي</option>
                        {l1Categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name_ar}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-500 mb-1">2. القسم الفرعي (L2)</span>
                      <select
                        value={l2Id}
                        disabled={!l1Id || !l2Categories.length}
                        onChange={e => {
                          setL2Id(e.target.value);
                          const cat = categories.find(c => c.id === e.target.value);
                          if (cat) handleSelectCategory(cat);
                        }}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-medium focus:outline-none focus:border-orange-600 disabled:opacity-50"
                      >
                        <option value="">اختر القسم الفرعي</option>
                        {l2Categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name_ar}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-slate-500 mb-1">3. القسم الدقيق (L3)</span>
                      <select
                        disabled={!l2Id || !l3Categories.length}
                        value={selectedCategoryId}
                        onChange={e => {
                          const cat = categories.find(c => c.id === e.target.value);
                          if (cat) handleSelectCategory(cat);
                        }}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-medium focus:outline-none focus:border-orange-600 disabled:opacity-50"
                      >
                        <option value="">اختر القسم الدقيق</option>
                        {l3Categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name_ar}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  وصف المنتج ومكوناته التسويقية <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="وصف تفصيلي جذاب للمنتج، المكونات، الحجم، أو نصائح الاستخدام…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-600 leading-relaxed"
                />
              </div>

              {/* Badge */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  شارة مميزة (Badge) — اختياري
                </label>
                <input
                  type="text"
                  placeholder="مثال: الأكثر طلباً، عرض خاص، طازج ومضمون"
                  value={badge}
                  onChange={e => setBadge(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>
          )}

          {/* ═════════ TAB 2: PRICING, INVENTORY & POS ═════════ */}
          {activeTab === 'pricing' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <Info size={18} className="shrink-0 text-amber-700" />
                <span>
                  ربط الباركود وكود الكاشير يضمن مطابقة مبيعات المنصة مع أنظمة نقاط البيع (POS) تلقائياً دون تضارب مخزون.
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    سعر البيع الفعلي بالجنيه <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:border-orange-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    السعر قبل الخصم (اختياري لإظهار نسبة التوفير)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="اتركه فارغاً إن لم يكن هناك خصم"
                      value={originalPrice}
                      onChange={e => setOriginalPrice(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-600"
                    />
                    {discountPercentage && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 bg-red-100 text-red-700 text-xs font-black px-2 py-1 rounded-lg">
                        خصم {discountPercentage}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* POS & Barcodes */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Barcode size={15} />
                    باركود الصنف الدولي (EAN-13 / GTIN / باركود الميزان)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="6221000123456"
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-orange-600 text-right"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    يستخدم للمسح السريع في السوبرماركت ومطابقة الكتالوج الموحد
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    كود الصنف بنظام كاشير التاجر (Merchant POS SKU)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="e.g. POS-BRG-01, ODOO-449"
                    value={merchantPosSku}
                    onChange={e => setMerchantPosSku(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-orange-600 text-right"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    الكود الداخلي المسجل لدى برنامج كاشير المتجر لمزامنة الفواتير
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={inStock}
                    onChange={e => setInStock(e.target.checked)}
                    className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <span className="font-bold text-sm text-slate-800 block">الصنف متاح للطلب الفوري بالمخزون</span>
                    <span className="text-xs text-slate-500">إذا عطلت هذا الخيار، سيظهر الصنف كـ (نفد مؤقتاً) دون حذفه.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={isPopular}
                    onChange={e => setIsPopular(e.target.checked)}
                    className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <span className="font-bold text-sm text-slate-800 block">عرض ضمن الأصناف الأكثر طلباً والمميزة</span>
                    <span className="text-xs text-slate-500">يظهر بشارة مميزة في مقدمة قسم المتجر والتطبيق.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ═════════ TAB 3: MODIFIERS & CUSTOMIZATIONS ═════════ */}
          {activeTab === 'modifiers' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">خيارات الوجبة والإضافات (Modifiers)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تخصيص الأحجام (عادي/كبير)، درجة التسوية، أو الإضافات كصوصات وجبن بأسعار إضافية
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addOptionGroup}
                  className="px-3.5 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                  إضافة مجموعة خيارات جديدة
                </button>
              </div>

              <div className="space-y-4">
                {optionGroups.map((group, groupIdx) => (
                  <div key={group.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={group.title}
                        onChange={e => updateOptionGroup(groupIdx, { title: e.target.value })}
                        placeholder="عنوان المجموعة (مثال: اختر الحجم، الصوص المفضل)"
                        className="font-bold text-xs p-2 bg-white border border-slate-200 rounded-lg flex-1 focus:outline-none focus:border-orange-600"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={group.required || false}
                          onChange={e => updateOptionGroup(groupIdx, { required: e.target.checked })}
                          className="rounded text-orange-600"
                        />
                        إجباري للعميل
                      </label>
                      <button
                        type="button"
                        onClick={() => removeOptionGroup(groupIdx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="space-y-2 pr-2 border-r-2 border-orange-200">
                      {group.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt.name}
                            onChange={e => {
                              const newOpts = [...group.options];
                              newOpts[optIdx].name = e.target.value;
                              updateOptionGroup(groupIdx, { options: newOpts });
                            }}
                            placeholder="اسم الخيار (مثال: حجم كبير، صوص جبنة)"
                            className="text-xs p-2 bg-white border border-slate-200 rounded-lg flex-1"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400 font-bold">+</span>
                            <input
                              type="number"
                              step="0.5"
                              value={opt.price}
                              onChange={e => {
                                const newOpts = [...group.options];
                                newOpts[optIdx].price = parseFloat(e.target.value) || 0;
                                updateOptionGroup(groupIdx, { options: newOpts });
                              }}
                              placeholder="0"
                              className="text-xs p-2 bg-white border border-slate-200 rounded-lg w-20 text-center font-bold"
                            />
                            <span className="text-[11px] text-slate-400">ج.م</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeOptionFromGroup(groupIdx, optIdx)}
                            className="p-1 text-slate-300 hover:text-red-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addOptionToGroup(groupIdx)}
                        className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1 pt-1"
                      >
                        <Plus size={12} />
                        إضافة خيار فرعي لهذه المجموعة
                      </button>
                    </div>
                  </div>
                ))}

                {!optionGroups.length && (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                    <Sliders size={28} className="mx-auto text-slate-300" />
                    <p className="text-xs text-slate-500 font-medium">
                      هذا الصنف بسيط حالياً بدون إضافات أو أحجام.
                    </p>
                    <button
                      type="button"
                      onClick={addOptionGroup}
                      className="px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold"
                    >
                      إضافة أحجام أو صوصات للوجبة
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═════════ TAB 4: PRODUCT IMAGE ═════════ */}
          {activeTab === 'media' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {imageUrl ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-4">
                  <span className="text-xs font-bold text-slate-600 block">الصورة الحالية للصنف:</span>
                  <div className="relative inline-block mx-auto">
                    <img
                      src={imageUrl}
                      alt="صورة الصنف"
                      className="h-56 max-w-full rounded-2xl shadow-sm border border-slate-200 object-cover"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                      }}
                    />
                  </div>

                  {uploadNotice && (
                    <p className="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl max-w-md mx-auto">
                      {uploadNotice}
                    </p>
                  )}

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="product-image-upload-input"
                    />
                    <label
                      htmlFor="product-image-upload-input"
                      className={`px-5 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-all ${
                        uploadingImage
                          ? 'bg-slate-200 text-slate-500 pointer-events-none'
                          : 'bg-orange-600 hover:bg-orange-700 text-white'
                      }`}
                    >
                      {uploadingImage ? 'جارٍ رفع الصورة…' : 'تغيير الصورة'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        setUploadNotice('');
                      }}
                      className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
                    >
                      حذف الصورة
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-3 hover:border-orange-500 transition-colors">
                  <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 mx-auto flex items-center justify-center">
                    <ImageIcon size={26} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">صورة الصنف الرئيسية</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      تدعم المنصة صور JPG و PNG و WebP بحجم يصل إلى 5 ميجابايت.
                    </p>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="product-image-upload-input"
                  />

                  <label
                    htmlFor="product-image-upload-input"
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-sm transition-all ${
                      uploadingImage
                        ? 'bg-slate-200 text-slate-500 pointer-events-none'
                        : 'bg-orange-600 hover:bg-orange-700 text-white active:scale-95'
                    }`}
                  >
                    {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {uploadingImage ? 'جارٍ رفع الصورة…' : 'اختيار صورة من جهازك'}
                  </label>

                  {uploadNotice && (
                    <p className="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-2 rounded-xl max-w-md mx-auto mt-2">
                      {uploadNotice}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Modal Footer ─────────────────────────────────────────────────── */}
          <footer className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400">
              {product?.id ? 'تحديث صنف موجود' : 'صنف جديد في الكتالوج'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting || busy || uploadingImage}
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || busy || uploadingImage}
                className="px-7 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                {submitting || busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {product?.id ? 'حفظ تعديلات الصنف' : 'إضافة الصنف للكتالوج'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
