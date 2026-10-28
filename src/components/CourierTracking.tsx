import type { Order } from '../types';

export type CourierTrackingOrder = Pick<Order,
  'id' | 'orderStatus' | 'courierId' | 'profileId' | 'coordinates'
>;

/** Integration seam owned by the GPS contributor. No location reads, writes, or UI until supplied. */
export function CourierTracking(_props: { order: CourierTrackingOrder }) {
  return null;
}
