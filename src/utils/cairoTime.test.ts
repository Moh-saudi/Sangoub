import test from 'node:test';
import assert from 'node:assert/strict';
import { cairoDateInput, cairoInputToIso } from './cairoTime';
test('campaign scheduling uses Cairo rather than the execution host timezone',()=>{
 for(const value of ['2026-01-10T12:30','2026-07-10T12:30','2026-10-24T12:30'])assert.equal(cairoDateInput(cairoInputToIso(value)),value);
 assert.equal(cairoInputToIso('2026-01-10T12:30'),'2026-01-10T10:30:00.000Z');assert.equal(cairoInputToIso('2026-07-10T12:30'),'2026-07-10T09:30:00.000Z');
 assert.throws(()=>cairoInputToIso('2026-02-31T12:00'));assert.throws(()=>cairoInputToIso('invalid'));
});
