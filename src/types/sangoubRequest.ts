export const requestStatuses = ['new', 'contacted', 'completed', 'cancelled'] as const;
export type SangoubRequestStatus = typeof requestStatuses[number];
export const requestStatusLabels: Record<SangoubRequestStatus, string> = { new:'بانتظار المراجعة', contacted:'جارٍ التواصل', completed:'أُغلقت المتابعة', cancelled:'ملغى' };
export type SangoubRequest = { id:string; version:number; kind:'breakfast'|'supermarket'; status:SangoubRequestStatus; name:string; phone:string; address:string; office:string; notes:string; payment:'cash'|'instapay'; items:{id:string;name:string;quantity:number;category:string}[]; totalQuantity:number; createdAt:string; updatedAt:string; adminNote?:string };
