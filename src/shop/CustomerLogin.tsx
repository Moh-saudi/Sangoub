import { useState } from "react";
import { supabase, signInWithSupabaseGoogle } from "../lib/supabase";
import { useShop } from "./ShopContext";
import { customerMessage } from "../utils/customerMessage";

export function CustomerLogin() {
  const shop = useShop();
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");

  async function run(operation: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (e: any) {
      const msg = e?.message || "";
      if (/invalid login credentials/i.test(msg)) {
        setError("بيانات الدخول غير صحيحة. راجع البريد وكلمة المرور.");
      } else if (/user already registered/i.test(msg)) {
        setError("هذا البريد مسجل بالفعل. يمكنك تسجيل الدخول مباشرة.");
      } else if (/password should be at least/i.test(msg)) {
        setError("كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.");
      } else {
        setError(
          customerMessage(
            e,
            "تعذر تسجيل الدخول. راجع بياناتك أو جرّب طريقة أخرى.",
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shop-login shop-panel">
      <h2>حسابك لإتمام الطلب</h2>
      <p>تصفح وأضف للسلة بحرية. سجّل الدخول لتأكيد الطلب ومتابعته من حسابك.</p>
      {error && (
        <p role="alert" className="shop-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {shop.identity && !shop.profile ? (
        <>
          <p>أكد بريدك الإلكتروني أولًا، ثم اضغط التحقق.</p>
          <button
            className="shop-primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await supabase.auth.refreshSession();
                shop.refreshAccount();
                setNotice("تم تحديث حالة الحساب.");
              })
            }
          >
            تحققت من بريدي
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const userEmail = shop.identity?.email || email;
                if (userEmail) {
                  await supabase.auth.resend({
                    type: "signup",
                    email: userEmail,
                  });
                }
                setNotice("أرسلنا رابط تأكيد البريد.");
              })
            }
          >
            إعادة إرسال رابط التأكيد
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await supabase.auth.signOut();
                shop.refreshAccount();
              })
            }
          >
            استخدام حساب آخر
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="shop-primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await signInWithSupabaseGoogle();
              })
            }
          >
            المتابعة بحساب Google
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (signup) {
                  const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                      data: { full_name: name },
                    },
                  });
                  if (error) throw error;
                  if (data.session) {
                    setNotice("تم إنشاء الحساب بنجاح وتم تسجيل دخولك.");
                    shop.refreshAccount();
                  } else {
                    setNotice("أرسلنا رابط تأكيد البريد، وسلتك محفوظة.");
                  }
                } else {
                  const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                  });
                  if (error) throw error;
                  shop.refreshAccount();
                }
              });
            }}
          >
            {signup && (
              <label>
                الاسم
                <input
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              البريد الإلكتروني
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              كلمة المرور
              <input
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="shop-primary" disabled={busy}>
              {busy
                ? "جارٍ المتابعة…"
                : signup
                  ? "إنشاء حساب عميل"
                  : "دخول العميل"}
            </button>
          </form>
          <div className="shop-login-links">
            <button
              disabled={busy}
              onClick={() => setSignup((value) => !value)}
            >
              {signup ? "لدي حساب بالفعل" : "إنشاء حساب جديد"}
            </button>
            <button
              disabled={busy || !email}
              onClick={() =>
                void run(async () => {
                  const { error } = await supabase.auth.resetPasswordForEmail(email);
                  if (error) throw error;
                  setNotice("إذا كان البريد مسجلًا، ستصلك رسالة استعادة.");
                })
              }
            >
              نسيت كلمة المرور
            </button>
          </div>
        </>
      )}
    </section>
  );
}
