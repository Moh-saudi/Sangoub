# Sangoub Enterprise E-Commerce Speed & Scalability Architecture (Speed Rules)
**Document Version:** 1.0.0  
**Target Throughput:** 1,000+ Completed Orders/Day & 50,000+ Daily Active Catalog Impressions  
**Last Updated:** November 2026  

---

## 1. Executive Summary & Core Performance Principles
For an e-commerce platform handling high order volume (1,000+ orders/day) with tens of thousands of customer visits across mobile networks (3G/4G/5G), page speed directly drives conversion rates and prevents cart abandonment.

The platform architecture follows **6 Zero-Latency Speed Rules**:
1. **Zero Base64 in Database Rest API Payloads** (Maximum JSON payload per page < 150 KB).
2. **Offline-First Stale-While-Revalidate (SWR) Local Caching** (Initial render in < 15ms).
3. **Smart Foreign-Key & Composite B-Tree/GIN Indexing** (No sequential scans on JOINs or filters).
4. **Windowed / Infinite Scroll Pagination** (Slice 40-50 products per chunk instead of full table scans).
5. **Universal Skeleton Placeholders** (Zero jarring empty layout shifts or false "no products" states).
6. **Next-Gen CDN Media Delivery (Cloudflare R2 / WebP)** with `loading="lazy"` and `decoding="async"`.

---

## 2. Speed Rule #1: Payload Size & Image Storage Architecture
### The Problem:
Embedding raw base64 data strings (e.g., `data:image/jpeg;base64,...`) directly into the `image_url` column causes catalog payload size to balloon to **27+ Megabytes**. On mobile networks, downloading 27 MB takes 30–60 seconds, and exceeds the browser's 5MB `localStorage` quota, causing caching to fail silently.

### The Standard Rule:
1. **Strict Cloudflare R2 / S3 URLs Only:**
   - Product images must be uploaded to Cloudflare R2 / CDN and referenced via clean HTTPS URLs:  
     `https://img.sangoub.com/products/{uuid}.webp`
   - No raw base64 string longer than 500 characters may be accepted or persisted in the `products` table.
2. **Cache Sanitization:**
   - Any legacy base64 strings in database rows are automatically sanitized out during local caching so the local cached catalog stays lightweight (**< 200 KB for 600+ items**).
3. **Image Optimization Attributes:**
   ```html
   <img 
     src="..." 
     loading="lazy" 
     decoding="async" 
     fetchpriority="low" 
     width="200" 
     height="200" 
     alt="..." 
   />
   ```

---

## 3. Speed Rule #2: Smart Database Indexes (Eliminating N+1 Queries)
Sequential table scans (`Seq Scan`) kill PostgreSQL performance under concurrent load. The following Smart Indexes are deployed in `supabase/migrations/202611210001_smart_indexes_and_perf.sql`:

| Table | Index Columns | Index Type | Purpose |
|---|---|---|---|
| `products` | `store_id` | B-Tree | Instant store catalog lookup (0ms) |
| `products` | `category` / `category_id` | B-Tree | Category rail filtering |
| `products` | `is_available`, `archived` | Composite B-Tree | Excludes out-of-stock/archived items instantly |
| `products` | `updated_at DESC` | B-Tree | Realtime catalog sync |
| `products` | `barcode` (WHERE NOT NULL) | Sparse B-Tree | POS & merchant barcode scanner lookup |
| `stores` | `status`, `rating DESC` | Composite B-Tree | Instant filtering of open stores sorted by rating |
| `orders` | `created_at DESC` | B-Tree | Live operational dashboard order timeline |
| `orders` | `order_status` | B-Tree | Status filtering (received, cooking, out_for_delivery) |
| `orders` | `store_ids` | GIN | Multi-store order attribution queries |
| `orders` | `user_id` / `phone` | B-Tree | Customer order history lookup |

---

## 4. Speed Rule #3: Query Projection (No `SELECT *`)
Never issue `supabase.from('products').select('*')` or cross-table join `stores(name)` when the client already holds the store taxonomy in memory.

### Optimized Catalog Query:
```typescript
const PRODUCT_FIELDS = 
  'id, store_id, name, name_en, description, price, original_price, category, category_id, barcode, merchant_pos_sku, is_available, archived, image_url, image_type, badge, is_popular, offer_title, options';

const { data } = await supabase
  .from('products')
  .select(PRODUCT_FIELDS);
```

---

## 5. Speed Rule #4: Caching Strategy (Stale-While-Revalidate)
1. **Immediate Synchronous Hydration (0ms):**
   The application initializes `rawProducts` and `rawStores` from local storage synchronously on component mount. The customer sees the store immediately.
2. **Silent Background Revalidation:**
   `getSupabaseStores()` and `getSupabaseProducts()` execute in the background via Supabase PostgreSQL realtime subscriptions. When fresh data arrives, state and cache update seamlessly without causing layout shifts.
3. **Quota Protection:**
   The cache payload is strictly bounded to < 500 KB to never trigger browser `QuotaExceededError`.

---

## 6. Speed Rule #5: Universal Skeleton Loaders
Under no circumstance should the UI display a false "لا توجد نتائج مطابقة" (No matching results) message while data is in flight.
- **Rules:**
  1. If `isLoadingCatalog && items.length === 0`, display an animated 6-8 item shimmer grid matching the exact layout dimensions.
  2. The empty state card is displayed **only** when `!isLoadingCatalog && items.length === 0`.
  3. Applied universally across desktop (`HomePage.tsx`), mobile (`MobileStorefront.tsx`), store details, and search feeds.

---

## 7. Speed Rule #6: Desktop & Mobile Feature Parity
Every core e-commerce conversion element must render cleanly across all device widths:
- The **Promo Coupon Voucher Card** (`featuredCoupon`) is displayed on both Desktop (`HomePage.tsx`) and Mobile First (`MobileStorefront.tsx`) directly beneath the quick mart banner with 1-tap copy and apply feedback.
- Category rails, live tracking pills, and sticky cart action docks maintain smooth 60fps touch interactions.
