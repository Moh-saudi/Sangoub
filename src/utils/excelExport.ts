import * as XLSX from 'xlsx';
import type { Product } from '../types';

/**
 * تصدير قائمة المنتجات إلى ملف Excel بتوقيع وهوية منصة سنجوب للتوصيل الذكي
 */
export function exportProductsToExcel(products: Product[], storeName: string) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 1. بناء مصفوفة البيانات مع ترويسة وتوقيع سنجوب للتوصيل الذكي
  const data: (string | number)[][] = [
    ['سنجوب للتوصيل الذكي — Sangoub Smart Delivery 🛵⚡'],
    [`قائمة المنتجات والأسعار الرسمية — فرع: ${storeName}`],
    [`تاريخ الاستخراج: ${dateStr} - ${timeStr} | إجمالي الأصناف: ${products.length} صنف`],
    [], // سطر فارغ
    [
      'م',
      'اسم الصنف (عربي)',
      'الاسم بالإنجليزية',
      'التصنيف',
      'سعر البيع (ج.م)',
      'السعر قبل الخصم (ج.م)',
      'حالة التوفر بالمطبخ',
      'كمية المخزون',
      'الباركود الدولي',
      'كود كاشير POS',
      'الوصف والمكونات',
      'رابط صورة الصنف',
    ],
  ];

  // 2. تعبئة بيانات الأصناف
  products.forEach((p, idx) => {
    data.push([
      idx + 1,
      p.name || '',
      p.nameEn || '',
      p.category || 'عام',
      p.price || 0,
      p.originalPrice || '',
      p.inStock ? 'متوفر للطلب' : 'غير متوفر حالياً',
      p.stockQuantity ?? 50,
      p.barcode || '',
      p.merchantPosSku || '',
      p.description || '',
      p.imageUrl || '',
    ]);
  });

  // 3. تذييل التوقيع الرسمي لسنجوب
  data.push([]);
  data.push(['═══════════════════════════════════════════════════════════════════════']);
  data.push([
    'تم التصدير والاعتماد آلياً عبر منصة سنجوب للتوصيل الذكي (Sangoub Delivery) © جميع الحقوق محفوظة',
  ]);

  // 4. إنشاء ورقة العمل والمصنف
  const ws = XLSX.utils.aoa_to_sheet(data);

  // ضبط عروض الأعمدة لتكون مريحة ومقروءة
  ws['!cols'] = [
    { wch: 6 },  // م
    { wch: 28 }, // اسم الصنف
    { wch: 24 }, // الاسم بالإنجليزية
    { wch: 16 }, // التصنيف
    { wch: 14 }, // السعر
    { wch: 16 }, // السعر قبل الخصم
    { wch: 18 }, // التوفر
    { wch: 14 }, // المخزون
    { wch: 18 }, // الباركود
    { wch: 14 }, // POS
    { wch: 35 }, // الوصف
    { wch: 35 }, // رابط الصورة
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'قائمة المنتجات');

  // 5. حفظ الملف باسم رسمي
  const safeStoreName = storeName.replace(/[\\/:*?"<>|]/g, '').trim() || 'المتجر';
  const fileDate = now.toISOString().slice(0, 10);
  const filename = `منتجات_${safeStoreName}_سنجوب_الذكي_${fileDate}.xlsx`;

  XLSX.writeFile(wb, filename);
}

