import type { Product, Store } from '../types';
import { SUPERMARKET_CATEGORY_TEMPLATES } from '../constants/taxonomy';

/**
 * Official Category Aliases, Keywords & Synonyms
 * Ensures complete coverage across legacy database strings, merchant inputs, and official taxonomy.
 */
export const CATEGORY_ALIASES: Record<string, string[]> = {
  'CAT-PRODUCE': [
    'الخضروات والفواكه', 'خضروات وفواكه', 'خضار وفاكهة', 'الخضروات', 'الفواكه', 'خضروات', 'فواكه', 'فاكهة', 'خضار', 'طماطم', 'خيار', 'بطاطس', 'بصل', 'ليمون', 'تفاح', 'موز', 'برتقال',
    'فراولة', 'عنب', 'مانجو', 'خس', 'جرجير', 'فلفل', 'جزر', 'كوسة', 'باذنجان', 'produce', 'vegetables', 'fruits'
  ],
  'CAT-BAKERY': [
    'المخبوزات والخبز', 'مخبوزات وخبز', 'مخبوزات', 'خبز', 'عيش', 'فينو', 'توست', 'باتيه', 'كرواسون', 'مخبز', 'بقسماط', 'كيك', 'مولتو', 'بسكويت خبز',
    'عيش بلدي', 'عيش شامي', 'روستو', 'bakery', 'bread'
  ],
  'CAT-MEAT': [
    'اللحوم والدواجن', 'لحوم ودواجن', 'لحوم', 'دواجن', 'فراخ', 'لحمة', 'كفتة', 'بانيه', 'كبدة', 'مفروم', 'سجق', 'برجر لحم', 'ستيك', 'لحم بقري',
    'دجاج', 'صدور دجاج', 'أوراك', 'شيش طاووق', 'meat', 'poultry'
  ],
  'CAT-DAIRY': [
    'الألبان والبيض', 'البان وبيض', 'ألبان', 'البان', 'لبن', 'حليب', 'بيض', 'زبادي', 'جبن', 'جبنة', 'قشطة', 'زبدة', 'رايب', 'مراعي', 'جهينة',
    'دومتي', 'عبور لاند', 'لافاش كيري', 'dairy', 'eggs', 'milk'
  ],
  'CAT-DELI': [
    'الجبن واللانشون', 'جبن ولانشون', 'جبن', 'لانشون', 'بسطرمة', 'رومي', 'شيدر', 'موتزاريلا', 'فيتا', 'براميلي', 'زيتون', 'مخلل', 'سلامي',
    'روست بيف', 'ديك رومي مدخن', 'جبنة بيضاء', 'جبنة مثلجات', 'deli', 'cheese'
  ],
  'CAT-PANTRY': [
    'البقالة والمواد الغذائية', 'بقالة ومواد غذائية', 'بقالة', 'مواد غذائية', 'سوبر ماركت', 'أرز', 'ارز', 'مكرونة', 'زيت', 'سكر', 'صلصة', 'تونة', 'سمن', 'دقيق',
    'شعرية', 'عدس', 'فول مدمس', 'سمنة', 'خل', 'شوفان', 'معلبات', 'ذرة', 'مشروم', 'pantry', 'grocery', 'canned'
  ],
  'CAT-BREAKFAST': [
    'الفطار', 'فطار', 'فطور', 'وجبات فطار', 'فول', 'فلافل', 'طعمية', 'شوفان', 'كورن فليكس', 'عسل', 'مربى', 'حلاوة', 'طحينة',
    'نسكويك', 'سيريال', 'بليلة', 'breakfast'
  ],
  'CAT-COOKING': [
    'الطبخ والخبز', 'طبخ وخبز', 'طبخ', 'خبز', 'دقيق', 'بهارات', 'توابل', 'زيت طعام', 'سمنة بلدي', 'سمن', 'خل', 'مرقة', 'خميرة',
    'بيكنج باودر', 'فانيليا', 'نشا', 'ملح', 'فلفل أسود', 'كمون', 'cooking', 'baking', 'spices'
  ],
  'CAT-FROZEN': [
    'الأطعمة المجمدة', 'أطعمة مجمدة', 'اطعمة مجمدة', 'المجمدات', 'مجمدات', 'خضار مجمد', 'ملوخية مجمدة', 'بسلة', 'بامية', 'برجر مجمد', 'ناجتس', 'ستربس',
    'سمبوسك', 'جلاش', 'فرايز', 'بطاطس نصف مقلية', 'frozen', 'frozen food'
  ],
  'CAT-DIET': [
    'أغذية الحمية', 'اغذية الحمية', 'أغذية دايت', 'حمية', 'دايت', 'كيتو', 'شوفان', 'خالي من السكر', 'قليل الدسم', 'هيلثي', 'سناك صحي', 'بروتين',
    'بذور الشيا', 'سكر ستيفيا', 'diet', 'healthy', 'keto'
  ],
  'CAT-BEVERAGES': [
    'المشروبات', 'مشروبات', 'مشروبات ومياه', 'عصائر', 'مياه', 'مياه معدنية', 'عصير', 'بيبسي', 'كولا', 'شويبس', 'صودا', 'مشروب غازي',
    'نستله', 'أكوافينا', 'بركة', 'داساني', 'بيتي', 'راني', 'beverages', 'drinks', 'water', 'juice'
  ],
  'CAT-COFFEE-TEA': [
    'القهوة والشاي', 'قهوة وشاي', 'شاي وقهوة', 'شاي', 'قهوة', 'نسكافيه', 'بن', 'كابتشينو', 'إسبريسو', 'اسبريسو', 'ليبتون', 'أعشاب', 'أحمد تي',
    'العروبة', 'نعناع', 'ينسون', 'كركديه', 'coffee', 'tea'
  ],
  'CAT-SNACKS': [
    'التسالي والشوكولاتة', 'تسالي وشوكولاتة', 'تسالي', 'شوكولاتة', 'سناكس', 'شيبسي', 'بسكويت', 'مقرمشات', 'كيك', 'ويفر', 'كراميل', 'كادبوري',
    'جلاكسي', 'ليز', 'دوريتوس', 'شيتوس', 'حلويات', 'لب', 'سوداني', 'مكسرات', 'snacks', 'chocolate', 'chips'
  ],
  'CAT-ICECREAM': [
    'الآيس كريم', 'آيس كريم', 'ايس كريم', 'جيلاتي', 'كونو', 'ميجا', 'ستيك', 'دولسي', 'فريدو', 'كيمو', 'ice cream'
  ],
  'CAT-CLEANING': [
    'المنظفات والغسيل', 'منظفات وغسيل', 'منظفات وعناية بالمنزل', 'منظفات', 'غسيل', 'مساحيق', 'مسحوق', 'أريال', 'اريال', 'تايد', 'برسيل', 'أوكسي', 'اوكسي', 'داوني',
    'كومفورت', 'فانيش', 'فيري', 'بريل', 'فينيش', 'أطباق', 'اطباق', 'صحون', 'cleaning', 'laundry', 'detergent'
  ],
  'CAT-HOME': [
    'مستلزمات المنزل', 'عناية بالمنزل', 'منزل', 'مطهر', 'معقم', 'ديتول', 'كلوركس', 'جنرال', 'مستر ماسل',
    'هاربيك', 'معطر', 'معطر جو', 'فريدال', 'جليد', 'إيرويك', 'مبيد', 'حشرات', 'ريد', 'باوجون', 'بيروسول',
    'أكياس قمامة', 'سلك مواعين', 'إسفنجة', 'فوط مطبخ', 'home', 'household'
  ],
  'CAT-PERSONAL': [
    'العناية الشخصية', 'عناية شخصية', 'شامبو', 'صابون', 'شاور جل', 'معجون أسنان', 'فرشاة أسنان', 'مزيل عرق', 'لوشن', 'كريم شعر',
    'دوف', 'بانتين', 'هيد آند شولدرز', 'سيجنال', 'كولجيت', 'ريكسونا', 'نيفيا', 'personal care'
  ],
  'CAT-BABY': [
    'مستلزمات الأطفال', 'مستلزمات أطفال', 'أطفال', 'اطفال', 'بامبرز', 'حفاضات', 'حفاض', 'مناديل مبللة للأطفال', 'مناديل مبللة', 'سيريلاك',
    'شامبو أطفال', 'زيت جونسون', 'بودرة أطفال', 'رضاعة', 'لهاية', 'baby', 'baby care'
  ],
  'CAT-PET': [
    'مستلزمات الحيوانات الأليفة', 'حيوانات أليفة', 'حيوانات', 'أليفة', 'قطط', 'كلاب', 'طعام قطط', 'طعام كلاب', 'دراي فود', 'رمل قطط', 'ويسكس', 'فريسكيز', 'pet', 'pet care'
  ],
  'CAT-DISPOSABLES': [
    'المستلزمات ذات الاستخدام الواحد', 'استخدام واحد', 'ورقيات', 'مناديل', 'فاين', 'زينة', 'مناديل تواليت', 'ورق مطبخ', 'فويل', 'ألومنيوم',
    'أكياس ثلاجة', 'أكياس حفظ', 'ورق زبدة', 'مفارش سفرة', 'أطباق بلاستيك', 'أكواب كرتون', 'ملاعق بلاستيك',
    'شاليموه', 'disposables', 'paper products'
  ],
  'CAT-STATIONERY': [
    'مستلزمات المكتب والمدرسة', 'مكتب ومدرسة', 'أدوات مكتبية', 'أدوات مدرسية', 'مكتب', 'مدرسة', 'كشاكيل', 'كراسات', 'أقلام', 'قلم جاف', 'قلم رصاص', 'ورق تصوير',
    'ألوان', 'مسطرة', 'براية', 'أستيكة', 'ملفات', 'stationery', 'school'
  ],
  'CAT-AUTO': [
    'مستلزمات السيارات', 'سيارات', 'عناية بالسيارات', 'معطر سيارة', 'شامبو سيارات', 'فوطة زفارة', 'مياه ردياتير', 'زيت فرامل', 'automotive'
  ],
  'CAT-OUTDOOR': [
    'مستلزمات الرحلات', 'رحلات', 'خروج', 'فحم', 'شواية', 'كولمان', 'ترمس', 'كراسي بحر', 'خيمة', 'outdoor', 'picnic'
  ],
  'CAT-SEASONAL': [
    'مستلزمات المواسم والمناسبات', 'مواسم ومناسبات', 'مواسم', 'مناسبات', 'رمضان', 'ياميش', 'فوانيس', 'أعياد', 'زينة رمضان', 'عيدية', 'seasonal'
  ]
};

/**
 * Strips Arabic definite article (ال) from the start of each word if length > 3.
 */
export function stripArabicDefiniteArticle(text?: string | null): string {
  if (!text) return '';
  return text
    .split(/\s+/)
    .map((word) => (word.startsWith('ال') && word.length > 3 ? word.slice(2) : word))
    .join(' ');
}

/**
 * Normalizes Arabic strings by unifying hamzas, taa-marbouta, and diacritics.
 */
export function normalizeArabicText(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[\u064B-\u065F]/g, ''); // Remove tashkeel
}

/**
 * Checks whether a product matches a target category (by code, name, or semantic aliases).
 */
export function matchProductToCategory(
  product: Product,
  targetCategoryCodeOrName: string,
  extraCategoryName?: string
): boolean {
  if (!targetCategoryCodeOrName) return true;

  const target = targetCategoryCodeOrName.trim();
  const upperTarget = target.toUpperCase();
  const targetNorm = normalizeArabicText(target);
  const targetStripped = stripArabicDefiniteArticle(targetNorm);

  const pCatNorm = normalizeArabicText(product.category);
  const pCatStripped = stripArabicDefiniteArticle(pCatNorm);
  const pCatId = (product.categoryId || '').toUpperCase();
  const pNameNorm = normalizeArabicText(product.name);
  const pDescNorm = normalizeArabicText(product.description);

  // 1. Direct Category ID Match
  if (pCatId && upperTarget === pCatId) {
    return true;
  }

  // 2. Direct Category Name Match (with normalization & stripped definite article)
  if (
    pCatNorm === targetNorm ||
    pCatNorm.includes(targetNorm) ||
    targetNorm.includes(pCatNorm) ||
    (targetStripped && pCatStripped === targetStripped) ||
    (targetStripped && pCatStripped.includes(targetStripped)) ||
    (pCatStripped && targetStripped.includes(pCatStripped))
  ) {
    return true;
  }

  // 3. Match against taxonomy template definitions
  const tmpl = SUPERMARKET_CATEGORY_TEMPLATES.find(
    t => t.code.toUpperCase() === upperTarget || 
         normalizeArabicText(t.name_ar) === targetNorm ||
         (extraCategoryName && t.code.toUpperCase() === extraCategoryName.toUpperCase()) ||
         (extraCategoryName && normalizeArabicText(t.name_ar) === normalizeArabicText(extraCategoryName))
  );

  if (tmpl) {
    const tmplNameNorm = normalizeArabicText(tmpl.name_ar);
    const tmplNameStripped = stripArabicDefiniteArticle(tmplNameNorm);

    if (
      pCatNorm === tmplNameNorm ||
      pCatNorm.includes(tmplNameNorm) ||
      tmplNameNorm.includes(pCatNorm) ||
      pCatStripped === tmplNameStripped ||
      pCatStripped.includes(tmplNameStripped) ||
      tmplNameStripped.includes(pCatStripped)
    ) {
      return true;
    }
  }

  // 4. Resolve Aliases from Category Code or Category Name
  let matchedAliases: string[] = [];

  if (CATEGORY_ALIASES[upperTarget]) {
    matchedAliases = CATEGORY_ALIASES[upperTarget];
  } else if (tmpl && CATEGORY_ALIASES[tmpl.code]) {
    matchedAliases = CATEGORY_ALIASES[tmpl.code];
  } else {
    // Check if target matches any category alias key
    for (const [code, aliases] of Object.entries(CATEGORY_ALIASES)) {
      if (
        aliases.some(
          a =>
            normalizeArabicText(a) === targetNorm ||
            targetNorm.includes(normalizeArabicText(a)) ||
            stripArabicDefiniteArticle(normalizeArabicText(a)) === targetStripped
        )
      ) {
        matchedAliases = aliases;
        break;
      }
    }
  }

  // 5. Test Product Category, Name, and Description against Aliases
  if (matchedAliases.length > 0) {
    const hasAliasMatch = matchedAliases.some((alias) => {
      const aNorm = normalizeArabicText(alias);
      const aStripped = stripArabicDefiniteArticle(aNorm);
      return (
        pCatNorm.includes(aNorm) ||
        (aStripped && pCatStripped.includes(aStripped)) ||
        pNameNorm.includes(aNorm) ||
        pDescNorm.includes(aNorm)
      );
    });
    if (hasAliasMatch) return true;
  }

  return false;
}

/**
 * Finds matching official category code for any freeform category name.
 */
export function findMatchingCategoryCode(categoryNameOrKeyword: string): string | null {
  if (!categoryNameOrKeyword) return null;
  const norm = normalizeArabicText(categoryNameOrKeyword);
  const stripped = stripArabicDefiniteArticle(norm);

  // Check templates first
  for (const tmpl of SUPERMARKET_CATEGORY_TEMPLATES) {
    const tmplNorm = normalizeArabicText(tmpl.name_ar);
    const tmplStripped = stripArabicDefiniteArticle(tmplNorm);
    if (tmpl.code.toLowerCase() === norm || tmplNorm === norm || (stripped && tmplStripped === stripped)) {
      return tmpl.code;
    }
  }

  // Check aliases
  for (const [code, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (
      aliases.some((a) => {
        const aNorm = normalizeArabicText(a);
        const aStripped = stripArabicDefiniteArticle(aNorm);
        return aNorm === norm || (stripped && aStripped === stripped) || norm.includes(aNorm);
      })
    ) {
      return code;
    }
  }

  return null;
}

/**
 * Calculates dynamic product count for a category.
 */
export function getCategoryProductCount(
  products: Product[],
  catCode: string,
  catNameAr: string
): number {
  return products.filter((p) => matchProductToCategory(p, catCode, catNameAr)).length;
}

/**
 * Finds all merchants offering items in a given category.
 */
export function getCategoryMerchants(
  products: Product[],
  catCodeOrName: string,
  stores: Store[]
): Store[] {
  const matched = products.filter((p) => matchProductToCategory(p, catCodeOrName));
  const storeNames = new Set(matched.map((p) => p.storeName));
  const storeIds = new Set(matched.map((p) => p.storeId));

  return stores.filter((s) => storeNames.has(s.name) || storeIds.has(s.id));
}


