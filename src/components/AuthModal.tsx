import React, { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import {
  auth,
  signInWithFirebaseGoogle,
  signOutFromFirebase,
  syncUserProfileToFirestore,
  isVerifiedIdentity,
} from "../lib/firebase.ts";
import type { Profile, Store } from "../types/index.ts";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Profile;
  stores: Store[];
  onLoginSuccess: (profile: Profile) => void;
  onLogout: () => void;
  checkoutInterceptNotice?: string | null;
}
export const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout,
  checkoutInterceptNotice,
}) => {
  const [signup, setSignup] = useState(false);
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const captcha = useRef<RecaptchaVerifier | null>(null);
  useEffect(() => {
    if (!isOpen) {
      captcha.current?.clear();
      captcha.current = null;
      setConfirmation(null);
    }
  }, [isOpen]);
  useEffect(() => () => captcha.current?.clear(), []);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (e: any) {
      const messages: Record<string, string> = {
        "auth/unauthorized-domain":
          "أضف نطاق الموقع إلى Authorized domains في Firebase Authentication.",
        "auth/operation-not-allowed":
          "طريقة الدخول غير مفعّلة في Firebase Authentication.",
        "auth/popup-blocked": "اسمح بالنوافذ المنبثقة ثم أعد المحاولة.",
        "auth/popup-closed-by-user": "أُغلقت نافذة Google قبل إكمال الدخول.",
        "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
        "auth/email-already-in-use": "البريد مسجل بالفعل. استخدم تسجيل الدخول.",
        "auth/weak-password": "استخدم كلمة مرور قوية من ٨ أحرف على الأقل.",
        "auth/invalid-verification-code": "رمز التحقق غير صحيح.",
        "auth/too-many-requests":
          "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
      };
      setError(messages[e.code] || e.message || "تعذر تسجيل الدخول.");
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    if (!isVerifiedIdentity(auth.currentUser)) {
      await signOutFromFirebase();
      throw new Error(
        "أكد بريدك من الرسالة المرسلة إليك، ثم سجّل الدخول مجددًا.",
      );
    }
    const profile = await syncUserProfileToFirestore(auth.currentUser!);
    onLoginSuccess(profile);
    onClose();
  };
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/65 flex items-center justify-center p-4"
      dir="rtl"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="bg-white text-slate-900 rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4"
      >
        <div className="flex justify-between items-center">
          <h2 id="auth-title" className="font-bold text-lg">
            {signup ? "إنشاء حساب" : "تسجيل الدخول"}
          </h2>
          <button onClick={onClose} aria-label="إغلاق">
            <X />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          حسابك محمي بمصادقة Firebase. صلاحيات الإدارة يمنحها مسؤول المشروع فقط.
        </p>
        {checkoutInterceptNotice && (
          <p className="text-sm bg-orange-50 p-3 rounded-xl">
            {checkoutInterceptNotice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="text-sm text-red-700 bg-red-50 p-3 rounded-xl"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="text-sm text-blue-800 bg-blue-50 p-3 rounded-xl"
          >
            {notice}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full border rounded-xl p-3 font-bold disabled:opacity-50"
          onClick={() =>
            run(async () => {
              const profile = await signInWithFirebaseGoogle();
              onLoginSuccess(profile);
              onClose();
            })
          }
        >
          متابعة باستخدام Google
        </button>
        <div className="flex gap-3 text-sm">
          <button
            disabled={busy}
            className={method === "email" ? "text-orange-700 font-bold" : ""}
            onClick={() => setMethod("email")}
          >
            البريد وكلمة المرور
          </button>
          <button
            disabled={busy}
            className={method === "phone" ? "text-orange-700 font-bold" : ""}
            onClick={() => setMethod("phone")}
          >
            رقم الهاتف
          </button>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (method === "phone") {
                if (confirmation) {
                  await confirmation.confirm(code);
                  await finish();
                } else {
                  captcha.current ||= new RecaptchaVerifier(
                    auth,
                    "auth-recaptcha",
                    { size: "normal" },
                  );
                  setConfirmation(
                    await signInWithPhoneNumber(auth, phone, captcha.current),
                  );
                  setNotice("تم إرسال رمز التحقق إلى هاتفك.");
                }
                return;
              }
              if (signup) {
                const result = await createUserWithEmailAndPassword(
                  auth,
                  email,
                  password,
                );
                await updateProfile(result.user, { displayName: name });
                await sendEmailVerification(result.user);
                await signOutFromFirebase();
                setSignup(false);
                setNotice(
                  "تم إنشاء الحساب. افتح رسالة تأكيد البريد، ثم سجّل الدخول.",
                );
              } else {
                const result = await signInWithEmailAndPassword(
                  auth,
                  email,
                  password,
                );
                if (!result.user.emailVerified) {
                  await sendEmailVerification(result.user);
                }
                await finish();
              }
            });
          }}
        >
          {method === "email" ? (
            <>
              {signup && (
                <label className="block text-sm">
                  الاسم
                  <input
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded-xl p-3 mt-1"
                    autoComplete="name"
                  />
                </label>
              )}
              <label className="block text-sm">
                البريد الإلكتروني
                <input
                  required
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-xl p-3 mt-1"
                />
              </label>
              <label className="block text-sm">
                كلمة المرور
                <input
                  required
                  type="password"
                  minLength={signup ? 8 : 1}
                  autoComplete={signup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-xl p-3 mt-1"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm">
                رقم الهاتف بكود الدولة
                <input
                  required
                  type="tel"
                  dir="ltr"
                  placeholder="+201012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border rounded-xl p-3 mt-1"
                />
              </label>
              {confirmation && (
                <label className="block text-sm">
                  رمز SMS
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full border rounded-xl p-3 mt-1"
                  />
                </label>
              )}
            </>
          )}
          <div
            id="auth-recaptcha"
            hidden={method !== "phone" || !!confirmation}
          />
          <button
            disabled={busy}
            type="submit"
            className="w-full bg-orange-600 text-white rounded-xl p-3 flex justify-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 className="animate-spin" size={18} />}
            {method === "phone"
              ? confirmation
                ? "تأكيد الرمز"
                : "إرسال رمز التحقق"
              : signup
                ? "إنشاء حساب وتأكيد البريد"
                : "دخول"}
          </button>
        </form>
        {method === "email" && (
          <div className="flex justify-between text-xs">
            <button disabled={busy} onClick={() => setSignup(!signup)}>
              {signup ? "لديك حساب؟ تسجيل الدخول" : "إنشاء حساب جديد"}
            </button>
            <button
              disabled={busy || !email}
              onClick={() =>
                run(async () => {
                  await sendPasswordResetEmail(auth, email);
                  setNotice(
                    "إذا كان البريد مسجلًا، ستصلك رسالة استعادة كلمة المرور.",
                  );
                })
              }
            >
              نسيت كلمة المرور؟
            </button>
          </div>
        )}
        {!currentUser.isGuest && (
          <button
            disabled={busy}
            className="text-red-700 text-sm"
            onClick={() =>
              run(async () => {
                await signOutFromFirebase();
                onLogout();
                onClose();
              })
            }
          >
            تسجيل الخروج
          </button>
        )}
      </section>
    </div>
  );
};
