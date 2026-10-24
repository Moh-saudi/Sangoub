import type { VisitorEvent, VisitorSource } from '../types/siteAnalytics';
const ID_KEY = 'capital-site-visitor-v1';
export const VISITOR_DAY_KEY = 'capital-site-visitor-day-v2';
let memoryId = '';
export function visitorDay() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function classifyVisitorSource(href: string, referrer: string): VisitorSource {
 const url = new URL(href);
 const tagged = url.searchParams.get('utm_source')?.toLowerCase();
 if (['facebook','fb'].includes(tagged || '')) return 'facebook';
 if (['whatsapp','wa'].includes(tagged || '')) return 'whatsapp';
 if (['instagram','ig'].includes(tagged || '')) return 'instagram';
 if (['google','bing','search'].includes(tagged || '')) return 'search';
 if (tagged) return 'other';
 let ref: URL;try { ref = new URL(referrer); } catch { return 'direct'; }
 if (ref.origin === url.origin) return 'direct';
 const host = ref.hostname;
 const matches = (domain: string) => host === domain || host.endsWith('.' + domain);
 if (matches('facebook.com') || matches('fb.com')) return 'facebook';
 if (matches('whatsapp.com') || matches('wa.me')) return 'whatsapp';
 if (matches('instagram.com')) return 'instagram';
 if (matches('google.com') || matches('google.com.eg') || matches('bing.com') || matches('duckduckgo.com')) return 'search';
 return 'other';
}
let firstSource: VisitorSource | undefined, sourceDay = '';
function source() {
 if (sourceDay !== visitorDay()) { firstSource = undefined; sourceDay = visitorDay(); }
 if (firstSource) return firstSource;
 const key = 'capital-site-source-' + visitorDay();
 try { const stored = sessionStorage.getItem(key); if (['facebook','whatsapp','instagram','search','other','direct'].includes(stored || '')) return firstSource = stored as VisitorSource; } catch { /* Memory fallback. */ }
 firstSource = classifyVisitorSource(location.href, document.referrer);
 try { sessionStorage.setItem(key, firstSource); } catch { /* Memory fallback. */ }
 return firstSource;
}
export async function recordSiteAnalytics(event?: VisitorEvent) {
 try {
  let id = memoryId;try { id = localStorage.getItem(ID_KEY) || id; } catch { /* Memory fallback. */ }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) id = crypto.randomUUID();
  memoryId = id;try { localStorage.setItem(ID_KEY, id); } catch { /* Memory fallback. */ }
  const day = visitorDay();
  const response = await fetch('/api/visitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: id, source: source(), ...(event ? {event} : {}) }), keepalive: true, signal: AbortSignal.timeout(10000) });
  if (response.ok) { try { localStorage.setItem(VISITOR_DAY_KEY, day); } catch { /* Memory fallback. */ } }
  return response.ok;
 } catch { return false; }
}
const recorded = new Set<string>(), pending = new Set<string>();
/** Unique browser/day events only; no customer, order, product, address, or payment data. */
export function trackSiteEvent(event: VisitorEvent) {
 const key = visitorDay() + ':' + event;
 if (recorded.has(key) || pending.has(key)) return;
 pending.add(key);
 void recordSiteAnalytics(event).then(ok => { pending.delete(key); if (ok) recorded.add(key); });
}
