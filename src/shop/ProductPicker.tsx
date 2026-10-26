import { useEffect, useId, useRef, useState } from "react";
import type { Product } from "../types";
import { formatEGP } from "../utils/orderCalculations";
import { useShop } from "./ShopContext";
export function ProductPicker({
  product,
  onClose,
  onAdded,
}: {
  product: Product;
  onClose: () => void;
  onAdded: () => void;
}) {
  const shop = useShop(),
    modal = useRef<HTMLDialogElement>(null),
    id = useId();
  const [quantity, setQuantity] = useState(1),
    [options, setOptions] = useState<Record<string, string>>({}),
    [notes, setNotes] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    modal.current?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      modal.current?.close();
      document.body.style.overflow = before;
    };
  }, []);
  const extra = (product.optionGroups || []).reduce(
    (sum, group) =>
      sum +
      (group.options.find((option) => option.name === options[group.title])
        ?.price || 0),
    0,
  );
  return (
    <dialog
      className="shop-product-dialog"
      ref={modal}
      dir="rtl"
      aria-labelledby={id}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (
              product.optionGroups?.some(
                (group) => group.required && !options[group.title],
              )
            )
              throw new Error("اختر الإضافات المطلوبة.");
            shop.add(product, quantity, options, notes);
            onAdded();
            onClose();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <header>
          <h2 id={id}>{product.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق تفاصيل المنتج"
          >
            ×
          </button>
        </header>
        <div
          className="shop-picker-body"
          tabIndex={0}
          role="region"
          aria-label="خيارات المنتج"
        >
          <a href={'/stores/'+encodeURIComponent(product.storeId)} onClick={onClose}>من {product.storeName||'المتجر'} — عرض المتجر</a>
          <p>{product.description}</p>
          <strong>{formatEGP(product.price)}</strong>
          {error && (
            <p role="alert" className="shop-error">
              {error}
            </p>
          )}
          {product.optionGroups?.map((group) => (
            <fieldset key={group.id}>
              <legend>
                {group.title} {group.required ? "(مطلوب)" : "(اختياري)"}
              </legend>
              {!group.required && (
                <label className="shop-option">
                  <input
                    type="radio"
                    name={id + group.id}
                    checked={!options[group.title]}
                    onChange={() =>
                      setOptions((old) => ({ ...old, [group.title]: "" }))
                    }
                  />
                  بدون إضافة
                </label>
              )}
              {group.options
                .filter(
                  (option) =>
                    Number.isFinite(option.price) && option.price >= 0,
                )
                .map((option) => (
                  <label className="shop-option" key={option.name}>
                    <input
                      type="radio"
                      name={id + group.id}
                      required={group.required}
                      checked={options[group.title] === option.name}
                      onChange={() =>
                        setOptions((old) => ({
                          ...old,
                          [group.title]: option.name,
                        }))
                      }
                    />
                    <span>{option.name}</span>
                    <b>+ {formatEGP(option.price)}</b>
                  </label>
                ))}
            </fieldset>
          ))}
          <label>
            الكمية
            <input
              aria-label="كمية المنتج"
              type="number"
              min={1}
              max={50}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label>
            ملاحظات الصنف (اختياري)
            <textarea
              maxLength={500}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <footer>
          <button
            className="shop-primary"
            type="submit"
            disabled={shop.catalogBusy}
          >
            إضافة للسلة — {formatEGP((product.price + extra) * quantity)}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
