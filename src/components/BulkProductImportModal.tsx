import { getBestAutoImageUrl } from '../utils/productImageFinder';
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { resolveSupabaseStoreUuid, supabase } from '../lib/supabase';
import { saveRecord } from '../lib/firebase';
import type { Store, Category } from '../types';
import { detectCategoryFromName } from '../utils/aiProductGenerator';
import { findMatchingCategoryCode } from '../utils/categoryMatching';
import { SUPERMARKET_CATEGORY_TEMPLATES, STORE_TYPES } from '../constants/taxonomy';
import {
  X,
  FileSpreadsheet,
  Sparkles,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  FileDown,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export interface ImportErrorItem {
  rowIndex: number;
  productName: string;
  errorReason: string;
  suggestedFix: string;
}

interface BulkProductImportModalProps {
  stores: Store[];
  categories?: Category[];
  selectedStoreId?: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

interface ParsedProductRow {
  index: number;
  name: string;
  nameEn?: string;
  storeId?: string;
  storeName?: string;
  category?: string;
  categoryId?: string;
  price: number;
  originalPrice?: number;
  barcode?: string;
  merchantPosSku?: string;
  description?: string;
  stockQuantity?: number;
  minStockAlert?: number;
  maxPerOrder?: number;
  catalogProductId?: string;
  inStock: boolean;
  isPopular: boolean;
  imageUrl?: string;
  isValid: boolean;
  error?: string;
}

function normalizeTextKey(str?: string | null): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}

export function BulkProductImportModal({
  stores,
  categories = [],
  selectedStoreId,
  onClose,
  onSuccess,
}: BulkProductImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const targetStore = (selectedStoreId && stores.find(s => s.id === selectedStoreId)) || stores[0];
  const [defaultStoreId, setDefaultStoreId] = useState<string>(targetStore?.id || '');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [filterOnlyErrors, setFilterOnlyErrors] = useState(false);
  const [importResult, setImportResult] = useState<{
    completed: boolean;
    successCount: number;
    addedCount: number;
    updatedCount: number;
    failedCount: number;
    errors: ImportErrorItem[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Download Sample / Empty Excel Template with Official 24 Categories
  function handleDownloadTemplate(asEmpty = false) {
    const sampleStore = targetStore?.name || 'سنجوب ماركت - الفرع الرئيسي';
    
    // Sample rows using the official new 24 Supermarket Categories
    const sampleData = asEmpty ? [
      {
        'اسم_المنتج_بالعربية': '',
        'اسم_المنتج_بالانجليزية': '',
        'المتجر': sampleStore,
        'التصنيف': 'الفطار',
        'سعر_البيع': '',
        'السعر_قبل_الخصم': '',
        'الباركود': '',
        'كود_POS': '',
        'الوصف': '',
        'الكمية_المتوفرة': 50,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'لا',
      }
    ] : [
      {
        'اسم_المنتج_بالعربية': 'شاي ليبتون ناعم أحمر 250 جم',
        'اسم_المنتج_بالانجليزية': 'Lipton Red Label Black Tea 250g',
        'المتجر': sampleStore,
        'التصنيف': 'المشروبات',
        'سعر_البيع': 75,
        'السعر_قبل_الخصم': 85,
        'الباركود': '6221155010012',
        'كود_POS': 'TEA-LIP-250',
        'الوصف': 'شاي أسود ناعم عالي الجودة منتقى من أفضل المزارع',
        'الكمية_المتوفرة': 100,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
      },
      {
        'اسم_المنتج_بالعربية': 'حليب جهينة كامل الدسم 1 لتر',
        'اسم_المنتج_بالانجليزية': 'Juhayna Full Cream Milk 1L',
        'المتجر': sampleStore,
        'التصنيف': 'الألبان والبيض',
        'سعر_البيع': 44,
        'السعر_قبل_الخصم': 48,
        'الباركود': '6221003001010',
        'كود_POS': 'MLK-JUH-1L',
        'الوصف': 'حليب بقري طبيعي مبستر ومعقم 100%',
        'الكمية_المتوفرة': 80,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
      },
      {
        'اسم_المنتج_بالعربية': 'فول مدمس سادة حدائق كاليفورنيا 400 جم',
        'اسم_المنتج_بالانجليزية': 'California Garden Plain Fava Beans 400g',
        'المتجر': sampleStore,
        'التصنيف': 'الفطار',
        'سعر_البيع': 26,
        'السعر_قبل_الخصم': '',
        'الباركود': '6223000511112',
        'كود_POS': 'FUL-CG-400',
        'الوصف': 'فول مدمس درجة أولى حبوب كاملة جاهز للتقديم',
        'الكمية_المتوفرة': 120,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'لا',
      },
      {
        'اسم_المنتج_بالعربية': 'جبنة دومتي فيتا بلس بطعم الزيتون 500 جم',
        'اسم_المنتج_بالانجليزية': 'Domty Feta Cheese with Olives 500g',
        'المتجر': sampleStore,
        'التصنيف': 'الجبن واللانشون',
        'سعر_البيع': 42,
        'السعر_قبل_الخصم': 46,
        'الباركود': '6221054010115',
        'كود_POS': 'CHS-DOM-500',
        'الوصف': 'جبنة بيضاء فيتا كريمية سهلة الفرد للسندوتشات',
        'الكمية_المتوفرة': 60,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'لا',
      },
      {
        'اسم_المنتج_بالعربية': 'طماطم طازجة بلدي درجة أولى 1 كجم',
        'اسم_المنتج_بالانجليزية': 'Fresh Local Tomatoes 1kg',
        'المتجر': sampleStore,
        'التصنيف': 'الخضروات والفواكه',
        'سعر_البيع': 20,
        'السعر_قبل_الخصم': '',
        'الباركود': '6220000001011',
        'كود_POS': 'VEG-TOM-1K',
        'الوصف': 'طماطم حمراء طازجة ونقية مفرزة بعناية يومياً',
        'الكمية_المتوفرة': 50,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
      },
      {
        'اسم_المنتج_بالعربية': 'خبز فينو ممتاز كيس 5 أرغفة',
        'اسم_المنتج_بالانجليزية': 'Fresh Fino Bread Pack 5 Loaves',
        'المتجر': sampleStore,
        'التصنيف': 'المخبوزات والخبز',
        'سعر_البيع': 15,
        'السعر_قبل_الخصم': '',
        'الباركود': '6220000002022',
        'كود_POS': 'BKR-FIN-5P',
        'الوصف': 'خبز فينو طازج وهش للسندوتشات والوجبات اليومية',
        'الكمية_المتوفرة': 90,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
      },
      {
        'اسم_المنتج_بالعربية': 'أرز مصري المطبخ درجة أولى 1 كجم',
        'اسم_المنتج_بالانجليزية': 'Al Matbakh Egyptian Rice 1kg',
        'المتجر': sampleStore,
        'التصنيف': 'البقالة والمواد الغذائية',
        'سعر_البيع': 35,
        'السعر_قبل_الخصم': 38,
        'الباركود': '6221122334455',
        'كود_POS': 'GRO-RIC-1K',
        'الوصف': 'أرز مصري أبيض حبة عريضة منقى ومغسول آلياً',
        'الكمية_المتوفرة': 150,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
      },
      {
        'اسم_المنتج_بالعربية': 'صدور دجاج بانيه متبلة طازجة 1 كجم',
        'اسم_المنتج_بالانجليزية': 'Fresh Seasoned Chicken Pane 1kg',
        'المتجر': sampleStore,
        'التصنيف': 'اللحوم والدواجن',
        'سعر_البيع': 220,
        'السعر_قبل_الخصم': 240,
        'الباركود': '6220000003033',
        'كود_POS': 'MET-PAN-1K',
        'الوصف': 'صدور دجاج مخلية متبلة جاهزة للقلي والشوي',
        'الكمية_المتوفرة': 30,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
      },
      {
        'اسم_المنتج_بالعربية': 'مسحوق غسيل أوتوماتيك أريال لافندر 2.5 كجم',
        'اسم_المنتج_بالانجليزية': 'Ariel Automatic Powder Lavender 2.5kg',
        'المتجر': sampleStore,
        'التصنيف': 'المنظفات ومستلزمات الغسيل',
        'سعر_البيع': 175,
        'السعر_قبل_الخصم': 195,
        'الباركود': '6221010055221',
        'كود_POS': 'CLN-ARI-25',
        'الوصف': 'مسحوق مركز للغسالات الأوتوماتيك مع عطر اللافندر المنعش',
        'الكمية_المتوفرة': 45,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'لا',
      },
      {
        'اسم_المنتج_بالعربية': 'مناديل فاين كلاسيك معقمة عبوة 550 منديل',
        'اسم_المنتج_بالانجليزية': 'Fine Classic Facial Tissues 550 Sheets',
        'المتجر': sampleStore,
        'التصنيف': 'الورقيات والمنتجات الاستهلاكية',
        'سعر_البيع': 38,
        'السعر_قبل_الخصم': '',
        'الباركود': '6221088010444',
        'كود_POS': 'PAP-FIN-550',
        'الوصف': 'مناديل وجه ناعمة ثلاثية الطبقات معقمة بتقنية ستيري برو',
        'الكمية_المتوفرة': 70,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'لا',
      },
      {
        'اسم_المنتج_بالعربية': 'حفاضات أطفال بامبرز عناية مميزة مقاس 3 (64 حفاضة)',
        'اسم_المنتج_بالانجليزية': 'Pampers Premium Care Size 3 (64 Diapers)',
        'المتجر': sampleStore,
        'التصنيف': 'مستلزمات الأطفال',
        'سعر_البيع': 310,
        'السعر_قبل_الخصم': 340,
        'الباركود': '6221099020333',
        'كود_POS': 'BAB-PAM-S3',
        'الوصف': 'حفاضات ناعمة بحماية فائقة للبشرة ضد التسرب حتى 12 ساعة',
        'الكمية_المتوفرة': 25,
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
      },
    ];

    // Sheet 1: Main Products Sheet
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 32 }, // اسم بالعربي
      { wch: 32 }, // اسم بالانجليزي
      { wch: 25 }, // متجر
      { wch: 25 }, // تصنيف
      { wch: 12 }, // سعر
      { wch: 15 }, // سعر قبل الخصم
      { wch: 18 }, // باركود
      { wch: 16 }, // كود POS
      { wch: 45 }, // وصف
      { wch: 15 }, // الكمية المتوفرة
      { wch: 12 }, // متاح
      { wch: 12 }, // مميز
    ];

    // Sheet 2: Official Approved Categories Reference Sheet (24 Supermarket Categories)
    const officialCategoriesList = SUPERMARKET_CATEGORY_TEMPLATES.map((cat, idx) => ({
      'الرقم': idx + 1,
      'كود_القسم': cat.code,
      'اسم_القسم_بالعربية': cat.name_ar,
      'اسم_القسم_بالانجليزية': cat.name_en,
      'نوع_المتجر': 'السوبر ماركت والبقالة (GROC)',
      'الحالة': cat.status === 'active' ? 'نشط ومعتمد' : 'مؤجل',
    }));
    const refWorksheet = XLSX.utils.json_to_sheet(officialCategoriesList);
    refWorksheet['!cols'] = [
      { wch: 8 },  // الرقم
      { wch: 18 }, // كود
      { wch: 28 }, // اسم عربي
      { wch: 28 }, // اسم انجليزي
      { wch: 28 }, // نوع المتجر
      { wch: 15 }, // الحالة
    ];

    // Sheet 3: Official Store Types Reference Sheet (16 Store Types)
    const officialStoreTypesList = STORE_TYPES.map((st, idx) => ({
      'الرقم': idx + 1,
      'كود_نوع_المتجر': st.code,
      'نوع_المتجر_بالعربية': st.name_ar,
      'نوع_المتجر_بالانجليزية': st.name_en,
      'حالة_الإطلاق': st.status === 'active' ? 'متاح للإطلاق الأول' : 'مؤجل ومحجوب',
    }));
    const storeTypesWorksheet = XLSX.utils.json_to_sheet(officialStoreTypesList);
    storeTypesWorksheet['!cols'] = [
      { wch: 8 },  // الرقم
      { wch: 18 }, // كود
      { wch: 28 }, // اسم عربي
      { wch: 28 }, // اسم انجليزي
      { wch: 20 }, // الحالة
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'بيانات_الأصناف');
    XLSX.utils.book_append_sheet(workbook, refWorksheet, 'قائمة_الأقسام_المعتمدة');
    XLSX.utils.book_append_sheet(workbook, storeTypesWorksheet, 'أنواع_المتاجر_المعتمدة');

    const fileName = asEmpty
      ? 'نموذج_أصناف_سنجوب_فارغ_معتمد.xlsx'
      : 'نموذج_أصناف_سنجوب_مع_أمثلة_معتمد.xlsx';

    XLSX.writeFile(workbook, fileName);
  }

  // 2. Parse Uploaded Excel / CSV
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setErrorMessage('');
    setParsedRows([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (!rawData || rawData.length === 0) {
        throw new Error('الملف فارغ أو لا يحتوي على صفوف بيانات.');
      }

      const rows: ParsedProductRow[] = rawData.map((row, idx) => {
        // Map Arabic and English column headers
        const name = String(
          row['اسم_المنتج_بالعربية'] ||
            row['اسم_المنتج'] ||
            row['اسم المنتج'] ||
            row['الاسم'] ||
            row['Name'] ||
            row['name'] ||
            ''
        ).trim();

        const nameEn = String(
          row['اسم_المنتج_بالانجليزية'] ||
            row['الاسم_بالانجليزية'] ||
            row['Name_En'] ||
            row['name_en'] ||
            ''
        ).trim();

        const rawStore = String(
          row['المتجر'] || row['اسم_المتجر'] || row['متجر'] || row['Store'] || row['store'] || ''
        ).trim();

        // Find store by name or id, or fallback to defaultStoreId
        const matchedStore = stores.find(
          s => s.id === rawStore || s.name.toLowerCase() === rawStore.toLowerCase()
        );
        const resolvedStoreId = selectedStoreId || matchedStore?.id || defaultStoreId;
        const resolvedStoreName = (selectedStoreId && stores.find(s => s.id === selectedStoreId)?.name) || matchedStore?.name || stores.find(s => s.id === defaultStoreId)?.name || '';

        const rawPrice = row['سعر_البيع'] ?? row['السعر'] ?? row['Price'] ?? row['price'];
        const price = parseFloat(String(rawPrice));

        const rawOrigPrice = row['السعر_قبل_الخصم'] ?? row['سعر_قبل_الخصم'] ?? row['Original_Price'];
        const originalPrice = rawOrigPrice ? parseFloat(String(rawOrigPrice)) : undefined;

        const barcode = String(row['الباركود'] || row['باركود'] || row['Barcode'] || '').trim();
        const merchantPosSku = String(row['كود_POS'] || row['SKU'] || row['كود'] || '').trim();
        const description = String(row['الوصف'] || row['وصف'] || row['Description'] || '').trim();
        const imageUrl = String(row['رابط_الصورة'] || row['صورة'] || row['Image'] || '').trim();

        const inStockText = String(row['متاح_للطلب'] || row['متاح'] || row['In_Stock'] || 'نعم').toLowerCase();
        const inStock = inStockText !== 'لا' && inStockText !== 'false' && inStockText !== '0';

        const popularText = String(row['صنف_مميز'] || row['مميز'] || row['Popular'] || 'لا').toLowerCase();
        const isPopular = popularText === 'نعم' || popularText === 'true' || popularText === '1';

        const rawStockQty = row['الكمية_المتوفرة'] ?? row['الكمية'] ?? row['Stock'] ?? row['stock_qty'];
        const stockQuantity = rawStockQty !== undefined && !isNaN(parseInt(String(rawStockQty))) ? Math.max(0, parseInt(String(rawStockQty))) : 50;

        const rawMinAlert = row['حد_التنبيه_الأدنى'] ?? row['حد_التنبيه'] ?? row['Min_Alert'];
        const minStockAlert = rawMinAlert !== undefined && !isNaN(parseInt(String(rawMinAlert))) ? Math.max(0, parseInt(String(rawMinAlert))) : 5;

        const rawMaxOrder = row['أقصى_كمية_للطلب'] ?? row['حد_الطلب_الأقصى'] ?? row['Max_Per_Order'];
        const maxPerOrder = rawMaxOrder !== undefined && !isNaN(parseInt(String(rawMaxOrder))) ? Math.max(1, parseInt(String(rawMaxOrder))) : 6;

        // Detect or match category
        let rawCategory = String(row['التصنيف'] || row['القسم'] || row['Category'] || '').trim();
        let categoryId: string | undefined;

        if (rawCategory) {
          const cat = categories.find(
            c => c.name_ar.toLowerCase() === rawCategory.toLowerCase() || (c.name_en && c.name_en.toLowerCase() === rawCategory.toLowerCase())
          );
          if (cat) {
            categoryId = cat.id;
            rawCategory = cat.name_ar;
          } else {
            // Match against official approved 24 Supermarket Categories via smart semantic matcher
            const matchedCode = findMatchingCategoryCode(rawCategory);
            const matchedTmpl = matchedCode ? SUPERMARKET_CATEGORY_TEMPLATES.find(t => t.code === matchedCode) : null;
            if (matchedTmpl) {
              rawCategory = matchedTmpl.name_ar;
            } else {
              const directTmpl = SUPERMARKET_CATEGORY_TEMPLATES.find(
                t => t.name_ar.toLowerCase() === rawCategory.toLowerCase() ||
                     t.name_en.toLowerCase() === rawCategory.toLowerCase() ||
                     t.code.toLowerCase() === rawCategory.toLowerCase()
              );
              if (directTmpl) {
                rawCategory = directTmpl.name_ar;
              }
            }
          }
        }

        if (!categoryId && name) {
          const detected = detectCategoryFromName(name, categories);
          if (detected) {
            categoryId = detected.category.id;
            if (!rawCategory) rawCategory = detected.category.name_ar;
          } else if (!rawCategory) {
            const matchedCode = findMatchingCategoryCode(name);
            const matchedTmpl = matchedCode ? SUPERMARKET_CATEGORY_TEMPLATES.find(t => t.code === matchedCode) : null;
            if (matchedTmpl) {
              rawCategory = matchedTmpl.name_ar;
            }
          }
        }

        // Validation
        let isValid = true;
        let error = '';

        if (!name) {
          isValid = false;
          error = 'اسم المنتج مفقود';
        } else if (isNaN(price) || price < 0) {
          isValid = false;
          error = 'السعر غير صالح';
        } else if (!resolvedStoreId) {
          isValid = false;
          error = 'المتجر غير محدد';
        }

        return {
          index: idx + 1,
          name,
          nameEn,
          storeId: resolvedStoreId,
          storeName: resolvedStoreName,
          category: rawCategory,
          categoryId,
          price,
          originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
          barcode,
          merchantPosSku,
          description,
          stockQuantity,
          minStockAlert,
          maxPerOrder,
          inStock,
          isPopular,
          imageUrl,
          isValid,
          error,
        };
      });

      setParsedRows(rows);
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      setErrorMessage(err.message || 'فشل في قراءة ملف الإكسيل. تأكد من سلامة تنسيق الملف.');
    } finally {
      setParsing(false);
    }
  }

  // 3. Execute Bulk Import
  async function handleStartImport() {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMessage('لا توجد صفوف صالحة للاستيراد في الملف.');
      return;
    }

    setImporting(true);
    setErrorMessage('');
    setImportProgress({ current: 0, total: validRows.length });

    let successCount = 0;
    let addedCount = 0;
    let updatedCount = 0;
    const failedItems: ImportErrorItem[] = [];
    let canDirectWriteSb = true;

    // ── Pre-fetch existing store products to prevent duplicate entries ───────
    const targetStoreUuid = resolveSupabaseStoreUuid(selectedStoreId || validRows[0]?.storeId);

    interface ExistingLookupItem {
      id: string;
      name: string;
      imageUrl?: string;
      price?: number;
    }
    const existingByBarcode = new Map<string, ExistingLookupItem>();
    const existingBySku = new Map<string, ExistingLookupItem>();
    const existingByName = new Map<string, ExistingLookupItem>();

    try {
      const { data: dbProducts } = await supabase
        .from('products')
        .select('id, name, barcode, merchant_pos_sku, image_url, price, archived')
        .eq('store_id', targetStoreUuid);

      if (Array.isArray(dbProducts)) {
        for (const item of dbProducts) {
          const entry: ExistingLookupItem = {
            id: item.id,
            name: item.name,
            imageUrl: item.image_url || undefined,
            price: Number(item.price),
          };
          if (item.barcode && String(item.barcode).trim()) {
            existingByBarcode.set(String(item.barcode).trim().toLowerCase(), entry);
          }
          if (item.merchant_pos_sku && String(item.merchant_pos_sku).trim()) {
            existingBySku.set(String(item.merchant_pos_sku).trim().toLowerCase(), entry);
          }
          if (item.name && item.name.trim()) {
            existingByName.set(normalizeTextKey(item.name), entry);
          }
        }
      }
    } catch (fetchErr) {
      console.warn('Could not preload existing products for deduplication:', fetchErr);
    }

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      // Smart Deduplication: Check if product already exists by barcode, POS SKU, or name
      let matchedExisting: ExistingLookupItem | undefined;

      if (row.barcode && String(row.barcode).trim()) {
        matchedExisting = existingByBarcode.get(String(row.barcode).trim().toLowerCase());
      }
      if (!matchedExisting && row.merchantPosSku && String(row.merchantPosSku).trim()) {
        matchedExisting = existingBySku.get(String(row.merchantPosSku).trim().toLowerCase());
      }
      if (!matchedExisting && row.name && row.name.trim()) {
        matchedExisting = existingByName.get(normalizeTextKey(row.name));
      }

      const isUpdate = Boolean(matchedExisting);
      // If product exists: reuse existing ID so it updates instead of duplicating!
      const prodId = matchedExisting ? matchedExisting.id : crypto.randomUUID();

      try {
        // Keep existing image if row doesn't specify one
        let finalImageUrl = row.imageUrl || matchedExisting?.imageUrl || '';
        let finalName = row.name;
        let finalNameEn = row.nameEn || '';
        let catalogProductId: string | null = null;

        // Smart Master Catalog Match by Barcode (EAN-13)
        if (row.barcode) {
          try {
            const { data: matchedSpu } = await supabase
              .from('master_spu')
              .select('id, name_ar, name_en, images, brand_name, category_id')
              .eq('primary_barcode', row.barcode)
              .maybeSingle();

            if (matchedSpu) {
              catalogProductId = matchedSpu.id;
              if (!finalImageUrl && Array.isArray(matchedSpu.images) && matchedSpu.images.length > 0) {
                finalImageUrl = matchedSpu.images[0];
              }
              if (!finalName && matchedSpu.name_ar) finalName = matchedSpu.name_ar;
              if (!finalNameEn && matchedSpu.name_en) finalNameEn = matchedSpu.name_en;
            }
          } catch {
            // Non-blocking catalog lookup fallback
          }
        }

        // 1. Primary: Save/Upsert to Supabase products table (Single Source of Truth)
        const safeOrigPrice = (row.originalPrice && Number(row.originalPrice) > Number(row.price)) ? Number(row.originalPrice) : undefined;
        let sbSaved = false;

        if (canDirectWriteSb) {
          try {
            const { error: sbError } = await supabase.from('products').upsert({
              id: prodId,
              store_id: targetStoreUuid,
              name: finalName,
              name_en: finalNameEn || null,
              description: row.description || '',
              price: row.price,
              original_price: safeOrigPrice || null,
              category: row.category || 'عام',
              category_id: row.categoryId || null,
              barcode: row.barcode || null,
              merchant_pos_sku: row.merchantPosSku || null,
              is_available: row.inStock,
              archived: false,
              image_url: finalImageUrl || null,
            });

            if (!sbError) {
              sbSaved = true;
            } else {
              if (sbError.code === '42501' || sbError.code === 'PGRST303') {
                canDirectWriteSb = false;
              }
            }
          } catch (sbEx) {
            canDirectWriteSb = false;
          }
        }

        // 2. Server-side API Sync via /api/admin-data (Persistent Store Catalog)
        try {
          await saveRecord('products', prodId, {
            id: prodId,
            name: finalName,
            nameEn: finalNameEn,
            storeId: row.storeId,
            storeName: row.storeName,
            category: row.category || 'عام',
            categoryId: row.categoryId || null,
            price: row.price,
            ...(safeOrigPrice ? { originalPrice: safeOrigPrice } : {}),
            barcode: row.barcode || '',
            merchantPosSku: row.merchantPosSku || '',
            description: row.description || '',
            inStock: row.inStock,
            stockQuantity: row.stockQuantity ?? 50,
            minStockAlert: row.minStockAlert ?? 5,
            maxPerOrder: row.maxPerOrder ?? 6,
            catalogProductId: catalogProductId || undefined,
            isPopular: row.isPopular,
            imageUrl: finalImageUrl,
            archived: false,
            imageType: 'croissant',
          });
          if (isUpdate) {
            updatedCount++;
          } else {
            addedCount++;
          }
          successCount++;

          // Register in index maps to prevent duplicate rows within the same file
          const registeredEntry: ExistingLookupItem = {
            id: prodId,
            name: finalName,
            imageUrl: finalImageUrl,
            price: Number(row.price),
          };
          if (row.barcode && String(row.barcode).trim()) {
            existingByBarcode.set(String(row.barcode).trim().toLowerCase(), registeredEntry);
          }
          if (row.merchantPosSku && String(row.merchantPosSku).trim()) {
            existingBySku.set(String(row.merchantPosSku).trim().toLowerCase(), registeredEntry);
          }
          if (finalName && finalName.trim()) {
            existingByName.set(normalizeTextKey(finalName), registeredEntry);
          }
        } catch (backendErr: any) {
          if (sbSaved) {
            if (isUpdate) {
              updatedCount++;
            } else {
              addedCount++;
            }
            successCount++;

            const registeredEntry: ExistingLookupItem = {
              id: prodId,
              name: finalName,
              imageUrl: finalImageUrl,
              price: Number(row.price),
            };
            if (row.barcode && String(row.barcode).trim()) {
              existingByBarcode.set(String(row.barcode).trim().toLowerCase(), registeredEntry);
            }
            if (row.merchantPosSku && String(row.merchantPosSku).trim()) {
              existingBySku.set(String(row.merchantPosSku).trim().toLowerCase(), registeredEntry);
            }
            if (finalName && finalName.trim()) {
              existingByName.set(normalizeTextKey(finalName), registeredEntry);
            }
          } else {
            console.error(`Failed to import row ${row.index}:`, backendErr);
            let reason = backendErr?.message || 'تعذر حفظ الصنف في قاعدة البيانات';
            let fix = 'راجع بيانات هذا الصف في ملف الإكسيل.';
            if (reason.includes('السعر قبل الخصم')) {
              reason = 'السعر قبل الخصم مساوٍ لسعر البيع أو أصغر منه.';
              fix = 'اجعل خانة السعر قبل الخصم فارغة، أو اكتب سعراً أكبر من سعر البيع.';
            } else if (reason.includes('المتجر غير موجود')) {
              reason = 'المتجر المحدد غير مسجل في النظام.';
              fix = 'اختر متجرك من القائمة بالأعلى أو تأكد من كتابة اسم المتجر الصحيح.';
            } else if (reason.includes('JWT') || reason.includes('PGRST303') || reason.includes('Unauthorized')) {
              reason = 'انتهت صلاحية جلسة الاتصال بقاعدة البيانات.';
              fix = 'أعد تحميل الصفحة أو قم بتسجيل الدخول مجدداً.';
            }
            failedItems.push({
              rowIndex: row.index,
              productName: row.name || 'صنف بدون اسم',
              errorReason: reason,
              suggestedFix: fix,
            });
          }
        }
      } catch (err: any) {
        console.error(`Failed to import row ${row.index}:`, err);
        let reason = err?.message || 'خطأ غير متوقع أثناء الحفظ';
        let fix = 'راجع بيانات هذا الصف في ملف الإكسيل.';
        if (reason.includes('السعر قبل الخصم')) {
          reason = 'السعر قبل الخصم مساوٍ لسعر البيع أو أصغر منه.';
          fix = 'اجعل خانة السعر قبل الخصم فارغة، أو اكتب سعراً أكبر من سعر البيع.';
        }
        failedItems.push({
          rowIndex: row.index,
          productName: row.name || 'صنف بدون اسم',
          errorReason: reason,
          suggestedFix: fix,
        });
      }

      setImportProgress({ current: i + 1, total: validRows.length });
    }

    setImporting(false);

    // Set detailed result with added vs updated statistics
    setImportResult({
      completed: true,
      successCount,
      addedCount,
      updatedCount,
      failedCount: failedItems.length,
      errors: failedItems,
    });
    onSuccess(successCount);
  }

  const handleExportErrorRows = () => {
    if (!importResult || importResult.errors.length === 0) return;
    const errorData = importResult.errors.map((err: ImportErrorItem) => ({
      'رقم_الصف_في_الملف': err.rowIndex + 1,
      'اسم_المنتج': err.productName,
      'سبب_الخطأ': err.errorReason,
      'طريقة_التصحيح': err.suggestedFix,
    }));
    const worksheet = XLSX.utils.json_to_sheet(errorData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'أخطاء_الاستيراد');
    XLSX.writeFile(workbook, `أخطاء_استيراد_منتجات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-lg">استيراد الأصناف عبر ملف إكسيل (Bulk Import)</h2>
              <p className="text-xs text-slate-500">
                إضافة وتحديث مئات المنتجات دفعة واحدة بملف Excel أو CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          {importResult?.completed ? (
            <div className="py-5 px-4 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={26} />
              </div>

              <div className="space-y-2 max-w-sm w-full">
                <h3 className="text-base font-black text-slate-900">تم استيراد وتحديث الأصناف بنجاح!</h3>
                
                {/* الإحصائية الذكية لمنع التكرار */}
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs space-y-1.5 text-slate-700 text-right">
                  <div className="flex items-center justify-between font-bold">
                    <span>أصناف جديدة تمت إضافتها:</span>
                    <span className="font-mono text-emerald-800 font-black bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                      {importResult.addedCount} صنف جديد
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span>أصناف محدثة مسبقاً (دون تكرار):</span>
                    <span className="font-mono text-sky-800 font-black bg-white px-2 py-0.5 rounded-lg border border-sky-200">
                      {importResult.updatedCount} تم تحديثها
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold pt-1.5 border-t border-emerald-200/80 text-slate-900">
                    <span>إجمالي الأصناف المعالجة:</span>
                    <span className="font-mono font-black text-emerald-900 text-sm">
                      {importResult.successCount} صنف
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  تم التعرف على الأصناف الموجودة مسبقاً وتحديث أسعارها وبياناتها آلياً دون إنشاء أي نسخ مكررة.
                </p>
              </div>

              {importResult.failedCount > 0 && (
                <div className="w-full max-w-md p-4 bg-amber-50 border border-amber-200 rounded-2xl text-right space-y-2">
                  <div className="flex items-center justify-between text-amber-900 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      يوجد {importResult.failedCount} صنف به أخطاء في ملف الإكسيل
                    </span>
                    <button
                      type="button"
                      onClick={handleExportErrorRows}
                      className="text-amber-800 underline hover:text-amber-950 font-bold text-xs cursor-pointer flex items-center gap-1"
                    >
                      <FileDown size={14} />
                      <span>تحميل ملف الأخطاء (.xlsx)</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    يمكنك تصحيح هذه الصفوف وإعادة رفعها دون التأثير على الأصناف التي تم استيرادها بنجاح.
                  </p>
                </div>
              )}

              <div className="pt-1 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => {
                    onSuccess(importResult.successCount);
                    onClose();
                  }}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  <span>عرض المنتجات في القائمة ({importResult.successCount} صنف)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
          {/* Single Template Download Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileSpreadsheet size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h4 className="text-xs font-black text-slate-900 truncate">نموذج Excel المعتمد (24 قسماً)</h4>
                  <span className="text-[9px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded font-bold">محدّث</span>
                </div>
                <p className="text-[10px] text-slate-500 truncate">
                  يتضمن شيت الأصناف وشيت مرجعي كامل للأقسام وأنواع المتاجر المعتمدة
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadTemplate(false)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="تحميل ملف إكسيل معبأ بأمثلة للأقسام"
              >
                <Download size={13} />
                <span>نموذج بأمثلة (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate(true)}
                className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="تحميل ملف إكسيل فارغ"
              >
                <FileDown size={13} />
                <span>نموذج فارغ (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Store Indicator */}
          {selectedStoreId ? (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="text-[11px] font-bold text-slate-500">الفرع المستهدف:</span>
              <span className="font-bold text-slate-800 text-xs">{targetStore?.name || "المتجر الحالي"}</span>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                المتجر المستهدف للاستيراد:
              </label>
              <select
                value={defaultStoreId}
                onChange={e => setDefaultStoreId(e.target.value)}
                disabled={importing}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white font-bold focus:outline-none focus:border-emerald-600"
              >
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.locationInDistrict || 'الحي الحكومي'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step 2: Upload Dropzone */}
          <div className="p-4 sm:p-5 bg-slate-50/70 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl text-center space-y-2 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
              <UploadCloud size={20} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-slate-800">
                {file ? file.name : 'اختر ملف إكسيل (.xlsx, .xls) أو CSV'}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {file ? `${(file.size / 1024).toFixed(1)} كيلوبايت` : 'اسحب الملف هنا أو اضغط للاختيار من جهازك'}
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={parsing || importing}
              className="hidden"
              id="excel-file-upload-input"
            />

            <label
              htmlFor="excel-file-upload-input"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs cursor-pointer shadow-2xs transition-all ${
                parsing || importing
                  ? 'bg-slate-200 text-slate-500 pointer-events-none'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              <span>{parsing ? 'جارٍ قراءة الملف…' : file ? 'تغيير الملف' : 'اختيار ملف الإكسيل'}</span>
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 3: Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    تمت قراءة <strong className="text-slate-950 font-black">{parsedRows.length}</strong> صف في الملف:
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    {validCount} صالح للاستيراد [نجاح]
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800">
                      {invalidCount} به أخطاء [خطأ]
                    </span>
                  )}
                </div>

                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterOnlyErrors(!filterOnlyErrors)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      filterOnlyErrors
                        ? 'bg-red-600 text-white'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    {filterOnlyErrors ? 'عرض جميع الصفوف' : `عرض الصفوف التي بها أخطاء فقط (${invalidCount})`}
                  </button>
                )}
              </div>

              {/* Table Preview */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">اسم الصنف</th>
                      <th className="p-2.5">المتجر</th>
                      <th className="p-2.5">التصنيف</th>
                      <th className="p-2.5">السعر</th>
                      <th className="p-2.5">الباركود</th>
                      <th className="p-2.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(filterOnlyErrors ? parsedRows.filter(r => !r.isValid) : parsedRows).map(row => (
                      <tr key={row.index} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}>
                        <td className="p-2.5 text-slate-400 font-mono">{row.index}</td>
                        <td className="p-2.5 font-bold text-slate-900">{row.name || '—'}</td>
                        <td className="p-2.5 text-slate-600">{row.storeName || '—'}</td>
                        <td className="p-2.5 text-slate-600">{row.category || 'عام'}</td>
                        <td className="p-2.5 font-bold text-slate-900">{row.price ? `${row.price} ج.م` : '—'}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{row.barcode || '—'}</td>
                        <td className="p-2.5">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                              <CheckCircle2 size={13} /> جاهز
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-bold" title={row.error}>
                              <AlertTriangle size={13} /> {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import Progress Bar */}
              {importing && (
                <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-emerald-600" />
                      جارٍ استيراد المنتجات وحفظها في قاعدة البيانات…
                    </span>
                    <span>
                      {importProgress.current} من {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-150"
                      style={{
                        width: `${Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {importResult?.completed ? (
            <div className="w-full flex items-center justify-between">
              {importResult.failedCount > 0 ? (
                <button
                  type="button"
                  onClick={handleExportErrorRows}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <FileDown size={15} />
                  <span>تحميل ملف الأصناف الخاطئة (.xlsx)</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => {
                  onSuccess(importResult.successCount);
                  onClose();
                }}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center gap-2"
              >
                <Check size={16} />
                <span>إغلاق وعرض الأصناف في القائمة ({importResult.successCount} صنف)</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleStartImport}
                disabled={importing || validCount === 0}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                {importing ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                {importing ? 'جارٍ الاستيراد…' : `بدء استيراد ${validCount} صنف`}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

