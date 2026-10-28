import { useRef, useState } from 'react';
import { operationsApi } from '../lib/operationsApi';
import { ErrorState } from './ui/DataStates';
export function PreparationTasks({
  orders,
  storeId,
  online,
  refresh
}: {
  orders: any[];
  storeId: string;
  online: boolean;
  refresh: () => Promise<void>;
}) {
  const [checks, setChecks] = useState<Record<string, string[]>>({}),
    [pending, setPending] = useState<string>(),
    [error, setError] = useState('');
  const busy = useRef(false);
  async function prepare(order: any, next: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(order.id);
    setError('');
    try {
      await operationsApi('operations', {
        action: 'prepare',
        orderId: order.id,
        next,
        checkedItemIds: checks[order.id] || []
      });
      await refresh();
    } catch {
      setError('تعذر تأكيد التحضير. حدّث القائمة وراجع حالة الأصناف.');
    } finally {
      busy.current = false;
      setPending(undefined);
    }
  }
  if (!orders.length) return null;
  return <section className="preparation-tasks" aria-label="تذاكر تحضير المتجر"><h2>تذاكر التحضير</h2>{error && <ErrorState message={error} retry={() => void refresh()} />} {orders.map(order => {
      const stage = order.kitchenStatus?.[storeId] || 'received';
      return <article key={order.id} className="preparation-task"><h3>طلب {order.orderNumber}</h3>{order.items.map((item: any, i: number) => {
          const id = item.id || String(i);
          return <label key={id}><input type="checkbox" checked={(checks[order.id] || []).includes(id)} onChange={e => setChecks(prev => ({
              ...prev,
              [order.id]: e.target.checked ? [...(prev[order.id] || []), id] : (prev[order.id] || []).filter(v => v !== id)
            }))} />{item.quantity} × {item.product.name}</label>;
        })}{order.issueOpen ? <p>التذكرة قيد مراجعة الإدارة، لا يمكن متابعة التحضير.</p> : !order.paymentReady ? <p>بانتظار تأكيد الدفع.</p> : stage === 'received' ? <button disabled={!online || !!pending} onClick={() => void prepare(order, 'preparing')}>قبول وبدء التحضير</button> : stage === 'preparing' ? <button disabled={!online || !!pending || (checks[order.id] || []).length !== order.items.length} onClick={() => void prepare(order, 'ready')}>تم التجهيز ومراجعة الأصناف</button> : <p>جاهز لاستلام المندوب</p>}</article>;
    })}</section>;
}
