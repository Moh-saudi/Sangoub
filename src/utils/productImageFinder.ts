import { supabase } from '../lib/supabase';

export interface ImageCandidate {
  url: string;
  source: 'catalog' | 'master_spu' | 'curated_library';
  label: string;
}

const CURATED_IMAGE_PATTERNS: Array<{
  keywords: string[];
  url: string;
  label: string;
}> = [
  // مشروبات ساخنة وشاي وقهوة
  {
    keywords: ['شاي', 'ليبتون', 'tea', 'lipton', 'شاي أحمر', 'شاي ناعم', 'شاي أخضر'],
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    label: 'شاي أسود وأحمر فاخر',
  },
  {
    keywords: ['قهوة', 'اسبريسو', 'نسكافيه', 'لاتيه', 'كابتشينو', 'بُن', 'coffee', 'espresso'],
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    label: 'قهوة ساخنة ممتازة',
  },
  // أجبان وألبان
  {
    keywords: ['جبنة', 'دومتي', 'فيتا', 'جبن', 'feta', 'cheese', 'جبنة بيضاء', 'جبنة اسطنبولي', 'جبنة براميلي'],
    url: 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?auto=format&fit=crop&w=600&q=80',
    label: 'جبنة بيضاء فيتا كريمية',
  },
  {
    keywords: ['شيدر', 'رومي', 'موزاريلا', 'cheddar', 'mozzarella'],
    url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
    label: 'جبن شيدر ورومي أصفر',
  },
  {
    keywords: ['لبن', 'حليب', 'زبادي', 'milk', 'yogurt', 'جهينة', 'المراعي'],
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    label: 'حليب وألبان طازجة',
  },
  // وجبات سريعة وبرجر
  {
    keywords: ['برجر', 'تشيز برجر', 'بيف', 'burger', 'cheeseburger', 'ساندوتش برجر', 'دبل تشيز'],
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
    label: 'برجر لحم مشوي على اللهب',
  },
  {
    keywords: ['شاورما', 'شاورمة', 'shawarma', 'عربي'],
    url: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=600&q=80',
    label: 'شاورما لحم أو دجاج طازجة',
  },
  {
    keywords: ['بيتزا', 'pizza', 'مارجريتا', 'ببروني'],
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    label: 'بيتزا إيطالية بالجبن',
  },
  {
    keywords: ['دجاج مقلي', 'بروستد', 'كرسبي', 'زنجر', 'strips', 'crispy', 'fried chicken'],
    url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80',
    label: 'دجاج مقلي مقرمش كرسبي',
  },
  {
    keywords: ['كريب', 'وافل', 'crepe', 'waffle'],
    url: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?auto=format&fit=crop&w=600&q=80',
    label: 'كريب فرنسي طازج',
  },
  // فطور ومخبوزات
  {
    keywords: ['فول', 'فول مدمس', 'فول بلدي', 'ساندوتش فول'],
    url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
    label: 'فول مدمس بالزيت والليمون',
  },
  {
    keywords: ['طعمية', 'فلافل', 'falafel', 'ساندوتش طعمية'],
    url: 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?auto=format&fit=crop&w=600&q=80',
    label: 'طعمية وفلافل مقرمشة ساخنة',
  },
  {
    keywords: ['كرواسون', 'باتيه', 'croissant', 'دانش'],
    url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
    label: 'كرواسون زبدة فرنسي',
  },
  {
    keywords: ['عيش', 'خبز', 'فينو', 'bread', 'بلدي'],
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    label: 'خبز طازج من الفرن',
  },
  // مياه وعصائر ومشروبات باردة
  {
    keywords: ['مياه', 'مياه معدنية', 'water', 'نستله', 'أكوافينا', 'بركة', 'داساني'],
    url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    label: 'مياه معدنية طبيعية نقية',
  },
  {
    keywords: ['عصير', 'juice', 'برتقال', 'مانجو', 'فراولة', 'جوافة', 'ليمون'],
    url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
    label: 'عصائر فواكه طبيعية طازجة',
  },
  {
    keywords: ['بيبسي', 'كولا', 'pepsi', 'cola', 'سفن اب', 'سبرايت', 'مشروب غازي'],
    url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    label: 'مشروب غازي بارد ومنعش',
  },
  // أدوية وصيدلية
  {
    keywords: ['بنادول', 'panadol', 'مسكن', 'باراسيتامول', 'أدول', 'صداع'],
    url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    label: 'مسكن وخافض حرارة طبي',
  },
  {
    keywords: ['بروفين', 'brufen', 'أقراص', 'كبسولات', 'دواء', 'فيتامين'],
    url: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80',
    label: 'مستحضرات طبية وأقراص علاجية',
  },
  {
    keywords: ['شامبو', 'بلسم', 'صابون', 'غسول', 'shampoo', 'soap'],
    url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600&auto=format&fit=crop&q=80',
    label: 'عناية شخصية ونظافة',
  },
  {
    keywords: ['مناديل', 'فاين', 'وايبس', 'tissues', 'wipes'],
    url: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&auto=format&fit=crop&q=80',
    label: 'مناديل ومستلزمات ورقية',
  },
  {
    keywords: ['شيبسي', 'شيبس', 'chips', 'بطاطس مقلية', 'سناكس'],
    url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
    label: 'مقرمشات وشيبس مقرمش',
  },
];

/**
 * البحث عن أفضل صور مقترحة لصنف معين بناءً على اسمه وكلماته الدلالية
 */
export async function searchImagesForProduct(productName: string): Promise<ImageCandidate[]> {
  if (!productName || !productName.trim()) return [];
  const cleanName = productName.trim().toLowerCase();
  const candidates: ImageCandidate[] = [];
  const seenUrls = new Set<string>();

  // 1. أولاً: البحث في الكتالوج المركزي الموحد master_spu
  try {
    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    const searchWord = words[0] || cleanName;

    const { data: spuMatches } = await supabase
      .from('master_spu')
      .select('name_ar, images')
      .ilike('name_ar', `%${searchWord}%`)
      .limit(3);

    if (spuMatches && spuMatches.length > 0) {
      for (const item of spuMatches) {
        if (Array.isArray(item.images) && item.images.length > 0) {
          const imgUrl = item.images[0];
          if (imgUrl && !seenUrls.has(imgUrl)) {
            seenUrls.add(imgUrl);
            candidates.push({
              url: imgUrl,
              source: 'master_spu',
              label: `كتالوج مركزي: ${item.name_ar}`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('SPU image search skipped:', err);
  }

  // 2. ثانياً: البحث في مكتبة الصور الذكية المقترنة بالتصنيفات
  for (const item of CURATED_IMAGE_PATTERNS) {
    const isMatch = item.keywords.some(kw => cleanName.includes(kw.toLowerCase()));
    if (isMatch && !seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      candidates.push({
        url: item.url,
        source: 'curated_library',
        label: item.label,
      });
    }
  }

  // 3. Fallback: صورة عامة إذا لم يُعثر على شيء
  if (candidates.length === 0) {
    const fallbackUrl = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
    candidates.push({
      url: fallbackUrl,
      source: 'curated_library',
      label: 'بقالة ومنتجات عامة',
    });
  }

  return candidates;
}

/**
 * إيجاد أفضل صورة تلقائياً للصنف وتعيينها
 */
export async function getBestAutoImageUrl(productName: string): Promise<string> {
  const candidates = await searchImagesForProduct(productName);
  return candidates[0]?.url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
}

