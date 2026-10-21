import 'package:flutter/material.dart';
import '../core/constants/colors.dart';

class AppImage extends StatelessWidget {
  final String? urlOrPath;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadius? borderRadius;
  final IconData fallbackIcon;

  const AppImage({
    super.key,
    required this.urlOrPath,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
    this.fallbackIcon = Icons.fastfood_rounded,
  });

  Widget _buildFallback(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: borderRadius,
      ),
      alignment: Alignment.center,
      child: Icon(
        fallbackIcon,
        color: AppColors.textMuted.withValues(alpha: 0.5),
        size: (width != null && width! < 40) ? 18 : 28,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final image = urlOrPath?.trim() ?? '';
    if (image.isEmpty) {
      return _buildFallback(context);
    }

    Widget imgWidget;
    if (image.startsWith('http://') || image.startsWith('https://')) {
      imgWidget = Image.network(
        image,
        width: width,
        height: height,
        fit: fit,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Container(
            width: width,
            height: height,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: borderRadius,
            ),
            child: const Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
              ),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) => _buildFallback(context),
      );
    } else {
      imgWidget = Image.asset(
        image,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (context, error, stackTrace) => _buildFallback(context),
      );
    }

    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: imgWidget);
    }
    return imgWidget;
  }
}
