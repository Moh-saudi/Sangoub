import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, ArrowUp, ArrowDown, X, Megaphone, Image as ImageIcon, Upload, Check, Trash2, Eye, EyeOff } from 'lucide-react';
import type { Product, Store } from '../types';
import { defaultCustomerHome, type CustomerHome, type Promotion } from '../types/appContent';
import { operationsApi } from '../lib/operationsApi';
import { cairoDateInput, cairoInputToIso } from '../utils/cairoTime';
import { uploadCatalogImage } from '../lib/catalogImages';

interface GalleryItem {
  id: string;
  title: string;
  url: string;
  addedAt: string;
}

const labels = { slider: 'سلايدر الحملات', stores: 'المتاجر', offers: 'المنتجات المخفضة', products: 'المنتجات والتصنيفات' };
const field = 'form-control';

export function AppContentManager({ stores, products }: { stores: Store[]; products: Product[] }) {
  const [config, setConfig] = useState<CustomerHome>(structuredClone(defaultCustomerHome));
  const [campaigns, setCampaigns] = useState<Promotion[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [ready, setReady] = useState(false), [enabled, setEnabled] = useState(false), [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ campaign?: Promotion } | null>(null), [targetType, setTargetType] = useState('offers');
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [targetCampaignForReplacement, setTargetCampaignForReplacement] = useState<Promotion | null>(null);
  const [useGalleryItemTarget, setUseGalleryItemTarget] = useState<GalleryItem | null>(null);
  
  const dialog = useRef<HTMLDialogElement>(null);
  const galleryDialog = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryUploadRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let active = true;
    setError('');
    operationsApi('app-content', { action: 'admin' })
      .then(result => {
        if (!active) return;
        if (!dirty.current) setConfig(result.config);
        setCampaigns(result.campaigns || []);
        setGallery(result.gallery || []);
        setReady(result.operationsReady);
        setEnabled(result.operationsEnabled);
        setLoaded(true);
      })
      .catch(error => {
        if (active) setError(error.message);
      });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    if (editor) {
      setCurrentImageUrl(editor.campaign?.imageUrl || '');
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [editor]);

  useEffect(() => {
    if (isGalleryModalOpen) {
      galleryDialog.current?.showModal();
    } else {
      galleryDialog.current?.close();
    }
  }, [isGalleryModalOpen]);

  async function perform(body: object, success: string, close = false) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operationsApi('app-content', body);
      if ((body as { action?: string }).action === 'save-home') dirty.current = false;
      setNotice(success);
      if (close) setEditor(null);
      setRevision(value => value + 1);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    dirty.current = true;
    setConfig(previous => {
      const sections = [...previous.sections];
      [sections[index], sections[index + delta]] = [sections[index + delta], sections[index]];
      return { ...previous, sections };
    });
  }

  function open(campaign?: Promotion) {
    setError('');
    setTargetType(campaign?.targetType || 'offers');
    setCurrentImageUrl(campaign?.imageUrl || '');
    setEditor({ campaign });
  }

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
      setGallery(prev => [newItem, ...prev]);
      if (forEditor) {
        setCurrentImageUrl(res.url);
      }
      setNotice('تم رفع الصورة وحفظها في معرض السلايدر بنجاح!');
    } catch (err: any) {
      setError(err.message || 'تعذر رفع الصورة.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function toggleCampaign(id: string) {
    setBusy(true);
    setError('');
    try {
      await operationsApi('app-content', { action: 'toggle-campaign', id });
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
      setNotice('تم تحديث حالة الحملة.');
      setRevision(v => v + 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyImageToCampaign(campaign: Promotion, imageUrl: string) {
    setBusy(true);
    setError('');
    try {
      const updated = { ...campaign, imageUrl };
      await operationsApi('app-content', { action: 'save-campaign', campaign: updated });
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? updated : c));
      setNotice(`تم استبدال صورة الشريحة "${campaign.title}" بنجاح! والصورة القديمة محفوظة في الجاليري.`);
      setTargetCampaignForReplacement(null);
      setUseGalleryItemTarget(null);
      setIsGalleryModalOpen(false);
      setRevision(v => v + 1);
    } catch (err: any) {
      setError(err.message || 'تعذر استبدال الصورة.');
    } finally {
      setBusy(false);
    }
  }

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

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const imageUrl = currentImageUrl.trim() || String(data.get('imageUrl') || '').trim();
    if (!imageUrl) {
      setError('يرجى اختيار صورة للحملة من المعرض أو رفع صورة جديدة.');
      return;
    }

    try {
      const campaign = {
        title: String(data.get('title') || '').trim(),
        subtitle: String(data.get('subtitle') || '').trim(),
        imageUrl,
        enabled: data.get('enabled') === 'on',
        priority: Number(data.get('priority')),
        targetType,
        targetId: String(data.get('targetId') || ''),
        startsAt: cairoInputToIso(String(data.get('startsAt'))),
        endsAt: cairoInputToIso(String(data.get('endsAt')))
      };
      await perform({ action: 'save-campaign', id: editor?.campaign?.id || crypto.randomUUID(), campaign }, 'تم حفظ الحملة بنجاح وتحديث سلايدر المتجر.', true);
    } catch (error) {
      setError((error as Error).message);
    }
  }

  return (
    <section className="space-y-6 font-cairo" aria-label="إدارة واجهة التطبيق والحملات" dir="rtl">
      
      {/* ── Top Header ── */}
      <header className="ops-heading flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">التسويق وتجربة العميل</p>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">سلايدر العروض والحملات الرئيسية</h1>
          <p className="text-xs text-slate-500 mt-1">تحكم في شرائح السلايدر للويب وتطبيق الموبايل، واستبدل الصور مع الاحتفاظ بها في الجاليري لإعادة استخدامها.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            onClick={() => setIsGalleryModalOpen(true)}
          >
            <ImageIcon size={16} className="text-orange-600" />
            <span>معرض صور السلايدر ({gallery.length})</span>
          </button>
          
          <button
            type="button"
            className="admin-primary btn btn-primary px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            disabled={!loaded || busy || campaigns.length >= 100}
            onClick={() => open()}
          >
            <Plus size={18} />
            <span>إضافة حملة جديدة</span>
          </button>
        </div>
      </header>

      {/* Notifications / Errors */}
      {!editor && error && <p role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold">{error}</p>}
      {notice && <p role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">{notice}</p>}

      {!loaded ? (
        <div className="admin-empty p-12 text-center bg-white rounded-2xl border border-slate-200" role="status">
          {error ? <button className="admin-primary px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold" onClick={() => setRevision(value => value + 1)}>إعادة المحاولة</button> : 'جارٍ تحميل إعدادات السلايدر والحملات…'}
        </div>
      ) : (
        <>
          {/* ── Active Campaigns Management Table ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>شرائح السلايدر والحملات الحالية</span>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full font-bold">{campaigns.length}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">يمكنك إيقاف أو تفعيل أي حملة بضغطة زر دون حذفها، لتظل محفوظة للاستخدام في المواسم القادمة.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3">الصورة</th>
                    <th className="p-3">عنوان الحملة</th>
                    <th className="p-3">الهدف والوجهة</th>
                    <th className="p-3">الموعد</th>
                    <th className="p-3">الحالة والظهور</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...campaigns].sort((a, b) => a.priority - b.priority).map(campaign => (
                    <tr key={campaign.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <div className="w-16 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                          <img
                            src={campaign.imageUrl}
                            alt={campaign.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <strong className="text-slate-900 font-black block">{campaign.title}</strong>
                        <span className="text-[11px] text-slate-500 line-clamp-1">{campaign.subtitle}</span>
                        <small className="text-[10px] text-orange-600 font-bold block mt-0.5">الترتيب: {campaign.priority}</small>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[11px]">
                          {campaign.targetType === 'offers' ? '🏷️ صفحة العروض' : campaign.targetType === 'product' ? `🍔 ${products.find(p => p.id === campaign.targetId)?.name || 'منتج'}` : `🏪 ${stores.find(s => s.id === campaign.targetId)?.name || 'متجر'}`}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        <div>{cairoDateInput(campaign.startsAt).replace('T', ' ')}</div>
                        <div>إلى {cairoDateInput(campaign.endsAt).replace('T', ' ')}</div>
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
                          title={campaign.enabled ? 'اضغط للإيقاف المؤقت' : 'اضغط للتفعيل على السلايدر'}
                        >
                          {campaign.enabled ? (
                            <>
                              <Eye size={13} />
                              <span>مفعلة وتظهر الآن</span>
                            </>
                          ) : (
                            <>
                              <EyeOff size={13} />
                              <span>موقوفة مؤقتاً</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                            disabled={busy}
                            onClick={() => {
                              setTargetCampaignForReplacement(campaign);
                              setIsGalleryModalOpen(true);
                            }}
                            title="استبدال صورة هذه الشريحة بصورة من الجاليري مباشرة"
                          >
                            <ImageIcon size={12} />
                            <span>استبدال الصورة</span>
                          </button>
                          <button
                            type="button"
                            className="px-2.5 py-1 bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-600 rounded-lg font-bold text-xs transition cursor-pointer"
                            disabled={busy}
                            onClick={() => open(campaign)}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold text-xs transition cursor-pointer"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm('هل تريد حذف هذه الشريحة؟ (ستظل الصورة محفوظة في الجاليري لاستخدامها لاحقاً).')) {
                                void perform({ action: 'delete-campaign', id: campaign.id }, 'تم حذف الحملة بنجاح.');
                              }
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!campaigns.length && (
              <div className="p-10 text-center text-slate-500">
                <Megaphone size={32} className="mx-auto text-slate-300 mb-2" />
                <h3 className="font-bold text-sm text-slate-700">لا توجد حملات مضافة حالياً</h3>
                <p className="text-xs text-slate-400 mt-1">اضغط على زر "إضافة حملة جديدة" لاختيار صورة من الجاليري وعرضها في السلايدر.</p>
              </div>
            )}
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
                <p className="text-xs text-slate-500 mt-0.5">جميع الصور التي ترفعها تظل محفوظة هنا دائماً في Cloudflare R2؛ يمكنك استبدال الصور الحالية وإعادة استخدام الصور القديمة في أي وقت.</p>
              </div>

              {/* Upload to Gallery Button */}
              <div>
                <input
                  type="file"
                  ref={galleryUploadRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => galleryUploadRef.current?.click()}
                  className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  <span>{uploadingImage ? 'جارٍ رفع الصورة…' : 'رفع صورة جديدة للجليري 📤'}</span>
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
                        onClick={() => setUseGalleryItemTarget(item)}
                        className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-[10px] font-bold transition shadow-2xs cursor-pointer"
                        title="استخدم هذه الصورة لاستبدال شريحة حالية أو إنشاء شريحة جديدة"
                      >
                        استخدم الصورة
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
              {config.sections.map((section, index) => (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200" key={section.type}>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      disabled={busy}
                      onChange={event => {
                        dirty.current = true;
                        setConfig(previous => ({
                          ...previous,
                          sections: previous.sections.map(item => item.type === section.type ? { ...item, enabled: event.target.checked } : item)
                        }));
                      }}
                      className="rounded text-orange-600"
                    />
                    <span>{labels[section.type]}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label={`تقديم ${labels[section.type]}`}
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                      className="p-1 bg-white hover:bg-slate-200 rounded border border-slate-200 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      aria-label={`تأخير ${labels[section.type]}`}
                      disabled={busy || index === config.sections.length - 1}
                      onClick={() => move(index, 1)}
                      className="p-1 bg-white hover:bg-slate-200 rounded border border-slate-200 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  وضع شرائح السلايدر
                  <select
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    value={config.sliderMode}
                    onChange={event => {
                      dirty.current = true;
                      setConfig(previous => ({ ...previous, sliderMode: event.target.value as CustomerHome['sliderMode'] }));
                    }}
                  >
                    <option value="manual">الحملات اليدوية المفعلة (الموصى به)</option>
                    <option value="automatic">تلقائي من المنتجات المخفضة</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  أقصى عدد للشرائح المعروضة
                  <input
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    type="number"
                    min="1"
                    max="10"
                    value={config.maxSlides}
                    onChange={event => {
                      dirty.current = true;
                      setConfig(previous => ({ ...previous, maxSlides: Number(event.target.value) }));
                    }}
                  />
                </label>
              </div>

              <button
                className="mt-3 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                disabled={busy}
                onClick={() => perform({ action: 'save-home', config }, 'تم حفظ ترتيب الصفحة وإعدادات السلايدر.')}
              >
                حفظ إعدادات الصفحة
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── Modal: Campaign Editor (With Gallery Picker Integration) ── */}
      <dialog
        ref={dialog}
        className="fixed inset-0 m-auto z-50 rounded-3xl p-0 border border-slate-200 shadow-2xl max-w-lg w-full max-h-[92vh] backdrop:bg-black/60 overflow-y-auto font-cairo"
        dir="rtl"
        aria-label="محرر الحملة"
        onCancel={event => { if (busy) event.preventDefault(); else setEditor(null); }}
        onClose={() => { if (!busy) setEditor(null); }}
      >
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="font-black text-base">{editor?.campaign ? 'تعديل شريحة السلايدر' : 'إضافة شريحة سلايدر جديدة'}</h2>
          <button disabled={busy} aria-label="إغلاق" onClick={() => setEditor(null)} className="p-1 hover:bg-white/20 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        {editor && (
          <form className="p-5 space-y-3.5" onSubmit={saveCampaign}>
            <fieldset disabled={busy} className="space-y-3">
              
              {/* Campaign Title (Optional) */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  عنوان الحملة الرئيسي <span className="text-slate-400 font-normal">(اختياري - اتركه فارغاً إذا كان التصميم يحتوي على نص):</span>
                </label>
                <input
                  name="title"
                  maxLength={120}
                  defaultValue={editor.campaign?.title || ''}
                  placeholder="اختياري: مثال سنجوب ماركت وكل طلبات البيت لحد بابك"
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-orange-500"
                />
              </div>

              {/* Campaign Subtitle */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">وصف مختصر / السلوجان:</label>
                <input
                  name="subtitle"
                  maxLength={250}
                  defaultValue={editor.campaign?.subtitle || ''}
                  placeholder="مثال: ألبان ومياه ومستلزماتك اليومية بأعلى سرعة وجودة."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:bg-white focus:border-orange-500"
                />
              </div>

              {/* Image Picker & Upload Section */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">صورة شريحة السلايدر:</label>
                
                {/* Live Image Preview */}
                {currentImageUrl && (
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 mb-2">
                    <img src={currentImageUrl} alt="معاينة" className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">معاينة الصورة الحالية</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGalleryModalOpen(true)}
                    className="flex-1 py-2 px-3 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ImageIcon size={15} />
                    <span>اختر صورة من الجاليري 🖼️</span>
                  </button>

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
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={14} />
                    <span>{uploadingImage ? 'جارٍ الرفع…' : 'رفع صورة من جهازك 📤'}</span>
                  </button>
                </div>

                <input type="hidden" name="imageUrl" value={currentImageUrl} />
              </div>

              {/* Target Type & Priority */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-slate-700">
                  نوع الهدف والوجهة
                  <select
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    value={targetType}
                    onChange={event => setTargetType(event.target.value)}
                  >
                    <option value="offers">صفحة العروض والتخفيضات</option>
                    <option value="store">متجر / مطعم محدد</option>
                    <option value="product">منتج محدد</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  أولوية الترتيب
                  <input
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    name="priority"
                    type="number"
                    min="0"
                    max="1000"
                    required
                    defaultValue={editor.campaign?.priority ?? 10}
                  />
                </label>
              </div>

              {/* Target Selector */}
              {targetType !== 'offers' && (
                <label className="block text-xs font-bold text-slate-700">
                  اختر {targetType === 'product' ? 'المنتج' : 'المتجر'}
                  <select
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    name="targetId"
                    required
                    key={targetType}
                    defaultValue={editor.campaign?.targetType === targetType ? editor.campaign.targetId : ''}
                  >
                    <option value="" disabled>اختر الهدف</option>
                    {(targetType === 'product' ? products.filter(product => !product.archived) : stores).map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Date Ranges */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-slate-700">
                  بداية الحملة
                  <input
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    type="datetime-local"
                    name="startsAt"
                    required
                    defaultValue={cairoDateInput(editor.campaign?.startsAt || Date.now())}
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  نهاية الحملة
                  <input
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                    type="datetime-local"
                    name="endsAt"
                    required
                    defaultValue={cairoDateInput(editor.campaign?.endsAt || Date.now() + 365 * 86400000)}
                  />
                </label>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={editor.campaign?.enabled ?? true}
                  className="rounded text-orange-600"
                />
                <span>تفعيل الشريحة وعرضها في السلايدر فوراً</span>
              </label>

            </fieldset>

            {error && <p role="alert" className="p-2 bg-red-50 text-red-600 rounded text-xs font-bold">{error}</p>}

            <button
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={busy}
            >
              <Check size={16} strokeWidth={2.5} />
              <span>{busy ? 'جارٍ الحفظ…' : 'حفظ الشريحة وعرضها في المتجر'}</span>
            </button>
          </form>
        )}
      </dialog>

      {/* ── Modal: Gallery Picker (Select previous images or upload) ── */}
      <dialog
        ref={galleryDialog}
        className="fixed inset-0 m-auto z-50 rounded-3xl p-0 border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[88vh] backdrop:bg-black/60 overflow-hidden font-cairo"
        dir="rtl"
        aria-label="معرض صور السلايدر"
        onCancel={() => setIsGalleryModalOpen(false)}
        onClose={() => setIsGalleryModalOpen(false)}
      >
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-orange-500" />
            <h2 className="font-black text-base">معرض صور السلايدر (اختر صورة للشريحة)</h2>
          </div>
          <button onClick={() => setIsGalleryModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2 bg-orange-50 p-3 rounded-2xl border border-orange-200">
            <p className="text-xs text-orange-900 font-bold">اضغط على أي صورة لاختيارها فوراً لشريحة السلايدر الحالية.</p>
            <button
              type="button"
              disabled={uploadingImage}
              onClick={() => galleryUploadRef.current?.click()}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer disabled:opacity-50"
            >
              <Upload size={13} />
              <span>{uploadingImage ? 'جارٍ الرفع…' : 'رفع صورة جديدة 📤'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {gallery.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setCurrentImageUrl(item.url);
                  setIsGalleryModalOpen(false);
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
