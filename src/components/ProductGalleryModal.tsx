import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Search,
  UploadCloud,
  Check,
  Loader2,
  Trash2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Plus,
  Pencil,
  Tag
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { operationsApi } from '../lib/operationsApi';
import { uploadCatalogImage } from '../lib/catalogImages';

export interface GalleryItem {
  id: string;
  title: string;
  url: string;
  category?: string;
  addedAt?: string;
  isCustom?: boolean;
}

interface ProductGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string, title?: string) => void;
  currentImageUrl?: string;
  title?: string;
}

export const GALLERY_CATEGORIES = [
  { id: 'all', label: 'جميع الأصناف' },
  { id: 'dairy', label: 'ألبان وأجبان' },
  { id: 'grocery', label: 'بقالة ومعلبات' },
  { id: 'produce', label: 'خضار وفواكه' },
  { id: 'bakery', label: 'مخبوزات وحلويات' },
  { id: 'beverages', label: 'مشروبات وعصائر' },
  { id: 'meat', label: 'لحوم ودواجن' },
  { id: 'snacks', label: 'شيبس وتسالي' },
  { id: 'cleaning', label: 'منظفات وعناية' },
  { id: 'other', label: 'أصناف متنوعة' },
] as const;

interface PendingBatchItem {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  category: string;
}

// Curated high quality product photography for quick selection
const DEFAULT_CURATED_PRODUCTS: GalleryItem[] = [
  // ألبان وأجبان
  { id: 'cur-1', title: 'حليب كامل الدسم 1 لتر', category: 'dairy', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-2', title: 'جبنة بيضاء فيتا كريمي', category: 'dairy', url: 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-3', title: 'جبن رومي وشيدر أصفر', category: 'dairy', url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-4', title: 'زبادي طبيعي طازج', category: 'dairy', url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-5', title: 'زبدة طبيعية فاخرة', category: 'dairy', url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-6', title: 'بيض مزارع طازج 30 بيضة', category: 'dairy', url: 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=600&q=80' },

  // بقالة ومعلبات
  { id: 'cur-7', title: 'زيت عباد الشمس 1 لتر', category: 'grocery', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-8', title: 'أرز مصري أبيض فاخر 1 كجم', category: 'grocery', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-9', title: 'سكر أبيض نقي 1 كجم', category: 'grocery', url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-10', title: 'مكرونة فرن إيطالية 400 جم', category: 'grocery', url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281692?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-11', title: 'صلصة طماطم معجون برطمان', category: 'grocery', url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-12', title: 'علبة تونة قطع في الزيت', category: 'grocery', url: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-13', title: 'فول مدمس درجة أولى', category: 'grocery', url: 'https://images.unsplash.com/photo-1585476962176-963d76e73c8d?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-14', title: 'شاي أسود ناعم أحمر', category: 'grocery', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-15', title: 'بُن قهوة تركي محوج', category: 'grocery', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80' },

  // خضروات وفواكه
  { id: 'cur-16', title: 'طماطم بلدي طازجة 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-17', title: 'خيار بلدي طازج 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-18', title: 'بطاطس تحمير ممتازة 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-19', title: 'بصل أحمر مصري 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-20', title: 'موز بلدي فاخر 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-21', title: 'تفاح أحمر سكري 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-22', title: 'برتقال عصير طازج 1 كجم', category: 'produce', url: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-23', title: 'ليمون أصفر بلدي 500 جم', category: 'produce', url: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&w=600&q=80' },

  // مخبوزات وحلويات
  { id: 'cur-24', title: 'خبز فينو طازج كيس 5 رغيف', category: 'bakery', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-25', title: 'خبز بلدي طازج بالردة', category: 'bakery', url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-26', title: 'خبز توست أبيض شرائح', category: 'bakery', url: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-27', title: 'كرواسون زبدة سادة وشوكولاتة', category: 'bakery', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-28', title: 'شوكولاتة بالحليب والبندق', category: 'bakery', url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=600&q=80' },

  // مشروبات وعصائر
  { id: 'cur-29', title: 'مياه معدنية طبيعية 1.5 لتر', category: 'beverages', url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-30', title: 'مشروب غازي كانز 330 مل', category: 'beverages', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-31', title: 'عصير برتقال طبيعي 1 لتر', category: 'beverages', url: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-32', title: 'عصير مانجو طبيعي فاخر', category: 'beverages', url: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80' },

  // شيبس وتسالي
  { id: 'cur-33', title: 'رقائق بطاطس مقرمشة شيبسي', category: 'snacks', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-34', title: 'مكسرات مشكلة محمصة مملحة', category: 'snacks', url: 'https://images.unsplash.com/photo-1536591375315-1988d689622d?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-35', title: 'بسكويت ويفر بالشوكولاتة', category: 'snacks', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80' },

  // لحوم ودواجن
  { id: 'cur-36', title: 'صدور دجاج بانيه طازجة 1 كجم', category: 'meat', url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-37', title: 'لحم مفروم بلدي طازج 1 كجم', category: 'meat', url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-38', title: 'برجر لحم بقري فاخر', category: 'meat', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },

  // منظفات وعناية
  { id: 'cur-39', title: 'مسحوق غسيل أوتوماتيك 2.5 كجم', category: 'cleaning', url: 'https://images.unsplash.com/photo-1585670270608-b4be4fb880ed?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-40', title: 'سائل غسيل الأطباق بالليمون 1 لتر', category: 'cleaning', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-41', title: 'مناديل مطبخ وتواليت رول', category: 'cleaning', url: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=600&q=80' },
  { id: 'cur-42', title: 'صابون يدين سائل مرطب 500 مل', category: 'cleaning', url: 'https://images.unsplash.com/photo-1600428877878-1a0ee97bed84?auto=format&fit=crop&w=600&q=80' },
];

export function ProductGalleryModal({
  isOpen,
  onClose,
  onSelectImage,
  currentImageUrl,
  title = 'معرض صور الأصناف والمنتجات',
}: ProductGalleryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [customItems, setCustomItems] = useState<GalleryItem[]>([]);
  const [catalogItems, setCatalogItems] = useState<GalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch upload state
  const [pendingBatch, setPendingBatch] = useState<PendingBatchItem[] | null>(null);
  const [batchGlobalCategory, setBatchGlobalCategory] = useState<string>('grocery');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Edit custom item modal
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('grocery');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Load custom gallery items from Supabase app_content & catalog products
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadGalleryData() {
      setIsLoading(true);
      setErrorNotice('');
      try {
        // 1. Fetch custom uploaded product gallery from app_content
        const { data: row } = await supabase.from('app_content').select('content').eq('id', true).maybeSingle();
        let content: any = row?.content;
        if (typeof content === 'string') {
          try { content = JSON.parse(content); } catch {}
        }
        if (content && Array.isArray(content.productGallery) && mounted) {
          setCustomItems(content.productGallery.map((item: any) => ({
            ...item,
            isCustom: true
          })));
        }

        // 2. Fetch distinct high quality product images from products table
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, image_url, category')
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(80);

        if (prods && mounted) {
          const validProds = prods
            .filter((p: any) => p.image_url && p.image_url.startsWith('http'))
            .map((p: any) => ({
              id: `prod-cat-${p.id}`,
              title: p.name,
              url: p.image_url,
              category: mapBackendCategory(p.category),
              isCustom: false
            }));
          setCatalogItems(validProds);
        }
      } catch (err: any) {
        console.warn('Product gallery load notice:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadGalleryData();
    return () => { mounted = false; };
  }, [isOpen]);

  // Helper to map backend category text to filter category
  function mapBackendCategory(catText?: string): string {
    if (!catText) return 'grocery';
    const c = catText.toLowerCase();
    if (c.includes('لبن') || c.includes('جبن') || c.includes('ألبان') || c.includes('dairy')) return 'dairy';
    if (c.includes('خضار') || c.includes('فاكه') || c.includes('فواكه') || c.includes('produce')) return 'produce';
    if (c.includes('مخبز') || c.includes('عيش') || c.includes('حلويات') || c.includes('bakery')) return 'bakery';
    if (c.includes('مشروب') || c.includes('عصير') || c.includes('مياه') || c.includes('beverage')) return 'beverages';
    if (c.includes('لحم') || c.includes('دجاج') || c.includes('فراخ') || c.includes('meat')) return 'meat';
    if (c.includes('شيبس') || c.includes('شيبسي') || c.includes('تسالي') || c.includes('سناك')) return 'snacks';
    if (c.includes('نظاف') || c.includes('صابون') || c.includes('غسيل') || c.includes('clean')) return 'cleaning';
    return 'grocery';
  }

  // Combine custom items (top priority), curated library, and existing store catalog items
  const allItems = useMemo(() => {
    const urlsSeen = new Set<string>();
    const list: GalleryItem[] = [];

    // Custom uploads first
    for (const item of customItems) {
      if (item.url && !urlsSeen.has(item.url)) {
        urlsSeen.add(item.url);
        list.push(item);
      }
    }

    // Curated high quality list second
    for (const item of DEFAULT_CURATED_PRODUCTS) {
      if (item.url && !urlsSeen.has(item.url)) {
        urlsSeen.add(item.url);
        list.push(item);
      }
    }

    // Catalog items third
    for (const item of catalogItems) {
      if (item.url && !urlsSeen.has(item.url)) {
        urlsSeen.add(item.url);
        list.push(item);
      }
    }

    return list;
  }, [customItems, catalogItems]);

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    let result = allItems;
    if (selectedCategory !== 'all') {
      result = result.filter((it) => it.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) => it.title.toLowerCase().includes(q) || (it.category && it.category.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allItems, selectedCategory, searchQuery]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    const validFiles = rawFiles.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setErrorNotice('يرجى اختيار ملفات صور صالحة (JPG, PNG, WEBP)');
      return;
    }

    const defaultCat = selectedCategory !== 'all' ? selectedCategory : 'grocery';
    setBatchGlobalCategory(defaultCat);

    const batchItems: PendingBatchItem[] = validFiles.map((file, idx) => {
      const previewUrl = URL.createObjectURL(file);
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      return {
        id: `batch-modal-${Date.now()}-${idx}`,
        file,
        previewUrl,
        title: fileNameWithoutExt || `صنف ${idx + 1}`,
        category: defaultCat
      };
    });

    setPendingBatch(batchItems);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleApplyGlobalCategory(catId: string) {
    setBatchGlobalCategory(catId);
    if (pendingBatch) {
      setPendingBatch(pendingBatch.map(it => ({ ...it, category: catId })));
    }
  }

  function handleUpdatePendingTitle(id: string, newTitle: string) {
    if (!pendingBatch) return;
    setPendingBatch(pendingBatch.map(it => it.id === id ? { ...it, title: newTitle } : it));
  }

  function handleUpdatePendingCategory(id: string, newCat: string) {
    if (!pendingBatch) return;
    setPendingBatch(pendingBatch.map(it => it.id === id ? { ...it, category: newCat } : it));
  }

  function handleRemovePendingItem(id: string) {
    if (!pendingBatch) return;
    const next = pendingBatch.filter(it => it.id !== id);
    if (next.length === 0) {
      setPendingBatch(null);
    } else {
      setPendingBatch(next);
    }
  }

  async function confirmBatchUpload() {
    if (!pendingBatch || pendingBatch.length === 0) return;
    setIsUploading(true);
    setUploadNotice('');
    setErrorNotice('');
    setUploadProgress({ current: 0, total: pendingBatch.length });

    const uploadedItems: GalleryItem[] = [];

    try {
      for (let i = 0; i < pendingBatch.length; i++) {
        const item = pendingBatch[i];
        setUploadProgress({ current: i + 1, total: pendingBatch.length });
        const itemId = `gal-prod-${Date.now()}-${i}`;
        const uploadRes = await uploadCatalogImage('products', itemId, item.file);

        uploadedItems.push({
          id: itemId,
          title: item.title.trim() || 'صنف في المعرض',
          url: uploadRes.url,
          category: item.category || 'grocery',
          addedAt: new Date().toISOString(),
          isCustom: true
        });
      }

      await operationsApi('app-content', {
        action: 'add-product-gallery',
        items: uploadedItems
      });

      setCustomItems((prev) => [...uploadedItems, ...prev.filter((i) => !uploadedItems.some(u => u.url === i.url))]);
      if (uploadedItems[0]) setSelectedItem(uploadedItems[0]);

      const catLabel = GALLERY_CATEGORIES.find(c => c.id === batchGlobalCategory)?.label || batchGlobalCategory;
      setUploadNotice(`✅ تم رفع وحفظ ${uploadedItems.length} صورة في قسم (${catLabel}) بنجاح!`);

      if (batchGlobalCategory && batchGlobalCategory !== 'all') {
        setSelectedCategory(batchGlobalCategory);
      }

      setPendingBatch(null);
    } catch (err: any) {
      console.error('Gallery upload error:', err);
      setErrorNotice(err.message || 'تعذر رفع مجموعة الصور إلى المعرض.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }

  function openEditModal(e: React.MouseEvent, item: GalleryItem) {
    e.stopPropagation();
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category || 'grocery');
    setErrorNotice('');
  }

  async function saveEdit() {
    if (!editingItem) return;
    if (!editTitle.trim()) {
      setErrorNotice('يرجى إدخال اسم صالح للصنف');
      return;
    }

    setIsSavingEdit(true);
    try {
      await operationsApi('app-content', {
        action: 'update-product-gallery',
        id: editingItem.id,
        url: editingItem.url,
        title: editTitle.trim(),
        category: editCategory
      });

      const updated: GalleryItem = {
        ...editingItem,
        title: editTitle.trim(),
        category: editCategory,
        isCustom: true
      };

      setCustomItems(prev => prev.map(it => (it.id === editingItem.id || it.url === editingItem.url ? updated : it)));
      if (selectedItem?.id === editingItem.id || selectedItem?.url === editingItem.url) {
        setSelectedItem(updated);
      }
      const catLabel = GALLERY_CATEGORIES.find(c => c.id === editCategory)?.label || editCategory;
      setUploadNotice(`✅ تم تعديل اسم وقسم صنف "${updated.title}" إلى (${catLabel}) بنجاح!`);
      setEditingItem(null);
    } catch (err: any) {
      setErrorNotice(err.message || 'تعذر حفظ تعديلات الصنف.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Handle delete custom item
  async function handleDeleteCustomItem(e: React.MouseEvent, item: GalleryItem) {
    e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف صورة "${item.title}" من المعرض؟`)) return;

    try {
      await operationsApi('app-content', {
        action: 'delete-product-gallery',
        id: item.id
      });
      setCustomItems((prev) => prev.filter((i) => i.id !== item.id));
      if (selectedItem?.id === item.id) setSelectedItem(null);
      setUploadNotice('تم حذف الصورة من المعرض بنجاح.');
    } catch (err: any) {
      setErrorNotice(err.message || 'تعذر حذف الصورة من المعرض.');
    }
  }

  function handleConfirmSelection() {
    if (!selectedItem) return;
    onSelectImage(selectedItem.url, selectedItem.title);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] max-h-[820px] shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                اختر صورة جاهزة عالية الجودة لصنفك أو ارفع مجموعة صور مباشرة إلى القسم
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
              id="gallery-file-upload-input"
            />
            <label
              htmlFor="gallery-file-upload-input"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs text-white shadow-xs transition-all cursor-pointer bg-[#FF5900] hover:bg-[#E04E00] active:scale-95"
            >
              <UploadCloud size={14} />
              <span>رفع مجموعة صور لقسم</span>
            </label>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Notices */}
        {uploadNotice && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <span>{uploadNotice}</span>
            <button type="button" onClick={() => setUploadNotice('')} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">✕</button>
          </div>
        )}
        {errorNotice && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-100 text-rose-800 text-xs font-bold flex items-center justify-between">
            <span>{errorNotice}</span>
            <button type="button" onClick={() => setErrorNotice('')} className="text-rose-600 hover:text-rose-900 cursor-pointer">✕</button>
          </div>
        )}

        {/* Search & Category Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن صنف (حليب، جبنة، زيت، أرز، طماطم، عصير، شيبسي…)"
              className="w-full pr-10 pl-9 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Categories Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {GALLERY_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gallery Image Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/50">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={32} className="animate-spin text-orange-500" />
              <p className="text-xs font-bold">جارٍ تحميل معرض الأصناف…</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ImageIcon size={28} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">لا توجد صور مطابقة لبحثك</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                يمكنك رفع مجموعة صور خاصة بقسمك مباشرة إلى المعرض بالضغط على زر "رفع مجموعة صور لقسم" بالأعلى.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.url === item.url || currentImageUrl === item.url;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`group relative flex flex-col rounded-2xl overflow-hidden bg-white border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-orange-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Thumbnail Image */}
                    <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                      <img
                        src={item.url}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />

                      {/* Selected Overlay Checkmark */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-orange-600/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                          <div className="w-8 h-8 rounded-full bg-[#FF5900] text-white flex items-center justify-center shadow-lg">
                            <Check size={18} strokeWidth={3} />
                          </div>
                        </div>
                      )}

                      {/* Custom uploaded actions */}
                      {item.isCustom && (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => openEditModal(e, item)}
                            className="w-6 h-6 rounded-lg bg-black/60 text-white hover:bg-orange-600 flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                            title="تعديل الاسم أو القسم"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomItem(e, item)}
                            className="w-6 h-6 rounded-lg bg-black/60 text-white hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                            title="حذف من المعرض"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="p-2.5">
                      <h5 className="font-bold text-slate-800 text-xs line-clamp-1 leading-snug">
                        {item.title}
                      </h5>
                      <span className="text-[10px] text-orange-600 font-bold block mt-0.5">
                        {GALLERY_CATEGORIES.find((c) => c.id === item.category)?.label || 'صنف عام'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-white">
          <div className="min-w-0 pr-1">
            {selectedItem ? (
              <div className="flex items-center gap-2">
                <img
                  src={selectedItem.url}
                  alt={selectedItem.title}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <span className="text-xs font-bold text-slate-800 line-clamp-1">
                  المحدد: {selectedItem.title}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500 font-medium">
                اضغط على أي صورة لتحديدها وتطبيقها على الصنف
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={!selectedItem}
              onClick={handleConfirmSelection}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
                selectedItem
                  ? 'bg-[#FF5900] hover:bg-[#E04E00] shadow-sm cursor-pointer active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check size={15} />
              <span>اعتماد وتطبيق الصورة</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── Sub-Modal 1: Batch Upload Confirmation & Category Assignment ── */}
      {pendingBatch && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in font-['Cairo',sans-serif]">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-right animate-scale-up" dir="rtl">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    رفع مجموعة صور على قسم ({pendingBatch.length} صورة)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    اختر القسم الموحد للمجموعة مع إمكانية تعديل اسم كل صنف على حدة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingBatch(null)}
                disabled={isUploading}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Batch Global Category Toolbar */}
            <div className="px-6 py-4 bg-orange-50/70 border-b border-orange-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-orange-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800">
                  تحديد قسم موحد لجميع الصور المحددة:
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={batchGlobalCategory}
                  onChange={(e) => handleApplyGlobalCategory(e.target.value)}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer shadow-2xs"
                >
                  {GALLERY_CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-orange-700 bg-orange-100/80 px-2.5 py-1 rounded-lg font-bold shrink-0">
                  يطبق على الـ {pendingBatch.length} صورة
                </span>
              </div>
            </div>

            {/* Upload Progress Bar if currently uploading */}
            {uploadProgress && (
              <div className="px-6 py-3 bg-slate-900 text-white shrink-0 space-y-1.5 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-orange-400" />
                    <span>جارٍ رفع الصور إلى المعرض…</span>
                  </span>
                  <span>{uploadProgress.current} من {uploadProgress.total} ({Math.round((uploadProgress.current / uploadProgress.total) * 100)}%)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#FF5900] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Scrollable List of Items */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {pendingBatch.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white hover:border-orange-200 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
                      <img
                        src={item.previewUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[9px] font-bold px-1 rounded-tl">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        اسم الصنف:
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdatePendingTitle(item.id, e.target.value)}
                        placeholder="اسم الصنف في المعرض…"
                        disabled={isUploading}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-orange-500 text-xs font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-start pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        القسم:
                      </label>
                      <select
                        value={item.category}
                        onChange={(e) => handleUpdatePendingCategory(item.id, e.target.value)}
                        disabled={isUploading}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 focus:border-orange-500 text-xs font-bold text-slate-800 outline-none transition-all cursor-pointer"
                      >
                        {GALLERY_CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePendingItem(item.id)}
                      disabled={isUploading}
                      className="mt-3.5 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="استبعاد هذه الصورة"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <span className="text-xs font-bold text-slate-500">
                إجمالي الصور الجاهزة للرفع: <span className="text-orange-600 font-black">{pendingBatch.length}</span>
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingBatch(null)}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmBatchUpload}
                  disabled={isUploading || pendingBatch.length === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#FF5900] hover:bg-[#E04E00] active:scale-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                  <span>{isUploading ? `جارٍ الرفع (${uploadProgress?.current || 0}/${uploadProgress?.total || pendingBatch.length})…` : `تأكيد ورفع الـ (${pendingBatch.length}) صور`}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Sub-Modal 2: Edit Existing Item ── */}
      {editingItem && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in font-['Cairo',sans-serif]">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-right animate-scale-up" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <Pencil size={16} />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">تعديل اسم وقسم صورة الصنف</h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <img
                src={editingItem.url}
                alt={editingItem.title}
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="text-xs text-slate-500 overflow-hidden">
                <p className="font-bold text-slate-800 line-clamp-1">{editingItem.title}</p>
                <p className="mt-0.5 text-orange-600 font-bold">
                  القسم الحالي: {GALLERY_CATEGORIES.find(c => c.id === editingItem.category)?.label || 'صنف عام'}
                </p>
              </div>
            </div>

            {/* Input Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الصنف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="أدخل اسم الصنف الجديد…"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm font-medium outline-none transition-all"
                autoFocus
              />
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تغيير القسم / التصنيف <span className="text-rose-500">*</span>
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-xs sm:text-sm font-bold outline-none transition-all cursor-pointer"
              >
                {GALLERY_CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={isSavingEdit || !editTitle.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF5900] hover:bg-[#E04E00] active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{isSavingEdit ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
