import { useEffect, useState, type ReactNode } from "react";
import type { Order, Store, Product, Coupon } from "../types";
import { OperationsDashboard, type OperationsCourier } from "./OperationsDashboard";
import { KitchenDisplay } from "./KitchenDisplay";
import { AdminSetupPanel, type AdminStaff } from "./AdminSetupPanel";
import { CatalogManager } from "./CatalogManager";
import { updateKitchenStage } from "../lib/firebase";

export function AdminWorkspace({ orders, stores, products, couriers, staff, coupons, initialManagementTab, connected, onError, children }: {
  orders: Order[]; stores: Store[]; products: Product[]; couriers: OperationsCourier[]; connected: boolean;
  staff: AdminStaff[]; coupons: Coupon[]; initialManagementTab?: string;
  onError: (error: unknown) => void; children: ReactNode;
}) {
  const [tab, setTab] = useState(window.location.pathname === "/kitchen" ? "kitchen" : "operations");
  useEffect(() => { if (initialManagementTab && initialManagementTab !== "orders") setTab("management"); }, [initialManagementTab]);
  return <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-5" dir="rtl">
    <nav aria-label="أقسام إدارة التشغيل" className="flex gap-2 overflow-x-auto pb-1">
      {[["operations", "مركز العمليات"], ["kitchen", "شاشة المطبخ"], ["catalog", "المنتجات والمتاجر"], ["management", "الطلبات والتقديمات"], ["settings", "الفريق والخصومات"]].map(([id, label]) => <button key={id} aria-pressed={id === tab} onClick={() => setTab(id)} className={`shrink-0 py-3 px-4 text-sm font-bold rounded-xl ${id === tab ? "bg-orange-600 text-white" : "border bg-white text-slate-700"}`}>{label}</button>)}
    </nav>
    {tab === "operations" && <OperationsDashboard orders={orders} stores={stores} couriers={couriers} connected={connected} />}
    {tab === "kitchen" && <KitchenDisplay orders={orders} stores={stores} connected={connected} onChange={updateKitchenStage} />}
    {tab === "catalog" && <CatalogManager stores={stores} products={products} orders={orders} />}
    {tab === "settings" && <AdminSetupPanel stores={stores} staff={staff} coupons={coupons} orders={orders} onError={onError} defaultOpen />}
    {tab === "management" && children}
  </div>;
}
