import type { Order } from "../types";
import { CustomerPOSReceipt } from "../components/CustomerPOSReceipt";

export function OrderInvoice({ order }: { order: Order }) {
  return <CustomerPOSReceipt order={order} />;
}
