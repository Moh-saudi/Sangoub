import { useEffect } from 'react';

const ID_KEY = 'capital-site-visitor-v1', DAY_KEY = 'capital-site-visitor-day-v1';
let memoryId = '', recordedDay = '', sending = false;
function dayInCairo() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
/** Counts this browser once per Cairo day, with a stable anonymous ID and no profile data. */
export function useVisitorCounter() {
 useEffect(() => {
  let active = true;
  async function record() {
   if (!active || document.hidden || sending) return;
   const day = dayInCairo();
   let id = memoryId;
   try { id = localStorage.getItem(ID_KEY) || id; if (localStorage.getItem(DAY_KEY) === day) return; } catch { /* Tab-memory fallback. */ }
   if (recordedDay === day) return;
   if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) id = crypto.randomUUID();
   memoryId = id;
   try { localStorage.setItem(ID_KEY, id); } catch { /* Counting remains approximate when storage is blocked. */ }
   sending = true;
   try {
    const response = await fetch('/api/visitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: id }), signal: AbortSignal.timeout(10000) });
    if (response.ok) { recordedDay = day; try { localStorage.setItem(DAY_KEY, day); } catch { /* In-memory fallback. */ } }
   } catch { /* Analytics must never interrupt ordering; retry while the page remains open. */ }
   finally { sending = false; }
  }
  const timer = window.setTimeout(record, 1500), interval = window.setInterval(record, 60000);
  document.addEventListener('visibilitychange', record);
  return () => { active = false; window.clearTimeout(timer); window.clearInterval(interval); document.removeEventListener('visibilitychange', record); };
 }, []);
}
