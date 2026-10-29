import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createOperationsEntry } from '../server/operationsEntry.ts';

function response() {
  return { code: 0, body: undefined as any, headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; }, end() { return this; } };
}

test('Vercel rewrite retains the public OSM URL and deployment has twelve functions', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(config.rewrites.find((r: any) => r.source === '/api/osm/:action'), {
    source: '/api/osm/:action', destination: '/api/operations?osmAction=:action',
  });
  const entries = readdirSync('api', { recursive: true }) as string[];
  assert.equal(entries.filter(path => path.endsWith('.ts') && !path.endsWith('.d.ts')).length, 12);
});

test('rewritten and local OSM requests preserve action, body and identity; operations body actions stay operations', async () => {
  const calls: any[] = [];
  const load = (name: string) => async () => ({ default: async (req: any, res: any) => {
    calls.push({ name, action: req.query?.action, body: req.body, authorization: req.headers.authorization });
    return res.status(200).json({ name });
  } });
  const handler = createOperationsEntry(load('operations'), load('osm'));
  for (const action of ['route', 'search']) {
    for (const selector of [{ query: { osmAction: action, action: 'spoofed' } }, { params: { action } }]) {
      const body = { from: { latitude: 30.01, longitude: 31.7 }, action: 'profile' };
      await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body, ...selector }, response());
      assert.deepEqual(calls.at(-1), { name: 'osm', action, body, authorization: 'Bearer test' });
    }
  }
  await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body: { action: 'merchant-tracking' } }, response());
  assert.equal(calls.at(-1).name, 'operations');
});

test('both entry paths keep authentication, method restrictions and native CORS before loading handlers', async () => {
  let loads = 0;
  const load = async () => { loads++; throw Error('must not load'); };
  const handler = createOperationsEntry(load, load);
  for (const query of [{}, { osmAction: 'route' }]) {
    for (const [method, headers, expected] of [
      ['POST', {}, 401], ['GET', {}, 405], ['OPTIONS', {}, 403],
      ['OPTIONS', { origin: 'capacitor://localhost' }, 204],
    ] as const) {
      const res = response();
      await handler({ method, headers, query }, res);
      assert.equal(res.code, expected);
      assert.equal(res.headers['Cache-Control'], 'no-store');
      if (expected === 204) assert.equal(res.headers['Access-Control-Allow-Origin'], 'capacitor://localhost');
    }
  }
  assert.equal(loads, 0);
});
