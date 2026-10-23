import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  static const List<Map<String, String>> _policySections = [
    {
      'title': 'Personal Contact Information',
      'titleAr': 'معلومات الاتصال الشخصية',
      'content':
          'نقوم بجمع بيانات الاتصال الأساسية مثل الاسم، رقم الهاتف، والبريد الإلكتروني فقط لغرض توثيق حساب الموظف، وتسهيل تواصل مندوب التوصيل معك عند الوصول إلى مقر الوزارة أو المبنى الحكومي.',
    },
    {
      'title': 'Use of your information',
      'titleAr': 'استخدام معلوماتك وبياناتك',
      'content':
          'تُستخدم البيانات المدخلة حصراً لمعالجة طلبات الوجبات، وتحديد موقع التوصيل بدقة داخل الحي الحكومي بالعاصمة الإدارية، وإرسال فواتير الشراء وإشعارات حالة الطلب.',
    },
    {
      'title': 'Your Email Address',
      'titleAr': 'عنوان بريدك الإلكتروني',
      'content':
          'يُستخدم بريدك الإلكتروني لإرسال رموز التحقق لمرة واحدة (OTP) مجاناً، وتأكيد الطلبات، واستعادة كلمة المرور، ولن يتم بيع أو مشاركة بريدك الإلكتروني مع أي جهة إعلانية خارجية.',
    },
    {
      'title': 'ATM, Credit Cards and Payment Information',
      'titleAr': 'معلومات بطاقات الدفع وبطاقات ميزة الحكومية',
      'content':
          'تتم جميع عمليات الدفع الإلكتروني عبر بوابة دفع جيديا (Geidea) المعتمدة من البنك المركزي المصري. نحن لا نقوم بتخزين أي أرقام سرية أو بيانات بطاقات بنكية على خوادمنا.',
    },
    {
      'title': 'Order Placement Information',
      'titleAr': 'بيانات تنفيذ وتوصيل الطلبات',
      'content':
          'يتم تسجيل تفاصيل الوجبات المختارة، ومقر الوزارة والمكتب والدور لتوجيه مندوب التوصيل بكفاءة وسرعة، ويتم أرشفة الفواتير لمراجعة حسابات الموظف وسجل النفقات.',
    },
    {
      'title': 'Navigation and Click stream Data',
      'titleAr': 'بيانات التصفح والموقع الجغرافي (GPS)',
      'content':
          'نطلب إذن الوصول إلى الموقع الجغرافي لتحديد مقر الوزارة التابع لها المستخدم تلقائياً على خريطة الحي الحكومي، ولا يتم تتبع موقعك خارج أوقات استخدام التطبيق أو طلب التوصيل.',
    },
    {
      'title': 'We May Use Advertising Companies to Serve Ads For Us',
      'titleAr': 'الإعلانات والعروض الترويجية المعتمدة',
      'content':
          'قد نعرض عروضاً ترويجية حصرية لمطاعم العاصمة الإدارية والشركاء المعتمدين داخل الحي الحكومي بما يخدم موظفي الوزارات.',
    },
    {
      'title': 'Marketing',
      'titleAr': 'التسويق والنشرات الإخبارية',
      'content':
          'يمكنك في أي وقت تفعيل أو إلغاء استلام رسائل العروض الترويجية والخصومات من خلال إعدادات الحساب بضغطة زر واحدة.',
    },
    {
      'title': 'Do We Disclose Your Personal Information?',
      'titleAr': 'هل نكشف عن معلوماتك الشخصية؟',
      'content':
          'نلتزم بأعلى معايير سرية البيانات ولا نشارك أي بيانات للموظفين إلا مع مندوب التوصيل والمطبخ المعني لتجهيز وتسليم الطلب فقط.',
    },
    {
      'title': 'How to Delete your Account',
      'titleAr': 'كيفية حذف حسابك وبياناتك',
      'content':
          'يمكنك حذف حسابك بالكامل وجميع البيانات المرتبطة به في أي وقت من خلال صفحة "معلومات الحساب" -> زر "Delete account". سيتم مسح حسابك فورياً التزاماً بسياسات Apple و Google.',
    },
    {
      'title': 'How Is Personally Identifiable Information Disclosed?',
      'titleAr': 'معايير حماية وأمان البيانات الشخصية',
      'content':
          'تُشفر جميع البيانات المنقولة باستخدام بروتوكولات SSL/TLS ومعايير التشفير القياسية (AES-256) لضمان حماية مطلقة لكافة المعاملات والمستخدمين.',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Privacy policy',
          style: GoogleFonts.cairo(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.black,
          ),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Privacy Policy',
              style: GoogleFonts.cairo(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: 16),
            ..._policySections.map((sec) => _buildAccordionCard(sec)),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildAccordionCard(Map<String, String> sec) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Theme(
        data: ThemeData().copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          iconColor: const Color(0xFFEA580C),
          collapsedIconColor: const Color(0xFFEA580C),
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          title: Text(
            sec['title'] ?? '',
            style: GoogleFonts.cairo(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF1E293B),
            ),
          ),
          subtitle: Text(
            sec['titleAr'] ?? '',
            style: GoogleFonts.cairo(
              fontSize: 11,
              color: const Color(0xFF64748B),
            ),
          ),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                sec['content'] ?? '',
                style: GoogleFonts.cairo(
                  fontSize: 13,
                  color: const Color(0xFF475569),
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
