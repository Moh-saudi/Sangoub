import { Archive, Image as ImageIcon, Pencil, RotateCcw, Store as StoreIcon, Trash2 } from 'lucide-react';
import type { Product, Store } from '../types';
import { formatEGP } from '../utils/orderCalculations';
import { matchStoreId } from '../utils/storeAssets';

export function CatalogProductTable({
  products,
  stores,
  performance,
  busy,
  onEdit,
  onAvailability,
  onArchive,
  onDelete,
  onPublish,
}: {
  products: Product[];
  stores: Store[];
  performance: Map<string, { sold: number; pending: number; revenue: number }>;
  busy: boolean;
  onEdit: (id: string) => void;
  onAvailability: (product: Product) => void;
  onArchive: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onPublish?: (product: Product) => void;
}) {
  return (
    <div className="admin-table-scroll catalog-table-scroll">
      <table className="table table-hover align-middle admin-data-table catalog-data-table">
        <caption className="sr-only">قائمة المنتجات وأسعارها وتوافرها</caption>
        <thead>
          <tr>
            <th scope="col">المنتج</th>
            <th scope="col">المتجر والتصنيف</th>
            <th scope="col">السعر</th>
            <th scope="col">الحالة</th>
            <th scope="col">المبيعات</th>
            <th scope="col">قيد التنفيذ</th>
            <th scope="col">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => {
            const stats = performance.get(product.id);
            const matchedStore = stores.find(s => matchStoreId(s.id, product.storeId) || s.name === product.storeName);
            const storeName = matchedStore?.name || product.storeName || (product.storeId === 'b1111111-2222-3333-4444-555555555501' ? 'صيدلية العاصمة المركزية - 24/7' : 'سنجوب ماركت');

            return (
              <tr key={product.id} className={product.archived ? 'bg-slate-50/70 opacity-90' : ''}>
                <td>
                  <div className="catalog-item-cell">
                    <Thumbnail url={product.imageUrl} />
                    <div className="min-w-0">
                      {/* Prominent Store Badge next to Product */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-orange-50 text-orange-800 border border-orange-200/80 shadow-2xs">
                          <StoreIcon size={12} className="text-orange-600 shrink-0" />
                          <span>{storeName}</span>
                        </span>
                        {product.barcode && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {product.barcode}
                          </span>
                        )}
                      </div>
                      <strong className={`block text-sm font-black text-slate-900 ${product.archived ? 'line-through text-slate-400' : ''}`}>
                        {product.name}
                      </strong>
                      <small title={product.description} className="text-xs text-slate-500 line-clamp-1">
                        {product.description}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <strong className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      {storeName}
                    </strong>
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-bold w-fit">
                      {product.category || 'عام'}
                    </span>
                  </div>
                </td>
                <td className="catalog-price">
                  {formatEGP(product.price)}
                  {Boolean(product.originalPrice && product.originalPrice > product.price) && (
                    <small>
                      <del>{formatEGP(product.originalPrice!)}</del>
                    </small>
                  )}
                </td>
                <td>
                  <span
                    className={`badge admin-status ${
                      product.archived
                        ? 'catalog-archived bg-slate-200 text-slate-700 font-bold'
                        : product.inStock
                        ? 'status-delivered'
                        : 'status-received'
                    }`}
                  >
                    {product.archived ? 'مؤرشف 📦' : product.inStock ? 'متاح للطلب' : 'غير متاح'}
                  </span>
                </td>
                <td>
                  {stats?.sold || 0}
                  <small>قطعة مسلّمة</small>
                </td>
                <td>{stats?.pending || 0}</td>
                <td>
                  <div className="catalog-row-actions">
                    <button
                      disabled={busy}
                      onClick={() => onEdit(product.id)}
                      className="compact-row-action btn btn-outline-secondary"
                    >
                      <Pencil size={13} />
                      تعديل
                    </button>
                    {!product.archived && (
                      <button
                        disabled={busy}
                        onClick={() => onAvailability(product)}
                        className={`compact-row-action btn ${product.inStock ? 'btn-outline-secondary' : 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'}`}
                      >
                        {product.inStock ? 'إيقاف مؤقت' : 'إتاحة للطلب'}
                      </button>
                    )}
                    {product.archived ? (
                      <button
                        disabled={busy}
                        onClick={() => onArchive(product)}
                        className="compact-row-action btn bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs border-emerald-600"
                        title="استعادة الصنف للمتجر"
                      >
                        <RotateCcw size={13} className="inline ml-1" />
                        استعادة الصنف
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => onArchive(product)}
                        className="compact-row-action btn btn-outline-secondary"
                        title="نقل الصنف إلى الأرشيف"
                      >
                        <Archive size={13} />
                        أرشفة
                      </button>
                    )}
                    {!product.archived && onPublish && (
                      <button
                        disabled={busy || Boolean(product.catalogProductId)}
                        onClick={() => onPublish(product)}
                        className="compact-row-action btn btn-outline-secondary"
                      >
                        {product.catalogProductId ? 'معتمد بالكتالوج العام' : 'اعتماد بالكتالوج العام'}
                      </button>
                    )}
                    {product.archived && onDelete && (
                      <button
                        disabled={busy}
                        onClick={() => onDelete(product)}
                        className="compact-row-action btn text-red-600 border border-red-200 hover:bg-red-50 font-bold"
                        title="حذف الصنف نهائياً من النظام"
                      >
                        <Trash2 size={13} />
                        حذف نهائي
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CatalogStoreTable({
  stores,
  products,
  busy,
  onEdit,
  onStatus,
  onDelete,
}: {
  stores: Store[];
  products: Product[];
  busy: boolean;
  onEdit: (id: string) => void;
  onStatus: (store: Store) => void;
  onDelete?: (store: Store) => void;
}) {
  return (
    <div className="admin-table-scroll catalog-table-scroll">
      <table className="table table-hover align-middle admin-data-table catalog-data-table">
        <caption className="sr-only">قائمة المتاجر وحالة التشغيل</caption>
        <thead>
          <tr>
            <th scope="col">المتجر</th>
            <th scope="col">العنوان</th>
            <th scope="col">الحالة</th>
            <th scope="col">المنتجات</th>
            <th scope="col">الحد الأدنى</th>
            <th scope="col">التوصيل</th>
            <th scope="col">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {stores.map(store => (
            <tr key={store.id}>
              <td>
                <div className="catalog-item-cell">
                  <Thumbnail url={store.logoUrl || store.imageUrl || store.bannerUrl} />
                  <div>
                    <h2>{store.name}</h2>
                    <small>{store.type}</small>
                  </div>
                </div>
              </td>
              <td>
                <span className="catalog-address">{store.locationInDistrict}</span>
              </td>
              <td>
                <span
                  className={`badge admin-status ${
                    store.status === 'open'
                      ? 'status-delivered'
                      : store.status === 'busy'
                      ? 'status-received'
                      : 'status-received'
                  }`}
                >
                  {store.status === 'open' ? 'مفتوح' : store.status === 'busy' ? 'مشغول' : 'مغلق'}
                </span>
              </td>
              <td>
                {products.filter(product => !product.archived && matchStoreId(product.storeId, store.id)).length}
              </td>
              <td>{formatEGP(store.minOrder)}</td>
              <td>{formatEGP(store.deliveryFee)}</td>
              <td>
                <div className="catalog-row-actions">
                  <button
                    disabled={busy}
                    onClick={() => onEdit(store.id)}
                    className="compact-row-action btn btn-outline-secondary"
                  >
                    <Pencil size={13} />
                    تعديل
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onStatus(store)}
                    className="compact-row-action btn btn-outline-secondary"
                  >
                    {store.status === 'open' ? 'إغلاق مؤقت' : 'فتح المتجر'}
                  </button>
                  {onDelete && (
                    <button
                      disabled={busy}
                      onClick={() => onDelete(store)}
                      className="compact-row-action btn btn-outline-danger text-red-600 border-red-200 hover:bg-red-50"
                      title="حذف المتجر نهائياً"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Thumbnail({ url }: { url?: string }) {
  return (
    <div className="catalog-thumbnail">
      <ImageIcon size={18} aria-hidden="true" />
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          onLoad={event => {
            event.currentTarget.style.visibility = 'visible';
          }}
          onError={event => {
            event.currentTarget.style.visibility = 'hidden';
          }}
        />
      )}
    </div>
  );
}
