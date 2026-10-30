import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

test('compiled serverless JavaScript loads the real handlers without TypeScript loaders', async () => {
  const root = process.cwd();
  const temp = await mkdtemp(join(tmpdir(), 'capital-compiled-api-'));
  try {
    const norm = (p) => p.replace(/\\/g, '/');
    const config = join(temp, 'tsconfig.json');
    const out = join(temp, 'output');
    await writeFile(
      config,
      JSON.stringify({
        extends: norm(join(root, 'api/tsconfig.json')),
        compilerOptions: {
          noEmit: false,
          noCheck: false,
          rewriteRelativeImportExtensions: true,
          rootDir: norm(root),
          outDir: norm(out),
        },
        include: [
          norm(join(root, 'api/**/*.ts')),
          norm(join(root, 'server/**/*.ts')),
          norm(join(root, 'server/**/*.js')),
        ],
        exclude: ['**/*.test.ts'],
      })
    );
    const isWin = process.platform === 'win32';
    const tscBin = isWin
      ? join(root, 'node_modules/.bin/tsc.cmd')
      : join(root, 'node_modules/.bin/tsc');
    const compile = spawnSync(tscBin, ['-p', config], {
      encoding: 'utf8',
      timeout: 60000,
      shell: isWin,
    });
    assert.equal(compile.status, 0, compile.stdout + '\n' + compile.stderr);
    await writeFile(join(out, 'package.json'), JSON.stringify({ type: 'module' }));
    await symlink(join(root, 'node_modules'), join(out, 'node_modules'), 'junction');
    const osm = await import(pathToFileURL(join(out, 'server/handlers/osm.js')).href);
    assert.equal(typeof osm.default, 'function');
    const { createOperationsEntry } = await import(pathToFileURL(join(out, 'server/operationsEntry.js')).href);
    const shared = createOperationsEntry(
      async () => ({ default: (_req, res) => res.json('operations') }),
      async () => ({ default: (req, res) => res.json(req.query.action) }),
    );
    let routed;
    await shared(
      { method: 'POST', headers: { authorization: 'Bearer test' }, query: { osmAction: 'route' } },
      { setHeader() {}, json(value) { routed = value; } },
    );
    assert.equal(routed, 'route');
    for (const name of [
      'admin-data',
      'admin-users',
      'orders',
      'order-delivery',
      'catalog-images',
      'operations',
      'app-content',
    ]) {
      const implementation = await import(
        pathToFileURL(join(out, 'server/handlers/' + name + '.js')).href
      );
      assert.equal(typeof implementation.default, 'function');
      const endpoint = await import(pathToFileURL(join(out, 'api/' + name + '.js')).href);
      let status;
      await endpoint.default(
        { method: 'POST', headers: {}, body: {} },
        {
          setHeader() {},
          status(code) {
            status = code;
            return this;
          },
          json() {
            return this;
          },
        }
      );
      assert.equal(status, 401, name);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
