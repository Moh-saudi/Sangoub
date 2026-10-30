/** Target migration contract only. Legacy Product/checkout remain active until an explicit data migration. */
export type MeasureUnit='g'|'kg'|'ml'|'l'|'piece';
export interface CategoryNodeV2 {
 schemaVersion:2;id:string;parentId:string|null;nameAr:string;slug:string;sortOrder:number;active:boolean;
}
export interface CatalogProductV2 {
 schemaVersion:2;id:string;categoryId:string;brandId?:string;nameAr:string;descriptionAr:string;imageUrls:string[];active:boolean;
}
export interface CatalogVariantV2 {
 schemaVersion:2;id:string;productId:string;sku:string;barcode?:string;nameAr:string;
 measure?:{value:number;unit:MeasureUnit};packCount:number;
 attributes:Record<string,string>;imageUrls:string[];active:boolean;
}
export interface MerchantOfferV2 {
 schemaVersion:2;id:string;storeId:string;variantId:string;
 currency:'EGP';priceMinor:number;originalPriceMinor?:number;
 available:boolean;archived:boolean;
 // Quantities require a separate transactional inventory ledger, not this availability flag.
}
export interface ModifierGroupV2 {
 id:string;productId:string;nameAr:string;minSelections:number;maxSelections:number;
 choices:Array<{id:string;nameAr:string;extraPriceMinor:number;active:boolean}>;
}
export interface OrderLineSnapshotV2 {
 productId:string;variantId:string;offerId:string;categoryId:string;
 productNameAr:string;variantNameAr:string;sku:string;quantity:number;
 currency:'EGP';unitPriceMinor:number;
 modifiers:Array<{groupId:string;choiceId:string;nameAr:string;extraPriceMinor:number}>;
}
