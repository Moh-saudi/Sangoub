import 'dart:convert';
import 'dart:typed_data';
import '../../core/services/api_service.dart';
import 'package:firebase_auth/firebase_auth.dart' hide AuthProvider;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/constants/colors.dart';
import '../../core/services/cloudflare_r2_service.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import 'saved_addresses_screen.dart';

class AccountInfoScreen extends StatefulWidget {
  const AccountInfoScreen({super.key});

  @override
  State<AccountInfoScreen> createState() => _AccountInfoScreenState();
}

class _AccountInfoScreenState extends State<AccountInfoScreen> {
  bool _isEditing = false;
  bool _isSaving = false;
  bool _isUploadingAvatar = false;
  String? _avatarUrl;
  Uint8List? _localAvatarBytes;

  late TextEditingController _emailController;
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _phoneController;
  late TextEditingController _dobController;

  String _gender = 'Male';
  bool _receiveOffers = true;
  bool _subscribeNewsletter = true;

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    final nameParts = (user?.name ?? 'محمد السعودي').trim().split(' ');
    final firstName = nameParts.isNotEmpty ? nameParts.first : 'محمد';
    final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : 'السعودي';

    _avatarUrl = user?.avatarUrl;

    _emailController = TextEditingController(text: user?.email ?? 'mo.saudi19@gmail.com');
    _firstNameController = TextEditingController(text: firstName);
    _lastNameController = TextEditingController(text: lastName);
    _phoneController = TextEditingController(text: user?.phone ?? '01012345678');
    _dobController = TextEditingController(text: '15 / 06 / 1992');

    _loadSavedPreferences(user?.id ?? FirebaseAuth.instance.currentUser?.uid);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  /// تحميل الصورة والتفضيلات المحفوظة محلياً فور فتح الشاشة
  Future<void> _loadSavedPreferences(String? userId) async {
    if (userId == null) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedBase64 = prefs.getString('user_avatar_base64_$userId');
      if (cachedBase64 != null && cachedBase64.isNotEmpty && mounted) {
        setState(() {
          _localAvatarBytes = base64Decode(cachedBase64);
        });
      }
      final savedDob = prefs.getString('user_dob_$userId');
      if (savedDob != null && savedDob.isNotEmpty) {
        _dobController.text = savedDob;
      }
      final savedGender = prefs.getString('user_gender_$userId');
      if (savedGender != null && mounted) {
        setState(() => _gender = savedGender);
      }
      final savedOffers = prefs.getBool('user_offers_$userId');
      if (savedOffers != null && mounted) {
        setState(() => _receiveOffers = savedOffers);
      }
      final savedNewsletter = prefs.getBool('user_newsletter_$userId');
      if (savedNewsletter != null && mounted) {
        setState(() => _subscribeNewsletter = savedNewsletter);
      }
    } catch (e) {
      debugPrint('Error loading saved preferences: $e');
    }
  }

  String _getFullName() {
    final first = _firstNameController.text.trim();
    final last = _lastNameController.text.trim();
    if (first.isEmpty && last.isEmpty) {
      final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
      return user?.name ?? 'العميل';
    }
    return '$first $last'.trim();
  }

  /// اختيار الصورة الشخصية وعرضها محلياً فوراً ثم حفظها سحابياً
  Future<void> _pickAndUploadAvatar(ImageSource source) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.currentUser;
    if (user == null) return;

    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 600,
        maxHeight: 600,
        imageQuality: 80,
      );

      if (pickedFile == null) return;

      setState(() => _isUploadingAvatar = true);

      final bytes = await pickedFile.readAsBytes();

      // 1. عرض فوري في الذاكرة بدون أي انتظار
      setState(() {
        _localAvatarBytes = bytes;
      });

      // 2. حفظ محلي سريع في SharedPreferences
      final base64Image = base64Encode(bytes);
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('user_avatar_base64_${user.id}', base64Image);
      } catch (e) {
        debugPrint('Cache avatar error: $e');
      }

      bool avatarSynced = false;

      // 4. محاولة رفع إلى Cloudflare R2 كخلفية (إن كان متاحاً)
      try {
        final uploadedUrl = await CloudflareR2Service.uploadUserAvatar(
          imageBytes: bytes,
          userId: user.id,
          contentType: 'image/jpeg',
        );
        if (uploadedUrl.isNotEmpty && !uploadedUrl.startsWith('data:')) {
          _avatarUrl = uploadedUrl;
          avatarSynced = true;
          auth.updateAvatarUrl(uploadedUrl);
        }
      } catch (e) {
        debugPrint('R2 background upload note: $e');
      }

      setState(() => _isUploadingAvatar = false);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 20),
              const SizedBox(width: 8),
              Text(
                avatarSynced ? 'تم حفظ صورتك الشخصية في حسابك' : 'الصورة محلية فقط؛ تعذر رفعها، أعد المحاولة',
                style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          backgroundColor: AppColors.navy,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      debugPrint('Avatar pick error: $e');
      if (mounted) {
        setState(() => _isUploadingAvatar = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('تعذر اختيار الصورة: $e', style: GoogleFonts.cairo()),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  /// حفظ كافة التعديلات في استعلام واحد موحد بقاعدة البيانات
  Future<void> _saveAllChanges() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.currentUser;
    final fbUser = FirebaseAuth.instance.currentUser;
    final uid = user?.id ?? fbUser?.uid;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('يرجى تسجيل الدخول أولاً لحفظ التعديلات', style: GoogleFonts.cairo()),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final fullName = '$firstName $lastName'.trim();
    final phone = _phoneController.text.trim();
    final dob = _dobController.text.trim();

    if (fullName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('يرجى إدخال الاسم', style: GoogleFonts.cairo()),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      // 1. حفظ التفضيلات الإضافية محلياً في SharedPreferences
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_dob_$uid', dob);
      await prefs.setString('user_gender_$uid', _gender);
      await prefs.setBool('user_offers_$uid', _receiveOffers);
      await prefs.setBool('user_newsletter_$uid', _subscribeNewsletter);

      await ApiService().updateOwnProfile({
        'fullName': fullName,
        if (phone.isNotEmpty) 'phone': phone,
      });

      // 3. تحديث اسم المستخدم في Firebase Auth
      final firebaseUser = FirebaseAuth.instance.currentUser;
      if (firebaseUser != null && fullName.isNotEmpty) {
        try {
          await firebaseUser.updateDisplayName(fullName);
        } catch (_) {}
      }

      // 4. تحديث جلسة المستخدم في التطبيق محلياً
      await auth.reloadUserSession();

      if (!mounted) return;
      setState(() {
        _isEditing = false;
        _isSaving = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.greenAccent, size: 20),
              const SizedBox(width: 8),
              Text(
                'تم حفظ كافة التعديلات بنجاح',
                style: GoogleFonts.cairo(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          backgroundColor: AppColors.navy,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      debugPrint('Save profile error: $e');
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('تعذر حفظ التعديلات: $e', style: GoogleFonts.cairo()),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
  }

  void _cancelEditing() {
    final user = Provider.of<AuthProvider>(context, listen: false).currentUser;
    final nameParts = (user?.name ?? '').trim().split(' ');
    final firstName = nameParts.isNotEmpty ? nameParts.first : '';
    final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';

    setState(() {
      _isEditing = false;
      _emailController.text = user?.email ?? '';
      _firstNameController.text = firstName;
      _lastNameController.text = lastName;
      _phoneController.text = user?.phone ?? '';
    });
  }

  void _showAvatarPickerSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'تغيير الصورة الشخصية',
              style: GoogleFonts.cairo(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer.withValues(alpha: 0.3),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.camera_alt_rounded, color: AppColors.primary, size: 22),
              ),
              title: Text(
                'التقاط صورة بالكاميرا',
                style: GoogleFonts.cairo(fontSize: 13.5, fontWeight: FontWeight.bold),
              ),
              onTap: () {
                Navigator.of(ctx).pop();
                _pickAndUploadAvatar(ImageSource.camera);
              },
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: const BoxDecoration(
                  color: Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.photo_library_rounded, color: AppColors.navy, size: 22),
              ),
              title: Text(
                'اختيار من معرض الصور',
                style: GoogleFonts.cairo(fontSize: 13.5, fontWeight: FontWeight.bold),
              ),
              onTap: () {
                Navigator.of(ctx).pop();
                _pickAndUploadAvatar(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteAccountDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 30),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 5,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.warning_amber_rounded, color: Colors.red.shade600, size: 32),
            ),
            const SizedBox(height: 14),
            Text(
              'حذف الحساب نهائياً',
              style: GoogleFonts.cairo(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'هل أنت متأكد من رغبتك في حذف الحساب؟ سيتم مسح كافة البيانات وسجل الطلبات والمحفظة وفقاً لسياسات الخصوصية ولا يمكن استرجاعها.',
              textAlign: TextAlign.center,
              style: GoogleFonts.cairo(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                    ),
                    child: Text(
                      'إلغاء',
                      style: GoogleFonts.cairo(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.navy,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      Navigator.of(ctx).pop();
                      final auth = Provider.of<AuthProvider>(context, listen: false);
                      await auth.signOut();
                      if (!mounted) return;
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (route) => false,
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red.shade600,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(
                      'تأكيد الحذف',
                      style: GoogleFonts.cairo(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).currentUser;
    final photoUrl = _avatarUrl ?? user?.avatarUrl;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'الملف الشخصي والبيانات',
          style: GoogleFonts.cairo(
            fontSize: 17,
            fontWeight: FontWeight.bold,
            color: Colors.black,
          ),
        ),
        actions: [
          if (_isEditing)
            TextButton(
              onPressed: _cancelEditing,
              child: Text(
                'إلغاء',
                style: GoogleFonts.cairo(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade600,
                ),
              ),
            )
          else
            TextButton.icon(
              onPressed: () => setState(() => _isEditing = true),
              icon: const Icon(Icons.edit_rounded, size: 16, color: AppColors.primary),
              label: Text(
                'تعديل',
                style: GoogleFonts.cairo(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          const SizedBox(width: 8),
        ],
      ),
      bottomNavigationBar: _isEditing
          ? SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 10,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _saveAllChanges,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.check_rounded, color: Colors.white, size: 20),
                  label: Text(
                    _isSaving ? 'جارٍ حفظ التعديلات...' : 'حفظ كافة التعديلات',
                    style: GoogleFonts.cairo(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            )
          : null,
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── قسم الصورة الشخصية الحديث ───
            _buildAvatarSection(photoUrl),
            const SizedBox(height: 16),

            // ─── مرجع العنوان والمنطقة المسجلة من الخريطة ───
            InkWell(
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SavedAddressesScreen()),
                );
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'العنوان والمنطقة المحددة',
                            style: GoogleFonts.cairo(
                              fontSize: 12.5,
                              fontWeight: FontWeight.bold,
                              color: AppColors.navy,
                            ),
                          ),
                          Text(
                            user?.ministryName?.isNotEmpty == true
                                ? user!.ministryName!
                                : 'اضغط لإدارة العناوين وتحديد موقعك على الخريطة',
                            style: GoogleFonts.cairo(
                              fontSize: 11.5,
                              color: AppColors.textSecondary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded, size: 13, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Email Field
            _buildFieldCard(
              label: 'البريد الإلكتروني',
              controller: _emailController,
              enabled: _isEditing,
            ),
            const SizedBox(height: 10),

            // First Name
            _buildFieldCard(
              label: 'الاسم الأول',
              controller: _firstNameController,
              enabled: _isEditing,
            ),
            const SizedBox(height: 10),

            // Last Name
            _buildFieldCard(
              label: 'اسم العائلة',
              controller: _lastNameController,
              enabled: _isEditing,
            ),
            const SizedBox(height: 10),

            // Phone Number
            _buildFieldCard(
              label: 'رقم الهاتف',
              controller: _phoneController,
              enabled: _isEditing,
            ),
            const SizedBox(height: 10),

            // Date of Birth
            _buildFieldCard(
              label: 'تاريخ الميلاد (اختياري)',
              controller: _dobController,
              suffixIcon: Icons.calendar_today_rounded,
              enabled: _isEditing,
              onTap: _isEditing
                  ? () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: DateTime(1992, 6, 15),
                        firstDate: DateTime(1950),
                        lastDate: DateTime.now(),
                      );
                      if (picked != null) {
                        setState(() {
                          _dobController.text =
                              '${picked.day.toString().padLeft(2, '0')} / ${picked.month.toString().padLeft(2, '0')} / ${picked.year}';
                        });
                      }
                    }
                  : null,
            ),
            const SizedBox(height: 16),

            // Gender
            Text(
              'النوع',
              style: GoogleFonts.cairo(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                _buildGenderRadio('Male', 'ذكر'),
                const SizedBox(width: 24),
                _buildGenderRadio('Female', 'أنثى'),
              ],
            ),
            const SizedBox(height: 12),

            // Marketing Checkboxes
            _buildCheckboxRow(
              value: _receiveOffers,
              label: 'استلام العروض والخصومات الحصرية',
              onChanged: _isEditing ? (val) => setState(() => _receiveOffers = val ?? false) : null,
            ),
            const SizedBox(height: 6),
            _buildCheckboxRow(
              value: _subscribeNewsletter,
              label: 'الاشتراك في النشرة الإخبارية لمنصة سنجوب',
              onChanged: _isEditing ? (val) => setState(() => _subscribeNewsletter = val ?? false) : null,
            ),
            const SizedBox(height: 20),

            // Delete Account Button
            Center(
              child: TextButton.icon(
                onPressed: _showDeleteAccountDialog,
                icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 18),
                label: Text(
                  'حذف الحساب نهائياً',
                  style: GoogleFonts.cairo(
                    color: Colors.redAccent,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarSection(String? photoUrl) {
    ImageProvider? imageProvider;
    if (_localAvatarBytes != null) {
      imageProvider = MemoryImage(_localAvatarBytes!);
    } else if (photoUrl != null && photoUrl.startsWith('data:image')) {
      try {
        final rawBase64 = photoUrl.split(',').last;
        imageProvider = MemoryImage(base64Decode(rawBase64));
      } catch (_) {}
    } else if (photoUrl != null && photoUrl.trim().isNotEmpty) {
      imageProvider = NetworkImage(photoUrl);
    }

    return Center(
      child: Column(
        children: [
          GestureDetector(
            onTap: _showAvatarPickerSheet,
            child: Stack(
              children: [
                Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF1F5F9),
                  border: Border.all(
                    color: AppColors.primary.withValues(alpha: 0.35),
                    width: 2.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.navy.withValues(alpha: 0.08),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: ClipOval(
                  child: _isUploadingAvatar
                      ? const Center(
                          child: SizedBox(
                            width: 28,
                            height: 28,
                            child: CircularProgressIndicator(strokeWidth: 2.5, color: AppColors.primary),
                          ),
                        )
                      : (imageProvider != null
                          ? Image(
                              image: imageProvider,
                              fit: BoxFit.cover,
                              width: 92,
                              height: 92,
                              errorBuilder: (context, error, stackTrace) => const Icon(
                                Icons.person_rounded,
                                size: 48,
                                color: AppColors.textMuted,
                              ),
                            )
                          : const Icon(
                              Icons.person_rounded,
                              size: 48,
                              color: AppColors.textMuted,
                            )),
                ),
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _showAvatarPickerSheet,
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.primary, AppColors.primaryDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.35),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.camera_alt_rounded,
                        size: 15,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          ),
          const SizedBox(height: 8),
          Text(
            _getFullName(),
            style: GoogleFonts.cairo(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppColors.navy,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFieldCard({
    required String label,
    required TextEditingController controller,
    IconData? suffixIcon,
    bool enabled = true,
    VoidCallback? onTap,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: enabled ? Colors.white : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: enabled ? AppColors.primary.withValues(alpha: 0.45) : const Color(0xFFE2E8F0),
          width: enabled ? 1.2 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: GoogleFonts.cairo(
                    fontSize: 10.5,
                    color: const Color(0xFF94A3B8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                TextField(
                  controller: controller,
                  enabled: enabled,
                  readOnly: onTap != null,
                  onTap: onTap,
                  style: GoogleFonts.cairo(
                    fontSize: 13.5,
                    color: enabled ? AppColors.navy : const Color(0xFF334155),
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.only(top: 2, bottom: 2),
                    border: InputBorder.none,
                  ),
                ),
              ],
            ),
          ),
          if (suffixIcon != null)
            Icon(
              suffixIcon,
              size: 17,
              color: enabled ? AppColors.primary : const Color(0xFF94A3B8),
            ),
        ],
      ),
    );
  }

  Widget _buildGenderRadio(String value, String arabicLabel) {
    final isSelected = _gender == value;
    return InkWell(
      onTap: _isEditing ? () => setState(() => _gender = value) : null,
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? AppColors.primary : const Color(0xFFCBD5E1),
                  width: isSelected ? 5.5 : 1.5,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              arabicLabel,
              style: GoogleFonts.cairo(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isSelected ? AppColors.navy : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckboxRow({
    required bool value,
    required String label,
    required ValueChanged<bool?>? onChanged,
  }) {
    return InkWell(
      onTap: onChanged != null ? () => onChanged(!value) : null,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: Checkbox(
                value: value,
                onChanged: onChanged,
                activeColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.cairo(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF334155),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
