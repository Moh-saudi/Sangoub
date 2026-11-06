// ==============================================================================
// 🐿️ SANGOUB (سنجوب) - هيكل أنواع المتاجر والأقسام (الإصدار 1.0)
// متوافق بالكامل مع وثيقة المواصفات: Sangoub_Store_Taxonomy_Developer_Spec.md
// ==============================================================================

export interface StoreTypeDefinition {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  image: string;
  sort_order: number;
  status: 'active' | 'inactive';
  icon?: string;
}

export interface StoreSubtypeDefinition {
  id?: string;
  type_code: string;
  code: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  status: 'active' | 'inactive';
}

export interface CategoryTemplateDefinition {
  id?: string;
  type_code: string;
  code: string;
  name_ar: string;
  name_en: string;
  image: string;
  sort_order: number;
  status: 'active' | 'inactive';
}

// 1. أنواع المتاجر المفعّلة عند الإطلاق (16 نوع) + المؤجلة (3 أنواع)
export const STORE_TYPES: StoreTypeDefinition[] = [
  {
    code: 'GROC',
    name_ar: 'السوبر ماركت والبقالة',
    name_en: 'Supermarkets & Groceries',
    image: '/categories/fruits_vegetables.jpg',
    sort_order: 1,
    status: 'active',
  },
  {
    code: 'PRODUCE',
    name_ar: 'الخضروات والفواكه',
    name_en: 'Fruits & Vegetables Stores',
    image: '/categories/fruits_vegetables.jpg',
    sort_order: 2,
    status: 'active',
  },
  {
    code: 'BAKERY',
    name_ar: 'المخابز والمخبوزات',
    name_en: 'Bakeries & Bread Shops',
    image: '/categories/bakery.jpg',
    sort_order: 3,
    status: 'active',
  },
  {
    code: 'BEVERAGE',
    name_ar: 'المشروبات والعصائر',
    name_en: 'Beverages & Juice Shops',
    image: '/categories/beverages.jpg',
    sort_order: 4,
    status: 'active',
  },
  {
    code: 'HOME',
    name_ar: 'مستلزمات المنزل',
    name_en: 'Home & Household Supplies',
    image: '/categories/home_essentials.jpg',
    sort_order: 5,
    status: 'active',
  },
  {
    code: 'CLEAN',
    name_ar: 'المنظفات ومستلزمات النظافة',
    name_en: 'Cleaning & Hygiene Supplies',
    image: '/categories/cleaning_laundry.jpg',
    sort_order: 6,
    status: 'active',
  },
  {
    code: 'PERSONAL',
    name_ar: 'العناية الشخصية',
    name_en: 'Personal Care',
    image: '/categories/personal_care.jpg',
    sort_order: 7,
    status: 'active',
  },
  {
    code: 'BABY',
    name_ar: 'مستلزمات الأطفال',
    name_en: 'Baby & Infant Supplies',
    image: '/categories/baby_care.jpg',
    sort_order: 8,
    status: 'active',
  },
  {
    code: 'PET',
    name_ar: 'مستلزمات الحيوانات الأليفة',
    name_en: 'Pet Supplies',
    image: '/categories/pet_care.jpg',
    sort_order: 9,
    status: 'active',
  },
  {
    code: 'FLOWER',
    name_ar: 'الورود والهدايا',
    name_en: 'Flowers & Gifts',
    image: '/categories/seasonal_products.jpg',
    sort_order: 10,
    status: 'active',
  },
  {
    code: 'BEAUTY',
    name_ar: 'التجميل والعطور',
    name_en: 'Beauty & Perfumes',
    image: '/categories/personal_care.jpg',
    sort_order: 11,
    status: 'active',
  },
  {
    code: 'ELECT',
    name_ar: 'الإلكترونيات والإكسسوارات',
    name_en: 'Electronics & Accessories',
    image: '/categories/automotive.jpg',
    sort_order: 12,
    status: 'active',
  },
  {
    code: 'STATIONERY',
    name_ar: 'المكتبات والأدوات المدرسية',
    name_en: 'Stationery & School Supplies',
    image: '/categories/stationery_school.jpg',
    sort_order: 13,
    status: 'active',
  },
  {
    code: 'AUTO',
    name_ar: 'مستلزمات السيارات',
    name_en: 'Automotive Supplies',
    image: '/categories/automotive.jpg',
    sort_order: 14,
    status: 'active',
  },
  {
    code: 'OUTDOOR',
    name_ar: 'مستلزمات الرحلات والخروج',
    name_en: 'Outdoor & Picnic Supplies',
    image: '/categories/picnic_outdoor.jpg',
    sort_order: 15,
    status: 'active',
  },
  {
    code: 'SEASONAL',
    name_ar: 'مستلزمات المواسم والمناسبات',
    name_en: 'Seasonal & Occasion Supplies',
    image: '/categories/seasonal_products.jpg',
    sort_order: 16,
    status: 'active',
  },
  // الأنواع المؤجلة
  {
    code: 'REST',
    name_ar: 'المطاعم',
    name_en: 'Restaurants',
    image: '',
    sort_order: 90,
    status: 'inactive',
  },
  {
    code: 'CAFE',
    name_ar: 'الكافيهات',
    name_en: 'Cafés',
    image: '',
    sort_order: 91,
    status: 'inactive',
  },
  {
    code: 'PHARM',
    name_ar: 'الصيدليات',
    name_en: 'Pharmacies',
    image: '',
    sort_order: 92,
    status: 'inactive',
  },
];

// 2. التخصصات الفرعية الـ 34
export const STORE_SUBTYPES: StoreSubtypeDefinition[] = [
  // GROC
  { type_code: 'GROC', code: 'GROC-HYPER', name_ar: 'هايبر ماركت', name_en: 'Hypermarket', sort_order: 1, status: 'active' },
  { type_code: 'GROC', code: 'GROC-SUPER', name_ar: 'سوبر ماركت', name_en: 'Supermarket', sort_order: 2, status: 'active' },
  { type_code: 'GROC', code: 'GROC-MINI', name_ar: 'ميني ماركت', name_en: 'Mini Market', sort_order: 3, status: 'active' },
  { type_code: 'GROC', code: 'GROC-GROCERY', name_ar: 'بقالة', name_en: 'Grocery Store', sort_order: 4, status: 'active' },
  // PRODUCE
  { type_code: 'PRODUCE', code: 'PRODUCE-FRUIT', name_ar: 'محل فواكه', name_en: 'Fruit Shop', sort_order: 1, status: 'active' },
  { type_code: 'PRODUCE', code: 'PRODUCE-VEG', name_ar: 'محل خضروات', name_en: 'Vegetable Shop', sort_order: 2, status: 'active' },
  { type_code: 'PRODUCE', code: 'PRODUCE-BOTH', name_ar: 'خضروات وفواكه', name_en: 'Fruit & Vegetable Shop', sort_order: 3, status: 'active' },
  // BAKERY
  { type_code: 'BAKERY', code: 'BAKERY-BREAD', name_ar: 'مخبز', name_en: 'Bread Bakery', sort_order: 1, status: 'active' },
  { type_code: 'BAKERY', code: 'BAKERY-PASTRY', name_ar: 'مخبوزات ومعجنات', name_en: 'Pastry Shop', sort_order: 2, status: 'active' },
  // BEVERAGE
  { type_code: 'BEVERAGE', code: 'BEV-JUICE', name_ar: 'عصائر', name_en: 'Juice Shop', sort_order: 1, status: 'active' },
  { type_code: 'BEVERAGE', code: 'BEV-DRINKS', name_ar: 'مشروبات', name_en: 'Drinks Shop', sort_order: 2, status: 'active' },
  // HOME
  { type_code: 'HOME', code: 'HOME-KITCHEN', name_ar: 'أدوات ومستلزمات المطبخ', name_en: 'Kitchen Supplies', sort_order: 1, status: 'active' },
  { type_code: 'HOME', code: 'HOME-TOOLS', name_ar: 'أدوات منزلية', name_en: 'Household Tools', sort_order: 2, status: 'active' },
  { type_code: 'HOME', code: 'HOME-DECOR', name_ar: 'ديكور ومفروشات', name_en: 'Home Décor', sort_order: 3, status: 'active' },
  // CLEAN
  { type_code: 'CLEAN', code: 'CLEAN-HOME', name_ar: 'منظفات منزلية', name_en: 'Household Cleaning', sort_order: 1, status: 'active' },
  { type_code: 'CLEAN', code: 'CLEAN-LAUNDRY', name_ar: 'منظفات وغسيل', name_en: 'Laundry Supplies', sort_order: 2, status: 'active' },
  { type_code: 'CLEAN', code: 'CLEAN-PAPER', name_ar: 'ورقيات ومنتجات النظافة', name_en: 'Paper & Hygiene Products', sort_order: 3, status: 'active' },
  // PERSONAL
  { type_code: 'PERSONAL', code: 'PERSONAL-CARE', name_ar: 'عناية شخصية', name_en: 'Personal Care', sort_order: 1, status: 'active' },
  // BABY
  { type_code: 'BABY', code: 'BABY-CARE', name_ar: 'مستلزمات أطفال', name_en: 'Baby Supplies', sort_order: 1, status: 'active' },
  // PET
  { type_code: 'PET', code: 'PET-FOOD', name_ar: 'أغذية الحيوانات', name_en: 'Pet Food', sort_order: 1, status: 'active' },
  { type_code: 'PET', code: 'PET-SUPPLIES', name_ar: 'مستلزمات الحيوانات', name_en: 'Pet Accessories & Supplies', sort_order: 2, status: 'active' },
  // FLOWER
  { type_code: 'FLOWER', code: 'FLOWER-ROSES', name_ar: 'محلات ورد', name_en: 'Florists', sort_order: 1, status: 'active' },
  { type_code: 'FLOWER', code: 'FLOWER-GIFTS', name_ar: 'هدايا', name_en: 'Gift Shops', sort_order: 2, status: 'active' },
  // BEAUTY
  { type_code: 'BEAUTY', code: 'BEAUTY-COS', name_ar: 'مستحضرات تجميل', name_en: 'Cosmetics', sort_order: 1, status: 'active' },
  { type_code: 'BEAUTY', code: 'BEAUTY-PERFUME', name_ar: 'عطور', name_en: 'Perfumes', sort_order: 2, status: 'active' },
  // ELECT
  { type_code: 'ELECT', code: 'ELECT-PHONES', name_ar: 'هواتف وإكسسوارات', name_en: 'Phones & Accessories', sort_order: 1, status: 'active' },
  { type_code: 'ELECT', code: 'ELECT-ACCESS', name_ar: 'إكسسوارات إلكترونية', name_en: 'Electronic Accessories', sort_order: 2, status: 'active' },
  // STATIONERY
  { type_code: 'STATIONERY', code: 'STAT-SCHOOL', name_ar: 'أدوات مدرسية', name_en: 'School Supplies', sort_order: 1, status: 'active' },
  { type_code: 'STATIONERY', code: 'STAT-OFFICE', name_ar: 'أدوات مكتبية', name_en: 'Office Supplies', sort_order: 2, status: 'active' },
  // AUTO
  { type_code: 'AUTO', code: 'AUTO-ACCESS', name_ar: 'إكسسوارات سيارات', name_en: 'Car Accessories', sort_order: 1, status: 'active' },
  { type_code: 'AUTO', code: 'AUTO-CARE', name_ar: 'عناية بالسيارات', name_en: 'Car Care', sort_order: 2, status: 'active' },
  // OUTDOOR
  { type_code: 'OUTDOOR', code: 'OUT-PICNIC', name_ar: 'مستلزمات رحلات ونزهات', name_en: 'Picnic Supplies', sort_order: 1, status: 'active' },
  // SEASONAL
  { type_code: 'SEASONAL', code: 'SEASON-EVENTS', name_ar: 'مستلزمات مناسبات', name_en: 'Occasion Supplies', sort_order: 1, status: 'active' },
  { type_code: 'SEASONAL', code: 'SEASON-RAMADAN', name_ar: 'مستلزمات رمضان والمواسم', name_en: 'Ramadan & Seasonal Supplies', sort_order: 2, status: 'active' },
];

// 3. قوالب أقسام المنتجات الـ 24 للسوبرماركت (GROC)
// الفطار قسم مستقل تماماً ولا يتم دمجه مع البقالة أو المعلبات.
export const SUPERMARKET_CATEGORY_TEMPLATES: CategoryTemplateDefinition[] = [
  {
    type_code: 'GROC',
    code: 'CAT-PRODUCE',
    name_ar: 'الخضروات والفواكه',
    name_en: 'Fruits & Vegetables',
    image: '/categories/fruits_vegetables.jpg',
    sort_order: 1,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-BAKERY',
    name_ar: 'المخبوزات والخبز',
    name_en: 'Bakery & Bread',
    image: '/categories/bakery.jpg',
    sort_order: 2,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-MEAT',
    name_ar: 'اللحوم والدواجن',
    name_en: 'Meat & Poultry',
    image: '/categories/meat_poultry.jpg',
    sort_order: 3,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-DAIRY',
    name_ar: 'الألبان والبيض',
    name_en: 'Dairy & Eggs',
    image: '/categories/dairy_eggs.jpg',
    sort_order: 4,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-DELI',
    name_ar: 'الجبن واللانشون',
    name_en: 'Cheese & Deli',
    image: '/categories/cheese_deli.jpg',
    sort_order: 5,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-PANTRY',
    name_ar: 'البقالة والمواد الغذائية',
    name_en: 'Pantry & Groceries',
    image: '/categories/pantry_canned.jpg',
    sort_order: 6,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-BREAKFAST',
    name_ar: 'الفطار',
    name_en: 'Breakfast',
    image: '/categories/breakfast.jpg',
    sort_order: 7,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-COOKING',
    name_ar: 'الطبخ والخبز',
    name_en: 'Cooking & Baking',
    image: '/categories/cooking_baking.jpg',
    sort_order: 8,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-FROZEN',
    name_ar: 'الأطعمة المجمدة',
    name_en: 'Frozen Food',
    image: '/categories/frozen_food.jpg',
    sort_order: 9,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-DIET',
    name_ar: 'أغذية الحمية',
    name_en: 'Special Diet',
    image: '/categories/special_diet.jpg',
    sort_order: 10,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-BEVERAGES',
    name_ar: 'المشروبات',
    name_en: 'Beverages',
    image: '/categories/beverages.jpg',
    sort_order: 11,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-COFFEE-TEA',
    name_ar: 'القهوة والشاي',
    name_en: 'Coffee & Tea',
    image: '/categories/coffee_tea.jpg',
    sort_order: 12,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-SNACKS',
    name_ar: 'التسالي والشوكولاتة',
    name_en: 'Snacks & Chocolate',
    image: '/categories/snacks_chocolate.jpg',
    sort_order: 13,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-ICECREAM',
    name_ar: 'الآيس كريم',
    name_en: 'Ice Cream',
    image: '/categories/ice_cream.jpg',
    sort_order: 14,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-CLEANING',
    name_ar: 'المنظفات والغسيل',
    name_en: 'Cleaning & Laundry',
    image: '/categories/cleaning_laundry.jpg',
    sort_order: 15,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-HOME',
    name_ar: 'مستلزمات المنزل',
    name_en: 'Home & Household',
    image: '/categories/home_essentials.jpg',
    sort_order: 16,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-PERSONAL',
    name_ar: 'العناية الشخصية',
    name_en: 'Personal Care',
    image: '/categories/personal_care.jpg',
    sort_order: 17,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-BABY',
    name_ar: 'مستلزمات الأطفال',
    name_en: 'Baby Care',
    image: '/categories/baby_care.jpg',
    sort_order: 18,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-PET',
    name_ar: 'مستلزمات الحيوانات الأليفة',
    name_en: 'Pet Care',
    image: '/categories/pet_care.jpg',
    sort_order: 19,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-DISPOSABLES',
    name_ar: 'المستلزمات ذات الاستخدام الواحد',
    name_en: 'Disposables',
    image: '/categories/disposables.jpg',
    sort_order: 20,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-STATIONERY',
    name_ar: 'مستلزمات المكتب والمدرسة',
    name_en: 'Stationery & School',
    image: '/categories/stationery_school.jpg',
    sort_order: 21,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-AUTO',
    name_ar: 'مستلزمات السيارات',
    name_en: 'Automotive Supplies',
    image: '/categories/automotive.jpg',
    sort_order: 22,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-OUTDOOR',
    name_ar: 'مستلزمات الرحلات',
    name_en: 'Picnic & Outdoor',
    image: '/categories/picnic_outdoor.jpg',
    sort_order: 23,
    status: 'active',
  },
  {
    type_code: 'GROC',
    code: 'CAT-SEASONAL',
    name_ar: 'مستلزمات المواسم والمناسبات',
    name_en: 'Seasonal Products',
    image: '/categories/seasonal_products.jpg',
    sort_order: 24,
    status: 'active',
  },
];

// Helper to get active store types for customer view
export function getActiveStoreTypes(): StoreTypeDefinition[] {
  return STORE_TYPES.filter((t) => t.status === 'active');
}

// Helper to get supermarket categories in 4-column display
export function getSupermarketCategories(): CategoryTemplateDefinition[] {
  return SUPERMARKET_CATEGORY_TEMPLATES.filter((c) => c.status === 'active');
}

