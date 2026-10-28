import type { ReactNode } from 'react';
import './admin-login.css';

export function AdminLoginLayout({ children }: { children: ReactNode }) {
  return <main id="admin-content" tabIndex={-1} className="admin-signin-main">
    <aside className="admin-signin-scene" aria-label="سنجوب للتوصيل في العاصمة الإدارية">
      <h1>إدارة التوصيل<br /><span>بذكاء</span></h1>
      <p>كل الطلبات، المتاجر، وفريق التوصيل.<br />في مكان واحد.</p>
    </aside>
    <section className="admin-signin-card" aria-label="دخول الإدارة">{children}</section>
  </main>;
}

export function GoogleSignInMark() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.97-3.39.97-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93a6 6 0 0 1 0-3.86V7.48H3.05a10 10 0 0 0 0 9.04l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.59 9.59 0 0 0 12 2a10 10 0 0 0-8.95 5.48l3.34 2.59C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>;
}
