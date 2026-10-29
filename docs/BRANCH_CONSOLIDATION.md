# توحيد الفروع — 2026-10-29

طلب المستخدم تصحيح الفروع وإزالة التكرار. الفحص الفعلي:

| الفرع عند بدء الفحص | SHA | العلاقة |
| --- | --- | --- |
| main | 4b5bfe47b149278ffe62d9e7ffe83ff57332f589 | يحتوي كامل فرع المعاينة |
| preview/mobile-courier-portals | 056a1fc90d2f071c3287138e2461aa02ea33d0d1 | صفر commits فريدة؛ متأخر5 عن main |
| feature/osm-tracking | 22e3b10976537e2af122a93c16aff00302f84418 | متقدم15 عن main، غير متأخر؛ عمل غير مدمج وليس نسخة ملفات مكررة |

حُذف فرع preview البعيد بعد التحقق باستخدام merge-base وlog من حفظ كل تعديلاته في main؛ لا فقد تاريخ ولا force-push.

main لديه فشل CI في test:rules وفق صفحة GitHub العامة للتشغيل40749931901، وليس دليلًا على فشل بناء Vercel. التفاصيل الخام محجوبة (GitHub API Forbidden). الكود يحتوي تعارضًا مؤكدًا: اختبار realtime قديم يقرأ orders/o1 كتاجر رغم منع قراءة parent order عمدًا. صُحح الاختبار للاستماع إلى storeOrderSignals/s1/orders/o1 مع اختبار بقاء منع parent order والمتجر الآخر وكتابة signals. لم نفتح قواعد الأمان ولم نلغِ الاختبار.

CI أصبح يفحص فرع GPS نفسه، مع npm ci بدل npm install لتجنب اختلاف نسخ dependencies. معرفات Firebase الاختبارية demo-only؛ لم توضع أسرار أو مشروع إنتاج في المهمة. أضيف wrapper يحتفظ برمز خروج test:rules ويعلن أسماء الاختبارات الفاشلة الثابتة فقط عبر GitHub annotations؛ لا طباعة قيم tokens أو حسابات أو بيانات اختبارات إضافية.

نجحت بوابات lint/lint:server و85 اختبارًا وcompiled API والبناء محليًا. emulator jar الرسمي ما زال يرجع403 حتى بعد منح الشبكة لهذه الجولة؛ لذلك لا ادعاء بنجاح test:rules أو أن كل فشل CI انتهى. لا تعديل/نشر firestore.rules. تبقى مراجعة نتيجة CI الجديدة شرطًا قبل إزالة فرع GPS أو وصفه بأنه اندمج بنجاح.

## نتيجة CI الأولى على GPS

تشغيل40832116354 نجح حتى auth وoperations؛ فشل test:rules حدد اختبار operational signals فقط. ظهر خطأ fixture مؤكد في المصدر: destructuring لطريقة context.firestore يفقد this، وطريقة SDK تعتمد على this.emulators/this.getApp. أُعيد الاستدعاء عبر context دون أي تغيير للقواعد. الاختبار القديم للـraw-order listener صُحح في الدفعة السابقة. هذه نتيجة تشخيص فعلية وليست نجاح test:rules بعد.

إعداد متصفح CI أصبح يستخدم chromium.executablePath() للنسخة التي يثبتها Playwright بدل افتراض وجود /usr/bin/chromium في GitHub Runner، مع إضافة fixture GPS إلى CI. لا تغيير لسلوك التطبيق أو قواعد البيانات.

## نتيجة CI الثانية

تشغيل40832754280 أثبت نجاح test:rules فعليًا على GitHub بعد إصلاح السياق. لم تُنشر القواعد ولم تتغير. الفشل التالي test:web-checkout كشف سيناريو اختبار قديمًا آخر يعتمد قراءة التاجر للطلبات الكاملة. جرى تحديثه إلى portal-active وlegacy-prepare وcourier-pickup/courier-depart الفعلية، مع تأكيد رفض القراءة الخام وأن التعيين ليس استلامًا. لا تغيير لتوقع الأسعار أو الدفع أو OTP أو أذونات التطبيق.

وُحد runner تشخيص CI في check-tests-ci.mjs بدل إنشاء wrappers مكررة؛ يدعم suites ثابتة ويحتفظ برمز الفشل وينشر عناوين الاختبارات فقط.
