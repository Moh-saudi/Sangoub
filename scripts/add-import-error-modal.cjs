const fs = require('fs');

const path = 'd:/Sangoub/src/components/BulkProductImportModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add icons to lucide-react import
if (!content.includes('AlertCircle,')) {
  content = content.replace(
    '  AlertTriangle,',
    '  AlertTriangle,\n  AlertCircle,\n  Info,\n  FileDown,\n  Check,'
  );
  if (!content.includes('AlertCircle,')) {
    content = content.replace(
      '  AlertTriangle,',
      '  AlertTriangle,\r\n  AlertCircle,\r\n  Info,\r\n  FileDown,\r\n  Check,'
    );
  }
}

// 2. Add ImportErrorItem interface and state
const interfaceAnchor = `interface BulkProductImportModalProps {`;
const interfaceAddition = `export interface ImportErrorItem {
  rowIndex: number;
  productName: string;
  errorReason: string;
  suggestedFix: string;
}

interface BulkProductImportModalProps {`;

if (!content.includes('interface ImportErrorItem')) {
  content = content.replace(interfaceAnchor, interfaceAddition);
}

// 3. Add states for filterOnlyErrors and importResult
const stateAnchor = `  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });`;
const stateAdditions = `  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [filterOnlyErrors, setFilterOnlyErrors] = useState(false);
  const [importResult, setImportResult] = useState<{
    completed: boolean;
    successCount: number;
    failedCount: number;
    errors: ImportErrorItem[];
  } | null>(null);`;

if (!content.includes('filterOnlyErrors')) {
  content = content.replace(stateAnchor, stateAdditions);
}

// 4. Update handleStartImport to record failures and show report
const oldImportLoop = `    let successCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const prodId = crypto.randomUUID();

      try {
        let finalImageUrl = row.imageUrl || '';
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

        // 1. Primary: Save to Supabase products table (Single Source of Truth)
        const targetStoreUuid = resolveSupabaseStoreUuid(row.storeId);
        const safeOrigPrice = (row.originalPrice && Number(row.originalPrice) > Number(row.price)) ? Number(row.originalPrice) : undefined;

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
          image_url: finalImageUrl || null,
        });

        if (sbError) {
          console.warn(\`Supabase upsert warning on row \${row.index}:\`, sbError);
        }

        // 2. Legacy Firebase Sync (Non-blocking fallback)
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
        } catch (fbErr) {
          console.info('Legacy Firebase sync skipped:', fbErr);
        }

        successCount++;
      } catch (err) {
        console.error(\`Failed to import row \${row.index}:\`, err);
      }

      setImportProgress({ current: i + 1, total: validRows.length });
    }

    setImporting(false);
    onSuccess(successCount);
    onClose();`;

const newImportLoop = `    let successCount = 0;
    const failedItems: ImportErrorItem[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const prodId = crypto.randomUUID();

      try {
        let finalImageUrl = row.imageUrl || '';
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

        // 1. Primary: Save to Supabase products table (Single Source of Truth)
        const targetStoreUuid = resolveSupabaseStoreUuid(row.storeId);
        const safeOrigPrice = (row.originalPrice && Number(row.originalPrice) > Number(row.price)) ? Number(row.originalPrice) : undefined;

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
          image_url: finalImageUrl || null,
        });

        if (sbError) {
          console.warn(\`Supabase upsert warning on row \${row.index}:\`, sbError);
          let reason = sbError.message || 'خطأ في قاعدة بيانات سوبابيز';
          let fix = 'تأكد من اختيار المتجر بشكل صحيح وأن الأعمدة مطابقة للنموذج.';
          if (sbError.code === '22P02') {
            reason = 'معرّف المتجر أو أحد الحقول الرقمية غير مطابق للصيغة المطلوبة.';
            fix = 'تأكد من اختيار متجرك من القائمة بالأعلى، وأن خانات الأسعار تحتوي أرقاماً فقط.';
          } else if (sbError.code === '23505') {
            reason = 'الصنف مكرر بالفعل أو كود الباركود مسجل لصنف آخر.';
            fix = 'تأكد من عدم تكرار كود الباركود لنفس الصنف.';
          }
          failedItems.push({
            rowIndex: row.index,
            productName: row.name || 'صنف بدون اسم',
            errorReason: reason,
            suggestedFix: fix,
          });
          continue;
        }

        // 2. Legacy Firebase Sync (Non-blocking fallback)
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
        } catch (fbErr: any) {
          console.info('Legacy Firebase sync skipped:', fbErr);
        }

        successCount++;
      } catch (err: any) {
        console.error(\`Failed to import row \${row.index}:\`, err);
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

    if (failedItems.length > 0) {
      // Show actionable report screen instead of silent close!
      setImportResult({
        completed: true,
        successCount,
        failedCount: failedItems.length,
        errors: failedItems,
      });
    } else {
      onSuccess(successCount);
      onClose();
    }`;

const normalize = s => s.replace(/\r\n/g, '\n');
if (normalize(content).includes(normalize(oldImportLoop))) {
  content = normalize(content).replace(normalize(oldImportLoop), normalize(newImportLoop));
  console.log('Replaced handleStartImport loop with error capturing');
} else {
  console.error('Failed to match oldImportLoop');
}

// 5. Add Export Error Rows helper function
const exportHelper = `  const handleExportErrorRows = () => {
    if (!importResult || importResult.errors.length === 0) return;
    const errorData = importResult.errors.map(err => ({
      'رقم_الصف_في_الملف': err.rowIndex + 1,
      'اسم_المنتج': err.productName,
      'سبب_الخطأ': err.errorReason,
      'طريقة_التصحيح': err.suggestedFix,
    }));
    const worksheet = XLSX.utils.json_to_sheet(errorData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'أخطاء_الاستيراد');
    XLSX.writeFile(workbook, \`أخطاء_استيراد_منتجات_\${new Date().toISOString().split('T')[0]}.xlsx\`);
  };`;

if (!content.includes('handleExportErrorRows')) {
  content = content.replace(
    '  const validCount = parsedRows.filter(r => r.isValid).length;',
    `${exportHelper}\n\n  const validCount = parsedRows.filter(r => r.isValid).length;`
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully saved script changes step 1');

