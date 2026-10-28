# خطة الترحيل والقرارات المؤجلة لنظام سنجوب (MIGRATION.md)

- **تاريخ الوثيقة**: 28 أكتوبر 2026
- **النطاق**: ترحيل الخرائط والتتبع إلى حلول مجانية ومفتوحة المصدر (OpenStreetMap & OSRM) عبر الويب والهواتف الذكية (Mobile-First PWA).

---

## 1. التغييرات المنفذة (What Changed)

1. **متغيرات البيئة الجديدة**:
   - `VITE_TILE_URL`: رابط مزود بلاطات الخريطة (الافتراضي: خادم OpenStreetMap العام).
   - `VITE_OSRM_URL`: خادم التوجيه وحساب المسارات (الافتراضي: خادم OSRM Driving العام).
   - `VITE_NOMINATIM_URL`: خادم البحث الجغرافي العكسي للنصوص.
2. **خدمة التوجيه المركزية (`src/services/osmRouting.ts`)**:
   - استبدال حساب الخط المستقيم بحساب شبكة الطرق الفعلية عبر OSRM.
   - ذاكرة مؤقتة (Caching) ذكية للمسارات لمنع الضغط وتجاوز حدود الطلبات.
   - فحص انحراف المندوب عن المسار (`hasDeviatedFromRoute` بحد 50 متراً) لإعادة الحساب فقط عند اللزوم، وإلغاء الاستدعاء الدوري كل بضع ثوانٍ.
   - بديل احتياطي (Fallback) فوري إلى معادلة Haversine الرياضية عند بطء الشبكة لضمان عدم توقف الواجهة.

---

## 2. القيود التقنية لمتصفحات الجوال (Mobile Web Limitations)

> [!WARNING]
> **قيود نظام التشغيل الصارمة على تتبع الويب (iOS & Android)**:
> 1. **قفل الشاشة (Screen Lock)**: في متصفحات الجوال (Safari على iOS و Chrome على Android)، يقوم النظام بإيقاف أو تجميد مؤقتات JavaScript وبث الـ GPS بالكامل بمجرد قفل شاشة الهاتف أو انتقال الشاشة للوضع الخامل لتوفير الطاقة.
> 2. **تبديل التطبيقات (Background Tab)**: إذا انتقل المندوب للرد على مكالمة هاتفية أو فتح تطبيق آخر (مثل WhatsApp أو Google Maps)، يتم تخفيض أولوية تبويب المتصفح ويتوقف بث الموقع اللحظي.
> 3. **الحل المؤقت في الـ PWA**:
>    - استخدام **Screen Wake Lock API** لإبقاء الشاشة مضاءة طوال الرحلة النشطة.
>    - إظهار شريط تحذير واضح للمندوب بأن قفل الشاشة أو مغادرة الصفحة يوقف التتبع فوراً.
>    - استخدام طابور محلي (IndexedDB Queue) لتخزين أي نقاط غير مرسلة وإعادة إرسالها فور عودة التبويب للواجهة.
> 4. **الحل الجذري النهائي (المرحلة القادمة)**:
>    - بعد إثبات نموذج العمل على الويب، يتم استكمال تطبيق Flutter أو بناء إضافة Capacitor بميزة **Android Foreground Service** و **iOS Location Background Mode** لضمان استمرار البث حتى والشاشة مقفلة في جيب المندوب.

---

## 3. قائمة القرارات المؤجلة (Postponed Decisions)

| القرار المؤجل | الوضع الحالي (MVP) | البديل الإنتاجي المستقبلي | معيار اتخاذ القرار |
| :--- | :--- | :--- | :--- |
| **مزود الـ Tiles للإنتاج** | خادم OSM العام المجاني للتطوير والتجارب الخفيفة. | التعاقد مع مزود مُدار (MapTiler أو Stadia Maps أو CartoDB) أو استضافة خادم Tiles خاص. | عند وصول الطلبات إلى أكثر من 150 طلباً نشطاً يومياً أو مواجهة حظر IP بسبب سياسة OSM Tile Usage Policy. |
| **بوابة الإشعارات الفورية للمناديب** | تنبيهات صوتية وبصرية داخل الصفحة المفتوحة + رسائل WhatsApp عبر بوابة Chataman. | تفعيل Web Push Notifications أو رسائل SMS نصية مباشرة. | عند الحاجة لإيقاظ المندوب وهو خارج المتصفح بالكامل. |
| **التحول لخطة Firebase Blaze** | البقاء على خطة Spark المجانية (بحد أقصى 20 ألف كتابة موقع يومياً ≈ 140 رحلة توصيل). | الترقية إلى Blaze مع وضع Budget Alerts سقفها 15-25 دولار شهرياً. | عند تجاوز 100-120 طلباً مكتملاً يومياً بصورة متكررة. |
| **تتبع الخلفية والشاشة مقفلة** | الشاشة مفتوحة دائماً عبر Wake Lock في PWA. | تطبيق أصلي Native (Flutter / Capacitor Plugin). | عند الانتقال من مرحلة إثبات المفهوم والتشغيل التجريبي إلى التوظيف الميداني الواسع للمناديب. |

---

## 4. خطة الاختبار الميداني الحقيقي (Field Testing Protocol)

### الأجهزة المطلوبة:
- **جهاز 1**: هاتف Android حقيقي (متصفح Chrome) مع شريحة بيانات 4G/5G.
- **جهاز 2**: هاتف iPhone حقيقي (متصفح Safari) أو جهاز أندرويد آخر للعميل.

### سيناريوهات الفحص الميداني:

| # | السيناريو التجريبي | الخطوات العملية | النتيجة المتوقعة |
| :--- | :--- | :--- | :--- |
| **1** | **رحلة ملاحة عادية بشاشة مفتوحة** | المندوب يفتح صفحة التوصيل، ويتحرك بالدراجة لمسافة 2 كم بالحي الحكومي. | خريطة العميل تعرض حركة المندوب بانسيابية، والمسار يتطابق مع الشوارع، والـ ETA ينخفض تدريجياً. |
| **2** | **قفل شاشة هاتف المندوب (Screen Lock)** | أثناء القيادة، يقوم المندوب بقفل الشاشة لمدة 90 ثانية ثم فتحها مجدداً. | صفحة العميل تظهر تنبيه "آخر تحديث منذ دقيقة"، وعند فتح الشاشة يعود البث ويُفرغ طابور IndexedDB دون انهيار التطبيق. |
| **3** | **التبديل إلى Google Maps للملاحة** | المندوب يضغط زر "فتح في خرائط جوجل" لمشاهدة الاتجاهات ثم يعود بعد دقيقتين. | يظهر تحذير للمندوب قبل المغادرة، وعند العودة يعيد Wake Lock تفعيل نفسه ويستأنف بث GPS فوراً. |
| **4** | **انقطاع شبكة الإنترنت في نفق أو مبنى** | وضع الهاتف في نمط الطيران (Airplane Mode) لمدة 45 ثانية أثناء الحركة ثم إعادة الشبكة. | تتجمع النقاط في IndexedDB محلياً، وبمجرد عودة الشبكة تُرسل آخر نقطة مباشرة وتتحدث الخريطة فوراً. |
| **5** | **استهلاك البطارية والحرارة** | تشغيل جلسة تتبع كاملة مدتها 30 دقيقة بشاشة مضاءة (Wake Lock). | قياس نسبة استهلاك البطارية (المستهدف: أقل من 6% استهلاك لكل نصف ساعة قيادة). |

---

## 5. إجراءات التراجع الفوري (Rollback Protocol)

في حال حدوث أي طارئ على الإنتاج:
1. العودة للـ Commit السابق عبر:
   ```bash
   git revert HEAD
   git push origin main
   ```
2. متغيرات البيئة يمكن إعادتها فوراً من لوحة تحكم Vercel دون الحاجة لتعديل الكود المصدري.


## T8 — Emulator-only simulator (implemented)

The simulator is not part of the production bundle. It refuses startup before SDK initialization unless FIRESTORE_EMULATOR_HOST is loopback and FIREBASE_PROJECT_ID is unset or demo-capital-talabat. It uses an explicit emulator-only owner credential, never a service-account file. Seed mode creates an order fixture, not login accounts/roles. Provide emulator Auth UIDs for real demo participants.

```sh
# Terminal 1 — emulators only; never select the production project.
firebase emulators:start --config firebase.emulators.json --only auth,firestore --project demo-capital-talabat
# Terminal 2 — synthetic line, 20 km/h, stand still 5 min, simulate a 30s GPS interruption.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-capital-talabat npm run simulate:courier -- --seed --route scripts/fixtures/nac-synthetic-route.json --order sim-order --courier sim-courier --customer sim-customer --speed 20 --pause 300 --outage-at 30 --outage 30
```

The example is explicitly synthetic, not a real or OSRM road. Coordinates are inside the documented development bounding box. SIGINT/SIGTERM attempts active:false in finally; abrupt process kill cannot guarantee cleanup. End-to-end emulator execution is NOT RUN here because the official Firestore jar download is blocked. Unit guard/timing tests and refusal without emulator were run; neither is a real journey test.
