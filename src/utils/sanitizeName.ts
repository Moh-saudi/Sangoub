// ==============================================================================
// 🛡️ SANGOUB - NAME & STRING SANITIZER
// Completely eliminates corrupted '????' characters and encoding artifacts
// ==============================================================================

/**
 * Checks if a name string is corrupted with question marks or invalid encodings
 */
export function isCorruptedName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (trimmed.length === 0) return true;

  // 1. Matches strings consisting entirely of question marks (Latin ? or Arabic ؟) and spaces
  if (/^[\s\?؟\-_.,#*!]+$/.test(trimmed)) return true;

  // 2. Matches strings with 2 or more consecutive question marks (e.g. '???? ??????')
  if (/[\?؟]{2,}/.test(trimmed)) return true;

  // 3. Matches if more than 30% of characters are question marks
  const qCount = (trimmed.match(/[\?؟]/g) || []).length;
  if (qCount > 0 && (qCount / trimmed.length) > 0.3) return true;

  return false;
}

/**
 * Cleans and sanitizes names for display across the platform
 */
export function cleanName(name?: string | null, fallback = 'مستخدم سنجوب'): string {
  if (isCorruptedName(name)) {
    return fallback;
  }
  return (name as string).trim();
}

/**
 * Specifically cleans courier names
 */
export function cleanCourierName(name?: string | null, phone?: string | null): string {
  if (isCorruptedName(name)) {
    if (phone && phone.length >= 4) {
      return `كابتن (${phone.slice(-4)})`;
    }
    return 'كابتن توصيل';
  }
  return (name as string).trim();
}

/**
 * Specifically cleans customer names
 */
export function cleanCustomerName(name?: string | null, phone?: string | null, email?: string | null): string {
  if (isCorruptedName(name)) {
    if (email && email.includes('@')) {
      const local = email.split('@')[0];
      if (!isCorruptedName(local)) return local;
    }
    if (phone && phone.length >= 4) {
      return `عميل (${phone.slice(-4)})`;
    }
    return 'عميل سنجوب';
  }
  return (name as string).trim();
}

