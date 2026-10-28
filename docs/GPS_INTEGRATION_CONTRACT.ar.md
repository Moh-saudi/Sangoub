# حدود تكامل GPS المتفق عليها

ملكية الخرائط والتتبع للمساهم الآخر. لا تعدّل من هذا المسار:

- `src/components/OrderMap.tsx`
- `src/components/CouriersLiveMap.tsx`
- `src/storefront/components/OrderTrackingModal.tsx`
- `src/storefront/components/ServiceAreaModal.tsx`
- `src/services/osm*`
- `src/services/locationTracking*`
- كتلة `match /tracking` في `firestore.rules`.

نقطة التكامل الوحيدة في بوابة المندوب: `<CourierTracking order={order} />` داخل بطاقة المهمة النشطة. `src/components/CourierTracking.tsx` حاليًا مكوّن فارغ يعيد null، دون أي قراءة موقع أو كتابة أو مراقبة شبكة؛ يملأه مساهم GPS. نوع الخصائص `CourierTrackingOrder` يحدد `id`, `orderStatus`, `courierId`, `profileId`, `coordinates` بأسمائها وأنواعها الحالية من `Order`.

استجابة الطلب النشط في `server/portalOrders.ts` أضيف إليها `courierId` و`profileId` من المصدر، بعد إبلاغ المستخدم؛ كانتا غير ممررتين في الإسقاط السابق. لا تغيير للقيم في قاعدة البيانات أو `orderStatus` أو `coordinates`. سجل التوصيل يظل ملخصًا ولا يحتاج بيانات التتبع. اختبار الإسقاط يثبت تطابق الحقول الأربعة مع المصدر.

لا تنشر `firestore.rules` إلا بعد نجاح `npm run test:rules` ببيئة Java المناسبة. وجود Java وحده أو نجاح ESLint للقواعد ليس بديلًا عن نجاح الاختبار. أي commit يمس الملفات المحجوزة أو القاعدة يجب إبلاغ المستخدم به صراحة، وكذلك تغيير دالة مشتركة تؤثر في صلاحيات التتبع.

للتاريخ: `3dd2607` و`a43aa1a` عدّلا `firestore.rules` خارج كتلة tracking. الثاني ضيّق قراءة الطلبات الكاملة للتاجر بتغيير `ownerOrder`؛ هذه الدالة تستعملها أيضًا قراءة tracking، لذا له أثر غير مباشر على صلاحيات التاجر في التتبع. لم تُنشر هذه القواعد من جلسة العمل. بقية ملفات الخرائط المذكورة لم تمسها التحديثات بين `22d6864` وهذه الدفعة.
