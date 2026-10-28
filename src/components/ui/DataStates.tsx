import { LoaderCircle, AlertCircle, Inbox } from 'lucide-react';
export function LoadingState({
  message = 'جارٍ تحميل البيانات…'
}: {
  message?: string;
}) {
  return <div className="data-state" role="status"><LoaderCircle className="animate-spin" aria-hidden="true" /><p>{message}</p></div>;
}
export function ErrorState({
  message,
  retry
}: {
  message: string;
  retry?: () => void;
}) {
  return <div className="data-state data-state-error" role="alert"><AlertCircle aria-hidden="true" /><p>{message}</p>{retry && <button type="button" onClick={retry}>إعادة المحاولة</button>}</div>;
}
export function EmptyState({
  message
}: {
  message: string;
}) {
  return <div className="data-state"><Inbox aria-hidden="true" /><p>{message}</p></div>;
}
export function ConnectionState({
  online,
  live,
  updatedAt
}: {
  online: boolean;
  live: boolean;
  updatedAt: string;
}) {
  return <p className="connection-state" role="status">{!online ? 'أنت غير متصل؛ البيانات المعروضة قديمة.' : live ? 'تحديث لحظي متصل' : 'التحديث اللحظي غير متصل؛ يجري التحقق دوريًا.'}{updatedAt && ` آخر تحقق: ${new Date(updatedAt).toLocaleTimeString('ar-EG')}`}</p>;
}
