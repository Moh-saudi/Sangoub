import type {
  Coupon,
  JobApplication,
  MinistryName,
  Order,
  PartnerApplication,
  Product,
  Store,
} from '../types/index.ts';

/**
 * Authentic administrative list of Egyptian Ministries located in the
 * Government District (الحي الحكومي), New Administrative Capital.
 */
export const MINISTRIES_LIST: MinistryName[] = [
  'رئاسة مجلس الوزراء',
  'وزارة المالية',
  'وزارة الخارجية',
  'وزارة النقل',
  'وزارة الإسكان والمرافق',
  'وزارة الاتصالات وتكنولوجيا المعلومات',
  'وزارة الصحة والسكان',
  'وزارة التربية والتعليم',
  'وزارة التعليم العالي',
  'وزارة الكهرباء والطاقة المتجددة',
  'وزارة البترول والثروة المعدنية',
  'وزارة العدل',
  'وزارة التضامن الاجتماعي',
  'وزارة التموين والتجارة الداخلية',
  'وزارة التخطيط والتنمية الاقتصادية',
  'وزارة التجارة والصناعة',
  'وزارة التعاون الدولي',
  'وزارة الزراعة واستصلاح الأراضي',
  'وزارة الموارد المائية والري',
  'وزارة العمل والقوى العاملة',
  'وزارة السياحة والآثار',
  'وزارة الثقافة',
  'وزارة الأوقاف',
  'وزارة الشباب والرياضة',
  'وزارة البيئة',
  'وزارة الطيران المدني',
  'وزارة التنمية المحلية',
  'وزارة شؤون المجالس النيابية',
  'وزارة قطاع الأعمال العام',
  'وزارة الهجرة وشؤون المصريين بالخارج',
  'وزارة الإنتاج الحربي',
  'وزارة الداخلية',
  'الهيئة القومية للبريد بالحي الحكومي',
  'الجهاز المركزي للتنظيم والإدارة',
];

// 100% Pure Real Data: All mock/fake static stores, products, orders, coupons purged.
// All live data is fetched directly from Supabase database.
export const INITIAL_STORES: Store[] = [];
export const INITIAL_PRODUCTS: Product[] = [];
export const INITIAL_COUPONS: Coupon[] = [];
export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_PARTNER_APPLICATIONS: PartnerApplication[] = [];
export const INITIAL_JOB_APPLICATIONS: JobApplication[] = [];
