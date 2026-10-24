export const homeSectionTypes = ['slider', 'stores', 'offers', 'products'] as const;
export type HomeSection = typeof homeSectionTypes[number];
export type CustomerHome = { sections: { type: HomeSection; enabled: boolean }[]; sliderMode: 'automatic' | 'manual'; maxSlides: number };
export type Promotion = { id: string; title: string; subtitle: string; imageUrl: string; enabled: boolean; priority: number; targetType: 'product' | 'store' | 'offers'; targetId: string; startsAt: string; endsAt: string };
export const defaultCustomerHome: CustomerHome = { sections: [{ type: 'slider', enabled: true }, { type: 'offers', enabled: true }, { type: 'stores', enabled: true }, { type: 'products', enabled: true }], sliderMode: 'automatic', maxSlides: 6 };
