// A tab opened before deployment can still request the previous hashed CSS/JS.
// Fetch the current document once, without weakening MIME checks on missing assets.
const recoveryKey = 'sangoub:asset-recovery';
function showRecovery() {
  if (document.getElementById('asset-recovery')) return;
  const panel = document.createElement('section');
  panel.id = 'asset-recovery';
  panel.dir = 'rtl';
  panel.setAttribute('role', 'alert');
  panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;gap:18px;padding:24px;background:#f8fafb;color:#102e3c;text-align:center;font:16px/1.8 system-ui,sans-serif';
  const text = document.createElement('p');
  text.textContent = 'تعذر تحميل ملفات الصفحة. تحقق من اتصالك ثم حدّث الصفحة.';
  const button = document.createElement('button');
  button.textContent = 'تحديث الصفحة';
  button.style.cssText = 'min-height:44px;padding:10px 24px;border:0;border-radius:12px;background:#c84400;color:white;font:inherit;cursor:pointer';
  button.onclick = () => window.location.reload();
  panel.append(text, button);
  document.body.append(panel);
}
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  try {
    const last = Number(sessionStorage.getItem(recoveryKey) || 0);
    if (Number.isFinite(last) && Date.now() - last < 60000) { showRecovery(); return; }
    sessionStorage.setItem(recoveryKey, String(Date.now()));
    window.location.reload();
  } catch {
    // Storage may be blocked; offer an explicit retry instead of risking a reload loop.
    showRecovery();
  }
});
