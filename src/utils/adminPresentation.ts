import type { OrderStatus } from '../types';
export const adminOrderStatus: Record<OrderStatus,string> = {
 received:'جديد',preparing:'قيد التحضير',ready:'جاهز للاستلام',with_courier:'في الطريق',delivered:'تم التسليم',cancelled:'ملغى',
};
