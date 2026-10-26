export type CartLine = {
  id: string;
  productId: string;
  quantity: number;
  selectedOptions: Record<string, string>;
  notes: string;
};
/** Remove only the acknowledged quantities, preserving additions made while checkout was in flight. */
export function remainingCart(current: CartLine[], purchased: CartLine[]) {
  const taken = new Map(purchased.map((line) => [line.id, line]));
  return current.flatMap((line) => {
    const paid = taken.get(line.id);
    if (!paid || paid.productId !== line.productId) return [line];
    const quantity = Math.max(0, line.quantity - paid.quantity);
    return quantity ? [{ ...line, quantity }] : [];
  });
}
