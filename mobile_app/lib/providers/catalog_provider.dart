import 'dart:async';
import 'package:flutter/material.dart';
import '../core/services/firebase_service.dart';
import '../models/store_model.dart';
import '../models/product_model.dart';

class CatalogProvider with ChangeNotifier {
  final FirebaseService _firebaseService = FirebaseService();

  StreamSubscription<List<StoreModel>>? _storesSubscription;
  StreamSubscription<List<ProductModel>>? _productsSubscription;

  List<StoreModel> _stores = [];
  List<ProductModel> _products = [];
  bool _isLoading = true;
  String? _selectedCategory;
  String _searchQuery = '';

  // تصفية المتاجر: فقط المتاجر المفتوحة والنشطة تظهر لعملاء التطبيق
  List<StoreModel> get stores => _stores.where((s) => s.isOpen).toList();
  List<StoreModel> get allStores => [..._stores];

  // تصفية المنتجات: تظهر فقط المنتجات المتاحة غير المؤرشفة التابعة لمتاجر مفتوحة
  List<ProductModel> get products {
    final openStoreIds = _stores.where((s) => s.isOpen).map((s) => s.id).toSet();
    return _products.where((p) {
      if (p.archived || !p.inStock) return false;
      if (p.storeId.isNotEmpty && !openStoreIds.contains(p.storeId)) return false;
      return true;
    }).toList();
  }

  bool get isLoading => _isLoading;
  String? get selectedCategory => _selectedCategory;
  String get searchQuery => _searchQuery;

  CatalogProvider() {
    initCatalogStreams();
  }

  void initCatalogStreams() {
    _isLoading = true;
    notifyListeners();

    _storesSubscription = _firebaseService.streamStores().listen((storesList) {
      _stores = storesList;
      _isLoading = false;
      notifyListeners();
    }, onError: (e) {
      debugPrint('Error streaming stores: $e');
      _isLoading = false;
      notifyListeners();
    });

    _productsSubscription = _firebaseService.streamProducts().listen((productsList) {
      _products = productsList;
      _isLoading = false;
      notifyListeners();
    }, onError: (e) {
      debugPrint('Error streaming products: $e');
      _isLoading = false;
      notifyListeners();
    });
  }

  StoreModel? getStoreById(String storeId) {
    try {
      return _stores.firstWhere((s) => s.id == storeId);
    } catch (_) {
      return null;
    }
  }

  ProductModel? getProductById(String productId) {
    try {
      return _products.firstWhere((p) => p.id == productId);
    } catch (_) {
      return null;
    }
  }

  List<ProductModel> getProductsForStore(String storeId) {
    final store = getStoreById(storeId);
    if (store == null || !store.isOpen) return [];
    return _products.where((p) => p.storeId == storeId && p.isAvailable && !p.archived).toList();
  }

  List<ProductModel> get filteredProducts {
    final openStoreIds = _stores.where((s) => s.isOpen).map((s) => s.id).toSet();
    return _products.where((p) {
      if (!p.isAvailable || p.archived) return false;
      if (p.storeId.isNotEmpty && !openStoreIds.contains(p.storeId)) return false;
      if (_selectedCategory != null &&
          _selectedCategory!.isNotEmpty &&
          _selectedCategory != 'الكل' &&
          p.category != _selectedCategory) {
        return false;
      }
      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final matchName = p.name.toLowerCase().contains(query);
        final matchDesc = p.description.toLowerCase().contains(query);
        final matchStore = p.storeName.toLowerCase().contains(query);
        if (!matchName && !matchDesc && !matchStore) return false;
      }
      return true;
    }).toList();
  }

  void setCategory(String? category) {
    _selectedCategory = category;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query.trim();
    notifyListeners();
  }

  @override
  void dispose() {
    _storesSubscription?.cancel();
    _productsSubscription?.cancel();
    super.dispose();
  }
}
