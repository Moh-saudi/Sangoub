class ProductOption {
  final String name;
  final double additionalPrice;
  final bool isDefault;

  const ProductOption({
    required this.name,
    this.additionalPrice = 0.0,
    this.isDefault = false,
  });
}

class ProductModel {
  final String id;
  final String name;
  final String description;
  final double price;
  final String restaurantId;
  final String restaurantName;
  final String category;
  final String prepTime;
  final double rating;
  final int calories;
  final String image;
  final bool isPopular;
  final List<ProductOption> sizes;
  final List<ProductOption> addOns;

  const ProductModel({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.restaurantId,
    required this.restaurantName,
    required this.category,
    required this.prepTime,
    required this.rating,
    required this.calories,
    required this.image,
    this.isPopular = false,
    this.sizes = const [],
    this.addOns = const [],
  });

  // قائمة وجبات ومنتجات العاصمة المتطابقة مع طلبات
  static List<ProductModel> get capitalProducts => [
        const ProductModel(
          id: 'p1',
          name: 'وجبة فطور ملوكي (كرواسون + أومليت)',
          description:
              'كرواسون زبدة فرنسي ساخن مع أومليت بيض بالجبنة الشيدر، يقدم مع شرائح الطماطم والخيار وزيتون ومشروب شاي ساخن.',
          price: 120.0,
          restaurantId: 'rest_1',
          restaurantName: 'مطبخ العاصمة المركزي',
          category: 'فطور',
          prepTime: '15 دقيقة',
          rating: 4.9,
          calories: 520,
          image: 'assets/images/onboarding_2.png',
          isPopular: true,
          sizes: [
            ProductOption(name: 'حجم عادي', isDefault: true),
            ProductOption(name: 'حجم لارج (+ كرواسون إضافي)', additionalPrice: 35.0),
          ],
          addOns: [
            ProductOption(name: 'زيادة جبنة شيدر مدخنة', additionalPrice: 20.0),
            ProductOption(name: 'عصير برتقال فريش', additionalPrice: 30.0),
            ProductOption(name: 'صوص هوني ماسترد', additionalPrice: 15.0),
          ],
        ),
        const ProductModel(
          id: 'p2',
          name: 'ساندوتش تشيكن جريل شيدر بريميوم',
          description:
              'صدور دجاج مشوية متبلة على الجريل مع صوص المايونيز المدخن، شرائح جبنة شيدر ذائبة، خس وخيار مخلل في خبز بريوش طازج.',
          price: 110.0,
          restaurantId: 'rest_2',
          restaurantName: 'ساندوتشات بريميوم العاصمة',
          category: 'سندوتشات',
          prepTime: '18 دقيقة',
          rating: 4.8,
          calories: 640,
          image: 'assets/images/onboarding_2.png',
          isPopular: true,
          sizes: [
            ProductOption(name: 'ساندوتش فردي', isDefault: true),
            ProductOption(name: 'وجبة كومبو (مع بطاطس ومشروب)', additionalPrice: 40.0),
          ],
          addOns: [
            ProductOption(name: 'هالبينو حار', additionalPrice: 10.0),
            ProductOption(name: 'بيكون لحم مقرمش', additionalPrice: 25.0),
            ProductOption(name: 'مخلل إضافي', additionalPrice: 10.0),
          ],
        ),
        const ProductModel(
          id: 'p3',
          name: 'برجر لحم بلدي دبل تشيز باربيكيو',
          description:
              'قطعتان من لحم الكاندوز الصافي 200 جم مع صوص الباربيكيو الغني، جبنة شيدر أمريكية مضاعفة وحلقات بصل مقرمشة.',
          price: 155.0,
          restaurantId: 'rest_3',
          restaurantName: 'بافلو برجر - Buffalo Burger',
          category: 'برجر',
          prepTime: '22 دقيقة',
          rating: 4.95,
          calories: 820,
          image: 'assets/images/onboarding_4.png',
          isPopular: true,
          sizes: [
            ProductOption(name: 'ساندوتش 200 جم', isDefault: true),
            ProductOption(name: 'وجبة تريبل 300 جم', additionalPrice: 55.0),
          ],
          addOns: [
            ProductOption(name: 'بطاطس ودجز متبلة', additionalPrice: 30.0),
            ProductOption(name: 'صوص بافلو حار', additionalPrice: 15.0),
            ProductOption(name: 'أصابع موتزاريلا (3 قطع)', additionalPrice: 45.0),
          ],
        ),
        const ProductModel(
          id: 'p4',
          name: 'سبانش لاتيه مثلج (Iced Spanish Latte)',
          description:
              'إسبريسو غني مضاعف مع حليب مكثف ومبخر وثلج مجروش، يقدم توازناً مثالياً بين الحلاوة ونكهة القهوة الفاخرة.',
          price: 65.0,
          restaurantId: 'rest_4',
          restaurantName: 'كافيه الحي الحكومي',
          category: 'مشروبات',
          prepTime: '6 دقائق',
          rating: 4.9,
          calories: 280,
          image: 'assets/images/onboarding_2.png',
          isPopular: true,
          sizes: [
            ProductOption(name: 'حجم وسط (Medium)', isDefault: true),
            ProductOption(name: 'حجم كبير (Large)', additionalPrice: 15.0),
          ],
          addOns: [
            ProductOption(name: 'شوت إسبريسو إضافي', additionalPrice: 15.0),
            ProductOption(name: 'حليب شوفان / نباتي', additionalPrice: 20.0),
            ProductOption(name: 'سيرب كراميل', additionalPrice: 12.0),
          ],
        ),
        const ProductModel(
          id: 'p5',
          name: 'شاورما لحم عربي دبل مع صوص طحينة',
          description:
              'شاورما لحم بقري متبل على السيخ ومقطع في خبز صاج مقرمش، تقدم مع طبق بطاطس محمرة، صوص طحينة ومخللات سورية.',
          price: 135.0,
          restaurantId: 'rest_5',
          restaurantName: 'شاورما الريم العاصمة',
          category: 'شاورما',
          prepTime: '15 دقيقة',
          rating: 4.8,
          calories: 710,
          image: 'assets/images/onboarding_2.png',
          isPopular: false,
          sizes: [
            ProductOption(name: 'وجبة عربي عادي', isDefault: true),
            ProductOption(name: 'وجبة عربي دبل', additionalPrice: 45.0),
          ],
          addOns: [
            ProductOption(name: 'ثومية إضافية', additionalPrice: 12.0),
            ProductOption(name: 'دبس رمان', additionalPrice: 10.0),
          ],
        ),
        const ProductModel(
          id: 'p6',
          name: 'سلة فواكه طازجة وسناكس صحية للمكتب',
          description:
              'تشكيلة مختارة من التفاح، الموز، العنب، والمكسرات النيئة الصحية المقسمة لموظفي المكاتب والاجتماعات.',
          price: 180.0,
          restaurantId: 'rest_6',
          restaurantName: 'ماركت الحي الحكومي السريع',
          category: 'سوبر ماركت',
          prepTime: '10 دقائق',
          rating: 4.75,
          calories: 340,
          image: 'assets/images/onboarding_4.png',
          isPopular: false,
          sizes: [
            ProductOption(name: 'سلة فردية للمكتب', isDefault: true),
            ProductOption(name: 'سلة عائلية / اجتماعات', additionalPrice: 120.0),
          ],
          addOns: [
            ProductOption(name: 'مياه معدنية طبيعية 1.5 لتر', additionalPrice: 10.0),
            ProductOption(name: 'بسكويت شوفان دايت', additionalPrice: 25.0),
          ],
        ),
        const ProductModel(
          id: 'p7',
          name: 'سينابون رول كلاسيك دبل بيكان',
          description:
              'لفائف القرفة الدافئة الشهيرة مغطاة بصوص الفروستينج الكريمي الغني وقطع جوز البيكان المحمص اللذيذ.',
          price: 85.0,
          restaurantId: 'rest_7',
          restaurantName: 'سينابون & بيكري العاصمة',
          category: 'حلويات',
          prepTime: '10 دقائق',
          rating: 4.9,
          calories: 590,
          image: 'assets/images/onboarding_2.png',
          isPopular: true,
          sizes: [
            ProductOption(name: 'قطعة واحدة كلاسيك', isDefault: true),
            ProductOption(name: 'بوكس 4 قطع ميني', additionalPrice: 75.0),
          ],
          addOns: [
            ProductOption(name: 'صوص شوكولاتة إضافي', additionalPrice: 18.0),
            ProductOption(name: 'صوص كراميل وفروستينج', additionalPrice: 20.0),
          ],
        ),
      ];
}
