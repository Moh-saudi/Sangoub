import test from 'node:test';
import assert from 'node:assert/strict';
import { merchantOrderView, courierOrderView, portalOrders } from '../server/portalOrders.ts';
import { writeOrderSignals } from '../server/orderSignals.ts';
class Db {
  data = new Map<string, any>();
  writes = 0;
  queue = Promise.resolve();
  doc(path: string): any {
    return {
      path,
      id: path.split('/').at(-1),
      get: async () => this.snap(path)
    };
  }
  snap(path: string): any {
    return {
      id: path.split('/').at(-1),
      ref: this.doc(path),
      exists: this.data.has(path),
      data: () => this.data.get(path)
    };
  }
  collection(path: string): any {
    let filters: any[] = [],
      max = Infinity,
      cursor = '';
    const q: any = {
      doc: (id = crypto.randomUUID()) => this.doc(path + '/' + id),
      where: (k: string, op: string, v: any) => {
        filters.push([k, op, v]);
        return q;
      },
      orderBy: () => q,
      limit: (n: number) => {
        max = n;
        return q;
      },
      startAfter: (id: string) => {
        cursor = id;
        return q;
      },
      get: async () => {
        const docs = [...this.data.keys()].filter(p => p.startsWith(path + '/') && p.split('/').length === path.split('/').length + 1).sort().map(p => this.snap(p)).filter(d => d.id > cursor && filters.every(([k, op, v]) => op === 'array-contains' ? d.data()[k]?.includes(v) : op === 'in' ? v.includes(d.data()[k]) : d.data()[k] === v)).slice(0, max);
        return {
          docs,
          size: docs.length
        };
      }
    };
    return q;
  }
  async runTransaction(fn: any) {
    const run = this.queue.then(async () => {
      const writes: any[] = [];
      const result = await fn({
        get: async (ref: any) => {
          assert.equal(writes.length, 0, 'all transaction reads before writes');
          return this.snap(ref.path);
        },
        set: (ref: any, value: any) => writes.push([ref.path, value]),
        update: (ref: any, value: any) => writes.push([ref.path, {
          ...this.data.get(ref.path),
          ...value
        }]),
        create: (ref: any, value: any) => writes.push([ref.path, value])
      });
      for (const [p, v] of writes) {
        this.data.set(p, v);
        this.writes++;
      }
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
const order = (patch: any = {}) => ({
  orderNumber: 'S1',
  storeIds: ['s1', 's2'],
  orderStatus: 'ready',
  courierId: 'c1',
  profileId: 'private-customer',
  profileName: 'اسم العميل',
  phone: '01000000000',
  ministry: 'جهة العميل',
  paymentMethod: 'cash',
  paymentStatus: 'cash_on_delivery',
  total: 100,
  storeSnapshots: [{
    id: 's2',
    privateAccount: 'secret-account'
  }],
  geideaTransaction: {
    secret: 'provider'
  },
  items: [{
    id: 'i1',
    quantity: 1,
    extraPrice: 0,
    product: {
      id: 'p1',
      storeId: 's1',
      storeName: 'متجر 1',
      name: 'صنف 1',
      price: 40,
      internalCost: 1
    }
  }, {
    id: 'i2',
    quantity: 1,
    extraPrice: 0,
    product: {
      id: 'p2',
      storeId: 's2',
      name: 'private-product',
      price: 60
    }
  }],
  ...patch
});
const context = (db: Db, role = 'courier', uid = 'c1'): any => ({
  db,
  actor: {
    uid,
    auth_time: 20
  },
  verified: true,
  role,
  staff: {
    role,
    storeId: 's1'
  }
});
test('merchant projection excludes every other store and customer/provider/contract metadata', () => {
  const view = merchantOrderView('o', order(), 's1');
  assert.equal(view.items.length, 1);
  assert.equal(view.total, 40);
  assert.equal(view.paymentMethod, 'cash');
  for (const value of ['private-product', 'secret-account', 'private-customer', 'اسم العميل', '01000000000', 'internalCost', 'geideaTransaction']) assert(!JSON.stringify(view).includes(value), value);
  const courier = courierOrderView('o', order());
  assert.equal(courier.amountToCollect, 100);
  const trackingSource=order({coordinates:{latitude:30.01,longitude:31.7}});
  const trackingView=courierOrderView('o',trackingSource);
  for(const key of ['orderStatus','courierId','profileId','coordinates'])assert.deepEqual(trackingView[key],trackingSource[key],`Tracking contract must preserve ${key}`);
  assert(!JSON.stringify(courier).includes('geideaTransaction'));
  assert.equal(courierOrderView('o', order({
    paymentMethod: 'geidea'
  })).amountToCollect, 0);
});
test('atomic signals contain identifiers and status only and revoke old courier on reassignment/closure', () => {
  const writes: any[] = [];
  const db: any = {
      doc: (p: string) => p
    },
    tx: any = {
      set: (p: string, d: any) => writes.push([p, d])
    };
  writeOrderSignals(db, tx, {
    ...order({
      courierId: 'c2'
    }),
    id: 'o'
  }, order());
  assert.equal(writes.find(([p]) => p === 'courierOrderSignals/c1/orders/o')[1].active, false);
  assert.equal(writes.find(([p]) => p === 'courierOrderSignals/c2/orders/o')[1].active, true);
  for (const [, value] of writes) assert.deepEqual(Object.keys(value).sort(), ['active', value.storeId ? 'storeId' : 'courierId', 'orderId', 'orderStatus', 'updatedAt'].sort());
  writes.length = 0;
  writeOrderSignals(db, tx, {
    ...order({
      orderStatus: 'delivered'
    }),
    id: 'o'
  }, order());
  assert(writes.every(([, v]) => !v.active));
});
test('active API constrains canonical query by verified identity, skips history, bootstraps without signal loops', async () => {
  const db = new Db();
  db.data.set('orders/a', order());
  db.data.set('orders/b', order({
    courierId: 'c2'
  }));
  db.data.set('orders/c', order({
    orderStatus: 'delivered'
  }));
  const result: any = await portalOrders({
    action: 'portal-active',
    courierId: 'c2'
  }, context(db));
  assert.deepEqual(result.items.map((o: any) => o.id), ['a']);
  const writes = db.writes;
  await portalOrders({
    action: 'portal-active'
  }, context(db));
  assert.equal(db.writes, writes, 'read must not invalidate itself indefinitely');
  const history: any = await portalOrders({
    action: 'portal-history'
  }, context(db));
  assert.deepEqual(history.items.map((o: any) => o.id), ['c']);
  assert.equal(history.items[0].phone, undefined);
  assert.equal(history.items[0].items, undefined);
});
test('legacy courier transitions require assignment, pickup and payment; duplicate confirmation is safe', async () => {
  const db = new Db();
  db.data.set('staff/c1', {
    role: 'courier'
  });
  db.data.set('orders/a', order());
  const ctx = context(db);
  await assert.rejects(portalOrders({
    action: 'courier-depart',
    orderId: 'a'
  }, ctx));
  await assert.rejects(portalOrders({
    action: 'courier-pickup',
    orderId: 'a',
    confirmed: false
  }, ctx));
  await portalOrders({
    action: 'courier-pickup',
    orderId: 'a',
    confirmed: true
  }, ctx);
  await Promise.all([portalOrders({
    action: 'courier-depart',
    orderId: 'a'
  }, ctx), portalOrders({
    action: 'courier-depart',
    orderId: 'a'
  }, ctx)]);
  assert.equal(db.data.get('orders/a').orderStatus, 'with_courier');
  db.data.set('accountAccess/c1', {
    disabled: true
  });
  await assert.rejects(portalOrders({
    action: 'courier-depart',
    orderId: 'a'
  }, ctx));
  db.data.delete('accountAccess/c1');
  db.data.set('orders/a', order({
    paymentMethod: 'geidea',
    paymentStatus: 'pending'
  }));
  await assert.rejects(portalOrders({
    action: 'courier-pickup',
    orderId: 'a',
    confirmed: true
  }, ctx));
  db.data.set('orders/a', order({
    courierId: 'c2'
  }));
  await assert.rejects(portalOrders({
    action: 'courier-pickup',
    orderId: 'a',
    confirmed: true
  }, ctx));
});
