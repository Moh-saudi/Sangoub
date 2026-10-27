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
    subtitle: `خدمة التوصيل السريع لمقاضيك داخل ${LAUNCH_CONFIG.serviceAreaLabel}.`,
    desc: `خدمة التوصيل السريع لمقاضيك داخل ${LAUNCH_CONFIG.serviceAreaLabel}.`,
    btnText: 'اطلب الآن',
    targetType: 'category',
    targetPath: '/categories',
    badgeColor: '#FF5900',
    bgGradient: 'linear-gradient(135deg, #131921 0%, #1F2937 100%)',
    mascotImg: '/assets/sangoub/mascot-cheerful.png',
  },
  {
    id: 2,
    tag: 'مقاضي طازجة يومياً',
    title: 'سنجوب بقالة ومقاضي البيت لحد بابك 🛒',
    subtitle: 'ألبان ومياه وسناكس ومستلزماتك اليومية بجودة عالية.',
    desc: 'ألبان ومياه وسناكس ومستلزماتك اليومية بجودة عالية.',
    btnText: 'تسوق البقالة',
    targetType: 'category',
    targetId: 'فطور ومخبوزات',
    targetPath: '/categories',
    badgeColor: '#E65100',
    bgGradient: 'linear-gradient(135deg, #1E1B4B 0%, #2E1065 100%)',
    mascotImg: '/assets/sangoub/mascot-delivery.png',
  },
  {
    id: 3,
    tag: 'أقوى العروض والتوفير 🎁',
    title: 'عروض وخصومات حصرية على المنتجات 🏷️',
    subtitle: 'وفر أكثر مع أقوى عروض التوفير اليومية في زهرة العاصمة.',
    desc: 'وفر أكثر مع أقوى عروض التوفير اليومية في زهرة العاصمة.',
    btnText: 'تصفح العروض',
    targetType: 'offers',
    targetPath: '/offers',
    badgeColor: '#059669',
    bgGradient: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
    mascotImg: '/assets/sangoub/mascot-trio.png',
  },
];
