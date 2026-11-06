import type { Product } from '../types';

export interface ProductSpecs {
  brand: string;
  netWeightOrVolume: string;
  categoryName: string;
  storeName: string;
  isColdChain: boolean;
  deliveryFeature: string;
  customAttributes: Array<{ label: string; value: string }>;
}

const KNOWN_BRANDS = [
  'دولفين',
  'سانشاين',
  'العلالي',
  'تريفا',
  'ريو ماري',
  'المراعي',
  'جهينة',
  'دومتي',
  'عبور لاند',
  'نستله',
  'بركة',
  'دوف',
  'نيفيا',
  'جونسون',
  'فريدال',
  'جليد',
  'إيرويك',
  'بيروسول',
  'ريد',
  'شاي العروسة',
  'ليبتون',
  'أحمد تي',
  'كرم الشام',
  'كشري هند',
  'أسماك بركات',
  'أبو عوف',
  'حلواني',
  'أمريكانا',
  'كوكي',
  'أطياب',
  'كادبوري',
  'جالكسي',
  'شيبسي',
  'دوريتوس',
  'تايجر',
  'فيروز',
  'شويبس',
  'كوكاكولا',
  'بيبسي',
  'سبيرو سباتس',
  'بنادول',
  'أدول',
  'كونجستال',
  'كومتركس',
  'أوجمنتين',
  'ألفينترن',
  'كيتوفان',
  'بروفين',
  'فولتارين',
  'أوتريفين',
  'ستربسلز',
];

export function getProductSpecifications(product: Product): ProductSpecs {
  const name = product.name || '';
  const desc = product.description || '';
  const cat = (product.category || '').toLowerCase();

  // 1. Extract Brand
  let brand = (product as any).brand || (product as any).brand_name || '';
  if (!brand) {
    for (const b of KNOWN_BRANDS) {
      if (name.includes(b) || desc.includes(b)) {
        brand = b;
        break;
      }
    }
  }
  if (!brand) {
    brand = product.storeName ? product.storeName.replace('متجر ', '').split(' - ')[0] : 'سنجوب إكسبريس';
  }

  // 2. Extract Net Weight / Volume
  const weightRegex = /(\d+(\.\d+)?)\s*(جرام|جم|كجم|كيلو|لتر|مل|قرص|كبسولة|قطعة|أكياس|كيس|زجاجة|مفرش|منديل|علبة)/i;
  const match = name.match(weightRegex) || desc.match(weightRegex);
  const netWeightOrVolume = match ? `${match[1]} ${match[3]}` : '';

  // 3. Category & Store
  const categoryName = product.category || 'عام';
  const storeName = product.storeName || 'سنجوب';

  // 4. Cold Chain Detection (Only real perishables require cold transport)
  const isColdChain =
    name.includes('آيس كريم') ||
    name.includes('جيلاتي') ||
    name.includes('زبادي') ||
    name.includes('مثلجات') ||
    name.includes('مجمدات') ||
    name.includes('لحوم طازجة') ||
    cat.includes('مجمدات') ||
    cat.includes('مثلجات');

  const deliveryFeature = isColdChain ? 'توصيل مبرد ومحكم' : 'تغليف آمن ومحكم';

  // 5. Dynamic Custom Attributes from database/control panel
  const customAttributes: Array<{ label: string; value: string }> = [];

  if (brand) {
    customAttributes.push({ label: 'العلامة التجارية / الماركة', value: brand });
  }

  if (netWeightOrVolume) {
    customAttributes.push({ label: 'الوزن / الحجم الصافي', value: netWeightOrVolume });
  }

  customAttributes.push({ label: 'القسم والتصنيف', value: categoryName });
  customAttributes.push({ label: 'المتجر الموفر', value: storeName });

  // Read any dynamic specifications saved from admin/control panel (e.g. master_spu or product.specifications)
  const rawSpecs = (product as any).specifications || (product as any).properties || (product as any).attributes;
  if (rawSpecs && typeof rawSpecs === 'object') {
    Object.entries(rawSpecs).forEach(([k, v]) => {
      if (v && typeof v === 'string' && k !== 'sku' && k !== 'barcode') {
        const readableLabel = k
          .replace('serving_size', 'حجم الوجبة')
          .replace('origin', 'بلد المنشأ')
          .replace('storage', 'إرشادات الحفظ')
          .replace('flavor', 'النكهة')
          .replace('ingredients', 'المكونات');
        customAttributes.push({ label: readableLabel, value: String(v) });
      }
    });
  }

  return {
    brand,
    netWeightOrVolume: netWeightOrVolume || 'عبوة قياسية',
    categoryName,
    storeName,
    isColdChain,
    deliveryFeature,
    customAttributes,
  };
}
