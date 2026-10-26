import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
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
    } catch (e) {
      setError(
        customerMessage(
          e,
          "تعذر تسجيل الدخول. راجع بياناتك أو جرّب طريقة أخرى.",
        ),
      );
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
                await auth.currentUser?.reload();
                await auth.currentUser?.getIdToken(true);
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
                if (auth.currentUser)
                  await sendEmailVerification(auth.currentUser);
                setNotice("أرسلنا رابط تأكيد البريد.");
              })
            }
          >
            إعادة إرسال رابط التأكيد
          </button>
          <button disabled={busy} onClick={() => void run(() => signOut(auth))}>
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
              void run(() => signInWithPopup(auth, googleProvider))
            }
          >
            المتابعة بحساب Google
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (signup) {
                  const result = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password,
                  );
                  await updateProfile(result.user, { displayName: name });
                  await sendEmailVerification(result.user);
                  setNotice("أرسلنا رابط تأكيد البريد، وسلتك محفوظة.");
                } else await signInWithEmailAndPassword(auth, email, password);
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
                  await sendPasswordResetEmail(auth, email);
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
