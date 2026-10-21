import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

enum UserRole {
  employee,   // موظف الحي الحكومي (عميل)
  restaurant, // شيف / مسؤول مطعم في الفود كورت
  courier,    // مندوب توصيل
  admin,      // مدير نظام (للإدارة عبر الويب فقط)
}

extension UserRoleExtension on UserRole {
  String get nameString {
    switch (this) {
      case UserRole.employee:
        return 'employee';
      case UserRole.restaurant:
        return 'restaurant';
      case UserRole.courier:
        return 'courier';
      case UserRole.admin:
        return 'admin';
    }
  }

  String get arabicTitle {
    switch (this) {
      case UserRole.employee:
        return 'موظف حكومي';
      case UserRole.restaurant:
        return 'شيف المطعم';
      case UserRole.courier:
        return 'مندوب التوصيل';
      case UserRole.admin:
        return 'مدير النظام';
    }
  }

  String get arabicLabel => arabicTitle;

  IconData get icon {
    switch (this) {
      case UserRole.employee:
        return Icons.badge_rounded;
      case UserRole.restaurant:
        return Icons.restaurant_menu_rounded;
      case UserRole.courier:
        return Icons.two_wheeler_rounded;
      case UserRole.admin:
        return Icons.admin_panel_settings_rounded;
    }
  }

  static UserRole fromString(String? role) {
    switch (role?.toLowerCase()) {
      case 'restaurant':
      case 'chef':
        return UserRole.restaurant;
      case 'courier':
      case 'captain':
        return UserRole.courier;
      case 'admin':
        return UserRole.admin;
      case 'employee':
      default:
        return UserRole.employee;
    }
  }
}

class UserModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final UserRole role;
  final String? ministryName;
  final String? floor;
  final String? officeNumber;
  final double walletBalance;
  final String? avatarUrl;
  final String? storeId; // للشيف / مسؤول المتجر
  final Map<String, double>? coordinates;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    this.role = UserRole.employee,
    this.ministryName,
    this.floor,
    this.officeNumber,
    this.walletBalance = 0.0,
    this.avatarUrl,
    this.storeId,
    this.coordinates,
    this.createdAt,
    this.updatedAt,
  });

  bool get isAddressComplete =>
      (ministryName?.trim().isNotEmpty ?? false) &&
      (floor?.trim().isNotEmpty ?? false) &&
      (officeNumber?.trim().isNotEmpty ?? false) &&
      (phone.trim().isNotEmpty);

  String get ministry => ministryName ?? '';
  String get floorNumber => floor ?? '';
  String get roomNumber => officeNumber ?? '';

  Map<String, dynamic> toFirestoreMap() {
    return {
      'uid': id,
      'fullName': name,
      'email': email,
      'phone': phone,
      'ministry': ministryName ?? '',
      'floorNumber': floor ?? '',
      'roomNumber': officeNumber ?? '',
      'role': 'employee', // قواعد أمان users/{uid} تشترط دور employee
      'walletBalance': walletBalance,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
      if (coordinates != null) 'coordinates': coordinates,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory UserModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc, {
    Map<String, dynamic>? staffData,
    bool isAdmin = false,
  }) {
    final data = doc.data() ?? {};

    UserRole resolvedRole = UserRole.employee;
    String? assignedStoreId;

    if (isAdmin) {
      resolvedRole = UserRole.admin;
    } else if (staffData != null) {
      final staffRole = staffData['role'] as String?;
      resolvedRole = UserRoleExtension.fromString(staffRole);
      assignedStoreId = staffData['storeId'] as String?;
    }

    DateTime? parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val);
      return null;
    }

    Map<String, double>? parsedCoordinates;
    if (data['coordinates'] is Map) {
      final c = data['coordinates'] as Map;
      if (c['latitude'] is num && c['longitude'] is num) {
        parsedCoordinates = {
          'latitude': (c['latitude'] as num).toDouble(),
          'longitude': (c['longitude'] as num).toDouble(),
        };
      }
    }

    return UserModel(
      id: doc.id,
      name: (data['fullName'] as String?)?.trim().isNotEmpty == true
          ? data['fullName']
          : (staffData?['name'] as String? ?? 'موظف بالعاصمة الإدارية'),
      email: data['email'] as String? ?? '',
      phone: (data['phone'] as String?)?.trim().isNotEmpty == true
          ? data['phone']
          : (staffData?['phone'] as String? ?? ''),
      role: resolvedRole,
      ministryName: data['ministry'] as String?,
      floor: data['floorNumber'] as String?,
      officeNumber: data['roomNumber'] as String?,
      walletBalance: (data['walletBalance'] as num?)?.toDouble() ?? 0.0,
      avatarUrl: data['avatarUrl'] as String?,
      storeId: assignedStoreId,
      coordinates: parsedCoordinates,
      createdAt: parseDate(data['createdAt']),
      updatedAt: parseDate(data['updatedAt']),
    );
  }

  UserModel copyWith({
    String? name,
    String? email,
    String? phone,
    UserRole? role,
    String? ministryName,
    String? floor,
    String? officeNumber,
    double? walletBalance,
    String? avatarUrl,
    String? storeId,
    Map<String, double>? coordinates,
  }) {
    return UserModel(
      id: id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      ministryName: ministryName ?? this.ministryName,
      floor: floor ?? this.floor,
      officeNumber: officeNumber ?? this.officeNumber,
      walletBalance: walletBalance ?? this.walletBalance,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      storeId: storeId ?? this.storeId,
      coordinates: coordinates ?? this.coordinates,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
