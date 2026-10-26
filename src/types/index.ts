export type MinistryName =
  | "رئاسة مجلس الوزراء"
  | "وزارة المالية"
  | "وزارة الخارجية"
  | "وزارة النقل"
  | "وزارة الإسكان والمرافق"
  | "وزارة الاتصالات وتكنولوجيا المعلومات"
  | "وزارة الصحة والسكان"
  | "وزارة التربية والتعليم"
  | "وزارة التعليم العالي"
  | "وزارة الكهرباء والطاقة المتجددة"
  | "وزارة البترول والثروة المعدنية"
  | "وزارة العدل"
  | "وزارة التضامن الاجتماعي"
  | "وزارة التموين والتجارة الداخلية"
  | "وزارة التخطيط والتنمية الاقتصادية"
  | "وزارة التجارة والصناعة"
  | "وزارة التعاون الدولي"
  | "وزارة الزراعة واستصلاح الأراضي"
  | "وزارة الموارد المائية والري"
  | "وزارة العمل والقوى العاملة"
  | "وزارة السياحة والآثار"
  | "وزارة الثقافة"
  | "وزارة الأوقاف"
  | "وزارة الشباب والرياضة"
  | "وزارة البيئة"
  | "وزارة الطيران المدني"
  | "وزارة التنمية المحلية"
  | "وزارة شؤون المجالس النيابية"
  | "وزارة قطاع الأعمال العام"
  | "وزارة الهجرة وشؤون المصريين بالخارج"
  | "وزارة الإنتاج الحربي"
  | "وزارة الداخلية"
  | "الهيئة القومية للبريد بالحي الحكومي"
  | "الجهاز المركزي للتنظيم والإدارة";

export type UserRole = "employee" | "restaurant" | "courier" | "admin";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Profile {
  coordinates?: Coordinates;
  id: string;
  fullName: string;
  phone: string;
  email: string;
  ministry?: MinistryName | string;
  floorNumber?: string; // e.g. "الدور الخامس" or "5"
  roomNumber?: string; // e.g. "مكتب 504"
  walletBalance: number;
  avatarUrl?: string;
  role: UserRole;
  isGuest?: boolean;
  authProvider?: "google" | "email" | "phone" | "guest";
  storeId?: string; // For restaurant role
  vehicleType?: string; // For courier role
  vehiclePlate?: string; // For courier role
}

export type StoreCategory =
  | "breakfast"
  | "sandwiches"
  | "supermarket"
  | "cafe"
  | "desserts";

export interface Store {
  id: string;
  name: string;
  nameEn: string;
  type: string; // e.g. 'مطعم فطور شعبي', 'سوبر ماركت', 'كافيه قهوة مختصة'
  category: StoreCategory;
  logo: string;
  banner: string;
  bannerUrl?: string;
  imageUrl?: string;
  logoUrl?: string;
  status: "open" | "busy" | "closed";
  rating: number;
  ratingCount: number;
  deliveryTime: string; // e.g. "15-20 دقيقة"
  minOrder: number;
  deliveryFee: number;
  locationInDistrict: string; // e.g. "فود كورت الحي الحكومي - مبنى C2"
}

export interface ProductOption {
  name: string;
  price: number;
}

export interface ProductOptionGroup {
  id: string;
  title: string;
  required?: boolean;
  options: ProductOption[];
}

export interface Product {
  archived?: boolean;
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category:
    | "فطور"
    | "سندوتشات"
    | "سوبر ماركت بالقطعة"
    | "مشروبات"
    | "وجبات خفيفة"
    | "حلويات";
  badge?: string; // e.g. "الأكثر طلباً", "عرض خاص"
  imageType:
    | "foul"
    | "falafel"
    | "water"
    | "chips"
    | "coffee"
    | "croissant"
    | "juice"
    | "cheddar"
    | "tea"
    | "hawawshi";
  imageUrl?: string;
  isPopular?: boolean;
  inStock: boolean;
  optionGroups?: ProductOptionGroup[];
}

export interface CartItem {
  id: string; // unique item cart uuid
  product: Product;
  quantity: number;
  selectedOptions: Record<string, string>; // groupTitle -> optionName
  extraPrice: number;
  notes?: string;
}

export type PaymentMethod = "instapay" | "geidea" | "cash";

export type OrderStatus =
  | "received"
  | "preparing"
  | "ready"
  | "with_courier"
  | "delivered"
  | "cancelled";

export interface CourierChecklist {
  receivedAndCheckedAtRestaurant: boolean; // استلم الأوردر وراجعه من المطعم
  paidRestaurant: boolean; // دفع / سوّى المبالغ مع المطعم
  settledRestaurantAmount?: number; // المبلغ المسدد للمطعم
  onTheWayToMinistry: boolean; // في طريقه لمبنى الوزارة والدور
  arrivedAtCustomerOffice: boolean; // وصل لمكتب الموظف
  collectedPayment: boolean; // استلم الأموال (كاش أو إثبات إنستا باي)
  collectedAmount?: number; // المبلغ الفعلي المستلم
  notes?: string; // ملاحظات المندوب عند الاستلام والتسليم
  completedAt?: string; // وقت إغلاق وتأكيد الطلب
}

export interface Order {
  fulfillmentVersion?: 2;
  pickedUpStoreIds?: string[];
  departedAt?: string;
  itemsSummary?: string;
  restaurantName?: string;
  kitchenStatus?: Record<string, "received" | "preparing" | "ready">;
  readyAt?: string;
  deliveredAt?: string;
  updatedAt?: string;
  legacySummary?: string;
  legacyRecord?: boolean;
  coordinates?: Coordinates;
  storeIds?: string[];
  id: string;
  orderNumber: string;
  profileId: string;
  profileName: string;
  phone: string;
  ministry: string;
  floorNumber: string;
  roomNumber: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  tip: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: "pending" | "paid" | "cash_on_delivery";
  paymentConfirmedAt?: string;
  paymentReference?: string;
  orderStatus: OrderStatus;
  courierId?: string;
  courierName?: string;
  courierPhone?: string;
  courierChecklist?: CourierChecklist;
  restaurantStatus?: "pending" | "preparing" | "ready_for_pickup";
  createdAt: string;
  estimatedDelivery: string;
  isScheduled?: boolean;
  scheduledDeliveryTime?: string;
  notes?: string;
}

export interface Coupon {
  code: string;
  discountType: "fixed" | "percent";
  value: number; // e.g. 100 for 100 EGP or 20 for 20%
  minOrder: number;
  description: string;
  title: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  orderId?: string;
  type: "order_update" | "courier_assigned" | "promo" | "system";
}

export type ApplicationStatus =
  | "pending"
  | "contacted"
  | "approved"
  | "rejected";

export interface PartnerApplication {
  id: string;
  businessName: string;
  partnerType:
    | "مطعم فود كورت"
    | "كافيه ومشروبات"
    | "سوبر ماركت وتموين"
    | "مخبوزات وحلويات"
    | "خدمات لوجستية";
  contactName: string;
  phone: string;
  email: string;
  locationInCapital: string;
  branchesCount: string;
  notes?: string;
  status: ApplicationStatus;
  createdAt: string;
}

export interface JobApplication {
  id: string;
  jobTitle: string;
  department: string;
  applicantName: string;
  phone: string;
  email: string;
  experienceYears: string;
  residenceArea: string;
  summary: string;
  status: ApplicationStatus;
  createdAt: string;
}
