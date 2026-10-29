# GPS migration — الوضع الفعلي وخطة المراجعة

تاريخ: 2026-10-29 (Africa/Cairo). فرع `feature/osm-tracking` فقط؛ لا نشر ولا دمج. هذه الوثيقة تصحح وصف seed السابق؛ لا يوجد IndexedDB replay queue ولا إثبات حصة رحلات أو ميزانية شهرية أو تتبع خلفية مضمون.

## التنفيذ الحالي

- `src/services/osmRouting.ts`: إعداد tiles/attribution مركزي؛ route planner عند بداية الرحلة أو تغير الوجهة أو انحراف يتجاوز 50m، مع منع تكرار الطلب خلال 10s. مسافة/ETA المتبقية تحسب محليًا؛ fallback تقديري Haversine مع معامل 1.3، وليس مسار شارع مثبتًا.
- `src/services/osmClient.ts`: طلبات مصادقة إلى `/api/osm/route` و`/api/osm/search` في نفس الأصل، لا إرسال token إلى مزود خارجي. البحث يتطلب تسجيل الدخول؛ تجربة الضيف لا تحصل على بحث مجهول عبر proxy.
- `server/osmProxy.ts` و`server/handlers/osm.ts`: تحقق token، bbox، مهلة upstream 4s، cache محدودة، 30 طلبًا/دقيقة/UID وحد Nominatim طلب/ثانية داخل instance. القيود والذاكرة ليست موزعة بين serverless instances؛ يلزم حل موزع قبل توسع الإنتاج.
- `sharedLocationSource.ts` و`trackingSession.ts`: مصدر GPS/Wake Lock مشترك، filter مستقل لكل طلب دون تغيير خوارزمية seed؛ heartbeat 10s وإعادة محاولة 2/5/10s، توقف بعد 3min من فشل مستمر أو عدم تأكيد كتابة. لا طابور إعادة تشغيل تاريخي.
- `OrderMap.tsx` و`CouriersLiveMap.tsx`: قراءة scoped لوثائق الطلبات النشطة، وصول محلي للتحديث لتحديد الانقطاع بعد 120s، دون محاكاة حركة. المشرف يعرض حتى 50 طلبًا نشطًا.
- الخريطة داخل `CourierTracking` الحالية؛ `CourierApp.tsx` و`server/portalOrders.ts` لم يتغيرا. لا موقع متجر مخترع؛ الإسقاط لا يحتوي إحداثيات المتجر.

## الإعداد دون أسرار

| المتغير | الغرض |
| --- | --- |
| `VITE_TILE_URL` | مزود tiles؛ OSM العام افتراضي تطوير فقط مع attribution ظاهر |
| `VITE_OSRM_URL` | إعداد توافق؛ العميل الفعلي يستخدم proxy نفس الأصل |
| `OSRM_URL` | upstream server route؛ يلزم اختيار مزود إنتاج صريح |
| `NOMINATIM_URL` | upstream server search/reverse |
| `NOMINATIM_USER_AGENT` | تعريف الجهة لدى المزود؛ لا سر في الواجهة |
| `OSM_ALLOWED_BBOX` | حدود خدمة minLon,minLat,maxLon,maxLat؛ مثال التطوير داخل `.env.example` |

لا يوجد اعتماد على `VITE_NOMINATIM_URL` الجديد في التنفيذ الحالي. الإعداد الإنتاجي يرفض غياب مزود server صريح وUser-Agent. إعداد provider والعقود وسياسة الاستخدام وحل rate limit الموزع قرارات غير منفذة. صلاحية Vercel dynamic function وخطة الحساب لم تُختبر بنشر فعلي.

## القيود والبوابات

Wake Lock قد يُرفض أو لا يُدعم. عند إخفاء الصفحة نوقف مصدر GPS ونحاول `active:false`، وعند العودة ننتظر قراءة GPS جديدة. قفل الشاشة/فتح Google Maps قد يوقف بث الويب؛ لا ادعاء بدعم background. كتابة Firebase وcleanup best-effort وقد تتأخر دون اتصال؛ kill/logout لا يضمن وصول cleanup. تطبيق native لاحقًا قرار مستقل، لم يتغير Flutter أو Android هنا.

اختبارات pure وfixture متصفح معزول نجحت؛ هذا لا يثبت الصلاحيات أو رحلة هاتف. `test:rules` لم يبدأ بعد محاولتين لتعذر تنزيل emulator jar الرسمي، رغم وجود Java. `firestore.rules` لم تتغير ولم تنشر. كلفة القراءات والتعارضات المتبقية في `TRACKING_RULES_COST.md` و`TRACKING_AUDIT.md`، لا أسعار حية متحقق منها.

لا تفعيل إنتاج قبل نجاح emulator ثم staging منفصل وتجربة هاتفين في `FIELD_TEST_PLAN.md`. النشر التلقائي للفرع معطّل بتأكيد المستخدم؛ لم نفحص dashboard. لا إنشاء staging أو تغيير billing أو قراءة أسرار.

## التراجع

المراجعة تتم في Draft PR فقط. عند اكتشاف خلل، revert للـ commit المعني على فرع GPS مع إعادة الاختبارات؛ لا push إلى main ولا أمر نشر تلقائي. قرار دمج/إطلاق منفصل بعد بوابات المراجعة والاختبار الميداني.

## T8 — Emulator-only simulator (implemented)

The simulator is not part of the production bundle. It refuses startup before SDK initialization unless FIRESTORE_EMULATOR_HOST is loopback and FIREBASE_PROJECT_ID is unset or demo-capital-talabat. It uses an explicit emulator-only owner credential, never a service-account file. Seed mode creates an order fixture, not login accounts/roles. Provide emulator Auth UIDs for real demo participants.

```sh
# Terminal 1 — emulators only; never select the production project.
firebase emulators:start --config firebase.emulators.json --only auth,firestore --project demo-capital-talabat
# Terminal 2 — synthetic line, 20 km/h, stand still 5 min, simulate a 30s GPS interruption.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-capital-talabat npm run simulate:courier -- --seed --route scripts/fixtures/nac-synthetic-route.json --order sim-order --courier sim-courier --customer sim-customer --speed 20 --pause 300 --outage-at 30 --outage 30
```

The example is explicitly synthetic, not a real or OSRM road. Coordinates are inside the documented development bounding box. SIGINT/SIGTERM attempts active:false in finally; abrupt process kill cannot guarantee cleanup. End-to-end emulator execution is NOT RUN here because the official Firestore jar download is blocked. Unit guard/timing tests and refusal without emulator were run; neither is a real journey test.
