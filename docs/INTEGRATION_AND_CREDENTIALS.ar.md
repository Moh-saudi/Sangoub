# دليل الربط التقني والمفاتيح المعتمدة (Integration & Credentials Registry)
**منظومة طلبات العاصمة (Capital Talabat)**  
**تاريخ التحديث:** 25 أكتوبر 2026  
**النطاق السحابي الرسمي:** `https://capital-talabat.vercel.app`  
**مشروع Firebase:** `capital-talabat`  
**قاعدة البيانات:** `(default)` Firestore

---

## 1. مفاتيح ومعلومات Firebase المعتمدة

### أ. عميل الويب والموبايل العام (Client Public Credentials)
```env
PROJECT_ID=capital-talabat
DATABASE_ID=(default)
AUTH_DOMAIN=capital-talabat.firebaseapp.com
STORAGE_BUCKET=capital-talabat.firebasestorage.app
MESSAGING_SENDER_ID=462331103510
```

| المنصة | App ID | API Key |
| :--- | :--- | :--- |
| **Web (Vite/React)** | `1:462331103510:web:b48e42c27667fcdee9e837` | `AIzaSyCTgSsfVgXrd4d79-wpRtCBY-biXnVTeM8` |
| **Android (Flutter)** | `1:462331103510:android:bbcec7992b9a9b08e9e837` | `AIzaSyC8riMf-65g49IqPvT_Ug2DD-X-cluDm54` |
| **iOS (Flutter)** | `1:462331103510:android:bbcec7992b9a9b08e9e837` | `AIzaSyC8riMf-65g49IqPvT_Ug2DD-X-cluDm54` |

---

## 2. بوابات الدفع الإلكتروني والرسائل (Payment & Messaging Gateways)

### أ. بوابة جيديا (Geidea Payment Gateway)
مخصصة لدفع البطاقات البنكية (Visa / MasterCard / Meeza / Apple Pay):
- **Base URL:** `https://api.merchant.geidea.net`
- **Environment:** `production`
- **Merchant Public Key:** `3448c010-87b1-41e7-9771-cac444268cfb`
- **API Password:** `ecba1701-4889-4357-ba09-4d8d864f6d64`
- **Sandbox Test Public Key:** `e510dca3-d113-47bf-b4b0-9b92bac661f6`
- **Sandbox Test Password:** `9b794cd5-9b42-4048-8e97-2c162f35710f`
- **Callback Webhook:** `https://capital-talabat.vercel.app/api/geidea/callback`
- **Return URL:** `https://capital-talabat.vercel.app/checkout/success`

### ب. بوابة شات أمان للواتساب (ChatAman WhatsApp Gateway)
مخصصة لإرسال إشعارات الطلب ورموز التأكيد عبر WhatsApp:
- **Base URL:** `https://chataman.com`
- **API Key:** `lmVt2Y62QMdZUp52JnkTeJNhgKERlCA92Oyv1aEh`
- **Sender Name:** `طلبات العاصمة`
- **Default Country Code:** `20` (Egypt)
- **Webhook URL:** `https://capital-talabat.vercel.app/api/chataman/webhook`

### ج. خيارات الدفع الأخرى
- **إنستاباي (Instapay):** تأكيد التحويل المباشر مع رفع إشعار التحويل لرقم الحساب المعتمد.
- **الدفع عند الاستلام (Cash on Delivery):** مفعل بحد أقصى **300 ج.م** لكل طلب؛ الطلبات التي تتجاوز هذا المبلغ تلزم العميل بالدفع الإلكتروني المسبق.

---

## 3. التخزين السحابي السريع (Cloudflare R2 Storage)

تخزين وتوزيع صور المطاعم والوجبات والأصناف عبر CDN سريع دون استهلاك حصة Firebase Storage:
- **Bucket Name:** `capitaltalabat`
- **Account ID:** `14521cdfec73fa908fbf7e760fae362a`
- **S3 Endpoint:** `https://14521cdfec73fa908fbf7e760fae362a.r2.cloudflarestorage.com`
- **Public CDN URL:** `https://pub-14521cdfec73fa908fbf7e760fae362a.r2.dev`

---

## 4. محرك الخرائط والمواقع الحرة (GPS & Routing)

- **Reverse Geocoding:** `https://nominatim.openstreetmap.org/reverse`
  - المعاملات: `format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1&accept-language=ar`
  - User-Agent المعتمد: `CapitalTalabatApp/1.0 (support@capitaltalabat.com)`
- **Search Geocoding:** `https://nominatim.openstreetmap.org/search`
  - المعاملات: `q={query}&countrycodes=eg&format=json&limit=5&accept-language=ar`
- **دقة الموقع في الموبايل:** `Geolocator.getCurrentPosition(accuracy: LocationAccuracy.high, timeLimit: 7s)`
- **تغطية التوصيل:** نظام ديناميكي حر يغطي أي نقطة (العاصمة الإدارية، الشروق، مدينتي، بدر، القاهرة الجديدة، الجيزة، وغيرها) مع احتساب فوري للمسافة وزمن وصول المندوب.

---

## 5. واجهات التكامل البرمجي بين الموبايل والويب (API Contracts)

### أ. إنشاء طلب جديد (`POST /api/orders`)
- **Headers الإلزامية:**
  - `Authorization: Bearer <Firebase_ID_Token>`
  - `Content-Type: application/json`
- **جسم الطلب (Request Payload):**
```json
{
  "id": "ord-7f3b8a1c-9d2e-4b6a-8c1d-0e4f2a5b6c7d",
  "profileName": "محمد أحمد",
  "phone": "01012345678",
  "ministry": "شارع المهندس ابراهيم عثمان، مدينة الشروق",
  "floorNumber": "3",
  "roomNumber": "شقة 12",
  "items": [
    {
      "product": {
        "id": "prod-101",
        "storeId": "store-cairo-kitchen",
        "name": "وجبة إفطار عاصمة",
        "price": 85.0
      },
      "quantity": 2,
      "selectedOptions": {}
    }
  ],
  "paymentMethod": "cash",
  "tip": 10.0,
  "coordinates": {
    "latitude": 30.163063,
    "longitude": 31.625725
  },
  "notes": "الاتصال عند البوابة"
}
```
- **استجابة النجاح (200 OK):**
```json
{
  "success": true,
  "order": {
    "id": "ord-7f3b8a1c-9d2e-4b6a-8c1d-0e4f2a5b6c7d",
    "status": "received",
    "total": 180.0
  },
  "requiresPaymentRedirect": false,
  "redirectUrl": null
}
```

---

## 6. مصفوفة الصلاحيات في Firestore

```
firestore/
├── orders/{orderId}        # وثائق الطلبات الحية مع coordinates و kitchenStatus
├── stores/{storeId}        # بيانات المتاجر، الرسوم، وحالة التفعيل
├── catalog/{categoryId}    # التصنيفات والأصناف وقوائم الطعام
├── users/{uid}             # بيانات العميل العامة ورصيده
├── admins/{uid}            # صلاحيات الإدارة العليا والوصول لـ /admin
└── staff/{uid}             # صلاحيات الشيف (role: restaurant) أو المندوب (role: courier)
```

---

## 7. فحص الجاهزية للخطوة التالية (Readiness Checklist)

- [x] إعدادات Firebase لجميع المنصات (Web, Android, iOS) مطابقة وموثقة.
- [x] مفاتيح بوابة جيديا للدفع المباشر (Production & Sandbox) مسجلة وجاهزة.
- [x] مفاتيح بوابة شات أمان لإشعارات الواتساب مسجلة ومفعلة.
- [x] مسار الصور R2 متصل بالـ CDN ومتاح في الكتالوج.
- [x] نظام الـ GPS بالموبايل يقرأ العناوين الحقيقية بدقة دون تقييد جغرافي.
- [x] تم رفع جميع التحديثات البرمجية والصور إلى مستودع GitHub (`main`).
