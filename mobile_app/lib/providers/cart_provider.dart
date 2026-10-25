import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../core/utils/distance_helper.dart';
import '../models/order_model.dart';
import '../models/product_model.dart';

class CartProvider with ChangeNotifier {
  final Map<String, OrderItem> _items = {};
  double _appliedDiscount = 0.0;
  String? _couponCode;

  Map<String, OrderItem> get items => {..._items};
  int get itemCount => _items.values.fold(0, (total, item) => total + item.quantity);

  double get appliedDiscount => _appliedDiscount;
  double get discount => _appliedDiscount;
  String? get couponCode => _couponCode;

  String _selectedMinistry = 'العاصمة الإدارية الجديدة';
  String get selectedMinistry => _selectedMinistry;

  double? _selectedLatitude;
  double? _selectedLongitude;
  double? get selectedLatitude => _selectedLatitude;
  double? get selectedLongitude => _selectedLongitude;

  String get deliveryDistanceLabel {
    if (_selectedLatitude != null && _selectedLongitude != null) {
      final km = DistanceHelper.distanceToCustomer(
        customerLat: _selectedLatitude!,
        customerLng: _selectedLongitude!,
      );
      return DistanceHelper.formatDistance(km);
    }
    return '1.8 كم';
  }

  String get deliveryZoneName {
    if (_selectedLatitude != null && _selectedLongitude != null) {
      return DistanceHelper.getZoneName(
        customerLat: _selectedLatitude!,
        customerLng: _selectedLongitude!,
        addressHint: _selectedMinistry,
      );
    }
    return _selectedMinistry;
  }

  void setMinistry(String ministry, {double? latitude, double? longitude}) {
    _selectedMinistry = ministry;
    if (latitude != null && longitude != null) {
      _selectedLatitude = latitude;
      _selectedLongitude = longitude;
    }
    notifyListeners();
  }

  void setCoordinates(double lat, double lng) {
    _selectedLatitude = lat;
    _selectedLongitude = lng;
    notifyListeners();
  }

  void addItem({
    required String id,
    String? productId,
    required String name,
    required double price,
    String storeId = 'capital-central-kitchen',
  }) {
    final cleanProductId = (productId != null && productId.isNotEmpty)
        ? productId
        : id.contains('_') && (id.startsWith('prod') || id.startsWith('p_') || id.startsWith('item'))
            ? id.split('_')[0]
            : id;

    if (_items.containsKey(id)) {
      final existing = _items[id]!;
      _items[id] = OrderItem(
        id: id,
        productId: cleanProductId,
        storeId: existing.storeId.isNotEmpty ? existing.storeId : storeId,
        name: existing.name,
        price: existing.price,
        quantity: existing.quantity + 1,
        extraPrice: existing.extraPrice,
        selectedOptions: existing.selectedOptions,
        notes: existing.notes,
      );
    } else {
      _items[id] = OrderItem(
        id: id,
        productId: cleanProductId,
        storeId: storeId,
        name: name,
        price: price,
        quantity: 1,
      );
    }
    notifyListeners();
  }

  double get subtotal => _items.values.fold(
      0.0, (total, item) => total + ((item.price + item.extraPrice) * item.quantity));

  // رسوم التوصيل: 15 جنيه لكل متجر متميز
  double get deliveryFee {
    if (_items.isEmpty) return 0.0;
    final storeCount = _items.values.map((i) => i.storeId).toSet().length;
    return (storeCount > 0 ? storeCount : 1) * 15.0;
  }

  double get total =>
      (subtotal + deliveryFee - _appliedDiscount).clamp(0.0, double.infinity);

  void addProduct(ProductModel product, {int quantity = 1, Map<String, String>? options, String? notes}) {
    if (!product.isAvailable) return;

    final key = options != null && options.isNotEmpty
        ? '${product.id}_${options.values.join('_')}'
        : product.id;

    double extra = 0.0;
    if (options != null) {
      for (final grp in product.optionGroups) {
        final selected = options[grp.title];
        if (selected != null) {
          final opt = grp.options.firstWhere(
            (o) => o.name == selected,
            orElse: () => const ProductOptionItem(name: '', price: 0),
          );
          extra += opt.price;
        }
      }
    }

    if (_items.containsKey(key)) {
      final existing = _items[key]!;
      _items[key] = OrderItem(
        id: key,
        productId: product.id,
        storeId: product.storeId,
        name: product.name,
        price: product.price,
        quantity: existing.quantity + quantity,
        extraPrice: extra,
        selectedOptions: options ?? existing.selectedOptions,
        notes: notes ?? existing.notes,
      );
    } else {
      _items[key] = OrderItem(
        id: key,
        productId: product.id,
        storeId: product.storeId,
        name: product.name,
        price: product.price,
        quantity: quantity,
        extraPrice: extra,
        selectedOptions: options ?? const {},
        notes: notes,
      );
    }
    notifyListeners();
  }

  void removeSingleItem(String key) {
    if (!_items.containsKey(key)) return;
    if (_items[key]!.quantity > 1) {
      final existing = _items[key]!;
      _items[key] = OrderItem(
        id: key,
        productId: existing.productId,
        storeId: existing.storeId,
        name: existing.name,
        price: existing.price,
        quantity: existing.quantity - 1,
        extraPrice: existing.extraPrice,
        selectedOptions: existing.selectedOptions,
        notes: existing.notes,
      );
    } else {
      _items.remove(key);
    }
    notifyListeners();
  }

  void removeItem(String key) {
    _items.remove(key);
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    _appliedDiscount = 0.0;
    _couponCode = null;
    notifyListeners();
  }

  void clear() => clearCart();

  /// التحقق من كود الخصم من Firestore (/coupons/{code})
  Future<bool> applyCoupon(String code) async {
    final cleanCode = code.trim().toUpperCase();
    if (cleanCode.isEmpty) return false;

    try {
      final doc = await FirebaseFirestore.instance
          .collection('coupons')
          .doc(cleanCode)
          .get();

      if (!doc.exists) {
        _appliedDiscount = 0.0;
        _couponCode = null;
        notifyListeners();
        return false;
      }

      final data = doc.data()!;
      final double minOrder = (data['minOrder'] as num?)?.toDouble() ?? 0.0;
      if (subtotal < minOrder) {
        return false;
      }

      final double val = (data['value'] as num?)?.toDouble() ?? 0.0;
      final String discountType = data['discountType'] as String? ?? 'fixed';

      if (discountType == 'percent') {
        _appliedDiscount = (subtotal * val / 100).clamp(0.0, subtotal);
      } else {
        _appliedDiscount = val.clamp(0.0, subtotal);
      }

      _couponCode = cleanCode;
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }

  void removeCoupon() {
    _appliedDiscount = 0.0;
    _couponCode = null;
    notifyListeners();
  }

  /// تحويل السلة إلى صيغة items المطلوبة لـ POST /api/orders
  List<Map<String, dynamic>> toApiItems() {
    return _items.values.map((item) {
      String cleanId = item.productId.trim();
      if (cleanId.contains('_') && (cleanId.startsWith('prod') || cleanId.startsWith('p_') || cleanId.startsWith('item'))) {
        cleanId = cleanId.split('_')[0];
      }

      return {
        'product': {'id': cleanId},
        'quantity': item.quantity,
        'selectedOptions': item.selectedOptions,
        if (item.notes != null && item.notes!.isNotEmpty) 'notes': item.notes,
      };
    }).toList();
  }
}
