import 'package:flutter/material.dart';
import '../models/order_model.dart';

class CartProvider with ChangeNotifier {
  final Map<String, OrderItem> _items = {};
  String _selectedMinistry = 'وزارة الاتصالات وتكنولوجيا المعلومات';
  String _building = 'مبنى 07';
  String _floor = 'الدور الرابع';
  String _office = 'مكتب 402';
  double _appliedDiscount = 0.0;
  String? _couponCode;

  Map<String, OrderItem> get items => {..._items};
  int get itemCount => _items.values.fold(0, (sum, item) => sum + item.quantity);
  
  String get selectedMinistry => _selectedMinistry;
  String get building => _building;
  String get floor => _floor;
  String get office => _office;
  double get appliedDiscount => _appliedDiscount;
  double get discount => _appliedDiscount;
  String? get couponCode => _couponCode;

  double get subtotal => _items.values.fold(0.0, (sum, item) => sum + (item.price * item.quantity));
  double get deliveryFee => _items.isEmpty ? 0.0 : 15.0; // 15 EGP delivery within Gov district
  double get total => (subtotal + deliveryFee - _appliedDiscount).clamp(0.0, double.infinity);

  void addItem({
    required String id,
    required String name,
    required double price,
    String? notes,
  }) {
    if (_items.containsKey(id)) {
      final existing = _items[id]!;
      _items[id] = OrderItem(
        id: id,
        name: name,
        price: price,
        quantity: existing.quantity + 1,
        notes: notes ?? existing.notes,
      );
    } else {
      _items[id] = OrderItem(
        id: id,
        name: name,
        price: price,
        quantity: 1,
        notes: notes,
      );
    }
    notifyListeners();
  }

  void removeSingleItem(String id) {
    if (!_items.containsKey(id)) return;
    if (_items[id]!.quantity > 1) {
      final existing = _items[id]!;
      _items[id] = OrderItem(
        id: id,
        name: existing.name,
        price: existing.price,
        quantity: existing.quantity - 1,
        notes: existing.notes,
      );
    } else {
      _items.remove(id);
    }
    notifyListeners();
  }

  void removeItem(String id) {
    _items.remove(id);
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    _appliedDiscount = 0.0;
    _couponCode = null;
    notifyListeners();
  }

  void clear() => clearCart();

  void setMinistry(String ministry) {
    _selectedMinistry = ministry;
    notifyListeners();
  }

  void setDeliveryLocation({
    required String ministry,
    required String building,
    required String floor,
    required String office,
  }) {
    _selectedMinistry = ministry;
    _building = building;
    _floor = floor;
    _office = office;
    notifyListeners();
  }

  bool applyCoupon(String code) {
    final clean = code.trim().toUpperCase();
    if (clean == 'CAPITAL100' || clean == 'العاصمة100') {
      _appliedDiscount = 100.0;
      _couponCode = clean;
      notifyListeners();
      return true;
    } else if (clean == 'GOV20') {
      _appliedDiscount = 20.0;
      _couponCode = clean;
      notifyListeners();
      return true;
    }
    return false;
  }
}
