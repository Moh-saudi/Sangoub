class RestaurantModel {
  final String id;
  final String name;
  final String category;
  final String logo;
  final String coverImage;
  final double rating;
  final int reviewsCount;
  final String deliveryTime;
  final double deliveryFee;
  final bool isFeatured;
  final String location;

  const RestaurantModel({
    required this.id,
    required this.name,
    required this.category,
    required this.logo,
    required this.coverImage,
    required this.rating,
    required this.reviewsCount,
    required this.deliveryTime,
    required this.deliveryFee,
    this.isFeatured = false,
    required this.location,
  });

  // قائمة مطاعم ومحلات الحي الحكومي بالعاصمة الإدارية
  static List<RestaurantModel> get capitalRestaurants => [
        const RestaurantModel(
          id: 'rest_1',
          name: 'مطبخ العاصمة المركزي',
          category: 'وجبات ومأكولات شرقية',
          logo: 'assets/images/app_icon.png',
          coverImage: 'assets/images/onboarding_2.png',
          rating: 4.9,
          reviewsCount: 1420,
          deliveryTime: '15-20 دقيقة',
          deliveryFee: 15.0,
          isFeatured: true,
          location: 'فود كورت مجمع الوزارات الرئيسي',
        ),
        const RestaurantModel(
          id: 'rest_2',
          name: 'ساندوتشات بريميوم العاصمة',
          category: 'سندوتشات وفطور',
          logo: 'assets/images/delivery_pin.png',
          coverImage: 'assets/images/onboarding_2.png',
          rating: 4.8,
          reviewsCount: 980,
          deliveryTime: '12-18 دقيقة',
          deliveryFee: 15.0,
          isFeatured: true,
          location: 'المبنى الخدمي B - الحي الحكومي',
        ),
        const RestaurantModel(
          id: 'rest_3',
          name: 'بافلو برجر - Buffalo Burger',
          category: 'برجر وسندوتشات',
          logo: 'assets/images/delivery_pin.png',
          coverImage: 'assets/images/onboarding_4.png',
          rating: 4.9,
          reviewsCount: 2310,
          deliveryTime: '20-25 دقيقة',
          deliveryFee: 20.0,
          isFeatured: true,
          location: 'مول الحي الدبلوماسي والحكومي',
        ),
        const RestaurantModel(
          id: 'rest_4',
          name: 'كافيه الحي الحكومي (Specialty Coffee)',
          category: 'قهوة ومشروبات وحلويات',
          logo: 'assets/images/app_icon.png',
          coverImage: 'assets/images/onboarding_2.png',
          rating: 4.95,
          reviewsCount: 3100,
          deliveryTime: '8-12 دقيقة',
          deliveryFee: 10.0,
          isFeatured: true,
          location: 'بهو مبنى رئاسة مجلس الوزراء',
        ),
        const RestaurantModel(
          id: 'rest_5',
          name: 'شاورما الريم العاصمة',
          category: 'شاورما وسريع',
          logo: 'assets/images/delivery_pin.png',
          coverImage: 'assets/images/onboarding_2.png',
          rating: 4.7,
          reviewsCount: 840,
          deliveryTime: '15-22 دقيقة',
          deliveryFee: 15.0,
          isFeatured: false,
          location: 'مجمع خدمات الوزارات C',
        ),
        const RestaurantModel(
          id: 'rest_6',
          name: 'ماركت الحي الحكومي السريع',
          category: 'سوبر ماركت ومستلزمات',
          logo: 'assets/images/app_icon.png',
          coverImage: 'assets/images/onboarding_4.png',
          rating: 4.85,
          reviewsCount: 1650,
          deliveryTime: '10-15 دقيقة',
          deliveryFee: 10.0,
          isFeatured: true,
          location: 'محطة الخدمات المركزية D',
        ),
        const RestaurantModel(
          id: 'rest_7',
          name: 'سينابون & بيكري العاصمة',
          category: 'مخبوزات وحلويات',
          logo: 'assets/images/delivery_pin.png',
          coverImage: 'assets/images/onboarding_2.png',
          rating: 4.9,
          reviewsCount: 1120,
          deliveryTime: '15-20 دقيقة',
          deliveryFee: 15.0,
          isFeatured: false,
          location: 'الفود كورت الجنوبي',
        ),
      ];
}
