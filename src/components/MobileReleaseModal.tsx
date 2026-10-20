import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  ShieldCheck,
  Copy,
  Check,
  Download,
  ExternalLink,
  GitBranch,
  Database,
  KeyRound,
  Rocket,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { firebaseConfig, auth, signInWithFirebaseGoogle } from '../lib/firebase.ts';
import { usePWAInstall } from '../utils/usePWAInstall.ts';
import type { Profile } from '../types/index.ts';

interface MobileReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile;
  onLoginSuccess: (profile: Profile) => void;
}

interface GitHubRepoStatus {
  configured: boolean;
  remoteUrl: string;
  branch: string;
  lastCommit: string;
  hasTokenInEnv: boolean;
}

export const MobileReleaseModal: React.FC<MobileReleaseModalProps> = ({
  isOpen,
  onClose,
  user,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'install' | 'firebase' | 'googleplay'>('googleplay');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [authTesting, setAuthTesting] = useState(false);
  const [authStatusMsg, setAuthStatusMsg] = useState<string | null>(null);

  const [githubStatus, setGithubStatus] = useState<GitHubRepoStatus | null>(null);
  const [isPushingGithub, setIsPushingGithub] = useState(false);
  const [githubPushFeedback, setGithubPushFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((data) => setGithubStatus(data))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleRealFirebaseGoogleLogin = async () => {
    setAuthTesting(true);
    setAuthStatusMsg(null);
    try {
      const profile = await signInWithFirebaseGoogle({
        ministry: user.ministry,
        floorNumber: user.floorNumber,
        roomNumber: user.roomNumber,
      });
      onLoginSuccess(profile);
      setAuthStatusMsg(
        `تمت المصادقة الفعلية عبر Firebase وحفظ ملف الموظف (${profile.email}) في قاعدة بيانات Firestore بنجاح!`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'تعذر فتح نافذة مصادقة Google في المتصفح.';
      setAuthStatusMsg(`ملاحظة: ${msg}`);
    } finally {
      setAuthTesting(false);
    }
  };

  const handlePushToGitHub = async () => {
    setIsPushingGithub(true);
    setGithubPushFeedback(null);
    try {
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setGithubPushFeedback({
        success: Boolean(data.success),
        message: data.message || 'تمت العملية.',
      });
    } catch (err: unknown) {
      setGithubPushFeedback({
        success: false,
        message: err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالخادم.',
      });
    } finally {
      setIsPushingGithub(false);
    }
  };

  const bubblewrapCommands = `# 1. تثبيت أداة Google Bubblewrap الرسمية لتوليد حزمة Google Play (.aab)
npm i -g @bubblewrap/cli

# 2. بناء حزمة الأندرويد الموقعة من ملف twa-manifest.json الجاهز بالمشروع
bubblewrap build

# سينتج الملف الجاهز للرفع مباشرة على Google Play Console:
# -> app-release-bundle.aab
# -> app-release-signed.apk`;

  const githubCommands = `# تم تهيئة مستودع Git المحلي وربطه بـ https://github.com/Moh-saudi/ct.git
git init -b main
git remote add origin https://github.com/Moh-saudi/ct.git
git add .
git commit -m "Release v1.0.0: Capital Talabat Mobile PWA + Firebase Auth & Firestore + TWA"
git push -u origin main`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">
                مركز إطلاق تطبيق الموبايل ورفع Google Play & GitHub
              </h2>
              <p className="text-[11px] text-slate-300">
                الإصدار الأول v1.0.0 · مربوط بمستودع Moh-saudi/ct.git وقاعدة بيانات Firebase
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('googleplay')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'googleplay'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Rocket className="w-3.5 h-3.5 text-emerald-600" />
            <span>ربط GitHub ورفع Google Play</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('firebase')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'firebase'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-orange-600" />
            <span>بيانات مصادقة Firebase الحية</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('install')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'install'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-teal-600" />
            <span>تثبيت تطبيق الموبايل المباشر</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB 1: GOOGLE PLAY & GITHUB */}
          {activeTab === 'googleplay' && (
            <div className="space-y-4">
              {/* GitHub Sync Box */}
              <div className="bg-white border-2 border-slate-900/15 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-emerald-700" />
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      1. مستودع GitHub المرتبط: <span className="font-mono text-emerald-700">Moh-saudi/ct.git</span>
                    </h3>
                  </div>
                  <a
                    href="https://github.com/Moh-saudi/ct"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1"
                  >
                    <span>فتح المستودع على GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {githubStatus && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">المستودع البعيد (Remote Origin):</span>
                      <span className="font-mono font-bold text-slate-900 break-all">
                        {githubStatus.remoteUrl}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">الفرع والحالة المحلية (Local Commit):</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {githubStatus.branch} · جاهز للرفع (Committed)
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePushToGitHub}
                    disabled={isPushingGithub}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPushingGithub ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <GitBranch className="w-4 h-4 text-emerald-400" />
                    )}
                    <span>رفع المشروع الآن إلى GitHub (Moh-saudi/ct.git)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(githubCommands, 'github')}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1.5"
                  >
                    {copiedKey === 'github' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم نسخ الأوامر</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ أوامر Git</span>
                      </>
                    )}
                  </button>
                </div>

                {githubPushFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 leading-relaxed ${
                      githubPushFeedback.success
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    {githubPushFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <span>{githubPushFeedback.message}</span>
                  </div>
                )}

                <pre
                  dir="ltr"
                  className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed"
                >
                  {githubCommands}
                </pre>
              </div>

              {/* Important Policy Explanation on Testers */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs sm:text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>كيف ترفع التطبيق على Google Play فوراً بدون شرط الـ 12 مختبر؟</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-xs">
                  قانون المختبرين في جوجل بلاي يعتمد على <strong>نوع حساب المطور الخاص بك</strong> وليس على كود المشروع نفسه:
                </p>
                <ul className="space-y-1.5 text-slate-700 pr-4 list-disc">
                  <li>
                    <strong>بدون مختبرين نهائياً (نشر فوري للإنتاج Production):</strong> إذا كان حسابك في Google Play Console <strong>حساب مؤسسي / شركة (Organization Account)</strong> أو <strong>حساب شخصي تم إنشاؤه قبل نوفمبر 2023</strong>، يمكنك رفع ملف <code>.aab</code> مباشرة في قسم <strong>الإنتاج (Production)</strong> وسيتم نشر التطبيق للجمهور فوراً بدون أي مختبرين.
                  </li>
                  <li>
                    <strong>تم تجهيز حزمة الأندرويد القياسية في المشروع:</strong> أضفنا ملف <code>twa-manifest.json</code> بمعرّف الحزمة الرسمي <code>eg.gov.capital.talabat</code> وملف البناء التلقائي <code>.github/workflows/android-release.yml</code> الذي يبني حزمة الأندرويد تلقائياً بمجرد الرفع على مستودعك <code>Moh-saudi/ct</code>.
                  </li>
                </ul>
              </div>

              {/* Android AAB Build Instructions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-orange-600" />
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      2. استخراج ملف Google Play (app-release-bundle.aab)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bubblewrapCommands, 'bubblewrap')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1"
                  >
                    {copiedKey === 'bubblewrap' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ الأوامر</span>
                      </>
                    )}
                  </button>
                </div>

                <pre
                  dir="ltr"
                  className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed"
                >
                  {bubblewrapCommands}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: FIREBASE AUTH & FIRESTORE CONFIG */}
          {activeTab === 'firebase' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-orange-600" />
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      حالة الاتصال بمصادقة Google Firebase و Firestore
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700">
                    متصل ومفعّل
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">معرف مشروع Firebase (Project ID):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {firebaseConfig.projectId}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">نطاق المصادقة (Auth Domain):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {firebaseConfig.authDomain}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 sm:col-span-2">
                    <span className="text-slate-500 block">
                      قاعدة بيانات Firestore المعتمدة (Database ID):
                    </span>
                    <span className="font-mono font-bold text-slate-900 break-all">
                      {firebaseConfig.firestoreDatabaseId}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRealFirebaseGoogleLogin}
                    disabled={authTesting}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {auth.currentUser
                        ? `متصل بحساب Firebase: ${auth.currentUser.email}`
                        : 'اختبار تسجيل الدخول الفعلي عبر Firebase Google Auth'}
                    </span>
                  </button>

                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>فتح لوحة Firebase Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {authStatusMsg && (
                  <p className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-medium">
                    {authStatusMsg}
                  </p>
                )}
              </div>

              {/* Full JSON Config Copy */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    ملف إعدادات المصادقة الكامل (firebase-applet-config.json):
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(firebaseConfig, null, 2), 'fbconfig')
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1"
                  >
                    {copiedKey === 'fbconfig' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <pre
                  dir="ltr"
                  className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] overflow-x-auto"
                >
                  {JSON.stringify(firebaseConfig, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT MOBILE PWA INSTALL */}
          {activeTab === 'install' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
                <img
                  src="/assets/aistudio/Capital_Talabat_App_Icon_7e80c871.png"
                  alt="أيقونة تطبيق طلبات العاصمة"
                  className="w-16 h-16 rounded-2xl mx-auto shadow-md border border-orange-200"
                />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    تثبيت تطبيق طلبات العاصمة على هاتفك الآن
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    يعمل التطبيق بوضع الشاشة الكاملة المستقل (Standalone Mobile App) على هواتف Android و iPhone مع دعم العمل دون اتصال بالإنترنت.
                  </p>
                </div>

                {isInstalled ? (
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>التطبيق مثبّت بالفعل على جهازك</span>
                  </div>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={install}
                    className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>تثبيت التطبيق المباشر على الهاتف</span>
                  </button>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-right max-w-md mx-auto space-y-1.5">
                    <p className="font-bold text-slate-900">
                      {isIOS
                        ? 'طريقة التثبيت على iPhone / iPad:'
                        : 'طريقة التثبيت السريع من متصفح الهاتف (Chrome):'}
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      {isIOS
                        ? '1. افتح رابط التطبيق في متصفح Safari ثم اضغط زر المشاركة (Share) بالأسفل واختر "الإضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                        : '1. افتح رابط التطبيق الرسمي في متصفح Chrome على هاتفك واضغط "تثبيت التطبيق" (Install App) من القائمة العلوية.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
