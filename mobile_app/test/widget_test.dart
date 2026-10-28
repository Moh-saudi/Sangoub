import 'package:flutter_test/flutter_test.dart';
import 'package:capital_talabat_app/providers/cart_provider.dart';
import 'package:capital_talabat_app/models/product_model.dart';
import 'package:capital_talabat_app/models/order_model.dart';

void main() {
  test('cart preserves exact product IDs and serializes canonical options', () {
    final cart = CartProvider();
    const product = ProductModel(id:'prod_merchant_item',storeId:'store',storeName:'Test',name:'Product',description:'Test',price:20,category:'فطور',optionGroups:[ProductOptionGroup(id:'size',title:'الحجم',required:true,options:[ProductOptionItem(name:'كبير',price:5)])]);
    cart.addProduct(product,quantity:2,options:{'الحجم':'كبير'},notes:'بدون ملح');
    final payload = cart.toApiItems().single;
    expect(payload['product'], {'id':'prod_merchant_item'});
    expect(payload['quantity'], 2);
    expect(payload['selectedOptions'], {'الحجم':'كبير'});
    expect(payload['notes'], 'بدون ملح');
    expect(cart.subtotal, 50);
    expect(payload.containsKey('price'), isFalse);
  });
  test('archived products cannot be added and underscore IDs are not truncated', () {
    final cart = CartProvider();
    cart.addProduct(const ProductModel(id:'archived',storeId:'store',storeName:'Test',name:'Archived',description:'Test',price:10,category:'فطور',archived:true));
    expect(cart.items, isEmpty);
    cart.addItem(id:'line',productId:'prod_real_id',name:'Product',price:10,storeId:'store');
    expect(cart.toApiItems().single['product'], {'id':'prod_real_id'});
  });
  test('delivery state strings match the backend contract', () {
    expect(OrderStatus.received.rawValue,'received');
    expect(OrderStatus.withCourier.rawValue,'with_courier');
    expect(OrderStatus.delivered.rawValue,'delivered');
  });
}
