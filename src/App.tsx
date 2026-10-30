import {ShopProvider} from './shop/ShopContext';
import { lazy, Suspense, useEffect, useState } from "react";
import StorefrontApp from "./storefront/StorefrontApp";

const ShopFront = lazy(() => import('./shop/ShopFront'));
const AdminApp = lazy(() => import("./AdminApp"));
const CourierApp = lazy(() => import("./CourierApp"));
const MerchantApp = lazy(() => import("./MerchantApp"));

export default function App() {
  const [path, setPath] = useState(location.pathname);

  useEffect(() => {
    const change = () => setPath(location.pathname);
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);

  if (/^\/courier(\/.*)?$/.test(path)) {
    return (
      <Suspense fallback={<p role="status" className="p-8" dir="rtl">جارٍ تحميل بوابة المندوب…</p>}>
        <CourierApp />
      </Suspense>
    );
  }

  if (/^\/(stores(?:\/[^/]+)?|cart|checkout(?:\/success)?|my-orders|track|order-tracking(?:\/[^/]+)?)\/?$/.test(path)) {
    return (
      <ShopProvider>
        <Suspense fallback={<p role="status" className="p-8" dir="rtl">جارٍ تحميل التسوق…</p>}>
          <ShopFront key={path} />
        </Suspense>
      </ShopProvider>
    );
  }

  if (/^\/merchant(\/.*)?$/.test(path) || location.hash.startsWith("#merchant") || new URLSearchParams(location.search).get("tab") === "restaurant") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center font-cairo" dir="rtl">
            <p role="status" className="text-white text-sm font-bold">
              جارٍ تحميل بوابة شركاء سنجوب…
            </p>
          </div>
        }
      >
        <MerchantApp />
      </Suspense>
    );
  }

  if (/^\/(admin|kitchen)(\/.*)?$/.test(path)) {
    return (
      <Suspense fallback={<p role="status" className="p-12 text-center" dir="rtl">جارٍ تحميل بوابة الإدارة…</p>}>
        <AdminApp />
      </Suspense>
    );
  }

  return <StorefrontApp />;
}
