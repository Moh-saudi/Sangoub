import { lazy, Suspense } from "react";
import {ShopProvider} from "./shop/ShopContext";
import { PublicWebsite } from "./components/PublicWebsite";

const AdminApp = lazy(() => import("./AdminApp"));
const adminRoute = /^\/(admin|kitchen)\/?$/.test(window.location.pathname);

document.title = adminRoute
  ? "لوحة إدارة سنجوب | Sangoub Admin"
  : window.location.pathname.startsWith("/offers") ? "عروض المنتجات | سنجوب" : window.location.pathname.startsWith("/careers") ? "انضم لفريق سنجوب | الوظائف" : "سنجوب | طلبك لحد مكتبك بالحي الحكومي";

export default function App() {
  return adminRoute
    ? <Suspense fallback={<p role="status" className="p-12 text-center" dir="rtl">جارٍ تحميل بوابة الإدارة…</p>}><AdminApp /></Suspense>
    : <ShopProvider><PublicWebsite /></ShopProvider>;
}
