import { UserManagement } from "./UserManagement";
import { AuditLog } from "./AuditLog";
import { useEffect, useState, type ReactNode } from "react";
import type { Order, Store, Product, Coupon } from "../types";
import { OperationsDashboard, type OperationsCourier } from "./OperationsDashboard";
import { KitchenDisplay } from "./KitchenDisplay";
import { AdminSetupPanel, type AdminStaff } from "./AdminSetupPanel";
import { CatalogManager } from "./CatalogManager";
import { updateKitchenStage } from "../lib/firebase";
import { LayoutDashboard, ChefHat, ShoppingBag, ClipboardList, Users, ChevronLeft, Menu, X, ArrowUpRight, Radio, MapPin, ScrollText, UserRoundCog } from "lucide-react";

const sections = [
  { id: "operations", label: "مركز العمليات", hint: "نظرة عامة على التشغيل", icon: LayoutDashboard },
  { id: "management", label: "الطلبات والتقديمات", hint: "الطلبات والشراكات والتوظيف", icon: ClipboardList },
  { id: "kitchen", label: "شاشة المطبخ", hint: "التحضير والاستلام", icon: ChefHat },
  { id: "catalog", label: "المنتجات والمتاجر", hint: "المنيو والأسعار والصور", icon: ShoppingBag },
  { id: "users", label: "المستخدمون", hint: "الحسابات والأدوار والوصول", icon: UserRoundCog },
  { id: "audit", label: "سجل التدقيق", hint: "العمليات والتغييرات والمنفّذون", icon: ScrollText },
  { id: "settings", label: "الفريق والخصومات", hint: "الصلاحيات وأكواد الخصم", icon: Users },
];

export function AdminWorkspace({ orders, stores, products, couriers, staff, coupons, initialManagementTab, connected, onError, children }: {
  orders: Order[]; stores: Store[]; products: Product[]; couriers: OperationsCourier[]; connected: boolean;
  staff: AdminStaff[]; coupons: Coupon[]; initialManagementTab?: string;
  onError: (error: unknown) => void; children: ReactNode;
}) {
  const [tab, setTab] = useState(() => window.location.pathname === "/kitchen" ? "kitchen" : sections.some(section => section.id === window.location.hash.slice(1)) ? window.location.hash.slice(1) : "operations");
  const [menuOpen, setMenuOpen] = useState(false);
  function navigate(id: string) { setTab(id); setMenuOpen(false); window.history.replaceState(null, "", `#${id}`); window.scrollTo({ top: 0 }); }
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", close); document.body.style.overflow = previous; };
  }, [menuOpen]);
  const current = sections.find(section => section.id === tab)!;
  const pending = orders.filter(order => order.orderStatus === "received").length;
  useEffect(() => { if (initialManagementTab && initialManagementTab !== "orders") setTab("management"); }, [initialManagementTab]);
  return <div className="admin-layout" dir="rtl">
    <div className="admin-mobile-bar"><button aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} />أقسام الإدارة</button><span>{current.label}</span></div>
    {menuOpen && <button className="admin-menu-backdrop" aria-label="إغلاق قائمة الإدارة" onClick={() => setMenuOpen(false)} />}
    <aside className={`admin-sidebar ${menuOpen ? "is-open" : ""}`} id="admin-navigation" aria-label="قائمة الإدارة">
      <div className="admin-sidebar-heading"><span>مساحة العمل</span><button className="admin-menu-close" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
      <nav aria-label="أقسام إدارة التشغيل">{sections.map(({id, label, hint, icon: Icon}) => <button key={id} aria-label={label} aria-pressed={id === tab} aria-current={id === tab ? "page" : undefined} onClick={() => navigate(id)}><Icon size={20} /><span><strong>{label}</strong><small>{hint}</small></span>{id === "management" && pending > 0 ? <b className="admin-nav-count">{pending}</b> : id === tab ? <ChevronLeft size={15} /> : null}</button>)}</nav>
      <div className="admin-sidebar-location"><MapPin size={17} /><div><strong>الحي الحكومي</strong><small>العاصمة الإدارية الجديدة</small></div></div>
      <a className="admin-public-link" href="/">عرض الموقع الرئيسي <ArrowUpRight size={16} /></a>
      <div className={`admin-connection ${connected ? "is-connected" : ""}`} role="status"><Radio size={16} /><span>{connected ? "متصل بالطلبات الحية" : "جارٍ تأكيد اتصال الطلبات"}</span></div>
    </aside>
    <main className="admin-content" id="admin-content">
      <div className="admin-breadcrumb"><span>لوحة الإدارة</span><ChevronLeft size={13} /><strong>{current.label}</strong><span className="admin-cairo-date">{new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span></div>
    {tab === "operations" && <OperationsDashboard orders={orders} stores={stores} couriers={couriers} connected={connected} onNavigate={navigate} />}
    {tab === "kitchen" && <KitchenDisplay orders={orders} stores={stores} connected={connected} onChange={updateKitchenStage} />}
    {tab === "catalog" && <CatalogManager stores={stores} products={products} orders={orders} />}
    {tab === "settings" && <AdminSetupPanel stores={stores} staff={staff} coupons={coupons} orders={orders} onError={onError} defaultOpen />}
    {tab === "management" && children}
    {tab === "users" && <UserManagement stores={stores} />}
    {tab === "audit" && <AuditLog />}
      <footer className="admin-footer">© 2026 جميع الحقوق محفوظة لشركة ميسك للتكنولوجيا.</footer>
    </main>
  </div>;
}
