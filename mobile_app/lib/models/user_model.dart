enum UserRole {
  employee, // موظف حكومي (العميل)
  chef,     // شيف المطبخ / المطعم
  courier,  // مندوب التوصيل
  admin,    // مدير الحي الحكومي
}

extension UserRoleExtension on UserRole {
  String get titleArabic {
    switch (this) {
      case UserRole.employee:
        return 'موظف حكومي (عميل)';
      case UserRole.chef:
        return 'شيف المطعم';
      case UserRole.courier:
        return 'مندوب التوصيل';
      case UserRole.admin:
        return 'إدارة الحي الحكومي';
    }
  }

  String get iconName {
    switch (this) {
      case UserRole.employee:
        return 'person';
      case UserRole.chef:
        return 'restaurant';
      case UserRole.courier:
        return 'two_wheeler';
      case UserRole.admin:
        return 'admin_panel_settings';
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
  final String? officeNumber;
  final String? floor;
  final String? avatarUrl;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    this.ministryName,
    this.officeNumber,
    this.floor,
    this.avatarUrl,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'role': role.name,
      'ministryName': ministryName,
      'officeNumber': officeNumber,
      'floor': floor,
      'avatarUrl': avatarUrl,
    };
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      email: map['email'] ?? '',
      phone: map['phone'] ?? '',
      role: UserRole.values.firstWhere(
        (r) => r.name == map['role'],
        orElse: () => UserRole.employee,
      ),
      ministryName: map['ministryName'],
      officeNumber: map['officeNumber'],
      floor: map['floor'],
      avatarUrl: map['avatarUrl'],
    );
  }
}
