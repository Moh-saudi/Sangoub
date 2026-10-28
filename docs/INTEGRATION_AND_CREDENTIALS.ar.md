# إعداد التكاملات وإدارة بيانات الاعتماد

تُحفظ القيم السرية في Vercel Environment Variables وGitHub Actions Secrets، ولا تضاف إلى Git أو ملفات توثيق عامة.

- Firebase Admin: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_ID`.
- Geidea: `GEIDEA_ENVIRONMENT` ومفاتيح الحساب المناسبة للبيئة، حسب `.env.example`. اختبر sandbox قبل قبول أموال حقيقية.
- R2: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` وبقية إعدادات endpoint/bucket في `server/r2.ts`.
- ChatAman وGemini: مفاتيح خادم فقط، دون بادئة `VITE_`.
- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` داخل GitHub Secrets. لا تُرفع keystore مع build artifacts.

أزيلت القيم السرية من الوثيقة الحالية. هذا لا يزيلها من Git history؛ على مسؤول الحسابات تدوير أي اعتماد حقيقي سبق نشره، والتحقق من استمرارية مفتاح توقيع التطبيق قبل إصداره.
