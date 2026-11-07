import { LAUNCH_CONFIG } from '../../config/launchConfig';

export interface StoreBanner {
  id: string | number;
  title: string;
  subtitle?: string;
  desc?: string;
  imageUrl?: string;
  image?: string;
  tag?: string;
  btnText?: string;
  hideOverlay?: boolean;
  hideButton?: boolean;
  targetType?: 'product' | 'store' | 'offers' | 'url' | 'category';
  targetId?: string;
  targetPath?: string;
  badgeColor?: string;
  bgGradient?: string;
  mascotImg?: string;
  code?: string;
}

export const DEFAULT_SANGOUB_BANNERS: StoreBanner[] = [
  {
    id: 1,
    tag: 'أسرع توصيل طلبات',
    title: 'سنجوب يوصلك لحد باب بيتك أو مكتبك 🐿️',
    subtitle: `خدمة التوصيل السريع لطلباتك داخل ${LAUNCH_CONFIG.serviceAreaLabel}.`,
    desc: `خدمة التوصيل السريع لطلباتك داخل ${LAUNCH_CONFIG.serviceAreaLabel}.`,
    imageUrl: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=800&q=80',
    btnText: 'اطلب الآن',
    targetType: 'category',
    targetPath: '/categories',
    badgeColor: '#FF5900',
    bgGradient: 'linear-gradient(135deg, #131921 0%, #1F2937 100%)',
    mascotImg: '/brand/sangoub-logo-256x256.png',
  },
  {
    id: 2,
    tag: 'منتجات طازجة يومياً',
    title: 'سنجوب ماركت وكل طلبات البيت لحد بابك 🛒',
    subtitle: 'ألبان ومياه وسناكس ومستلزماتك اليومية بجودة عالية.',
    desc: 'ألبان ومياه وسناكس ومستلزماتك اليومية بجودة عالية.',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
    btnText: 'تسوق البقالة',
    targetType: 'store',
    targetId: 'sangoub-market',
    targetPath: '/stores/sangoub-market',
    badgeColor: '#E65100',
    bgGradient: 'linear-gradient(135deg, #1E1B4B 0%, #2E1065 100%)',
    mascotImg: '/brand/capital-talabat-mascot-logo-256x256.png',
  },
  {
    id: 3,
    tag: 'أقوى العروض والتوفير 🎁',
    title: 'عروض وخصومات حصرية على المنتجات 🏷️',
    subtitle: 'وفر أكثر مع أقوى عروض التوفير اليومية في زهرة العاصمة.',
    desc: 'وفر أكثر مع أقوى عروض التوفير اليومية في زهرة العاصمة.',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    btnText: 'تصفح العروض',
    targetType: 'offers',
    targetPath: '/offers',
    badgeColor: '#059669',
    bgGradient: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
    mascotImg: '/brand/sangoub-mark-white-256.png',
  },
];
