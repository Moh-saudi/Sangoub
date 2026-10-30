import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { saveRecord } from '../lib/firebase';
import type { Store, Category } from '../types';
import { detectCategoryFromName } from '../utils/aiProductGenerator';
import {
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface BulkProductImportModalProps {
  stores: Store[];
  categories: Category[];
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
  inStock: boolean;
  isPopular: boolean;
  imageUrl?: string;
  isValid: boolean;
  error?: string;
}

export function BulkProductImportModal({
  stores,
  categories,
  onClose,
  onSuccess,
}: BulkProductImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [defaultStoreId, setDefaultStoreId] = useState<string>(stores[0]?.id || '');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Download Sample Excel Template
  function handleDownloadTemplate() {
    const sampleStore = stores[0]?.name || 'سوبر ماركت العاصمة';
    const sampleData = [
      {
        'اسم_المنتج_بالعربية': 'شاي ليبتون ناعم أحمر 250 جم',
        'اسم_المنتج_بالانجليزية': 'Lipton Red Label Black Tea 250g',
        'المتجر': sampleStore,
        'التصنيف': 'مشروبات ومياه',
        'سعر_البيع': 75,
        'السعر_قبل_الخصم': 85,
        'الباركود': '6221155010012',
        'كود_POS': 'TEA-LIP-250',
        'الوصف': 'شاي أسود ناعم عالي الجودة منتقى من أفضل المزارع',
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
        'رابط_الصورة': '',
      },
      {
        'اسم_المنتج_بالعربية': 'جبنة دومتي فيتا بلس 500 جم',
        'اسم_المنتج_بالانجليزية': 'Domty Feta Cheese 500g',
        'المتجر': sampleStore,
        'التصنيف': 'ألبان وأجبان وبيض',
        'سعر_البيع': 42,
        'السعر_قبل_الخصم': '',
        'الباركود': '6221054010115',
        'كود_POS': 'CHS-DOM-500',
        'الوصف': 'جبنة بيضاء فيتا كريمية سهلة الفرد للسندوتشات',
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'لا',
        'رابط_الصورة': '',
      },
      {
        'اسم_المنتج_بالعربية': 'ساندوتش دبل تشيز برجر بيف',
        'اسم_المنتج_بالانجليزية': 'Double Cheeseburger Beef',
        'المتجر': sampleStore,
        'التصنيف': 'وجبات وساندوتشات رئيسية',
        'سعر_البيع': 135,
        'السعر_قبل_الخصم': 150,
        'الباركود': '',
        'كود_POS': 'BRG-DBL-01',
        'الوصف': 'قطعتين لحم مشوي على اللهب مع جبن شيدر وخس وخيار مخلل',
        'متاح_للطلب': 'نعم',
        'صنف_مميز': 'نعم',
        'رابط_الصورة': '',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 30 }, // اسم بالعربي
      { wch: 30 }, // اسم بالانجليزي
      { wch: 25 }, // متجر
      { wch: 25 }, // تصنيف
      { wch: 12 }, // سعر
      { wch: 15 }, // سعر قبل الخصم
      { wch: 18 }, // باركود
      { wch: 16 }, // كود POS
      { wch: 45 }, // وصف
      { wch: 12 }, // متاح
      { wch: 12 }, // مميز
      { wch: 35 }, // رابط صورة
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج_أصناف_سنجوب');
    XLSX.writeFile(workbook, 'نموذج_استيراد_منتجات_سنجوب.xlsx');
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
        const resolvedStoreId = matchedStore?.id || defaultStoreId;
        const resolvedStoreName = matchedStore?.name || stores.find(s => s.id === defaultStoreId)?.name || '';

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

        // Detect or match category
        let rawCategory = String(row['التصنيف'] || row['القسم'] || row['Category'] || '').trim();
        let categoryId: string | undefined;

        if (rawCategory) {
          const cat = categories.find(
            c => c.name_ar.toLowerCase() === rawCategory.toLowerCase() || (c.name_en && c.name_en.toLowerCase() === rawCategory.toLowerCase())
          );
          if (cat) categoryId = cat.id;
        }

        if (!categoryId && name) {
          const detected = detectCategoryFromName(name, categories);
          if (detected) {
            categoryId = detected.category.id;
            if (!rawCategory) rawCategory = detected.category.name_ar;
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

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const prodId = crypto.randomUUID();

      try {
        // Save to Firebase
        await saveRecord('products', prodId, {
          id: prodId,
          name: row.name,
          nameEn: row.nameEn || '',
          storeId: row.storeId,
          storeName: row.storeName,
          category: row.category || 'عام',
          categoryId: row.categoryId || null,
          price: row.price,
          originalPrice: row.originalPrice || null,
          barcode: row.barcode || '',
          merchantPosSku: row.merchantPosSku || '',
          description: row.description || '',
          inStock: row.inStock,
          isPopular: row.isPopular,
          imageUrl: row.imageUrl || '',
          archived: false,
          imageType: 'croissant',
        });

        // Save to Supabase products table
        await supabase.from('products').upsert({
          id: prodId,
          store_id: row.storeId,
          name: row.name,
          name_en: row.nameEn || null,
          description: row.description || '',
          price: row.price,
          original_price: row.originalPrice || null,
          category: row.category || 'عام',
          category_id: row.categoryId || null,
          barcode: row.barcode || null,
          merchant_pos_sku: row.merchantPosSku || null,
          is_available: row.inStock,
          image_url: row.imageUrl || null,
        });

        successCount++;
      } catch (err) {
        console.error(`Failed to import row ${row.index}:`, err);
      }

      setImportProgress({ current: i + 1, total: validRows.length });
    }

    setImporting(false);
    onSuccess(successCount);
    onClose();
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Download Templates */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <FileSpreadsheet size={16} className="text-emerald-700" />
                  نموذج فارغ لإدخال منتجات جديدة
                </h4>
                <p className="text-[11px] text-emerald-800">
                  ملف إكسيل فارغ يحتوي على أسماء الأعمدة المعتمدة لملئها بأصنافك.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download size={15} />
                تحميل النموذج الفارغ (.xlsx)
              </button>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                  <FileSpreadsheet size={16} className="text-blue-700" />
                  كتالوج الأدوية والمستلزمات والمنظفات (520 صنف جاهز)
                </h4>
                <p className="text-[11px] text-blue-800">
                  قاعدة أصناف جاهزة ومرخصة بالأسعار والباركود وأكواد POS والوصف والصور عالية الدقة.
                </p>
              </div>
              <a
                href="/pharmacy_and_cleaning_catalog.xlsx"
                download="pharmacy_and_cleaning_catalog.xlsx"
                className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer text-center"
              >
                <Download size={15} />
                تحميل الكتالوج المعتمد (520 صنف .xlsx)
              </a>
            </div>
          </div>

          {/* Default Store Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              المتجر الافتراضي (يُسند تلقائياً لأي صنف لم يُحدد له متجر في الملف):
            </label>
            <select
              value={defaultStoreId}
              onChange={e => setDefaultStoreId(e.target.value)}
              disabled={importing}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white font-medium focus:outline-none focus:border-emerald-600"
            >
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.locationInDistrict || 'الحي الحكومي'})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Upload Dropzone */}
          <div className="p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-3 hover:border-emerald-500 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <UploadCloud size={24} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900">
                {file ? file.name : 'اختر ملف إكسيل (.xlsx, .xls) أو CSV من جهازك'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                تدعم المنصة رفع ملفات الإكسيل التي تحتوي على آلاف الأصناف
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
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-all ${
                parsing || importing
                  ? 'bg-slate-200 text-slate-500 pointer-events-none'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              {parsing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {parsing ? 'جارٍ قراءة الملف وتحليله…' : file ? 'اختيار ملف آخر' : 'اختيار ملف الإكسيل'}
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
                    {validCount} صالح للاستيراد ✓
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-800">
                      {invalidCount} به أخطاء ✗
                    </span>
                  )}
                </div>
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
                    {parsedRows.map(row => (
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

        {/* Footer */}
        <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
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
        </footer>
      </div>
    </div>
  );
}

