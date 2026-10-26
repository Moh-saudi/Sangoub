import { createPortal } from "react-dom";
import { AdminQuickSearch } from "./AdminQuickSearch";
import { UserManagement } from "./UserManagement";
import { AuditLog } from "./AuditLog";
import { useEffect, useState, useRef, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { Order, Store, Product, Coupon } from "../types";
import { OperationsDashboard, type OperationsCourier } from "./OperationsDashboard";
import { PreparationMonitor } from "./PreparationMonitor";
import { SangoubRequests } from "./SangoubRequests";
import { VisitorStats } from "./VisitorStats";
import { AppContentManager } from "./AppContentManager";
import { CouponManager } from "./CouponManager";
import type { AdminTabType } from "./AdminDashboard";
import { type AdminStaff } from "./AdminSetupPanel";
import { CatalogManager } from "./CatalogManager";
import { CouriersLiveMap } from "./CouriersLiveMap";
import { FinancialReports } from "./FinancialReports";
import { NotificationCenter } from "./NotificationCenter";
import { LayoutDashboard, ChefHat, ClipboardList, ChevronLeft, Menu, X, ArrowUpRight, Radio, MapPin, ScrollText, UserRoundCog, PanelRightClose, PanelRightOpen, Store as StoreIcon, Package, Tag, TicketPercent, Handshake, Briefcase, PanelsTopLeft, Bike, Banknote, Bell } from "lucide-react";

const sections = [
  { id: "operations", group: "التشغيل اليومي", label: "مركز العمليات", hint: "ملخص اليوم ومؤشرات التشغيل", icon: LayoutDashboard },
  { id: "couriers-map", label: "خريطة المناديب الحية", hint: "تتبع مواقع المناديب والطلبات النشطة", icon: Bike },
  { id: "finance", label: "التقارير المالية والمتاجر", hint: "الإيرادات والعمولات وتسوية الشركاء", icon: Banknote },
  { id: "sangoub", label: "طلبات سنجوب", hint: "فطار وسوبرماركت الموقع", icon: ClipboardList },
  { id: "orders", label: "الطلبات", hint: "المتابعة وتعيين المندوب", icon: ClipboardList },
  { id: "kitchen", label: "متابعة التحضير", hint: "جاهزية المطاعم والسوبر ماركت", icon: ChefHat },
  { id: "stores", group: "المتاجر والمنتجات", label: "المتاجر", hint: "البيانات والتوافر والتوصيل", icon: StoreIcon },
  { id: "products", label: "المنتجات", hint: "المنيو والأسعار والصور", icon: Package },
  { id: "notifications", group: "التسويق", label: "مركز الإشعارات الموحد", hint: "إرسال وتتبع إشعارات الموبايل والويب", icon: Bell },
  { id: "offers", label: "عروض المنتجات", hint: "المنتجات المخفّضة على الموقع", icon: Tag },
  { id: "visitors", label: "عدد الزوار", hint: "إجمالي زوار الموقع وزوار اليوم", icon: LayoutDashboard },
  { id: "content", label: "واجهة التطبيق والحملات", hint: "الأقسام والسلايدر والتشغيل", icon: PanelsTopLeft },
  { id: "coupons", label: "أكواد الخصم", hint: "قسائم خصم الطلبات", icon: TicketPercent },
  { id: "users", group: "الحسابات والشراكات", label: "المستخدمون", hint: "العملاء والمناديب وفريق المتاجر", icon: UserRoundCog },
  { id: "partners", label: "طلبات الشراكة", hint: "انضمام المتاجر والتعاقد", icon: Handshake },
  { id: "jobs", label: "طلبات التوظيف", hint: "المتقدمون والمقابلات", icon: Briefcase },
  { id: "audit", group: "الرقابة", label: "سجل التدقيق", hint: "التغييرات والمنفّذون", icon: ScrollText },
];
const legacySections: Record<string, string> = { management: "orders", catalog: "products", settings: "users" };
function resolveSection(id: string) {
  const target = legacySections[id] || id;
  return sections.some(section => section.id === target) ? target : "operations";
}

export function AdminWorkspace({ orders, stores, products, couriers, staff, coupons, initialManagementTab, connected, onError, children }: {
  orders: Order[]; stores: Store[]; products: Product[]; couriers: OperationsCourier[]; connected: boolean;
  staff: AdminStaff[]; coupons: Coupon[]; initialManagementTab?: string;
  onError: (error: unknown) => void; children: ReactNode;
}) {
  const [tab, setTab] = useState(() => window.location.hash ? resolveSection(window.location.hash.slice(1)) : window.location.pathname === "/kitchen" ? "kitchen" : "operations");
  useEffect(() => {
    const sync = () => { setTab(resolveSection(window.location.hash.slice(1))); setMenuOpen(false); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem('capital-admin-sidebar')==='collapsed');
  const [orderRequest,setOrderRequest]=useState<{term:string;key:number}|undefined>();
  const [catalogRequest,setCatalogRequest]=useState<{term:string;kind:'products'|'stores';key:number}|undefined>();
  function toggleSidebar(){setCollapsed(value=>{const next=!value;localStorage.setItem('capital-admin-sidebar',next?'collapsed':'expanded');return next;});}
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  function navigate(id: string) { const target = resolveSection(id); setTab(target); setMenuOpen(false); if (window.location.hash !== `#${target}`) window.location.hash = target; window.scrollTo({ top: 0 }); }
  useEffect(() => {
    if (!menuOpen) return;
    const focusable = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []).filter(element => element.getClientRects().length > 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(false); }
      if (event.key === "Tab") {
        const elements = focusable(), first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const background = Array.from(document.querySelectorAll<HTMLElement>('.admin-global-header, .admin-mobile-bar, #admin-content'));
    const inertState = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusable()[0]?.focus();
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      background.forEach((element, index) => { element.inert = inertState[index]; });
      document.body.style.overflow = previousOverflow;
      menuTrigger.current?.focus();
    };
  }, [menuOpen]);
  const current = sections.find(section => section.id === tab)!;
  const pending = orders.filter(order => order.orderStatus === "received").length;
  useEffect(() => { if (initialManagementTab && initialManagementTab !== "orders") setTab(resolveSection(initialManagementTab)); }, [initialManagementTab]);
  return <div className={`admin-layout compact-workspace ${collapsed ? "sidebar-collapsed" : ""}`} dir="rtl">
    {document.getElementById('admin-header-search')&&createPortal(<AdminQuickSearch orders={orders} products={products} stores={stores} sections={sections} onSelect={(kind,id,label)=>{
      if(kind==='section')navigate(id);
      else if(kind==='order'){setOrderRequest({term:label,key:Date.now()});navigate('orders');}
      else{setCatalogRequest({term:label,kind:kind==='store'?'stores':'products',key:Date.now()});navigate(kind === 'store' ? 'stores' : 'products');}
    }}/>,document.getElementById('admin-header-search')!)}
    <div className="admin-mobile-bar"><button ref={menuTrigger} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} />أقسام الإدارة</button><span>{current.label}</span></div>
    {menuOpen && <button className="admin-menu-backdrop" aria-label="إغلاق قائمة الإدارة" onClick={() => setMenuOpen(false)} />}
    <aside ref={sidebar} role={menuOpen ? "dialog" : undefined} aria-modal={menuOpen || undefined} className={`admin-sidebar ${menuOpen ? "is-open" : ""}`} id="admin-navigation" aria-label="قائمة الإدارة">
      <div className="admin-sidebar-heading"><span>إدارة سنجوب</span><button className="admin-collapse-toggle" aria-label={collapsed?"توسيع القائمة الجانبية":"طي القائمة الجانبية"} aria-expanded={!collapsed} onClick={toggleSidebar}>{collapsed?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button><button className="admin-menu-close" aria-label="إغلاق القائمة" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
      <nav aria-label="أقسام إدارة التشغيل">{sections.map(({id, label, hint, group, icon: Icon}) => <div key={id} className="admin-nav-item">{group && <p className="admin-nav-group">{group}</p>}<button title={label} aria-label={label} aria-pressed={id === tab} aria-current={id === tab ? "page" : undefined} onClick={() => navigate(id)}><Icon size={20} /><span><strong>{label}</strong><small>{hint}</small></span>{id === "orders" && pending > 0 ? <b className="admin-nav-count">{pending}</b> : id === tab ? <ChevronLeft size={15} /> : null}</button></div>)}</nav>
      <div className="admin-sidebar-location"><MapPin size={17} /><div><strong>الحي الحكومي</strong><small>العاصمة الإدارية الجديدة</small></div></div>
      <a className="admin-public-link" href="/">عرض الموقع الرئيسي <ArrowUpRight size={16} /></a>
      <div className={`admin-connection ${connected ? "is-connected" : ""}`} role="status"><Radio size={16} /><span>{connected ? "متصل بالطلبات الحية" : "جارٍ تأكيد اتصال الطلبات"}</span></div>
    </aside>
    <main className="admin-content" id="admin-content" tabIndex={-1}>
      <nav className="admin-breadcrumb breadcrumb" aria-label="مسار الصفحة"><button onClick={() => navigate("operations")}>لوحة الإدارة</button><ChevronLeft size={13} /><strong>{current.label}</strong><span className="admin-cairo-date">{new Intl.DateTimeFormat("ar-EG", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span></nav>
    {tab === "operations" && <OperationsDashboard orders={orders} stores={stores} couriers={couriers} connected={connected} onNavigate={navigate} />}
    {tab === "couriers-map" && <CouriersLiveMap orders={orders} stores={stores} couriers={couriers} connected={connected} />}
    {tab === "finance" && <FinancialReports orders={orders} stores={stores} />}
    {tab === "kitchen" && <PreparationMonitor orders={orders} stores={stores} connected={connected} />}
    {["stores", "products", "offers"].includes(tab) && <CatalogManager key={tab} mode={tab as "stores" | "products" | "offers"} stores={stores} products={products} orders={orders} searchRequest={catalogRequest?.kind === tab ? catalogRequest : undefined} />}
    {tab === "sangoub" && <SangoubRequests />}
    {tab === "visitors" && <VisitorStats />}
    {tab === "notifications" && <NotificationCenter stores={stores} />}
    {tab === "content" && <AppContentManager stores={stores} products={products} />}
    {tab === "coupons" && <CouponManager coupons={coupons} />}
    {["orders", "partners", "jobs"].includes(tab) && (isValidElement(children) ? cloneElement(children as ReactElement<{ initialAdminTab: AdminTabType; orderSearchRequest?: {term:string;key:number} }>, { initialAdminTab: tab as AdminTabType, orderSearchRequest: tab === "orders" ? orderRequest : undefined }) : children)}
    {tab === "users" && <UserManagement stores={stores} />}
    {tab === "audit" && <AuditLog />}
      <footer className="admin-footer">© 2026 جميع الحقوق محفوظة لشركة ميسك للتكنولوجيا. <span className="admin-build-label" dir="ltr">{String(import.meta.env.VITE_BUILD_ID || "local").slice(0,8)}</span></footer>
    </main>
  </div>;
}
