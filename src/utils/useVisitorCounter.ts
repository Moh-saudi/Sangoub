import { useEffect } from 'react';
import { recordSiteAnalytics, visitorDay, VISITOR_DAY_KEY } from './siteAnalytics';
let recordedDay = '', sending = false;
export function useVisitorCounter() {
 useEffect(() => {
  let active = true;
  async function record() {
   if (!active || document.hidden || sending) return;
   const day = visitorDay();
   try { if (localStorage.getItem(VISITOR_DAY_KEY) === day) return; } catch { /* Memory fallback. */ }
   if (recordedDay === day) return;
   sending = true;
   try { if (await recordSiteAnalytics()) recordedDay = day; } finally { sending = false; }
  }
  const timer = window.setTimeout(record, 1500), interval = window.setInterval(record, 60000);
  document.addEventListener('visibilitychange', record);
  return () => { active = false; window.clearTimeout(timer); window.clearInterval(interval); document.removeEventListener('visibilitychange', record); };
 }, []);
}
