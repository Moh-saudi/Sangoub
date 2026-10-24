import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import { adminServices } from '../server/firebaseAdmin.ts';
import handler from '../api/visitors.ts';
import { cairoVisitorDay } from '../server/handlers/visitors.ts';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local demo emulators required');
process.env.FIREBASE_PROJECT_ID = 'demo-capital-talabat';process.env.FIREBASE_DATABASE_ID = '(default)';
const services = adminServices(), app = initializeApp({ apiKey: 'demo', projectId: 'demo-capital-talabat' }, 'visitors-test');
const auth = getAuth(app);connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });let token = '';
async function call(method: string, body: any = {}, extra: object = {}) {
 let status = 200, result: any;
 await handler({ method, body, headers: { origin: 'http://localhost:3105', host: 'localhost:3105', 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 VisitorTest', ...extra } }, { setHeader() {}, status(v: number) { status = v;return this; }, json(v: any) { result = v;return this; } });
 return { status, result };
}
before(async () => {
 const user = await services.auth.createUser({ email: 'visitor-admin@example.com', emailVerified: true, password: 'TestPassword123!' });
 await services.db.doc('admins/' + user.uid).set({ enabled: true });token = await (await signInWithEmailAndPassword(auth, user.email!, 'TestPassword123!')).user.getIdToken();
});
after(async () => { await deleteApp(app); });
test('statistics require admin auth, anonymous writes validate origin and strict payload', async () => {
 assert.equal((await call('GET')).status, 401);
 assert.equal((await call('POST', { visitorId: randomUUID() }, { origin: 'https://external.example' })).status, 403);
 assert.equal((await call('POST', { visitorId: randomUUID() }, { 'content-type': 'text/plain' })).status, 415);
 for (const body of [{ visitorId: '../bad' }, { visitorId: randomUUID(), name: 'not collected' }, { visitorId: randomUUID(), day: '2000-01-01' }]) assert.equal((await call('POST', body)).status, 400);
 assert.equal((await call('DELETE')).status, 405);
});
test('parallel retries, repeated visits and returning browsers never inflate the unique counts', async () => {
 const visitorId = randomUUID();
 const outcomes = await Promise.all(Array.from({ length: 4 }, () => call('POST', { visitorId })));
 assert.ok(outcomes.every(item => item.status === 200));
 let stats = (await call('GET', {}, { authorization: 'Bearer ' + token })).result;
 assert.equal(stats.total, 1);assert.equal(stats.today, 1);assert.ok(stats.startedAt);
 const visitor = services.db.doc('siteVisitors/' + createHash('sha256').update(visitorId).digest('hex'));
 assert.deepEqual((await visitor.get()).data(), { lastDay: cairoVisitorDay(), source: 'direct', events: [] });
 // Model an existing browser last seen yesterday, with today's counter reset.
 await visitor.update({ lastDay: '2000-01-01' });await services.db.doc('siteMetricDays/' + cairoVisitorDay()).set({ visitors: 0 });
 await call('POST', { visitorId });stats = (await call('GET', {}, { authorization: 'Bearer ' + token })).result;
 assert.equal(stats.total, 1);assert.equal(stats.today, 1);
 await call('POST', { visitorId: randomUUID() });stats = (await call('GET', {}, { authorization: 'Bearer ' + token })).result;
 assert.equal(stats.total, 2);assert.equal(stats.today, 2);
 await call('POST', { visitorId: randomUUID() }, { 'user-agent': 'facebookexternalhit/1.1' });
 assert.equal((await call('GET', {}, { authorization: 'Bearer ' + token })).result.total, 2);
});
test('day boundary uses Cairo rather than UTC', () => {
 assert.equal(cairoVisitorDay(new Date('2026-10-24T22:30:00Z')), '2026-10-25');
});

test('sources and event stages are unique per browser/day, support legacy visitors, and cannot expose order data', async () => {
 const visitorId=randomUUID();
 await services.db.doc('siteVisitors/'+createHash('sha256').update(visitorId).digest('hex')).set({lastDay:cairoVisitorDay()});
 const before=(await call('GET',{}, {authorization:'Bearer '+token})).result;
 const priorSource=before.days[6].sources.facebook||0, priorEvents=before.days[6].events.mascot_open||0;
 await Promise.all(Array.from({length:3},()=>call('POST',{visitorId,source:'facebook',event:'mascot_open'})));
 await call('POST',{visitorId,source:'whatsapp',event:'breakfast'});
 await call('POST',{visitorId,source:'facebook',event:'review_breakfast'});
 await call('POST',{visitorId,source:'facebook',event:'whatsapp_breakfast'});
 const after=(await call('GET',{}, {authorization:'Bearer '+token})).result;
 assert.equal(after.total,before.total);assert.equal(after.today,before.today);assert.equal(after.days.length,7);
 assert.equal(new Set(after.days.map((day:any)=>day.day)).size,7);
 assert.equal(after.days[6].sources.facebook,priorSource+1);
 assert.equal(after.days[6].events.mascot_open,priorEvents+1);
 for(const event of ['breakfast','review_breakfast','whatsapp_breakfast'])assert.ok(after.days[6].events[event]>=1);
 assert.ok(after.analyticsStartedAt);
 for(const input of [{visitorId,event:'arbitrary'},{visitorId,source:'private-value'},{visitorId,event:'breakfast',name:'forbidden'}])assert.equal((await call('POST',input)).status,400);
 assert.equal((await call('GET')).status,401);
});
