import { useEffect, useState } from 'react';
import { startTrackingObserver, type ObservedTracking } from './trackingObserver';
import { subscribeCourierLocation } from './subscribeCourierLocation';

export function useOrderTracking(orderId: string, orderStatus: string, enabled = true, _merchant = false, courierId?: string) {
  const key = JSON.stringify([orderId, orderStatus, enabled, courierId]);
  const initial: ObservedTracking = {
    status: orderStatus === 'delivered' ? 'delivered' : orderStatus === 'cancelled' ? 'cancelled' : 'waiting',
    point: null,
    lastArrivalAt: null,
  };
  const [snapshot, setSnapshot] = useState<{ key: string; state: ObservedTracking }>({ key, state: initial });

  useEffect(() => {
    setSnapshot({ key, state: initial });
    if (!enabled || !courierId || !orderId || orderStatus !== 'with_courier') return;
    let alive = true;
    const stop = startTrackingObserver({
      orderStatus,
      notify: state => { if (alive) setSnapshot({ key, state }); },
      listen: (onData, onError) => subscribeCourierLocation(courierId, onData, onError),
    });
    return () => { alive = false; stop(); };
  }, [key, enabled, orderId, orderStatus, courierId]);

  return snapshot.key === key ? snapshot.state : initial;
}
