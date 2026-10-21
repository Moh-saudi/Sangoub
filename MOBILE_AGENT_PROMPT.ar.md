# برومبت تنفيذ ربط Flutter بلوحة إدارة Capital Talabat

أنت مسؤول تطبيق Flutter داخل `mobile_app/` في مستودع `Moh-saudi/capital-talabat`. نفّذ الربط الفعلي مع لوحة الإدارة، ولا تكتفِ بتحسين الشكل أو كتابة دوال Firestore غير موصولة بالـproviders.

## حدود النظام المتفق عليها

- الويب في `src/` مخصص **للإدارة فقط**. الصفحة `/` و`/admin` تفتحان بوابة المدير، ثم مركز العمليات والكتالوج والطلبات والفريق والخصومات والمطبخ للمراقبة والإدارة. لا يوجد محاكي موبايل أو اختيار دور على الويب.
- Flutter يخدم **الموظف، الشيف، المندوب فقط**. الشيف يطابق الدور البرمجي `restaurant`، والمندوب `courier`، والموظف `employee`. لا تبنِ أو تفتح شاشة إدارة في Flutter. إذا كان الحساب مديرًا فأخبره باستخدام بوابة الإدارة على الويب.
- ابدأ من آخر `origin/main` واقرأ `SHARED_INTEGRATION_SPEC.md` و`docs/WEB_MOBILE_INTEGRATION.ar.md` و`docs/ADMIN_DASHBOARD.ar.md`، ثم الكود الفعلي في `src/types/index.ts` و`src/lib/firebase.ts` و`src/utils/orderIntegration.ts` و`api/orders.ts` و`api/order-delivery.ts` و`server/orderBuilder.ts` و`firestore.rules`. عند اختلاف نص قديم مع التنفيذ الآمن، لا تُعدّل القواعد لتجاوز الخطأ؛ وضّح الاختلاف واستعمل المسارات الحقيقية الموثقة أدناه.
- حافظ على عمل الويب وملفاته. لا تستبدل قواعد الأمان أو مسارات API أو متغيرات Vercel أثناء تعديل Flutter، ولا تنفّذ force-push على عمل زميلك.

## Firebase المشترك

- Project ID: `capital-talabat`؛ قاعدة Firestore: `(default)`.
- Project Number: `462331103510`.
- Auth Domain: `capital-talabat.firebaseapp.com`.
- Web App ID: `1:462331103510:web:b48e42c27667fcdee9e837`.
- Android App ID: `1:462331103510:android:bbcec7992b9a9b08e9e837`.
- Android package: `eg.gov.capital.capital_talabat_app`.
- عنوان API الإنتاجي: `https://capital-talabat.vercel.app`، واجعله قابلًا للضبط بـ`--dart-define=API_BASE_URL=...`. لا تثبّت رابط Preview داخل التطبيق. تحقّق من نشر وظائف API قبل الاختبار الحي؛ وجود موقع HTML لا يثبت تشغيل الخادم.
- راجع تسجيل iOS وبصمات Android وإعداد Google الفعلي؛ لا تستخدم Android App ID كأنه تسجيل iOS معتمد.

## المصادقة والصلاحيات

استخدم Firebase Auth الحقيقي: Google والبريد/كلمة المرور، والهاتف فقط إذا كان مفعّلًا ومهيأً. لا تمنح الصلاحية بناء على نص البريد أو الهاتف، ولا تعتمد على SharedPreferences أو اختيار المستخدم للدور. أزل `loginAsRole` وأي تسجيل دخول تجريبي، ولا تقبل كلمة مرور شكلية أو هوية `USR_...` أو العميل الثابت `employee_capital`.

الجلسة من FirebaseAuth، وكل معرف مستخدم هو `currentUser.uid`:

- `users/{uid}`: `uid`, `fullName`, `email`, `phone`, `ministry`, `floorNumber`, `roomNumber`, `role`, `walletBalance`, `createdAt`, `updatedAt`، واختياريًا `avatarUrl`, `coordinates`.
- عند أول تسجيل حساب موثّق أنشئ ملف الموظف بـ`role: employee` و`walletBalance: 0` ووقتَي `serverTimestamp()`. لا تولّد أسماء أو هواتف أو مكاتب أو رصيدًا ترحيبيًا افتراضيًا. يمكن إكمال بيانات العنوان الحقيقية قبل الطلب.
- تحقق البريد أو الهاتف مطلوب. لا تمسح الهوية الحقيقية أو تستبدلها بحساب محلي عند فشل الاتصال.
- الدور الفعلي يأتي من `admins/{uid}` أولًا، ثم `staff/{uid}`: `{ role: 'restaurant' | 'courier', name, phone, storeId?, updatedAt }`. الشيف يحتاج `storeId` حقيقيًا. المستخدم يقرأ وثيقة تكليفه فقط، ولا يكتب صلاحياته.
- وجود وثيقة `admins/{uid}` هو صلاحية الإدارة، وحذفها يلغيها؛ لا تعتمد على `enabled: false` أو على `users.role` لمنح/إلغاء الإدارة. المدير يُحوّل إلى رسالة استخدام الويب، لا إلى لوحة إدارة موبايل.
- استمع لتغير الهوية والتكليف، وألغِ الاشتراكات وامسح البيانات الخاصة عند الخروج أو تبديل الحساب أو سحب الصلاحية.

## الكتالوج الحقيقي الذي تنشئه الإدارة

المجموعتان المعتمدتان هما **`stores` و`products`**. لا تستخدم مجموعة بديلة باسم `restaurants`، ولا قوائم `capitalRestaurants` و`capitalProducts` الثابتة كمصدر تشغيل.

`stores/{storeId}`:

```ts
id: string;
name: string;
nameEn: string;
type: string;
category: 'breakfast' | 'sandwiches' | 'supermarket' | 'cafe' | 'desserts';
status: 'open' | 'closed' | 'busy';
minOrder: number;
deliveryFee: number;
locationInDistrict: string;
deliveryTime: string;
imageUrl?: string; // صورة الغلاف، ويوجد bannerUrl للتوافق
bannerUrl?: string;
logoUrl?: string;
rating: number;
ratingCount: number;
updatedAt: Timestamp;
```

`products/{productId}`:

```ts
id: string;
storeId: string;
storeName: string;
name: string;
description: string;
price: number;
originalPrice?: number;
category: 'فطور' | 'سندوتشات' | 'سوبر ماركت بالقطعة' | 'مشروبات' | 'وجبات خفيفة' | 'حلويات';
imageUrl?: string;
inStock: boolean;
archived?: boolean;
isPopular?: boolean;
badge?: string;
optionGroups?: Array<{ id: string; title: string; required?: boolean; options: Array<{ name: string; price: number }> }>;
updatedAt: Timestamp;
```

استمع بـ`snapshots()` واعرض التعديلات لحظيًا. `archived == true` يخفي المنتج ويمنع طلبه، والقيمة المفقودة تعني غير مؤرشف للتوافق. لا تعتمد على `where(archived == false)` وحده لأنه يستبعد السجلات القديمة التي لا تحمل الحقل. `inStock` توافر يدوي وليس عدد قطع مخزون. المتجر غير المفتوح لا يستقبل طلبًا ولو ظهر المنتج متاحًا. الصور يعرضها الموبايل من `imageUrl` و`logoUrl` الفعليين؛ الإدارة تضيف المنتجات وترفع صورها من الويب.

R2 Bucket: `capitaltalabat`، Account ID: `14521cdfec73fa908fbf7e760fae362a`. لا تستنتج رابط `r2.dev` من Account ID، ولا تضع Access Key أو Secret Key أو حساب خدمة Firebase داخل Flutter. لا تضع فواتير أو مستندات خاصة في حاوية الصور العامة. لا نحتاج رفع صور المنتجات من Flutter لهذا الربط.

## إنشاء الطلب عبر الخادم

كل API يستخدم `Authorization: Bearer <Firebase ID token>` و`Content-Type: application/json`. هذا ID token من FirebaseAuth وليس Google OAuth access token.

`POST /api/orders`، مثال بنيوي وليست بيانات تشغيل:

```json
{
  "id": "ord-<UUID v4 ثابت للمحاولة وإعادة إرسالها>",
  "profileName": "اسم العميل الحقيقي",
  "phone": "الهاتف المصري الحقيقي",
  "ministry": "الوزارة المختارة فعليًا",
  "floorNumber": "الدور الفعلي",
  "roomNumber": "المكتب الفعلي",
  "paymentMethod": "cash",
  "tip": 0,
  "items": [
    {
      "product": { "id": "معرف منتج موجود في Firestore" },
      "quantity": 2,
      "selectedOptions": { "عنوان مجموعة الخيارات": "اسم الخيار المختار" },
      "notes": "ملاحظة العميل الاختيارية"
    }
  ]
}
```

يمكن إرسال `couponCode` و`coordinates: { latitude, longitude }` و`notes` اختياريًا. لا ترسل خيارًا غير موجود في `optionGroups`. مفاتيح `selectedOptions` هي **عناوين المجموعات**، والقيم أسماء الخيارات كما خزنت في الكتالوج؛ إذا لم توجد خيارات استخدم `{}`.

الخادم يقرأ أسعار المنتجات والخيارات ورسوم كل متجر والحد الأدنى والخصومات من القاعدة، ويحسب المجموع. لا تستخدم إجمالي الهاتف كقيمة معتمدة، ولا تكتب `/orders` مباشرة من Flutter. تكرار UUID نفسه لا يكرر الطلب. احتفظ به عند إعادة المحاولة، وامسح السلة واعرض النجاح فقط بعد استجابة 200.

الاستجابة `{ order: ... }` تحمل `order.id` الحقيقي لوثيقة الطلب. استخدم `doc.id` أو `order.id` للتحديث والتتبع، ولا تستبدله بـ`orderNumber` الظاهر للمستخدم. الدفع النقدي فقط مفعّل حاليًا؛ لا تعرض نجاح دفع بطاقة أو محفظة أو InstaPay غير موصول ببوابة حقيقية.

## مستند الطلب والاستماع حسب الدور

`orders/{orderId}` يتضمن:

```ts
id: string;
orderNumber: string;
profileId: string; // UID الحقيقي من الخادم
profileName: string;
phone: string;
ministry: string;
floorNumber: string;
roomNumber: string;
storeIds: string[];
restaurantName: string;
itemsSummary: string;
items: Array<{
  id: string;
  product: { id: string; storeId: string; storeName: string; name: string; price: number; /* لقطة الصنف وقت الطلب */ };
  quantity: number;
  extraPrice: number;
  selectedOptions: Record<string, string>;
  notes?: string;
}>;
kitchenStatus: Record<string, 'received' | 'preparing' | 'ready'>;
subtotal: number;
deliveryFee: number;
discount: number;
tip: number;
total: number;
paymentMethod: 'cash';
paymentStatus: 'cash_on_delivery' | 'pending' | 'paid';
orderStatus: 'received' | 'preparing' | 'ready' | 'with_courier' | 'delivered' | 'cancelled';
courierId?: string;
courierName?: string;
courierPhone?: string;
coordinates?: { latitude: number; longitude: number };
createdAt: Timestamp;
updatedAt: Timestamp;
readyAt?: Timestamp;
deliveredAt?: Timestamp;
```

حوّل Firestore Timestamp إلى DateTime، وتقبّل ISO string في استجابة HTTP. لا تولّد وقتًا أو رمزًا أو أصنافًا مفقودة بديلًا. السجلات القديمة ذات الملخص فقط تعرض كملخص غير مكتمل، ولا تتحول إلى أصناف وهمية أو سعر جديد.

الاستعلامات المسموحة:

- الموظف: `orders.where('profileId', isEqualTo: currentUser.uid)`.
- الشيف: `orders.where('storeIds', arrayContains: assignedStoreId)`.
- المندوب: `orders.where('courierId', isEqualTo: currentUser.uid)`.

لا تشترك في كل طلبات النظام ثم تخفِ غير المسموح بها داخل الواجهة. لا توجد قراءة عامة للطلبات الجاهزة لجميع المناديب. المدير يعيّن مندوبًا حقيقيًا من الويب ويحوّل `ready` إلى `with_courier`؛ لا تخترع مسار API لاستلام طلب أو تمنح المندوب نفسه تكليفًا عبر تحديث مفتوح.

## شاشة الشيف

اعرض received/preparing/ready لأصناف المتجر المكلّف به فقط. نقل المرحلة يتم بمعاملة Firestore تقرأ أحدث سجل وتغيّر `kitchenStatus[storeId]` فقط من received إلى preparing ثم ready. الحالة العامة تبقى preparing حتى تصبح **كل** `storeIds` جاهزة؛ حينها تصبح ready وتكتب `readyAt: serverTimestamp()`. اكتب `updatedAt: serverTimestamp()` في كل تحديث. راجع `nextKitchenUpdate` و`updateKitchenStage` في الويب كمرجع مطابق للقواعد. لا تستخدم `restaurantStatus: ready_for_pickup` بدل دورة الحالات الجديدة.

## شاشة المندوب وGPS والتسليم

اعرض تكليفات UID الحقيقي فقط. موقع المندوب في `tracking/{orderId}`:

```ts
coordinates: { latitude: number; longitude: number };
active: boolean;
updatedAt: serverTimestamp();
```

الكتابة للمندوب المسجل والمكلّف بطلب في الطريق فقط. اطلب إذن الموقع وبيّن وقت آخر تحديث، وأوقف المشاركة عند انتهاء الطلب/الخروج. لا تدّعِ تتبع الخلفية أو إرسال FCM ما لم تنفذه وتختبره على الجهاز. بيانات الوزارة والدور والمكتب مطلوبة؛ GPS لا يستنتج المكتب.

لا تقرأ رمز التسليم من مستند الطلب، ولا تقارن رمزًا محليًا داخل provider، ولا تستخدم 1234 بديلًا. `orderSecrets` مجموعة خادمية ممنوعة على كل عملاء Firestore.

- الموظف فقط: `POST /api/order-delivery` مع `{ "action": "code", "orderId": "doc-id" }`، والاستجابة `{ "otpCode": "4 digits" }`. أظهره لصاحب الطلب عند طلبه، واطلب منه مشاركته عند الاستلام فقط.
- المندوب المكلّف: المسار نفسه مع `{ "action": "deliver", "orderId": "doc-id", "otpCode": "رمز العميل", "collectedAmount": 123 }`، حيث المبلغ الحقيقي يساوي إجمالي الطلب النقدي. طبّع الأرقام إلى ASCII قبل الإرسال.
- الخادم يتحقق من الدور والتكليف والحالة والمبلغ والرمز، ويسجل delivered وdeliveredAt وpaid بمعاملة. خمس محاولات خاطئة توقف المحاولات 15 دقيقة. لا تحدّث delivered مباشرة من العميل؛ القواعد ترفض ذلك.

## شروط الإنجاز

1. أزل قوائم المطاعم والوجبات والطلبات والحسابات التجريبية من مسار التشغيل، وأزل الرصيد والخصومات والعناوين الافتراضية.
2. اربط providers بمصادقة Firebase واشتراكات Firestore الحقيقية، مع حالات التحميل والفراغ والخطأ وفقد الاتصال. لا تبتلع الأخطاء وتظهر نجاحًا محليًا.
3. اختبر على محاكيات Firebase أولًا. أضف حسابًا عاديًا وشيفًا ومندوبًا ومطعمًا آخر للتأكد من العزل. تغيير SharedPreferences أو حقل role لا يمنح صلاحية.
4. اختبار القبول: الإدارة تضيف متجرًا ومنتجًا فعليًا → يظهران في Flutter → الموظف يطلب → الشيف الصحيح يرى الطلب ويجهزه → ready → الإدارة تكلّف المندوب → تظهر بياناته وموقعه عند المشاركة → العميل يقرأ الرمز → المندوب يؤكد الرمز والتحصيل → يظهر delivered في الويب والموبايل. اختبر الطلب متعدد المطابخ والأرشفة وفشل الحفظ وإعادة الإرسال دون تكرار.
5. شغّل `flutter analyze` و`flutter test`، ووثّق نتائج الربط ومسار الطلب وإعدادات الأجهزة التي اختُبرت. لا تعتبر سلامة التحليل البرمجي وحدها دليلًا على تشغيل Firebase أو Google أو R2 أو التزامن.
6. ارفع تعديلات Flutter إلى GitHub دون استبدال ملفات الويب أو أسرار المشروع. إذا كان API غير منشور أو احتاج إعدادًا، اذكر ذلك صراحة بدل fallback تجريبي أو تخفيف القواعد.
