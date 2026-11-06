import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Category, Store, Product } from '../types';
import { buildCategoryTree, getCategoryBreadcrumb } from '../lib/categoryTree';
import { 
  STORE_TYPES, 
  SUPERMARKET_CATEGORY_TEMPLATES, 
  type StoreTypeDefinition, 
  type CategoryTemplateDefinition 
} from '../constants/taxonomy';
import { operationsApi } from '../lib/operationsApi';
import { uploadCatalogImage } from '../lib/catalogImages';
import { matchProductToCategory } from '../utils/categoryMatching';
import {
  FolderTree,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Utensils,
  Pill,
  Sparkles,
  Layers,
  ArrowRight,
  Loader2,
  X,
  Save,
  Store as StoreIcon,
  Image as ImageIcon,
  Check,
  Eye,
  EyeOff,
  Package,
  Upload
} from 'lucide-react';

interface CategoryManagerProps {
  stores?: Store[];
  products?: Product[];
}

export function CategoryManager({ stores = [], products = [] }: CategoryManagerProps) {
  // Navigation Tabs: 'templates' (24 supermarket categories) | 'storeTypes' (16 store types) | 'tree' (hierarchical tree)
  const [activeTab, setActiveTab] = useState<'templates' | 'storeTypes' | 'tree'>('templates');

  // Templates & Store Types State
  const [templates, setTemplates] = useState<CategoryTemplateDefinition[]>(SUPERMARKET_CATEGORY_TEMPLATES);
  const [storeTypes, setStoreTypes] = useState<StoreTypeDefinition[]>(STORE_TYPES);
  const [disabledStoreTypes, setDisabledStoreTypes] = useState<string[]>(['REST', 'CAFE', 'PHARM']);
  const [disabledCategories, setDisabledCategories] = useState<string[]>(['CAT-PHARMACY', 'pharmacy', 'صيدلية', 'ادوية']);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, Partial<CategoryTemplateDefinition>>>({});

  // Tree View State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Edit / Modal States
  const [editingTemplate, setEditingTemplate] = useState<CategoryTemplateDefinition | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateFormNameAr, setTemplateFormNameAr] = useState('');
  const [templateFormNameEn, setTemplateFormNameEn] = useState('');
  const [templateFormImage, setTemplateFormImage] = useState('');
  const [templateFormCode, setTemplateFormCode] = useState('');
  const [templateFormOrder, setTemplateFormOrder] = useState(1);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const categoryImageUploadRef = useRef<HTMLInputElement | null>(null);

  // Secure Image Upload Handler (Cloudflare R2 + Supabase Storage fallback)
  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const res = await uploadCatalogImage('banners', 'cat-' + (templateFormCode || 'custom'), file);
      if (res?.url) {
        setTemplateFormImage(res.url);
      }
    } catch (err: any) {
      alert(err?.message || 'تعذر رفع الصورة، تأكد من حجم الملف ونوعه.');
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Tree Modal State
  const [treeModalOpen, setTreeModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentCategoryForNew, setParentCategoryForNew] = useState<Category | null>(null);
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formVertical, setFormVertical] = useState('supermarket');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formOrder, setFormOrder] = useState<number>(0);
  const [formIcon, setFormIcon] = useState('folder');

  const [busy, setBusy] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load backend configurations
  async function loadConfigAndCategories() {
    setLoading(true);
    try {
      // 1. Fetch app-content admin configuration
      const contentRes = await operationsApi('app-content', { action: 'admin' }).catch(() => null);
      if (contentRes) {
        if (contentRes.disabledStoreTypes) setDisabledStoreTypes(contentRes.disabledStoreTypes);
        if (contentRes.disabledCategories) setDisabledCategories(contentRes.disabledCategories);
        if (contentRes.categoryOverrides) setCategoryOverrides(contentRes.categoryOverrides);
      }

      // 2. Fetch categories tree from Supabase if available
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && data) {
        setCategories((data as Category[]) || []);
        const rootIds = new Set((data || []).filter(c => !c.parent_id).map(c => c.id));
        setExpandedNodes(rootIds);
      }
    } catch (err: any) {
      console.warn('Notice loading category data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfigAndCategories();
  }, []);

  // Save updated category configuration to server
  async function persistCategoryConfig(
    updatedDisabledTypes: string[],
    updatedDisabledCats: string[],
    updatedOverrides: Record<string, Partial<CategoryTemplateDefinition>>
  ) {
    setBusy(true);
    try {
      await operationsApi('app-content', {
        action: 'save-category-config',
        disabledStoreTypes: updatedDisabledTypes,
        disabledCategories: updatedDisabledCats,
        categoryOverrides: updatedOverrides
      });
      setAlertMessage({ type: 'success', text: 'تم حفظ وتحديث إعدادات الأقسام بنجاح!' });
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'تعذر حفظ الإعدادات.' });
    } finally {
      setBusy(false);
    }
  }

  // Toggle Store Type Active/Inactive
  const toggleStoreTypeStatus = async (code: string) => {
    const isCurrentlyDisabled = disabledStoreTypes.includes(code);
    const updated = isCurrentlyDisabled
      ? disabledStoreTypes.filter(c => c !== code)
      : [...disabledStoreTypes, code];

    setDisabledStoreTypes(updated);
    await persistCategoryConfig(updated, disabledCategories, categoryOverrides);
  };

  // Toggle Category Template Active/Inactive
  const toggleCategoryStatus = async (code: string) => {
    const isCurrentlyDisabled = disabledCategories.includes(code);
    const updated = isCurrentlyDisabled
      ? disabledCategories.filter(c => c !== code)
      : [...disabledCategories, code];

    setDisabledCategories(updated);
    await persistCategoryConfig(disabledStoreTypes, updated, categoryOverrides);
  };

  // Compute dynamic product count and merchants per category
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; storeNames: Set<string> }> = {};
    
    templates.forEach(cat => {
      stats[cat.code] = { count: 0, storeNames: new Set() };
    });

    products.forEach(p => {
      templates.forEach(cat => {
        if (matchProductToCategory(p, cat.code, cat.name_ar)) {
          stats[cat.code].count += 1;
          if (p.storeName) stats[cat.code].storeNames.add(p.storeName);
        }
      });
    });

    return stats;
  }, [templates, products]);

  // Open Template Edit Modal
  const openEditTemplate = (tmpl: CategoryTemplateDefinition) => {
    const override = categoryOverrides[tmpl.code] || {};
    setEditingTemplate(tmpl);
    setTemplateFormCode(tmpl.code);
    setTemplateFormNameAr(override.name_ar || tmpl.name_ar);
    setTemplateFormNameEn(override.name_en || tmpl.name_en);
    setTemplateFormImage(override.image || tmpl.image);
    setTemplateFormOrder(override.sort_order || tmpl.sort_order);
    setTemplateModalOpen(true);
  };

  // Open Add New Template Modal
  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateFormCode(`CAT-CUSTOM-${Date.now().toString().slice(-4)}`);
    setTemplateFormNameAr('');
    setTemplateFormNameEn('');
    setTemplateFormImage('/categories/fruits_vegetables.jpg');
    setTemplateFormOrder(templates.length + 1);
    setTemplateModalOpen(true);
  };

  // Save Template Edit
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateFormNameAr.trim()) {
      alert('يرجى إدخال اسم القسم بالعربية');
      return;
    }

    const updatedOverrides = {
      ...categoryOverrides,
      [templateFormCode]: {
        name_ar: templateFormNameAr.trim(),
        name_en: templateFormNameEn.trim(),
        image: templateFormImage.trim(),
        sort_order: Number(templateFormOrder) || 1
      }
    };

    setCategoryOverrides(updatedOverrides);

    // If it's a new template, add it to local list
    if (!editingTemplate) {
      const newTmpl: CategoryTemplateDefinition = {
        type_code: 'GROC',
        code: templateFormCode,
        name_ar: templateFormNameAr.trim(),
        name_en: templateFormNameEn.trim(),
        image: templateFormImage.trim(),
        sort_order: Number(templateFormOrder) || templates.length + 1,
        status: 'active'
      };
      setTemplates([...templates, newTmpl]);
    }

    setTemplateModalOpen(false);
    await persistCategoryConfig(disabledStoreTypes, disabledCategories, updatedOverrides);
  };

  // Tree View Helper Functions
  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredCategories = useMemo(() => {
    let list = categories;
    if (selectedVertical !== 'all') {
      list = list.filter(c => c.vertical_id === selectedVertical);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c =>
        c.name_ar.toLowerCase().includes(q) ||
        (c.name_en && c.name_en.toLowerCase().includes(q))
      );
    }
    return list;
  }, [categories, selectedVertical, searchQuery]);

  const tree = useMemo(() => {
    if (searchQuery.trim()) return [];
    return buildCategoryTree(filteredCategories);
  }, [filteredCategories, searchQuery]);

  return (
    <div className="space-y-6 font-cairo" dir="rtl">
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md">
            <FolderTree size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">إدارة الأقسام وتصنيفات المتاجر</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              تحكم كامل في تفعيل أو إيقاف الأقسام، تغيير صورها، وعرض عدد المنتجات والتجار المرتبطين بكل قسم
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'templates' && (
            <button
              onClick={openCreateTemplate}
              className="bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة قسم سوبرماركت جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────────── */}
      {alertMessage && (
        <div
          role="alert"
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
            alertMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{alertMessage.text}</span>
          <button onClick={() => setAlertMessage(null)} className="text-xs underline cursor-pointer">إغلاق</button>
        </div>
      )}

      {/* ── Tabs Selector ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'templates'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ShoppingBag size={15} />
          <span>أقسام منتجات السوبرماركت (الـ 24 قسماً)</span>
          <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{templates.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('storeTypes')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'storeTypes'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <StoreIcon size={15} />
          <span>أنواع المتاجر والأنشطة (16 مفعلاً + 3 مؤجلة)</span>
          <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{storeTypes.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('tree')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'tree'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers size={15} />
          <span>شجرة التصنيفات الهرمية (POS Tree)</span>
        </button>
      </div>

      {/* ── TAB 1: SUPERMARKET CATEGORIES (24 Categories) ───────────────────── */}
      {activeTab === 'templates' && (
        <section className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 p-3.5 rounded-2xl flex items-center justify-between text-xs text-orange-900">
            <div>
              <strong>ملاحظة هامة:</strong> أي قسم تقوم بإيقافه هنا سيختفي فوراً من الصفحة الرئيسية لتطبيق العميل وتختفي معه جميع منتجاته من كافة التجار تلقائياً.
            </div>
            <span className="font-bold text-orange-700">تحديث لحظي</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {templates.map(cat => {
              const override = categoryOverrides[cat.code] || {};
              const nameAr = override.name_ar || cat.name_ar;
              const nameEn = override.name_en || cat.name_en;
              const image = override.image || cat.image;
              const isDisabled = disabledCategories.includes(cat.code) || disabledCategories.includes(nameAr);
              const stats = categoryStats[cat.code] || { count: 0, storeNames: new Set() };
              const storesArray = Array.from(stats.storeNames);

              return (
                <div
                  key={cat.code}
                  className={`bg-white rounded-2xl border p-3.5 flex flex-col justify-between shadow-2xs transition-all ${
                    isDisabled ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-slate-200 hover:border-orange-300'
                  }`}
                >
                  <div>
                    {/* Top Row: Thumbnail + Status Badge */}
                    <div className="flex items-start gap-3 mb-2.5">
                      {/* Category Photo - Uncropped Container */}
                      <div className="w-16 h-16 rounded-xl bg-white border border-slate-100 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={image}
                          alt={nameAr}
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono text-slate-400 truncate">{cat.code}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                              isDisabled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isDisabled ? 'مغلق مؤقتاً' : 'مفعّل'}
                          </span>
                        </div>
                        <h3 className="font-black text-sm text-slate-900 line-clamp-1">{nameAr}</h3>
                        <p className="text-[10px] text-slate-500 truncate">{nameEn}</p>
                      </div>
                    </div>

                    {/* Stats: Product Count & Merchants */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Package size={13} className="text-orange-600" />
                          <span>عدد المنتجات المتاحة:</span>
                        </span>
                        <strong className="text-slate-900 font-black">{stats.count} منتج</strong>
                      </div>

                      {/* Merchants providing this category */}
                      <div className="pt-1">
                        <p className="text-[10px] text-slate-500 mb-1">
                          التجار الذين يوفرون هذا القسم ({storesArray.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {storesArray.length > 0 ? (
                            storesArray.slice(0, 3).map((stName, idx) => (
                              <span key={idx} className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[120px]">
                                {stName}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">لا توجد منتجات مسجلة حالياً</span>
                          )}
                          {storesArray.length > 3 && (
                            <span className="text-[9px] text-orange-600 font-bold">+{storesArray.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Toggle Active + Edit */}
                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleCategoryStatus(cat.code)}
                      disabled={busy}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                        isDisabled
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700'
                      }`}
                    >
                      {isDisabled ? <Eye size={13} /> : <EyeOff size={13} />}
                      <span>{isDisabled ? 'فتح وتفعيل القسم' : 'إغلاق مؤقت'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditTemplate(cat)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={13} />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── TAB 2: STORE TYPES (16 Active + 3 Inactive) ───────────────────────── */}
      {activeTab === 'storeTypes' && (
        <section className="space-y-4">
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div>
              <strong className="text-orange-400">قاعدة الإطلاق الأول:</strong> المطاعم (REST) والكافيهات (CAFE) والصيدليات (PHARM) معطلة افتراضياً ومغلقة مؤقتاً لحماية نطاق الإطلاق.
              يمكنك تفعيل أي منها بنقرة زر عندما تقرر الإدارة ذلك دون تعديل أي كود برمجي.
            </div>
            <span className="text-slate-400">نطاق الإطلاق الأول</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {storeTypes.map(st => {
              const isDisabled = disabledStoreTypes.includes(st.code);
              const storeCount = stores.filter(s => {
                const sType = (s.type || '').toLowerCase();
                const sCat = (s.category || '').toLowerCase();
                return sType.includes(st.name_ar.toLowerCase()) || sCat.includes(st.code.toLowerCase());
              }).length;

              return (
                <div
                  key={st.code}
                  className={`bg-white rounded-2xl border p-4 flex flex-col justify-between shadow-2xs transition-all ${
                    isDisabled ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">{st.code}</span>
                      <span
                        className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                          isDisabled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isDisabled ? 'مغلق مؤقتاً (Inactive)' : 'مفعّل (Active)'}
                      </span>
                    </div>

                    <h3 className="font-black text-sm text-slate-900 mb-0.5">{st.name_ar}</h3>
                    <p className="text-xs text-slate-500 mb-2">{st.name_en}</p>

                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mb-3">
                      <span>المتاجر المسجلة: </span>
                      <strong className="text-slate-900 font-bold">{storeCount} متجر</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleStoreTypeStatus(st.code)}
                      disabled={busy}
                      className={`w-full py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isDisabled
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700'
                      }`}
                    >
                      {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span>{isDisabled ? 'تفعيل وإظهار هذا النشاط' : 'إيقاف النشاط مؤقتاً'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── TAB 3: POS HIERARCHICAL TREE ──────────────────────────────────────── */}
      {activeTab === 'tree' && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-8 flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'كل القطاعات', icon: Layers },
                { id: 'supermarket', label: 'سوبر ماركت وبقالة', icon: ShoppingBag },
                { id: 'restaurant', label: 'مطاعم ومأكولات', icon: Utensils },
                { id: 'pharmacy', label: 'صيدلية ورعاية صحية', icon: Pill },
              ].map(v => {
                const Icon = v.icon;
                const active = selectedVertical === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVertical(v.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Icon size={14} />
                    {v.label}
                  </button>
                );
              })}
            </div>

            <div className="md:col-span-4 relative">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في شجرة الأقسام…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs p-4">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">جارٍ تحميل الشجرة…</div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">لا توجد أقسام مطابقة للبحث</div>
            ) : (
              <div className="space-y-2">
                {filteredCategories.slice(0, 50).map(cat => (
                  <div key={cat.id} className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{cat.name_ar}</span>
                      {cat.name_en && <span className="text-slate-400 text-[10px] mr-2">({cat.name_en})</span>}
                    </div>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono text-slate-500">
                      {cat.vertical_id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── MODAL: EDIT / ADD SUPERMARKET CATEGORY ────────────────────────────── */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">
                {editingTemplate ? `تعديل قسم: ${editingTemplate.name_ar}` : 'إضافة قسم سوبرماركت جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">كود القسم الفريد</label>
                <input
                  type="text"
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono"
                  value={templateFormCode}
                  disabled={Boolean(editingTemplate)}
                  onChange={e => setTemplateFormCode(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم القسم بالعربية</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold"
                  value={templateFormNameAr}
                  onChange={e => setTemplateFormNameAr(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  value={templateFormNameEn}
                  onChange={e => setTemplateFormNameEn(e.target.value)}
                />
              </div>

              {/* Secure Image Upload & Instant Preview (Zero Exposed Raw URLs) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">صورة القسم</label>
                <input
                  type="file"
                  ref={categoryImageUploadRef}
                  accept="image/*"
                  onChange={handleCategoryImageUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                    {templateFormImage ? (
                      <img
                        src={templateFormImage}
                        alt="معاينة صورة القسم"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/brand/sangoub-mark-white-128.png';
                        }}
                      />
                    ) : (
                      <ImageIcon size={26} className="text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800 mb-0.5">
                      {templateFormImage ? 'تم تعيين صورة معتمدة للقسم' : 'لم يتم اختيار صورة بعد'}
                    </p>
                    <p className="text-[10.5px] text-slate-500 mb-2">
                      رفع آمن ومباشر من الجهاز بصيغ (JPG, PNG, WebP)
                    </p>
                    <button
                      type="button"
                      onClick={() => categoryImageUploadRef.current?.click()}
                      disabled={isUploadingImage}
                      className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingImage ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      <span>{isUploadingImage ? 'جارٍ رفع الصورة…' : 'رفع صورة من جهازك'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ترتيب العرض</label>
                <input
                  type="number"
                  min="1"
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  value={templateFormOrder}
                  onChange={e => setTemplateFormOrder(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl shadow-xs"
                >
                  {busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
