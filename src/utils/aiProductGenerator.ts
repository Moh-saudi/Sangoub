import { supabase } from '../lib/supabase';
import type { Category, ProductOptionGroup } from '../types';
import pharmacyCatalog from '../data/pharmacyCatalog.json';

export interface MatchingProduct {
  id: string;
  name_ar: string;
  name_en?: string;
  description?: string;
  category?: string;
  category_id?: string;
  barcode?: string;
  image_url?: string;
  suggested_price?: number;
  source?: 'master_spu' | 'local_catalog' | 'products';
}

export interface AISuggestionResult {
  nameEn: string;
  description: string;
  categoryName?: string;
  badge?: string;
  suggestedPrice?: number;
  modifiers?: ProductOptionGroup[];
}

export interface DetectedCategoryResult {
  category: Category;
  l1Id?: string;
  l2Id?: string;
  l3Id?: string;
  pathDisplay: string;
}

/**
 * كتالوج المنتجات القياسية المعتمد والمحمّل في الذاكرة للبحث الفوري بدون أي تأخير (0ms)
 */
const CORE_FOOD_AND_GROCERY_CATALOG: MatchingProduct[] = [
  // شاي ومشروبات ساخنة
  {
    id: 'local-tea-01',
    name_ar: 'شاي ليبتون ناعم أحمر 250 جم',
    name_en: 'Lipton Red Label Black Tea 250g',
    description: 'شاي أسود كيني ناعم عالي الجودة من أفضل مزارع الشاي العالمية',
    barcode: '6221155010012',
    suggested_price: 75,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },
  {
    id: 'local-tea-02',
    name_ar: 'شاي ليبتون العلامة الصفراء 100 فتلة',
    name_en: 'Lipton Yellow Label Tea 100 Bags',
    description: 'شاي أسود فاخر 100 كيس فلتر مغلف فردياً',
    barcode: '6221155010029',
    suggested_price: 110,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },
  {
    id: 'local-tea-03',
    name_ar: 'شاي العروسة ناعم 250 جم',
    name_en: 'El Arosa Black Tea 250g',
    description: 'شاي أسود كيني متميز بطعم أصيل وقوي، نخب أول',
    barcode: '6223000530018',
    suggested_price: 65,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },
  {
    id: 'local-tea-04',
    name_ar: 'شاي العروسة 100 فتلة',
    name_en: 'El Arosa Tea 100 Bags',
    description: 'شاي العروسة 100 فتلة أصلية سهلة التحضير',
    barcode: '6223000530025',
    suggested_price: 95,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },
  {
    id: 'local-tea-05',
    name_ar: 'شاي أخضر أحمد تي بالنعناع 20 كيس',
    name_en: 'Ahmad Tea Green Tea with Mint 20 Bags',
    description: 'شاي أخضر طبيعي بنكهة النعناع المنعش ومضاد للأكسدة',
    barcode: '054881007421',
    suggested_price: 60,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },
  {
    id: 'local-cof-01',
    name_ar: 'قهوة نسكافيه جولد سريعة التحضير 100 جم',
    name_en: 'Nescafe Gold Instant Coffee 100g',
    description: 'قهوة ذهبية نقية غنية بالرائحة والنكهة الفاخرة المحمصة بعناية',
    barcode: '7613035882011',
    suggested_price: 220,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },
  {
    id: 'local-cof-02',
    name_ar: 'نسكافيه كلاسيك 3 في 1 كيس',
    name_en: 'Nescafe 3 in 1 Sachet',
    description: 'مزيج القهوة السريع مع المبيض والسكر المتوازن',
    barcode: '7613031234567',
    suggested_price: 10,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },
  {
    id: 'local-cof-03',
    name_ar: 'بن عبد المعبود محوج فاتح 100 جم',
    name_en: 'Abdel Maboud Light Cardamom Coffee 100g',
    description: 'بن يمني وبرازيلي مطحون ومحوج بالحبان والمستكة',
    barcode: '6224000123456',
    suggested_price: 60,
    category: 'شاي وقهوة ومشروبات ساخنة',
    source: 'local_catalog',
  },

  // ألبان وأجبان
  {
    id: 'local-mlk-01',
    name_ar: 'حليب جهينة كامل الدسم 1 لتر',
    name_en: 'Juhayna Full Cream Milk 1L',
    description: 'حليب بقري طبيعي 100% معقم ومعبأ تتراباك خالي من المواد الحافظة',
    barcode: '6221007010014',
    suggested_price: 48,
    category: 'حليب ولبن رائب',
    source: 'local_catalog',
  },
  {
    id: 'local-mlk-02',
    name_ar: 'حليب المراعي كامل الدسم 1 لتر',
    name_en: 'Almarai Full Fat Milk 1L',
    description: 'حليب طازج معالج بدرجة حرارة فائقة معبأ بجودة عالمية',
    barcode: '6281007010021',
    suggested_price: 50,
    category: 'حليب ولبن رائب',
    source: 'local_catalog',
  },
  {
    id: 'local-mlk-03',
    name_ar: 'لبن رايب جهينة طبيعي 440 مل',
    name_en: 'Juhayna Rayeb Natural 440ml',
    description: 'لبن رائب صحي غني بالبروبيوتيك وخفيف على المعدة',
    barcode: '6221007010038',
    suggested_price: 22,
    category: 'حليب ولبن رائب',
    source: 'local_catalog',
  },
  {
    id: 'local-chs-01',
    name_ar: 'جبنة دومتي فيتا بلس بطعم القشطة 500 جم',
    name_en: 'Domty Feta Cheese with Cream 500g',
    description: 'جبنة بيضاء فيتا كريمية ناعمة سهلة الفرد ومثالية للسندوتشات',
    barcode: '6221054010115',
    suggested_price: 42,
    category: 'جبن فيتا وإسطنبولي براميلي',
    source: 'local_catalog',
  },
  {
    id: 'local-chs-02',
    name_ar: 'جبنة عبور لاند فيتا 500 جم',
    name_en: 'Obour Land Feta Cheese 500g',
    description: 'جبنة بيضاء نباتية الدهن مبسترة عالية الجودة',
    barcode: '6223001850123',
    suggested_price: 38,
    category: 'جبن فيتا وإسطنبولي براميلي',
    source: 'local_catalog',
  },
  {
    id: 'local-chs-03',
    name_ar: 'جبنة براميلي بالفلفل الأخضر 250 جم',
    name_en: 'Baramily Cheese with Green Pepper 250g',
    description: 'جبنة براميلي طبيعية معتقة بالفلفل الحار والملح المضبوط',
    barcode: '6223001850999',
    suggested_price: 55,
    category: 'جبن فيتا وإسطنبولي براميلي',
    source: 'local_catalog',
  },
  {
    id: 'local-chs-04',
    name_ar: 'جبن قريش طبيعي بلدي 500 جم',
    name_en: 'Natural Fresh Cottage Cheese 500g',
    description: 'جبن قريش فلاحي طازج خالي من الملح والزيوت المهدرجة، صحي ومثالي للدايت',
    barcode: '6223001850555',
    suggested_price: 60,
    category: 'جبن قريش طبيعي وخالي دسم',
    source: 'local_catalog',
  },
  {
    id: 'local-egg-01',
    name_ar: 'طبق بيض أحمر مائدة 30 بيضة',
    name_en: 'Red Table Eggs Carton 30 Pcs',
    description: 'بيض مائدة أحمر طازج مبستر ونظيف من مزارع معتمدة يومياً',
    barcode: '6229999010011',
    suggested_price: 175,
    category: 'بيض مائدة طازج',
    source: 'local_catalog',
  },

  // مياه ومشروبات غازية
  {
    id: 'local-wtr-01',
    name_ar: 'مياه معدنية نستله بيور لايف 1.5 لتر',
    name_en: 'Nestle Pure Life Mineral Water 1.5L',
    description: 'مياه شرب طبيعية نقية معبأة تحت أعلى معايير الجودة العالمية',
    barcode: '6221003010018',
    suggested_price: 10,
    category: 'مياه معدنية وفوارة',
    source: 'local_catalog',
  },
  {
    id: 'local-wtr-02',
    name_ar: 'مياه معدنية بركة 600 مل',
    name_en: 'Baraka Natural Water 600ml',
    description: 'مياه شرب صغيرة مناسبة للاستخدام اليومي والعمل والمكتب',
    barcode: '6221003010025',
    suggested_price: 6,
    category: 'مياه معدنية وفوارة',
    source: 'local_catalog',
  },
  {
    id: 'local-bev-01',
    name_ar: 'بيبسي كانز 330 مل',
    name_en: 'Pepsi Can 330ml',
    description: 'مشروب غازي كولا منعش وبارد يقدم مثلجاً',
    barcode: '6221001010012',
    suggested_price: 15,
    category: 'مشروبات غازية',
    source: 'local_catalog',
  },
  {
    id: 'local-bev-02',
    name_ar: 'كوكاكولا كانز 330 مل',
    name_en: 'Coca-Cola Can 330ml',
    description: 'المذاق الأصلي المنعش لمشروب كوكاكولا الكلاسيكي',
    barcode: '6221002010019',
    suggested_price: 15,
    category: 'مشروبات غازية',
    source: 'local_catalog',
  },
  {
    id: 'local-bev-03',
    name_ar: 'سفن آب كانز 330 مل',
    name_en: '7Up Can 330ml',
    description: 'مشروب غازي شفاف بنكهة الليمون واللايم المنعش بدون كافيين',
    barcode: '6221001010029',
    suggested_price: 15,
    category: 'مشروبات غازية',
    source: 'local_catalog',
  },
  {
    id: 'local-juc-01',
    name_ar: 'عصير جهينة بيور برتقال 1 لتر',
    name_en: 'Juhayna Pure Orange Juice 1L',
    description: 'عصير برتقال طبيعي 100% بدون سكر مضاف وبدون مواد حافظة',
    barcode: '6221007020013',
    suggested_price: 52,
    category: 'عصائر طبيعية ومشروبات',
    source: 'local_catalog',
  },

  // زيوت ومؤن وبقالة
  {
    id: 'local-oil-01',
    name_ar: 'زيت عافية ذرة نقي 800 مل',
    name_en: 'Afia Pure Corn Oil 800ml',
    description: 'زيت ذرة نقي وخفيف مناسب للقلي والطبخ الصحي وغني بالأوميجا',
    barcode: '6221025010016',
    suggested_price: 95,
    category: 'زيت عباد الشمس وذرة',
    source: 'local_catalog',
  },
  {
    id: 'local-oil-02',
    name_ar: 'زيت كريستال عباد الشمس 800 مل',
    name_en: 'Crystal Sunflower Oil 800ml',
    description: 'زيت عباد الشمس نقي 100% غني بفيتامين هـ وخفيف على الأكل',
    barcode: '6221025010023',
    suggested_price: 88,
    category: 'زيت عباد الشمس وذرة',
    source: 'local_catalog',
  },
  {
    id: 'local-ric-01',
    name_ar: 'أرز مصري الضحى رفيع الحبة 1 كجم',
    name_en: 'El Doha Egyptian Rice 1kg',
    description: 'أرز مصري أبيض منقى ومغسول إلكترونياً جاهز للطهي مباشرة',
    barcode: '6223001220015',
    suggested_price: 45,
    category: 'أرز ومكرونة وبقوليات',
    source: 'local_catalog',
  },
  {
    id: 'local-pas-01',
    name_ar: 'مكرونة الملكة أقلام 400 جم',
    name_en: 'El Maleka Penne Pasta 400g',
    description: 'مكرونة سيملينا فاخرة متماسكة عند السلق ومثالية للطواجن',
    barcode: '6221045010017',
    suggested_price: 18,
    category: 'أرز ومكرونة وبقوليات',
    source: 'local_catalog',
  },
  {
    id: 'local-tun-01',
    name_ar: 'تونة صن شاين قطع سهلة الفتح 185 جم',
    name_en: 'Sunshine Tuna Chunks 185g',
    description: 'لحم تونة أبيض قطع في زيت دوار الشمس عالي البروتين',
    barcode: '6223000880014',
    suggested_price: 65,
    category: 'تونا ومعلبات وصلصة',
    source: 'local_catalog',
  },

  // سناكس وشوكولاتة
  {
    id: 'local-chp-01',
    name_ar: 'شيبسي عائلي بالجبنة المتبلة',
    name_en: 'Chipsy Seasoned Cheese Big Bag',
    description: 'رقائق بطاطس مقرمشة متبلة بأشهى أنواع الجبن',
    barcode: '6221035010013',
    suggested_price: 20,
    category: 'شيبس ومقرمشات وبسكويت',
    source: 'local_catalog',
  },
  {
    id: 'local-chp-02',
    name_ar: 'شيبسي بالملح والخل حجم وسط',
    name_en: 'Chipsy Salt & Vinegar Medium',
    description: 'رقائق بطاطس طبيعية بنكهة الملح والخل اللاذعة',
    barcode: '6221035010020',
    suggested_price: 10,
    category: 'شيبس ومقرمشات وبسكويت',
    source: 'local_catalog',
  },
  {
    id: 'local-chc-01',
    name_ar: 'شوكولاتة كادبوري ديري ميلك سادة 90 جم',
    name_en: 'Cadbury Dairy Milk Chocolate 90g',
    description: 'شوكولاتة الحليب الناعمة الأصلية من كادبوري بطعم الكاكاو الغني',
    barcode: '7622210123456',
    suggested_price: 65,
    category: 'شوكولاتة وحلويات',
    source: 'local_catalog',
  },

  // وجبات ومطاعم
  {
    id: 'local-brg-01',
    name_ar: 'ساندوتش دبل تشيز برجر لحم بقري',
    name_en: 'Double Cheeseburger Beef',
    description: 'قطعتين لحم بقري مشوي 150 جم مع جبن شيدر ذائب وصوص سنجوب الخاص في خبز بريوش',
    suggested_price: 145,
    category: 'ساندوتشات برجر ولحم',
    source: 'local_catalog',
  },
  {
    id: 'local-brg-02',
    name_ar: 'ساندوتش سنجل بيف برجر كلاسيك',
    name_en: 'Single Classic Beef Burger',
    description: 'شريحة برجر لحم بقري صافي مع خس وطماطم وخيار مخلل وصوص مدخن',
    suggested_price: 95,
    category: 'ساندوتشات برجر ولحم',
    source: 'local_catalog',
  },
  {
    id: 'local-shw-01',
    name_ar: 'ساندوتش شاورما دجاج سوري بالثومية كبير',
    name_en: 'Syrian Chicken Shawarma Large',
    description: 'شاورما صدور دجاج متبلة في خبز صاج مقرمش مع ثومية وبطاطس ومخلل خيار',
    suggested_price: 85,
    category: 'شاورما ودجاج مشوي',
    source: 'local_catalog',
  },
  {
    id: 'local-shw-02',
    name_ar: 'ساندوتش شاورما لحم بلدي بالطحينة',
    name_en: 'Beef Shawarma with Tahini',
    description: 'شاورما لحم بلدي طازج مع بقدونس وبصل وطحينة في خبز كيزر أو صاج',
    suggested_price: 105,
    category: 'شاورما ودجاج مشوي',
    source: 'local_catalog',
  },
  {
    id: 'local-piz-01',
    name_ar: 'بيتزا مارجريتا إيطالية وسط',
    name_en: 'Italian Margherita Pizza Medium',
    description: 'عجينة إيطالية هشة مع صلصة طماطم وجبنة موتزاريلا وريحان طازج',
    suggested_price: 110,
    category: 'بيتزا وفطائر إيطالية',
    source: 'local_catalog',
  },
  {
    id: 'local-piz-02',
    name_ar: 'بيتزا بيبروني سجق وموتزاريلا كبيرة',
    name_en: 'Pepperoni Pizza Large',
    description: 'شرائح البيبروني البقري مع صلصة الطماطم وجبنة الموتزاريلا الغنية',
    suggested_price: 165,
    category: 'بيتزا وفطائر إيطالية',
    source: 'local_catalog',
  },
  {
    id: 'local-fol-01',
    name_ar: 'ساندوتش فول إسكندراني بالزيت الحار والليمون',
    name_en: 'Alexandrian Foul Sandwich with Flaxseed Oil',
    description: 'فول مدمس بالخلطة الإسكندرانية والطحينة والزيت الحار في خبز بلدي ساخن',
    suggested_price: 15,
    category: 'فول وفلافل وطعمية',
    source: 'local_catalog',
  },
  {
    id: 'local-fol-02',
    name_ar: 'ساندوتش فلافل طعمية محشية كيري وبسطرمة',
    name_en: 'Stuffed Falafel Sandwich',
    description: 'قرص طعمية مقرمش ومحشو جبن وبسطرمة مع سلطة وطحينة',
    suggested_price: 20,
    category: 'فول وفلافل وطعمية',
    source: 'local_catalog',
  },
  {
    id: 'local-frs-01',
    name_ar: 'بطاطس محمرة فارم فريتس مقرمشة صوابع',
    name_en: 'Crispy French Fries Plate',
    description: 'بطاطس مقلية ذهبية مقرمشة تقدم مع بهارات خاصة وصوص كاتشب ومايونيز',
    suggested_price: 35,
    category: 'بطاطس مقلية وصوصات مميزة',
    source: 'local_catalog',
  },

];

// تحويل كتالوج الأدوية والصيدلية والمستلزمات الطبية والمنظفات الشامل (520 صنف موثق) إلى الذاكرة
const PHARMACY_AND_CLEANING_ITEMS: MatchingProduct[] = (pharmacyCatalog as any[]).map((item, idx) => ({
  id: `cat-pharma-${idx + 1}-${item.pos_sku || item.barcode}`,
  name_ar: item.name_ar,
  name_en: item.name_en,
  description: item.description,
  category: item.category,
  barcode: item.barcode,
  suggested_price: item.price,
  image_url: item.image_url,
  source: 'local_catalog' as const,
}));

/**
 * الكتالوج الموحد الشامل (أغذية + 520 صنف صيدلية ومستلزمات طبية ومنظفات)
 */
export const POPULAR_MASTER_CATALOG: MatchingProduct[] = [
  ...CORE_FOOD_AND_GROCERY_CATALOG,
  ...PHARMACY_AND_CLEANING_ITEMS,
];

/**
 * 1. فحص الكتالوج الموحد والبحث الفوري عن أصناف مطابقة حتى من الحرف الأول
 */
export async function searchMatchingCatalog(term: string): Promise<MatchingProduct[]> {
  if (!term || !term.trim()) return [];
  const clean = term.trim().toLowerCase();

  // أولاً: بحث فوري محلي فائق السرعة في الذاكرة (0ms)
  const localMatches = POPULAR_MASTER_CATALOG.filter(item => {
    const ar = item.name_ar.toLowerCase();
    const en = (item.name_en || '').toLowerCase();
    return ar.includes(clean) || en.includes(clean);
  }).slice(0, 8);

  // إذا كان الحرف مدخلاً فردياً أو ثنائياً، نعيد الفوري فوراً ونبحث في الخلفية
  try {
    const promises: Promise<any>[] = [];

    // بحث في master_spu بالخادم
    promises.push(
      supabase
        .from('master_spu')
        .select('id, name_ar, name_en, description, primary_barcode, images, category_id, suggested_price')
        .ilike('name_ar', `%${clean}%`)
        .limit(6)
    );

    // بحث في منتجات المتجر الحالية
    promises.push(
      supabase
        .from('products')
        .select('id, name, name_en, description, category, category_id, price, image_url, barcode')
        .ilike('name', `%${clean}%`)
        .limit(6)
    );

    const [spuRes, prodRes] = await Promise.allSettled(promises);

    const results: MatchingProduct[] = [...localMatches];
    const seenNames = new Set<string>(localMatches.map(m => m.name_ar));

    if (spuRes.status === 'fulfilled' && spuRes.value.data) {
      spuRes.value.data.forEach((s: any) => {
        if (!seenNames.has(s.name_ar)) {
          seenNames.add(s.name_ar);
          results.push({
            id: s.id,
            name_ar: s.name_ar,
            name_en: s.name_en || '',
            description: s.description || '',
            barcode: s.primary_barcode || '',
            category_id: s.category_id || '',
            suggested_price: s.suggested_price || 0,
            image_url: Array.isArray(s.images) && s.images[0] ? s.images[0] : '',
            source: 'master_spu',
          });
        }
      });
    }

    if (prodRes.status === 'fulfilled' && prodRes.value.data) {
      prodRes.value.data.forEach((p: any) => {
        if (!seenNames.has(p.name)) {
          seenNames.add(p.name);
          results.push({
            id: p.id,
            name_ar: p.name,
            name_en: p.name_en || '',
            description: p.description || '',
            category: p.category || '',
            category_id: p.category_id || '',
            suggested_price: p.price || 0,
            barcode: p.barcode || '',
            image_url: p.image_url || '',
            source: 'products',
          });
        }
      });
    }

    return results.slice(0, 10);
  } catch (err) {
    console.warn('Network search warning:', err);
    return localMatches;
  }
}

/**
 * 2. كاشف التصنيفات الذكي التلقائي:
 * يقوم بتحليل اسم المنتج واختيار التصنيف والتدرج الهرمي المناسب تلقائياً
 * (مثلاً: "شاي" -> يضعه تحت "مشروبات ومياه" -> "شاي وقهوة ومشروبات ساخنة")
 */
export function detectCategoryFromName(
  productName: string,
  categories: Category[]
): DetectedCategoryResult | null {
  if (!productName || !productName.trim() || !categories || categories.length === 0) return null;
  const name = productName.toLowerCase().trim();

  // خريطة الكلمات المفتاحية الذكية للتصنيفات مرتبة حسب الأولوية والتخصص
  const rules: { keywords: RegExp; categoryMatch: RegExp | string }[] = [
    // 1. السناكس والحلويات (تسبق الأجبان مثل "شيبسي بطعم الجبنة")
    { keywords: /شيبسي|شيبس|دوريتوس|بيك رولز|مقرمشات|بسكويت|أوريو|بسكوت/i, categoryMatch: /شيبس|مقرمشات/i },
    { keywords: /شوكولاتة|شوكولاته|كادبوري|جالكسي|كيت كات|نوتيلا/i, categoryMatch: /شوكولاتة|حلويات/i },

    // 2. المطاعم والوجبات السريعة والساندوتشات
    { keywords: /برجر|بيف|تشيز برجر|ساندوتش برجر/i, categoryMatch: /برجر/i },
    { keywords: /شاورما|شاورمة|فراخ مشوية|دجاج مشوي|كباب|كفتة|مشويات/i, categoryMatch: /شاورما|دجاج/i },
    { keywords: /بيتزا|بيبروني|مارجريتا|فطير|فطيرة/i, categoryMatch: /بيتزا/i },
    { keywords: /فول|فلافل|طعمية|بسطرمة/i, categoryMatch: /فول|فلافل/i },
    { keywords: /بطاطس|فرايز|سلطة|صوص|مايونيز|كاتشب|ثومية/i, categoryMatch: /بطاطس|مقبلات/i },

    // 3. الشاي والقهوة والمشروبات
    { keywords: /شاي|ليبتون|عروسة|أحمد تي|احمد تي|فتلة|أعشاب|ينسون|نعناع|كركديه/i, categoryMatch: /شاي/i },
    { keywords: /قهوة|نسكافيه|اسبريسو|إسبريسو|كابتشينو|لاتيه|موكا|عبد المعبود|(?:^|\s)بن(?:\s|$)/i, categoryMatch: /قهوة|إسبريسو|اسبريسو|نسكافيه|(?:^|\s)بن(?:\s|$)/i },
    { keywords: /مياه|مياة|ماء|معدنية|بركة|نستله|داساني|أكوافينا|سيوة/i, categoryMatch: /مياه|ماء/i },
    { keywords: /بيبسي|كولا|كوكاكولا|سفن|شويبس|سبرايت|فانتا|ميرندا|غازية|كانز/i, categoryMatch: /غازية/i },
    { keywords: /عصير|بيور|راني|برتقال|مانجو|تفاح|جوافة|فراولة/i, categoryMatch: /عصائر|عصير/i },

    // 4. منتجات الألبان والأجبان الطازجة
    { keywords: /قريش/i, categoryMatch: /قريش/i },
    { keywords: /فيتا|براميلي|إسطنبولي|اسطنبولي/i, categoryMatch: /فيتا|براميلي|أجبان|جبن/i },
    { keywords: /جبن|جبنة|موتزاريلا|موزاريلا|شيدر|رومي|كيري|لافاش كيري/i, categoryMatch: /أجبان|جبن/i },
    { keywords: /حليب|لبن|رايب|رائب/i, categoryMatch: /حليب|لبن/i },
    { keywords: /زبادي|دانيت|زبادو/i, categoryMatch: /زبادي/i },
    { keywords: /بيض|بيضة/i, categoryMatch: /بيض/i },

    // 5. المؤن والبقالة والزيوت والحبوب
    { keywords: /زيت|عافية|كريستال|سمن|سمنة|زبدة/i, categoryMatch: /زيوت|زيت/i },
    { keywords: /أرز|رز|مكرونة|معكرونة|شعرية|لسان عصفور|بقوليات|عدس/i, categoryMatch: /أرز|مكرونة/i },
    { keywords: /تونا|تونة|سردين|معلبات|صلصة|معجون طماطم/i, categoryMatch: /تونا|معلبات/i },
    { keywords: /بهار|بهارات|توابل|فلفل أسود|كمون|شطة|مرقة/i, categoryMatch: /بهارات|توابل/i },
    { keywords: /سكر|دقيق|بيكنج باودر|فانيليا/i, categoryMatch: /سكر|دقيق/i },

    // 6. أدوية وصيدلية
    { keywords: /بنادول|بروفين|سيتال|كتافلام|مسكن|صداع|حرارة|إيبوبروفين|باراسيتامول/i, categoryMatch: /مسكنات|حرارة/i },
    { keywords: /كونجستال|كومتركس|فلورست|برد|إنفلونزا|انفلونزا|رشح|سعال|كحة|جيوب أنفية/i, categoryMatch: /برد|إنفلونزا|سعال/i },
    { keywords: /ريني|جافيسكون|أنتودين|موتيليوم|حموضة|حرقان|معدة|قولون|ارتجاع/i, categoryMatch: /هضمي|معدة/i },
    { keywords: /فيتامين|فيتاسيد|زنكترون|أوميجا|سنتروم|حديد|كالسيوم|مكمل غذائي/i, categoryMatch: /فيتامينات/i },
    { keywords: /فيوسيدين|بانثينول|بيتاديرم|مرهم|كريم طبي|مرطب جلد|حروق/i, categoryMatch: /مراهم|كريمات/i },
    { keywords: /سيستان|توبرادكس|قطرة عيون|قطرة أذن/i, categoryMatch: /قطرات/i },

    // 7. المستلزمات الطبية والإسعافات
    { keywords: /بيتادين|كحول|مطهر|معقم|جروح|شاش|قطن طبي|بلاستر|رباط ضاغط|إسعافات/i, categoryMatch: /مطهرات|جروح/i },
    { keywords: /ضغط|سكر دم|أومرون|أكيوتشيك|ترمومتر|مقياس حرارة|شرائط سكر/i, categoryMatch: /أجهزة طبية/i },
    { keywords: /كمامة|كمامات|قفازات|لاتكس|سرنجة|سرنجات/i, categoryMatch: /مستهلكات|وقاية/i },

    // 8. المنظفات والعناية بالمنزل
    { keywords: /أريال|اريال|تايد|برسيل|داوني|مسحوق غسيل|جل غسيل|منعم أقمشة/i, categoryMatch: /غسيل|مساحيق/i },
    { keywords: /فيري|بريل|أطباق|صحون|سائل صحون|مواعين/i, categoryMatch: /صحون/i },
    { keywords: /ديتول|كلوركس|كلور|مستر ماسل|منظف أرضيات|ملمع زجاج|مطهر أسطح/i, categoryMatch: /أسطح|أرضيات/i },
    { keywords: /فاين|زينة|مناديل|بكرة مطبخ|ماكسي رول|مناديل مبللة/i, categoryMatch: /مناديل|ورقية/i },
    { keywords: /فريدال|معطر جو|ريد|ناموس|طارد ناموس|مبيد حشري/i, categoryMatch: /معطرات|مبيدات/i },
  ];

  // 1. البحث عن تطابق عبر القواعد الذكية
  for (const rule of rules) {
    if (rule.keywords.test(name)) {
      const matchCat = categories.find(c => {
        if (rule.categoryMatch instanceof RegExp) {
          return rule.categoryMatch.test(c.name_ar) || (c.name_en && rule.categoryMatch.test(c.name_en));
        }
        return c.name_ar.includes(rule.categoryMatch);
      });

      if (matchCat) {
        return buildCategoryHierarchy(matchCat, categories);
      }
    }
  }

  // 2. البحث المباشر عن اسم أي قسم ورد داخل اسم المنتج
  const directMatch = categories.find(c => {
    if (c.name_ar.length > 2 && name.includes(c.name_ar.toLowerCase())) return true;
    return false;
  });

  if (directMatch) {
    return buildCategoryHierarchy(directMatch, categories);
  }

  return null;
}

/**
 * تركيب التدرج الهرمي (L1 -> L2 -> L3) للصنف
 */
function buildCategoryHierarchy(cat: Category, allCategories: Category[]): DetectedCategoryResult {
  let l1Id: string | undefined;
  let l2Id: string | undefined;
  let l3Id: string | undefined;
  const pathParts: string[] = [];

  if (!cat.parent_id) {
    // المستوى الأول الرئيسي
    l1Id = cat.id;
    pathParts.push(cat.name_ar);
  } else {
    const parent = allCategories.find(c => c.id === cat.parent_id);
    if (!parent) {
      l1Id = cat.id;
      pathParts.push(cat.name_ar);
    } else if (!parent.parent_id) {
      // المستوى الثاني (Parent هو L1)
      l1Id = parent.id;
      l2Id = cat.id;
      pathParts.push(parent.name_ar, cat.name_ar);
    } else {
      // المستوى الثالث (Parent هو L2، وجد parent هو L1)
      const grandParent = allCategories.find(c => c.id === parent.parent_id);
      if (grandParent) {
        l1Id = grandParent.id;
        l2Id = parent.id;
        l3Id = cat.id;
        pathParts.push(grandParent.name_ar, parent.name_ar, cat.name_ar);
      } else {
        l1Id = parent.id;
        l2Id = cat.id;
        pathParts.push(parent.name_ar, cat.name_ar);
      }
    }
  }

  return {
    category: cat,
    l1Id,
    l2Id,
    l3Id,
    pathDisplay: pathParts.join(' ⬅ '),
  };
}

/**
 * 3. محرك الذكاء الاصطناعي الذكي لتوليد الوصف، الاسم الإنجليزي، الإضافات والأحجام
 */
export async function generateProductDetailsWithAI(
  nameAr: string,
  categories: Category[]
): Promise<AISuggestionResult> {
  const clean = nameAr.trim();

  // جرب استدعاء Gemini API عبر الخادم أولاً
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      const response = await fetch('/api/gemini/suggest-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ productNameAr: clean }),
      });
      if (response.ok) {
        const json = await response.json();
        if (json?.data) return json.data;
      }
    }
  } catch {
    // الانتقال للمحرك المعرفي الذكي
  }

  // ── Smart Commercial Heuristics Engine (Offline/Real-time fallback) ────────
  return synthesizeProductKnowledge(clean, categories);
}

function synthesizeProductKnowledge(name: string, _categories: Category[]): AISuggestionResult {
  const englishName = translateToEnglish(name);

  // 1. الفطور الشعبي والمأكولات المصرية (فول، طعمية، فلافل، بيض، كبدة، سجق، حواوشي، كشري)
  if (/فول|طعمية|فلافل|بيض|باذنجان|بتنجان|كبدة|سجق|حواوشي|كشري|مسقعة/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} المحضر على الطريقة المصرية الأصيلة بتتبيلة وخلطة مميزة وطازجة، يقدم في الخبز الطازج مع أشهى الإضافات.`,
      badge: 'فطور شرقي',
      suggestedPrice: /لحم|سجق|كبدة|حواوشي/i.test(name) ? 65 : 20,
      modifiers: [
        {
          id: 'bread-' + Date.now(),
          title: 'نوع الخبز',
          required: true,
          options: [
            { name: 'خبز بلدي طازج', price: 0 },
            { name: 'خبز شامي أبيض', price: 2 },
            { name: 'خبز فينو كيزر', price: 3 },
          ],
        },
        {
          id: 'extras-' + Date.now(),
          title: 'إضافات مفضلة',
          required: false,
          options: [
            { name: 'زيت حار إضافي', price: 3 },
            { name: 'طحينة زيادة', price: 4 },
            { name: 'بيض مسلوق زيادة', price: 8 },
            { name: 'طرشي ومخلل بلدي', price: 5 },
          ],
        },
      ],
    };
  }

  // 2. برجر ولحوم
  if (/برجر|burger|بيف/i.test(name)) {
    return {
      nameEn: englishName,
      description: `ساندوتش ${name} الفاخر المحضر من لحم بقري صافي 100% مشوي على اللهب، يقدم مع شرائح الجبنة الذائبة، الخس المقرمش، الطماطم وصوص سنجوب السري في خبز البريوش الطازج.`,
      badge: 'الأكثر طلباً',
      suggestedPrice: 125,
      modifiers: [
        {
          id: 'size-' + Date.now(),
          title: 'اختر الحجم ونوع الوجبة',
          required: true,
          options: [
            { name: 'ساندوتش فردي سينجل', price: 0 },
            { name: 'ساندوتش دبل شريحتين', price: 40 },
            { name: 'وجبة كومبو (بطاطس ومشروب غازي)', price: 35 },
          ],
        },
        {
          id: 'extras-' + Date.now(),
          title: 'إضافات وصوصات مميزة',
          required: false,
          options: [
            { name: 'شريحة جبنة شيدر إضافية', price: 12 },
            { name: 'بيكون بقري مدخن مقرمش', price: 20 },
            { name: 'صوص هالبينو حار', price: 8 },
            { name: 'صوص مشروم كريمي', price: 15 },
          ],
        },
      ],
    };
  }

  // 3. شاورما ودجاج ومشاوي وكريب
  if (/شاورما|فراخ|دجاج|تيكا|كريب|مشويات|كفتة|كباب/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} المتبل بأشهى البهارات والتتبيلة الخاصة، مشوي بعناية ومقدم مع صوص التومية الغني والخيار المخلل والبطاطس المقرمشة في خبز الصاج الطازج.`,
      badge: 'وجبة سريعة',
      suggestedPrice: 85,
      modifiers: [
        {
          id: 'size-' + Date.now(),
          title: 'اختر الحجم',
          required: true,
          options: [
            { name: 'حجم عادي (وسط)', price: 0 },
            { name: 'حجم كبير (صاروخ)', price: 25 },
          ],
        },
        {
          id: 'sauces-' + Date.now(),
          title: 'الصوصات والإضافات',
          required: false,
          options: [
            { name: 'تومية إضافية', price: 6 },
            { name: 'موتزاريلا ذائبة', price: 15 },
            { name: 'صوص باربكيو مدخن', price: 8 },
          ],
        },
      ],
    };
  }

  // 4. بيتزا ومعجنات
  if (/بيتزا|فطير|معجنات|فطيرة|بيبروني|مارجريتا/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} محضرة بعجينة هشة وخفيفة مع صلصة طماطم إيطالية غنية وجبنة موتزاريلا ذائبة مع أفضل المكونات الطازجة.`,
      badge: 'مميز',
      suggestedPrice: 110,
      modifiers: [
        {
          id: 'size-' + Date.now(),
          title: 'اختر مقاس البيتزا',
          required: true,
          options: [
            { name: 'وسط (Medium)', price: 0 },
            { name: 'كبير (Large)', price: 45 },
            { name: 'أطراف محشوة جبنة', price: 30 },
          ],
        },
      ],
    };
  }

  // 5. الألبان والأجبان
  if (/جبن|جبنة|ألبان|حليب|لبن|زبادي|قشطة|زبدة/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} عالي الجودة منتقى من أفضل المصانع والمزارع، غني بالكالسيوم والبروتين ومحفوظ في درجات تبريد مثالية لضمان الطعم الطازج.`,
      badge: 'طازج ومضمون',
      suggestedPrice: 45,
    };
  }

  // 6. المشروبات والمياه والشاي والقهوة
  if (/قهوة|كافيه|شاي|عصير|مياه|بيبسي|كولا|مشروب/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} المنعش والمحضر من أجود المكونات الطبيعية، يمنحك الطاقة والانتعاش طوال اليوم.`,
      badge: 'مشروب منعش',
      suggestedPrice: 25,
      modifiers: [
        {
          id: 'cup-' + Date.now(),
          title: 'حجم المشروب',
          required: true,
          options: [
            { name: 'حجم عادي (M)', price: 0 },
            { name: 'حجم كبير (L)', price: 10 },
          ],
        },
      ],
    };
  }

  // 7. أدوية وصيدلية
  if (/بنادول|بروفين|سيتال|كتافلام|كونجستال|كومتركس|ريني|جافيسكون|فيتامين|زنك|أوميجا|سنتروم|فيوسيدين|بانثينول|دواء|أقراص|كبسولات|شراب/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} صنف طبي مصرح من وزارة الصحة المصرية، محفوظ ومخزن وفق أعلى المعايير الدوائية لضمان الفاعلية والأمان. استشر الصيدلي أو الطبيب قبل الاستخدام.`,
      badge: 'صيدلية وعناية',
      suggestedPrice: /سنتروم|أوميجا/i.test(name) ? 150 : 45,
    };
  }

  // 8. مستلزمات طبية وأجهزة وإسعافات أولية
  if (/بيتادين|كحول|شاش|قطن|بلاستر|رباط ضاغط|جهاز|ضغط|سكر|ترمومتر|كمامة|قفازات|سرنجة/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} مستلزم طبي عالي الجودة ومعقم للاستخدام المنزلي والعيادات، حاصل على شهادات الجودة والأمان الطبي المعتمدة.`,
      badge: 'مستلزمات طبية',
      suggestedPrice: /جهاز|ضغط|سكر/i.test(name) ? 750 : 35,
    };
  }

  // 9. منظفات وعناية بالمنزل
  if (/أريال|تايد|برسيل|داوني|فيري|بريل|ديتول|كلوركس|مستر ماسل|فاين|زينة|معطر|مسحوق|مناديل|ريد/i.test(name)) {
    return {
      nameEn: englishName,
      description: `${name} تركيبة فعالة متطورة تمنحك أقصى درجات النظافة والتعقيم الفائق لمنزلك وأسرتك مع روائح منعشة تدوم طويلاً.`,
      badge: 'عناية بالمنزل',
      suggestedPrice: /أريال|تايد|برسيل/i.test(name) ? 245 : 55,
    };
  }

  // 10. صنف عام
  return {
    nameEn: englishName,
    description: `${name} عالي الجودة متوفر حصرياً عبر منصة سنجوب، تم اختياره بعناية ليلبي أعلى معايير الجودة ورضا العملاء.`,
    badge: 'صنف مميز',
    suggestedPrice: 50,
  };
}

export function translateToEnglish(arabic: string): string {
  if (!arabic || !arabic.trim()) return 'Fresh Item';
  const clean = arabic.trim().toLowerCase();

  // 1. هل الصنف سندوتش بأي هجاء (سندوتش، ساندوتش، سندونتش)
  const isSandwich = /سندوتش|ساندوتش|سندونتش|ساندوتشات|سندوتشات/i.test(clean);
  const coreDish = clean
    .replace(/سندوتش|ساندوتش|سندونتش|ساندوتشات|سندوتشات/gi, '')
    .trim();

  // 2. قواميس المصطلحات المركبة عالية الدقة
  const compounds: [RegExp, string][] = [
    [/فول\s+بالبيض/i, 'Foul with Egg'],
    [/فول\s+إسكندراني|فول\s+اسكندراني/i, 'Alexandrian Foul'],
    [/فول\s+بالطحينة/i, 'Foul with Tahini'],
    [/فول\s+بالزيت\s+الحار/i, 'Foul with Flaxseed Oil'],
    [/فول\s+بالسمنة/i, 'Foul with Ghee'],
    [/فول\s+سادة/i, 'Plain Foul'],
    [/فول/i, 'Foul'],
    [/طعمية\s+محشية|فلافل\s+محشية/i, 'Stuffed Falafel'],
    [/طعمية\s+بالسمسم|فلافل\s+بالسمسم/i, 'Sesame Falafel'],
    [/طعمية|فلافل/i, 'Falafel'],
    [/بيض\s+بالبسطرمة/i, 'Eggs with Pastrami'],
    [/بيض\s+مسلوق/i, 'Boiled Eggs'],
    [/بيض\s+أومليت|بيض\s+اومليت/i, 'Omelet Eggs'],
    [/بيض\s+مقلي/i, 'Fried Eggs'],
    [/بيض|بالبيض/i, 'Eggs'],
    [/كبدة\s+إسكندراني|كبدة\s+اسكندراني/i, 'Alexandrian Liver'],
    [/كبدة/i, 'Liver'],
    [/سجق\s+بلدي|سجق\s+شرقي/i, 'Oriental Sausage'],
    [/سجق/i, 'Sausage'],
    [/حواوشي\s+بلدي|حواوشي\s+مخصوص/i, 'Egyptian Hawawshi'],
    [/حواوشي/i, 'Hawawshi'],
    [/كشري\s+مصري|كشري/i, 'Egyptian Koshary'],
    [/كفتة\s+مشوية/i, 'Grilled Kofta'],
    [/كفتة/i, 'Kofta'],
    [/كباب\s+مشوي/i, 'Grilled Kebab'],
    [/شاورما\s+دجاج|شاورما\s+فراخ/i, 'Chicken Shawarma'],
    [/شاورما\s+لحم|شاورما\s+لحمة/i, 'Beef Shawarma'],
    [/شاورما/i, 'Shawarma'],
    [/دبل\s+تشيز\s+برجر/i, 'Double Cheeseburger'],
    [/تشيز\s+برجر/i, 'Cheeseburger'],
    [/برجر\s+لحم|بيف\s+برجر/i, 'Beef Burger'],
    [/برجر\s+دجاج|تشيكن\s+برجر/i, 'Chicken Burger'],
    [/برجر/i, 'Burger'],
    [/بيتزا\s+مارجريتا/i, 'Margherita Pizza'],
    [/بيتزا\s+بيبروني/i, 'Pepperoni Pizza'],
    [/بيتزا\s+خضار/i, 'Vegetable Pizza'],
    [/بيتزا/i, 'Pizza'],
    [/فطير\s+مشلتت/i, 'Feteer Meshaltet'],
    [/فطير/i, 'Feteer'],
    [/جبنة\s+براميلي|جبن\s+براميلي/i, 'Baramily Cheese'],
    [/جبنة\s+فيتا|جبن\s+فيتا/i, 'Feta Cheese'],
    [/جبنة\s+قريش|جبن\s+قريش/i, 'Cottage Cheese'],
    [/جبنة\s+رومي|جبن\s+رومي/i, 'Roumy Cheese'],
    [/جبنة\s+شيدر|جبن\s+شيدر/i, 'Cheddar Cheese'],
    [/جبنة\s+موتزاريلا|جبنة\s+موزاريلا/i, 'Mozzarella Cheese'],
    [/جبنة|جبن/i, 'Cheese'],
    [/بطاطس\s+محمرة|بطاطس\s+صوابع|فارم\s+فريتس/i, 'French Fries'],
    [/بطاطس\s+بالمايونيز/i, 'Fries with Mayo'],
    [/بطاطس/i, 'Potatoes'],
    [/شاي\s+أخضر|شاي\s+اخضر/i, 'Green Tea'],
    [/شاي\s+ليبتون/i, 'Lipton Tea'],
    [/شاي\s+العروسة/i, 'El Arosa Tea'],
    [/شاي/i, 'Black Tea'],
    [/قهوة\s+تركي|بن\s+تركي/i, 'Turkish Coffee'],
    [/قهوة\s+نسكافيه|نسكافيه\s+جولد/i, 'Nescafe Gold Coffee'],
    [/نسكافيه/i, 'Nescafe'],
    [/قهوة|بن/i, 'Coffee'],
    [/مياه\s+معدنية/i, 'Mineral Water'],
    [/مياه|ماء/i, 'Water'],
    [/عصير\s+برتقال/i, 'Orange Juice'],
    [/عصير\s+مانجو/i, 'Mango Juice'],
    [/عصير/i, 'Fresh Juice'],
    [/حليب\s+كامل\s+الدسم/i, 'Full Cream Milk'],
    [/حليب|لبن\s+طبيعي/i, 'Fresh Milk'],
    [/لبن\s+رايب/i, 'Rayeb Milk'],
    [/لبن/i, 'Milk'],
    [/زبادي/i, 'Yogurt'],
    [/أرز\s+مصري|رز\s+مصري/i, 'Egyptian Rice'],
    [/أرز|رز/i, 'Rice'],
    [/مكرونة\s+بشاميل/i, 'Bechamel Pasta'],
    [/مكرونة/i, 'Pasta'],
    [/زيت\s+ذرة/i, 'Corn Oil'],
    [/زيت\s+عباد/i, 'Sunflower Oil'],
    [/زيت\s+زيتون/i, 'Olive Oil'],
    [/زيت/i, 'Cooking Oil'],
    [/شيبسي/i, 'Chipsy Potato Chips'],
    [/شوكولاتة|شوكولاته/i, 'Chocolate'],
    [/تونة|تونا/i, 'Tuna'],

    // أدوية وصيدلية
    [/بنادول\s+أدفانس|بنادول\s+ادفانس|بنادول\s+أزرق|بنادول\s+ازرق/i, 'Panadol Advance 500mg'],
    [/بنادول\s+إكسترا|بنادول\s+اكسترا|بنادول\s+أحمر|بنادول\s+احمر/i, 'Panadol Extra'],
    [/بنادول\s+كولد/i, 'Panadol Cold & Flu'],
    [/بنادول/i, 'Panadol'],
    [/بروفين\s+400/i, 'Brufen 400mg'],
    [/بروفين\s+600/i, 'Brufen 600mg'],
    [/بروفين/i, 'Brufen'],
    [/سيتال/i, 'Cetal Paracetamol'],
    [/كتافلام/i, 'Cataflam'],
    [/كونجستال/i, 'Congestal Cold & Flu'],
    [/كومتركس/i, 'Comtrex Cold Relief'],
    [/ريني/i, 'Rennie Antacid'],
    [/جافيسكون/i, 'Gaviscon Liquid'],
    [/فيتامين\s+سي|فيتاسيد\s+سي/i, 'Vitacid C 1000mg Effervescent'],
    [/زنكترون/i, 'Zinctron Zinc & Multivitamins'],
    [/أوميجا\s+3|اوميجا\s+3/i, 'Omega 3 Plus Fish Oil'],
    [/سنتروم/i, 'Centrum with Lutein'],
    [/فيوسيدين/i, 'Fucidin Antibiotic Cream'],
    [/بانثينول/i, 'Panthenol Moisturizing Cream'],
    [/بيتاديرم/i, 'Betaderm Cream'],

    // مستلزمات طبية
    [/بيتادين\s+مطهر|بيتادين/i, 'Betadine Antiseptic Solution'],
    [/كحول\s+إيثيلي|كحول\s+طبي|كحول/i, 'Medical Ethyl Alcohol 70%'],
    [/قطن\s+طبي/i, 'Pure Sterile Medical Cotton'],
    [/شاش\s+طبي/i, 'Sterile Medical Gauze Swabs'],
    [/بلاستر\s+طبي|بلاستر\s+جروح|بلاستر/i, 'First Aid Adhesive Plasters'],
    [/رباط\s+ضاغط/i, 'Elastic Crepe Bandage'],
    [/جهاز\s+قياس\s+ضغط|جهاز\s+ضغط|أومرون|اومرون/i, 'Omron Digital Blood Pressure Monitor'],
    [/جهاز\s+قياس\s+سكر|جهاز\s+سكر|أكيوتشيك|اكيوتشيك/i, 'Accu-Chek Instant Blood Glucose Kit'],
    [/شرائط\s+سكر|شرائط\s+قياس/i, 'Blood Glucose Test Strips'],
    [/ترمومتر\s+طبي|ترمومتر\s+ديجيتال|ترمومتر|مقياس\s+حرارة/i, 'Digital Clinical Thermometer'],
    [/كمامات\s+طبية|كمامة\s+طبية|كمامات/i, '3-Ply Medical Face Masks'],
    [/قفازات\s+لاتكس|قفازات\s+طبية|جوانتي\s+طبي/i, 'Latex Examination Gloves'],
    [/سرنجات\s+طبية|سرنجة\s+طبية|سرنجات|سرنجة/i, 'Sterile Disposable Syringes'],

    // منظفات وعناية بالمنزل
    [/مسحوق\s+أريال|مسحوق\s+اريال|أريال|اريال/i, 'Ariel Automatic Laundry Detergent'],
    [/مسحوق\s+تايد|تايد/i, 'Tide Automatic Laundry Detergent'],
    [/برسيل\s+جل|برسيل/i, 'Persil Deep Clean Power Gel'],
    [/داوني/i, 'Downy Fabric Softener'],
    [/سائل\s+فيري|فيري/i, 'Fairy Plus Dishwashing Liquid'],
    [/بريل/i, 'Pril Dishwashing Liquid'],
    [/ديتول\s+مطهر|ديتول/i, 'Dettol Antiseptic Liquid'],
    [/كلوركس|كلور/i, 'Clorox Bleach Cleaner'],
    [/مستر\s+ماسل/i, 'Mr Muscle Glass Cleaner'],
    [/مناديل\s+فاين|فاين/i, 'Fine Classic Facial Tissues'],
    [/مناديل\s+مطبخ|ورق\s+مطبخ|زينة\s+ماكسي|ماكسي\s+رول/i, 'Zeina Kitchen Maxi Roll'],
    [/مناديل\s+مبللة/i, 'Antibacterial Wet Wipes'],
    [/معطر\s+جو|فريدال/i, 'Fridal Air Freshener'],
    [/ريد\s+ناموس|طارد\s+ناموس|ريد/i, 'Raid Electric Mosquito Killer'],
  ];

  for (const [regex, english] of compounds) {
    if (regex.test(coreDish || clean)) {
      if (isSandwich && !english.toLowerCase().includes('sandwich')) {
        return `${english} Sandwich`;
      }
      return english;
    }
  }

  // 3. ترجمة الكلمات الفردية إن لم تتطابق العبارات
  const words = clean.split(/\s+/);
  const dict: Record<string, string> = {
    'سندونتش': 'Sandwich',
    'سندوتش': 'Sandwich',
    'ساندوتش': 'Sandwich',
    'فول': 'Foul',
    'بيض': 'Eggs',
    'بالبيض': 'with Eggs',
    'طعمية': 'Falafel',
    'فلافل': 'Falafel',
    'بطاطس': 'Fries',
    'جبنة': 'Cheese',
    'جبن': 'Cheese',
    'شاي': 'Tea',
    'قهوة': 'Coffee',
    'لحم': 'Beef',
    'دجاج': 'Chicken',
    'فراخ': 'Chicken',
    'كبدة': 'Liver',
    'سجق': 'Sausage',
    'حواوشي': 'Hawawshi',
  };

  const translatedWords = words.map(w => dict[w] || '').filter(Boolean);
  if (translatedWords.length > 0) {
    return translatedWords.join(' ');
  }

  return clean;
}
