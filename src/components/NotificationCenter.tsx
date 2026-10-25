import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { apiUrl } from "../lib/apiUrl";
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import type { Store } from "../types";
import {
  Bell,
  Send,
  Smartphone,
  Users,
  ShoppingBag,
  Bike,
  Store as StoreIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Tag,
  Clock,
  History,
  RotateCcw,
  Zap,
  Info,
  Radio,
  ExternalLink
} from "lucide-react";

interface NotificationCenterProps {
  stores?: Store[];
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  audience: "all" | "clients" | "couriers" | "stores" | "single";
  type: "promo" | "operational" | "alert" | "general";
  targetScreen?: string;
  targetId?: string;
  imageUrl?: string;
  senderEmail?: string;
  recipientCount?: number;
  fcmDeliveryStatus?: string;
  createdAt?: any;
}

const TEMPLATES = [
  {
    label: "🥐 إفطار الحي الحكومي",
    type: "promo" as const,
    audience: "clients" as const,
    targetScreen: "offers",
    title: "وجبات الإفطار الساخنة في الحي الحكومي 🥐",
    body: "الفول، الفلافل، والمخبوزات الطازجة تصلك إلى مكتبك في الوزارات بالعاصمة الإدارية خلال 25 دقيقة فقط!",
  },
  {
    label: "⚡ توصيل سريع للشروق",
    type: "promo" as const,
    audience: "clients" as const,
    targetScreen: "home",
    title: "أشهى وجبات الغداء في الشروق جاهزة الآن 🍔",
    body: "مندوبنا بالقرب منك! اطلب وجبتك المفضلة واستمتع بتوصيل قياسي لباب منزلك.",
  },
  {
    label: "🎁 كوبون خصم حصري",
    type: "promo" as const,
    audience: "all" as const,
    targetScreen: "offers",
    title: "خصم 15% على جميع طلبات اليوم! 🎁",
    body: "استخدم كود [CAPITAL] عند الدفع واحصل على خصم فوري على وجباتك المفضلة لفترة محدودة.",
  },
  {
    label: "🛵 تنبيه للمناديب والأسطول",
    type: "operational" as const,
    audience: "couriers" as const,
    targetScreen: "orders",
    title: "تنبيه تشغيلي: أوقات الذروة الحالية ⚡",
    body: "يرجى التواجد بالقرب من المطابخ المركزية بالحي الحكومي لسرعة استلام وتوصيل الطلبات للعملاء.",
  },
  {
    label: "🍽️ شركاء المتاجر والمطابخ",
    type: "operational" as const,
    audience: "stores" as const,
    targetScreen: "kitchen",
    title: "متابعة وتأكيد جاهزية الطلبات 📋",
    body: "يرجى من مسؤولي المطابخ التحقق من شاشة التحضير وتسليم الوجبات للمناديب في الوقت المحدد.",
  },
];

export function NotificationCenter({ stores = [] }: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");

  // Form State
  const [title, setTitle] = useState("وجبات الإفطار الساخنة في الحي الحكومي 🥐");
  const [body, setBody] = useState("الفول، الفلافل، والمخبوزات الطازجة تصلك إلى مكتبك في الوزارات بالعاصمة الإدارية خلال 25 دقيقة فقط!");
  const [audience, setAudience] = useState<"all" | "clients" | "couriers" | "stores" | "single">("all");
  const [type, setType] = useState<"promo" | "operational" | "alert" | "general">("promo");
  const [targetScreen, setTargetScreen] = useState("offers");
  const [targetId, setTargetId] = useState("");
  const [targetUid, setTargetUid] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Submission State
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  // History State
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [filterAudience, setFilterAudience] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // الاستماع اللحظي لسجل الإشعارات
  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(40));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as NotificationItem[];
        setHistory(items);
      },
      (err) => {
        console.warn("Failed to listen to notifications history:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleApplyTemplate = (tmpl: (typeof TEMPLATES)[number]) => {
    setTitle(tmpl.title);
    setBody(tmpl.body);
    setAudience(tmpl.audience);
    setType(tmpl.type);
    setTargetScreen(tmpl.targetScreen);
    setFeedback(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFeedback({ success: false, message: "يرجى كتابة عنوان الإشعار ونصه." });
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يرجى تسجيل الدخول بحساب الإدارة.");

      const token = await user.getIdToken();
      const response = await fetch(apiUrl("/api/notifications"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          body,
          audience,
          type,
          targetScreen,
          targetId: targetId || undefined,
          targetUid: targetUid || undefined,
          imageUrl: imageUrl || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "تعذر إرسال الإشعار.");
      }

      setFeedback({
        success: true,
        message: data.message || "تم بث الإشعار بنجاح لجميع الأجهزة المستهدفة!",
        count: data.recipientCount,
      });
    } catch (err: any) {
      setFeedback({
        success: false,
        message: err.message || "حدث خطأ أثناء إرسال الإشعار.",
      });
    } finally {
      setSending(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (filterAudience !== "all" && item.audience !== filterAudience) return false;
    if (filterType !== "all" && item.type !== filterType) return false;
    return true;
  });

  const formatTimestamp = (ts: any) => {
    if (!ts) return "الآن";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat("ar-EG", {
      timeZone: "Africa/Cairo",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="notification-center-workspace" dir="rtl" style={{ padding: "1.25rem", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Header Bar */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          borderRadius: "16px",
          padding: "1.5rem 2rem",
          color: "#fff",
          marginBottom: "1.5rem",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <div style={{ background: "#F59E0B", color: "#fff", padding: "0.5rem", borderRadius: "10px", display: "flex" }}>
              <Bell size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>مركز الإشعارات الموحد</h2>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>
                بث التنبيهات الفورية والحملات التسويقية لتطبيقي الموبايل والويب عبر Firebase Cloud Messaging
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255,255,255,0.06)", padding: "4px", borderRadius: "10px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              transition: "all 0.2s",
              background: activeTab === "compose" ? "#F59E0B" : "transparent",
              color: activeTab === "compose" ? "#fff" : "#cbd5e1",
            }}
          >
            <Send size={16} /> إرسال إشعار فوري
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              transition: "all 0.2s",
              background: activeTab === "history" ? "#F59E0B" : "transparent",
              color: activeTab === "history" ? "#fff" : "#cbd5e1",
            }}
          >
            <History size={16} /> سجل الإشعارات ({history.length})
          </button>
        </div>
      </div>

      {activeTab === "compose" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", alignItems: "start" }}>
          {/* Main Form */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "1.5rem",
              boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Quick Templates Bar */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", color: "#475569" }}>
                <Sparkles size={16} color="#F59E0B" />
                <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>قوالب جاهزة سريعة:</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "20px",
                      padding: "0.35rem 0.85rem",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      color: "#334155",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#F59E0B")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Audience Selector */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.5rem" }}>
                  الجمهور المستهدف:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: "0.5rem" }}>
                  {[
                    { id: "all", label: "الجميع", icon: Users },
                    { id: "clients", label: "العملاء", icon: ShoppingBag },
                    { id: "couriers", label: "المناديب", icon: Bike },
                    { id: "stores", label: "المتاجر", icon: StoreIcon },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setAudience(id as any)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.75rem 0.5rem",
                        borderRadius: "10px",
                        border: audience === id ? "2px solid #F59E0B" : "1px solid #e2e8f0",
                        background: audience === id ? "#fffbeb" : "#f8fafc",
                        color: audience === id ? "#b45309" : "#64748b",
                        fontWeight: audience === id ? 700 : 500,
                        cursor: "pointer",
                        fontSize: "0.825rem",
                        transition: "all 0.15s",
                      }}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification Type & Target Screen */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem" }}>
                    نوع الإشعار:
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      background: "#fff",
                    }}
                  >
                    <option value="promo">🎁 عرض وتخفيض (تسويق)</option>
                    <option value="operational">⚡ تنبيه تشغيلي</option>
                    <option value="alert">🚨 إشعار عاجل</option>
                    <option value="general">📢 إعلان عام</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem" }}>
                    الإجراء عند النقر (Deep link):
                  </label>
                  <select
                    value={targetScreen}
                    onChange={(e) => setTargetScreen(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      background: "#fff",
                    }}
                  >
                    <option value="offers">🏷️ شاشة العروض والخصومات</option>
                    <option value="home">🏠 الصفحة الرئيسية</option>
                    <option value="orders">🛵 شاشة تتبع الطلبات</option>
                    <option value="store">🏪 متجر محدد</option>
                  </select>
                </div>
              </div>

              {targetScreen === "store" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem" }}>
                    اختر المتجر المستهدف:
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.65rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                    }}
                  >
                    <option value="">-- اختر المتجر --</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title Input */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>عنوان الإشعار:</label>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{title.length} / 120 حرف</span>
                </div>
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: خصم 20% على إفطار اليوم 🥐"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.925rem",
                  }}
                  required
                />
              </div>

              {/* Body Input */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1e293b" }}>نص وتفاصيل الإشعار:</label>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{body.length} / 500 حرف</span>
                </div>
                <textarea
                  rows={3}
                  value={body}
                  maxLength={500}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="اكتب رسالة الإشعار الترويجية أو التنبيهية بالتفصيل..."
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.925rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                  required
                />
              </div>

              {/* Optional Image URL */}
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem" }}>
                  رابط صورة البانر (اختياري):
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/promo-banner.jpg"
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              {/* Feedback Alert */}
              {feedback && (
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    fontSize: "0.875rem",
                    background: feedback.success ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${feedback.success ? "#a7f3d0" : "#fecaca"}`,
                    color: feedback.success ? "#065f46" : "#991b1b",
                  }}
                >
                  {feedback.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Send Button */}
              <button
                type="submit"
                disabled={sending}
                style={{
                  background: sending ? "#94a3b8" : "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0.9rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: sending ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)",
                  transition: "all 0.2s",
                }}
              >
                {sending ? (
                  <>
                    <Zap size={18} className="animate-spin" />
                    <span>جارٍ البث عبر قنوات FCM...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>بث الإشعار الآن</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Live Mobile Notification Preview */}
          <div>
            <div
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                borderRadius: "24px",
                padding: "2rem 1.5rem",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
                color: "#fff",
                border: "2px solid #334155",
                position: "sticky",
                top: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Smartphone size={20} color="#F59E0B" />
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#cbd5e1" }}>المعاينة الحية على هاتف العميل</span>
                </div>
                <span
                  style={{
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "#F59E0B",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Android & iOS
                </span>
              </div>

              {/* Simulated Phone Notification Banner */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "18px",
                  padding: "1rem",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                }}
              >
                {/* Notification Top Meta */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        background: "#F59E0B",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "0.75rem",
                        color: "#fff",
                      }}
                    >
                      ع
                    </div>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f8fafc" }}>طلبات العاصمة</span>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>• الآن</span>
                  </div>
                  <Bell size={14} color="#F59E0B" />
                </div>

                {/* Content */}
                <h4 style={{ margin: "0 0 0.35rem 0", fontSize: "0.95rem", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                  {title || "عنوان الإشعار يظهر هنا..."}
                </h4>
                <p style={{ margin: 0, fontSize: "0.825rem", color: "#cbd5e1", lineHeight: 1.45 }}>
                  {body || "تفاصيل ونص الإشعار الترويجي تظهر هنا بشكل مطابق لما سيصل لهواتف العملاء..."}
                </p>

                {/* Optional Banner Preview */}
                {imageUrl && (
                  <div style={{ marginTop: "0.75rem", borderRadius: "10px", overflow: "hidden", maxHeight: "140px" }}>
                    <img src={imageUrl} alt="Banner" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}

                {/* Simulated Action Tag */}
                <div
                  style={{
                    marginTop: "0.75rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.75rem",
                    color: "#F59E0B",
                  }}
                >
                  <span>اضغط للفتح: {targetScreen === "offers" ? "شاشة العروض" : targetScreen === "orders" ? "تتبع الطلب" : "الرئيسية"}</span>
                  <ExternalLink size={12} />
                </div>
              </div>

              {/* Audience & Delivery Info */}
              <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(0,0,0,0.25)", borderRadius: "12px", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <span style={{ color: "#94a3b8" }}>الجمهور الموجه له:</span>
                  <strong style={{ color: "#F59E0B" }}>
                    {audience === "all" ? "كافة المستخدمين (عام)" : audience === "clients" ? "العملاء فقط" : audience === "couriers" ? "المناديب فقط" : "المتاجر"}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>بروتوكول البث:</span>
                  <span style={{ color: "#38bdf8" }}>FCM Topic Broadcast + Firestore Realtime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div style={{ background: "#fff", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
          {/* Filters Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>سجل الإشعارات المرسلة مؤخراً</h3>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <select
                value={filterAudience}
                onChange={(e) => setFilterAudience(e.target.value)}
                style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.825rem" }}
              >
                <option value="all">كافة الجماهير</option>
                <option value="clients">العملاء</option>
                <option value="couriers">المناديب</option>
                <option value="stores">المتاجر</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.825rem" }}
              >
                <option value="all">كافة الأنواع</option>
                <option value="promo">عروض وترويج</option>
                <option value="operational">تنبيه تشغيلي</option>
                <option value="alert">إشعار عاجل</option>
                <option value="general">إعلان عام</option>
              </select>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
              <Bell size={40} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
              <p style={{ margin: 0, fontSize: "0.95rem" }}>لا توجد إشعارات سابقة مسجلة بهذه المعايير.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                    transition: "all 0.15s",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ flex: "1 1 300px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span
                        style={{
                          background: item.type === "promo" ? "#fef3c7" : item.type === "operational" ? "#e0f2fe" : "#fee2e2",
                          color: item.type === "promo" ? "#b45309" : item.type === "operational" ? "#0369a1" : "#b91c1c",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {item.type === "promo" ? "عروض وترويج" : item.type === "operational" ? "تشغيلي" : "عاجل"}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        موجه إلى:{" "}
                        <strong style={{ color: "#334155" }}>
                          {item.audience === "all" ? "الجميع" : item.audience === "clients" ? "العملاء" : item.audience === "couriers" ? "المناديب" : "المتاجر"}
                        </strong>
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>• {formatTimestamp(item.createdAt)}</span>
                    </div>

                    <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.95rem", fontWeight: 700, color: "#1e293b" }}>{item.title}</h4>
                    <p style={{ margin: 0, fontSize: "0.825rem", color: "#475569", lineHeight: 1.4 }}>{item.body}</p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTitle(item.title);
                        setBody(item.body);
                        setAudience(item.audience || "all");
                        setType(item.type || "general");
                        if (item.targetScreen) setTargetScreen(item.targetScreen);
                        setActiveTab("compose");
                      }}
                      title="استخدام كقالب جديد"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        padding: "0.45rem 0.85rem",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        color: "#334155",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <RotateCcw size={14} /> إعادة استخدام
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
