import type { Category } from '../types';

/**
 * تحويل قائمة التصنيفات المسطحة إلى شجرة هرمية متعددة المستويات
 */
export function buildCategoryTree(flatList: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];

  // 1. Initialize map with clean children array
  flatList.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // 2. Nest children under their parents
  flatList.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  // 3. Sort by display_order
  const sortTree = (items: Category[]) => {
    items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        sortTree(item.children);
      }
    });
  };

  sortTree(roots);
  return roots;
}

/**
 * الحصول على المسار الكامل للقسم بصيغة نصية واضحة
 * مثال: "مؤن وبقالة أساسية > زيوت طعام وسمن > زيت عباد الشمس"
 */
export function getCategoryBreadcrumb(flatList: Category[], targetId: string): string {
  const map = new Map(flatList.map((c) => [c.id, c]));
  const names: string[] = [];
  let curr = map.get(targetId);

  while (curr) {
    names.unshift(curr.name_ar);
    if (!curr.parent_id) break;
    curr = map.get(curr.parent_id);
  }

  return names.join(' ⬅ ');
}

/**
 * فلترة التصنيفات التابعة لنشاط تجاري معين
 */
export function filterCategoriesByVertical(categories: Category[], verticalId?: string): Category[] {
  if (!verticalId || verticalId === 'all') return categories;
  return categories.filter((c) => c.vertical_id === verticalId);
}

