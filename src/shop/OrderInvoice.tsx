import type { Order, StoreOrderSnapshot } from "../types";
import { BRAND } from "../brand";
import { formatEGP } from "../utils/orderCalculations";
export function OrderInvoice({ order }: { order: Order }) {
  const snapshots =
    order.storeSnapshots ||
    [...new Set(order.items.map((item) => item.product.storeId))].map(
      (id) =>
        ({
          id,
          name:
            order.items.find((item) => item.product.storeId === id)?.product
              .storeName || "المتجر",
          logoUrl: "",
          taxRegistrationNumber: "",
          taxRate: 0,
          pricesIncludeTax: true,
          subtotal: 0,
          discount: 0,
          deliveryFee: 0,
          taxTotal: 0,
          includedTax: 0,
          additionalTax: 0,
          total: 0,
        }) as StoreOrderSnapshot,
    );
  const verifiedMethod = String(
    (order as any).geideaTransaction?.method || "",
  ).toLowerCase();
  const paidViaWallet = /wallet|vodafone|meezamobile/.test(verifiedMethod);
  return (
    <section className="shop-invoice" aria-labelledby="shop-invoice-title">
      <header>
        <div>
          <img src={BRAND.logoSmall} alt="شعار سنجوب" width="72" height="72" />
          <strong>سنجوب · Sangoub</strong>
        </div>
        <div>
          <h2 id="shop-invoice-title">فاتورة الطلب {order.orderNumber}</h2>
          <p>
            {new Date(order.createdAt).toLocaleString("ar-EG", {
              timeZone: "Africa/Cairo",
            })}{" "}
            · بتوقيت القاهرة
          </p>
          <p>
            {order.paymentMethod === "cash"
              ? "كاش عند الاستلام"
              : order.paymentMethod === "geidea"
                ? paidViaWallet
                  ? "محفظة محمول عبر جيديا"
                  : "جيديا"
                : order.paymentMethod}{" "}
            ·{" "}
            {order.paymentStatus === "paid" ? "مدفوع ومؤكد" : "لم يُؤكد السداد"}
          </p>
        </div>
      </header>
      {snapshots.map((store) => (
        <section key={store.id} className="shop-invoice-store">
          <header>
            {store.logoUrl && (
              <img
                src={store.logoUrl}
                alt={"شعار " + store.name}
                width="60"
                height="60"
              />
            )}
            <div>
              <h3>{store.name}</h3>
              {store.taxRegistrationNumber && (
                <p>رقم التسجيل الضريبي: {store.taxRegistrationNumber}</p>
              )}
            </div>
          </header>
          <div className="shop-invoice-table">
            <table>
              <thead>
                <tr>
                  <th>الصنف والإضافات</th>
                  <th>الكمية</th>
                  <th>سعر الوحدة</th>
                  <th>القيمة</th>
                </tr>
              </thead>
              <tbody>
                {order.items
                  .filter((item) => item.product.storeId === store.id)
                  .map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.product.name}
                        {Object.entries(item.selectedOptions || {}).map(
                          ([key, value]) => (
                            <small key={key}>
                              {key}: {value}
                            </small>
                          ),
                        )}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatEGP(item.product.price + item.extraPrice)}</td>
                      <td>
                        {formatEGP(
                          (item.product.price + item.extraPrice) *
                            item.quantity,
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {order.storeSnapshots && (
            <p>
              التوصيل: {formatEGP(store.deliveryFee)} · الخصم:{" "}
              {formatEGP(store.discount)} · الضريبة ({store.taxRate}٪):{" "}
              {formatEGP(store.taxTotal)}{" "}
              {store.pricesIncludeTax
                ? "ضمن أسعار المنتجات"
                : "تضاف إلى الأسعار"}
            </p>
          )}
        </section>
      ))}
      <dl>
        <dt>المنتجات</dt>
        <dd>{formatEGP(order.subtotal)}</dd>
        <dt>الخصم</dt>
        <dd>{formatEGP(order.discount)}</dd>
        <dt>التوصيل</dt>
        <dd>{formatEGP(order.deliveryFee)}</dd>
        <dt>ضريبة إضافية</dt>
        <dd>{formatEGP(order.additionalTax || 0)}</dd>
        <dt>منها ضريبة ضمن الأسعار</dt>
        <dd>{formatEGP(order.includedTax || 0)}</dd>
        {order.tip > 0 && (
          <>
            <dt>إكرامية</dt>
            <dd>{formatEGP(order.tip)}</dd>
          </>
        )}
        <dt>الإجمالي</dt>
        <dd>
          <strong>{formatEGP(order.total)}</strong>
        </dd>
      </dl>
      <p>
        {order.profileName} · {order.phone}
        <br />
        {order.ministry} · الدور {order.floorNumber} · المكتب {order.roomNumber}
      </p>
      <p className="shop-invoice-note">
        القيم وبيانات التاجر محفوظة وقت إنشاء الطلب. الضريبة حسب إعدادات تسجيل
        التاجر؛ هذه فاتورة طلب وليست مستندًا ضريبيًا إلكترونيًا معتمدًا.
      </p>
      <button
        className="shop-secondary no-print"
        onClick={() => window.print()}
      >
        طباعة أو حفظ الفاتورة PDF
      </button>
    </section>
  );
}
