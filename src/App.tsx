import { lazy, Suspense } from "react";
import { PublicWebsite } from "./components/PublicWebsite";

const AdminApp = lazy(() => import("./AdminApp"));
const adminRoute = /^\/(admin|kitchen)\/?$/.test(window.location.pathname);

document.title = adminRoute
  ? "لوحة إدارة طلبات العاصمة | Capital Talabat Admin"
  : window.location.pathname.startsWith("/offers") ? "عروض المنتجات | طلبات العاصمة" : window.location.pathname.startsWith("/careers") ? "انضم لفريق طلبات العاصمة | الوظائف" : "طلبات العاصمة | طلبك لحد مكتبك بالحي الحكومي";

export default function App() {
  return adminRoute
    ? <Suspense fallback={<p role="status" className="p-12 text-center" dir="rtl">جارٍ تحميل بوابة الإدارة…</p>}><AdminApp /></Suspense>
    : <PublicWebsite />;
}
