import { lazy, Suspense } from "react";
import StorefrontApp from "./storefront/StorefrontApp";

const AdminApp = lazy(() => import("./AdminApp"));
const adminRoute = /^\/(admin|kitchen)\/?$/.test(window.location.pathname);

export default function App() {
  return adminRoute ? (
    <Suspense fallback={<p role="status" className="p-12 text-center" dir="rtl">جارٍ تحميل بوابة الإدارة…</p>}>
      <AdminApp />
    </Suspense>
  ) : (
    <StorefrontApp />
  );
}
