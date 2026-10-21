class MinistryModel {
  final String id;
  final String nameArabic;
  final String sector;
  final String buildingNumber;
  final int totalOffices;
  final String icon;

  const MinistryModel({
    required this.id,
    required this.nameArabic,
    required this.sector,
    required this.buildingNumber,
    required this.totalOffices,
    required this.icon,
  });

  static const List<MinistryModel> governmentDistrictMinistries = [
    MinistryModel(
      id: 'cabinet',
      nameArabic: 'رئاسة مجلس الوزراء',
      sector: 'القطاع السيادي والرئاسي',
      buildingNumber: 'مبنى 01',
      totalOffices: 180,
      icon: 'account_balance',
    ),
    MinistryModel(
      id: 'mof',
      nameArabic: 'وزارة المالية',
      sector: 'المجمع المالي والاقتصادي',
      buildingNumber: 'مبنى 04',
      totalOffices: 240,
      icon: 'payments',
    ),
    MinistryModel(
      id: 'mcit',
      nameArabic: 'وزارة الاتصالات وتكنولوجيا المعلومات',
      sector: 'مجمع التكنولوجيا والابتكار',
      buildingNumber: 'مبنى 07',
      totalOffices: 310,
      icon: 'devices',
    ),
    MinistryModel(
      id: 'mohp',
      nameArabic: 'وزارة الصحة والسكان',
      sector: 'القطاع الخدمي',
      buildingNumber: 'مبنى 12',
      totalOffices: 260,
      icon: 'local_hospital',
    ),
    MinistryModel(
      id: 'moe',
      nameArabic: 'وزارة التربية والتعليم والتعليم الفني',
      sector: 'القطاع التعليمي',
      buildingNumber: 'مبنى 15',
      totalOffices: 290,
      icon: 'school',
    ),
    MinistryModel(
      id: 'moee',
      nameArabic: 'وزارة الكهرباء والطاقة المتجددة',
      sector: 'قطاع الطاقة والمرافق',
      buildingNumber: 'مبنى 09',
      totalOffices: 210,
      icon: 'bolt',
    ),
    MinistryModel(
      id: 'housing',
      nameArabic: 'وزارة الإسكان والمرافق والمجتمعات العمرانية',
      sector: 'قطاع التنمية العمرانية',
      buildingNumber: 'مبنى 03',
      totalOffices: 350,
      icon: 'apartment',
    ),
    MinistryModel(
      id: 'mofa',
      nameArabic: 'وزارة الخارجية والتعاون الدولي',
      sector: 'القطاع الدبلوماسي',
      buildingNumber: 'مبنى 02',
      totalOffices: 200,
      icon: 'public',
    ),
  ];
}
