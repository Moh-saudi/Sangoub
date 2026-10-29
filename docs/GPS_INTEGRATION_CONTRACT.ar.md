# عقد تكامل GPS — الوضع الحالي

> تحديث 2026-10-29: [GPS_FOLLOWUP_2026-10-29.md](GPS_FOLLOWUP_2026-10-29.md) يوثق إضافة خريطة التاجر وإصلاح تجهيز Vercel ومنع الموقع القديم. تفاصيل التسليم السابق أدناه تاريخية حيث تتعارض مع التحديث.

تاريخ 2026-10-29. طلب المستخدم المرفق اللاحق أجاز تنفيذ GPS على `feature/osm-tracking` فقط، ويحل محل حجز الملفات السابق. لا دمج أو نشر. المستخدم أكد تعطيل نشر الفرع؛ إعداد Vercel لم يُفحص مباشرة.

نقطة التكامل هي `<CourierTracking order={order} />` الموجودة في `src/CourierApp.tsx`. لم يتغير موضعها أو هذا الملف؛ `src/components/CourierTracking.tsx` أصبح مكوّنًا فعليًا. الخصائص تبقى `id`, `orderStatus`, `courierId`, `profileId`, `coordinates` من `Order` دون تغيير الأسماء أو شكلها. `server/portalOrders.ts` لم يتغير؛ pickupPoints لا تعطي إحداثيات المتجر، لذلك لا نعرض نقطة متجر تخمينية.

المندوب المعيّن فقط، بحالة `with_courier`، يبدأ جلسة لكل طلب. مصدر watchPosition وWake Lock واحد مشترك في الصفحة؛ filter مستقل لكل طلب. الكاتب الوحيد الجديد داخل hook GPS يرسل `coordinates`, `active`, `updatedAt: serverTimestamp()` إلى `tracking/{orderId}`. لا توسيع saveRecord أو admin-data. لا معرفات أو speed/accuracy إضافية في الوثيقة.

العميل والمشرف يقرآن وثائق منفردة ضمن الصلاحيات الحالية؛ لا collection listener شامل. الواجهة لا تعتبر cached snapshot حيًا، ولا تستعمل ساعة الخادم لقياس freshness. آخر وصول محلي أقدم من 120s يعني انقطاعًا؛ animation لا يعني وصول GPS. تتوقف الاشتراكات عند إغلاق المكوّن أو تغيير المستخدم أو الحالة النهائية. للمشرف سقف 50 طلبًا نشطًا ظاهرًا.

الاستثناءات المعلنة:
- D1: لا store coordinates في API؛ لم نغيره.
- D2: saveRecord لا يصلح لهذا المسار؛ helper GPS مستقل.
- D3: توافق نافذة legacy مع الحقول canonical اختياري، واستبدال قسم GPS فقط في ShopFront، دون تغيير دفع/سلة/حساب.
- D4: القواعد الحالية تسمح cleanup `active:false` خارج `with_courier`؛ لم نشددها دون اختبار ناجح.
- D5: اشتراك الوثيقة مستمر أثناء فتح طلب `with_courier` حتى لو inactive، حتى يرى الاستئناف؛ لا عرض حي للوثيقة غير النشطة.
- D6: قراءة tracking داخل order-status REST باقية في server؛ تكرار معروف لم يُزال خارج نطاق التعديل.

`firestore.rules` لم تتغير. لا نشر لها قبل نجاح `npm run test:rules`؛ الاختبار لم يبدأ لتعذر تنزيل emulator jar مرتين، رغم Java21. إعادة التعيين تحتاج مراجعة server-side cleanup حتى لا يعرض آخر موقع للمندوب السابق قبل أول كتابة جديدة؛ لا حقل جديد صامتًا. cleanup دون اتصال best-effort.

قائمة commits التي مسّت ملفات الخرائط/الخدمات المحجوزة سابقًا موجودة في `TRACKING_WORKLOG.md` مع SHA وgit show --stat؛ يجب إبلاغ المالك بها عند تسليم PR. المحاكي demo-only، ولا وصول لبيانات Firebase الإنتاجية. الاختبار الميداني وتحقق الصلاحيات على emulator بوابات معلقة، وليسا إنجازًا مثبتًا.
