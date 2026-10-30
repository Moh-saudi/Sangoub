const fs = require('fs');
let content = fs.readFileSync('src/types/index.ts', 'utf8');

const targetStr = `export interface Product {
  archived?: boolean;
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category:
    | "فطور"
    | "سندوتشات"
    | "سوبر ماركت بالقطعة"
    | "مشروبات"
    | "وجبات خفيفة"
    | "حلويات";
  badge?: string; // e.g. "الأكثر طلباً", "عرض خاص"
  imageType:
    | "foul"
    | "falafel"
    | "water"
    | "chips"
    | "coffee"
    | "croissant"
    | "juice"
    | "cheddar"
    | "tea"
    | "hawawshi";
  imageUrl?: string;
  isPopular?: boolean;
  inStock: boolean;
  optionGroups?: ProductOptionGroup[];
}`;

const replacementStr = `export interface Category {
  id: string;
  vertical_id: string;
  parent_id?: string | null;
  name_ar: string;
  name_en?: string | null;
  slug: string;
  icon?: string | null;
  image_url?: string | null;
  display_order: number;
  is_active: boolean;
  children?: Category[];
  product_count?: number;
}

export interface Product {
  archived?: boolean;
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  nameEn?: string;
  description: string;
  price: number;
  originalPrice?: number;
  categoryId?: string;
  category: string;
  barcode?: string;
  merchantPosSku?: string;
  verticalId?: string;
  badge?: string;
  imageType?: string;
  imageUrl?: string;
  isPopular?: boolean;
  inStock: boolean;
  optionGroups?: ProductOptionGroup[];
}`;

content = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');

if (content.includes(normalizedTarget)) {
  content = content.replace(normalizedTarget, replacementStr);
  fs.writeFileSync('src/types/index.ts', content, 'utf8');
  console.log('Successfully updated src/types/index.ts');
} else {
  console.error('Target string not found in file');
}

