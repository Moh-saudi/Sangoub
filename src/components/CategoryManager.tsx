import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Category } from '../types';
import { buildCategoryTree, getCategoryBreadcrumb } from '../lib/categoryTree';
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
} from 'lucide-react';

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentCategoryForNew, setParentCategoryForNew] = useState<Category | null>(null);

  // Form Fields
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formVertical, setFormVertical] = useState('supermarket');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formOrder, setFormOrder] = useState<number>(0);
  const [formIcon, setFormIcon] = useState('folder');
  const [busy, setBusy] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function fetchCategories() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories((data as Category[]) || []);
      
      // Auto-expand top-level categories by default
      const rootIds = new Set((data || []).filter(c => !c.parent_id).map(c => c.id));
      setExpandedNodes(rootIds);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setAlertMessage({ type: 'error', text: 'تعذر تحميل الأقسام. تحقق من الاتصال بالخادم.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchCategories();
  }, []);

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
    if (searchQuery.trim()) return []; // Flat search list when searching
    return buildCategoryTree(filteredCategories);
  }, [filteredCategories, searchQuery]);

  function openCreateModal(parent?: Category) {
    setEditingCategory(null);
    setParentCategoryForNew(parent || null);
    setFormNameAr('');
    setFormNameEn('');
    setFormVertical(parent?.vertical_id || (selectedVertical !== 'all' ? selectedVertical : 'supermarket'));
    setFormParentId(parent?.id || '');
    setFormOrder(0);
    setFormIcon(parent ? 'tag' : 'folder');
    setModalOpen(true);
  }

  function openEditModal(cat: Category) {
    setEditingCategory(cat);
    setParentCategoryForNew(null);
    setFormNameAr(cat.name_ar);
    setFormNameEn(cat.name_en || '');
    setFormVertical(cat.vertical_id);
    setFormParentId(cat.parent_id || '');
    setFormOrder(cat.display_order || 0);
    setFormIcon(cat.icon || 'folder');
    setModalOpen(true);
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!formNameAr.trim()) {
      alert('يرجى كتابة اسم القسم بالعربية.');
      return;
    }

    setBusy(true);
    setAlertMessage(null);

    const slug = (formNameEn ? formNameEn.toLowerCase().replace(/\s+/g, '-') : 'cat-' + Date.now()) + '-' + Math.floor(Math.random() * 1000);

    const payload = {
      name_ar: formNameAr.trim(),
      name_en: formNameEn.trim() || null,
      vertical_id: formVertical,
      parent_id: formParentId || null,
      display_order: Number(formOrder) || 0,
      icon: formIcon || 'folder',
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editingCategory.id);
        if (error) throw error;
        setAlertMessage({ type: 'success', text: `تم تحديث القسم "${formNameAr}" بنجاح!` });
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({ ...payload, slug });
        if (error) throw error;
        setAlertMessage({ type: 'success', text: `تم إضافة القسم "${formNameAr}" بنجاح!` });
      }

      setModalOpen(false);
      await fetchCategories();
    } catch (err: any) {
      console.error('Error saving category:', err);
      setAlertMessage({ type: 'error', text: err.message || 'تعذر حفظ القسم.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!window.confirm(`هل أنت متأكد من حذف القسم "${name}"؟ إذا كان يحتوي على أقسام فرعية فسيتم حذفها أيضاً.`)) {
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setAlertMessage({ type: 'success', text: `تم حذف القسم "${name}" بنجاح.` });
      await fetchCategories();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      setAlertMessage({ type: 'error', text: 'تعذر حذف القسم. قد يكون مرتبطاً بمنتجات نشطة.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section dir="rtl" className="category-manager space-y-6 pb-12 font-sans" aria-label="إدارة شجرة التصنيفات">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md">
            <FolderTree size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">شجرة الأقسام والتصنيفات الهرمية</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة الهيكل الموحد للمنصة (أقسام رئيسية ⬅ فرعية ⬅ دقيقة) لدعم آلاف الأصناف ومطابقة الكاشير والـ POS
            </p>
          </div>
        </div>

        <button
          onClick={() => openCreateModal()}
          className="bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all text-white px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Plus size={18} />
          إضافة قسم رئيسي جديد
        </button>
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────────────── */}
      {alertMessage && (
        <div
          role="alert"
          className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between ${
            alertMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span>{alertMessage.text}</span>
          <button onClick={() => setAlertMessage(null)} className="text-xs underline cursor-pointer">إغلاق</button>
        </div>
      )}

      {/* ── Filter Bar & Search ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Verticals Filter Pills */}
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
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
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

        {/* Search Input */}
        <div className="md:col-span-4 relative">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث في أسماء الأقسام والتصنيفات…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
          />
        </div>
      </div>

      {/* ── Category Tree View ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <Loader2 className="animate-spin text-orange-600 mx-auto" size={32} />
            <p className="text-sm text-slate-500 font-medium">جارٍ تحميل شجرة التصنيفات…</p>
          </div>
        ) : searchQuery.trim() ? (
          /* Flat Search Results Mode */
          <div className="p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 px-2">نتائج البحث ({filteredCategories.length} قسم):</p>
            {filteredCategories.map(cat => (
              <div key={cat.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-between border border-slate-200 transition-colors">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{cat.name_ar}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{getCategoryBreadcrumb(categories, cat.id)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditModal(cat)} className="p-2 text-slate-600 hover:text-orange-600 rounded-xl">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDeleteCategory(cat.id, cat.name_ar)} className="p-2 text-slate-600 hover:text-red-600 rounded-xl">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {!filteredCategories.length && (
              <p className="p-10 text-center text-sm text-slate-500">لا توجد أقسام تطابق البحث.</p>
            )}
          </div>
        ) : (
          /* Hierarchical Nested Tree Mode */
          <div className="divide-y divide-slate-100">
            {tree.map(root => (
              <div key={root.id} className="p-4 space-y-3">
                {/* Level 1: Root Category */}
                <div className="flex items-center justify-between bg-slate-50/80 hover:bg-slate-100/80 p-3.5 rounded-2xl border border-slate-200/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(root.id)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-orange-600 transition-colors cursor-pointer"
                    >
                      {expandedNodes.has(root.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                      L1
                    </span>
                    <div>
                      <span className="font-black text-slate-900 text-sm">{root.name_ar}</span>
                      {root.name_en && <span className="text-xs text-slate-400 mr-2 font-mono">({root.name_en})</span>}
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {root.children?.length || 0} أقسام فرعية
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openCreateModal(root)}
                      className="px-3 py-1.5 bg-white hover:bg-orange-50 hover:text-orange-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="إضافة قسم فرعي تحت هذا القسم"
                    >
                      <Plus size={13} />
                      إضافة فرعي
                    </button>
                    <button
                      onClick={() => openEditModal(root)}
                      className="p-2 text-slate-500 hover:text-orange-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                      title="تعديل"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(root.id, root.name_ar)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Level 2 & 3: Children Accordion */}
                {expandedNodes.has(root.id) && root.children && root.children.length > 0 && (
                  <div className="mr-8 space-y-2 border-r-2 border-orange-200 pr-4 mt-2">
                    {root.children.map(sub => (
                      <div key={sub.id} className="space-y-2">
                        {/* Level 2 Item */}
                        <div className="flex items-center justify-between bg-white hover:bg-slate-50 p-2.5 rounded-xl border border-slate-200 transition-colors">
                          <div className="flex items-center gap-2.5">
                            {sub.children && sub.children.length > 0 ? (
                              <button
                                onClick={() => toggleExpand(sub.id)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-800"
                              >
                                {expandedNodes.has(sub.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                              </button>
                            ) : (
                              <span className="w-5 h-5 flex items-center justify-center text-slate-300">•</span>
                            )}
                            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                              L2
                            </span>
                            <div>
                              <span className="font-bold text-xs text-slate-800">{sub.name_ar}</span>
                              {sub.name_en && <span className="text-[11px] text-slate-400 mr-2 font-mono">({sub.name_en})</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openCreateModal(sub)}
                              className="px-2.5 py-1 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg text-[11px] font-bold flex items-center gap-1"
                              title="إضافة قسم صب-فرعي"
                            >
                              <Plus size={11} />
                              إضافة صب-فرعي
                            </button>
                            <button
                              onClick={() => openEditModal(sub)}
                              className="p-1.5 text-slate-400 hover:text-orange-600 rounded-lg"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(sub.id, sub.name_ar)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Level 3: Sub-sub children */}
                        {expandedNodes.has(sub.id) && sub.children && sub.children.length > 0 && (
                          <div className="mr-6 space-y-1.5 border-r border-slate-300 pr-3">
                            {sub.children.map(child => (
                              <div
                                key={child.id}
                                className="flex items-center justify-between bg-slate-50/60 p-2 rounded-lg text-xs hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[9px]">
                                    L3
                                  </span>
                                  <span className="font-medium text-slate-700">{child.name_ar}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openEditModal(child)} className="p-1 text-slate-400 hover:text-orange-600">
                                    <Edit2 size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteCategory(child.id, child.name_ar)} className="p-1 text-slate-400 hover:text-red-600">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!tree.length && (
              <div className="p-12 text-center space-y-3">
                <FolderTree size={36} className="mx-auto text-slate-300" />
                <p className="text-slate-500 font-bold text-sm">لا توجد أقسام مسجلة في هذا القطاع حتى الآن.</p>
                <button
                  onClick={() => openCreateModal()}
                  className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold"
                >
                  إضافة أول قسم رئيسي
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal إضافة / تعديل قسم ─────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {editingCategory ? 'تعديل بيانات القسم' : parentCategoryForNew ? `إضافة قسم فرعي تحت "${parentCategoryForNew.name_ar}"` : 'إضافة قسم رئيسي جديد'}
                </h3>
                <p className="text-xs text-slate-500">
                  {parentCategoryForNew ? 'المستوى الفرعي (Child Category)' : 'المستوى الرئيسي للشجرة'}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </header>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم القسم بالعربية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ألبان وأجبان، وجبات عائلية، مسكنات"
                  value={formNameAr}
                  onChange={e => setFormNameAr(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الاسم بالإنجليزية (اختياري - للـ SEO وتوليد الرابط)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="e.g. Dairy & Cheese, Family Meals"
                  value={formNameEn}
                  onChange={e => setFormNameEn(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">القطاع التجاري</label>
                  <select
                    value={formVertical}
                    onChange={e => setFormVertical(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-orange-600"
                  >
                    <option value="supermarket">سوبر ماركت وبقالة</option>
                    <option value="restaurant">مطاعم ومأكولات</option>
                    <option value="pharmacy">صيدلية وعناية</option>
                    <option value="retail">تجزئة ومحلات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ترتيب العرض (الرقم الأقل أولاً)</label>
                  <input
                    type="number"
                    value={formOrder}
                    onChange={e => setFormOrder(Number(e.target.value))}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-orange-600"
                  />
                </div>
              </div>

              {/* Parent Selector if not predefined */}
              {!parentCategoryForNew && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">القسم الرئيسي التابع له</label>
                  <select
                    value={formParentId}
                    onChange={e => setFormParentId(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:border-orange-600"
                  >
                    <option value="">(قسم رئيسي مستقل - المستوى الأول L1)</option>
                    {categories
                      .filter(c => !editingCategory || c.id !== editingCategory.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.parent_id ? '  ↳ ' : '• '} {c.name_ar}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <footer className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingCategory ? 'حفظ التعديلات' : 'إضافة القسم الآن'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

