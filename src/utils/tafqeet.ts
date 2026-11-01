/**
 * Converts numbers into Arabic text for Egyptian Pounds (Tafqeet)
 * e.g., 141.5 => "فقط مائة وواحد وأربعون جنيهاً مصرياً وخمسون قرشاً لا غير"
 */

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
  'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];

const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function convertUnderThousand(n: number): string {
  if (n === 0) return '';
  const parts: string[] = [];

  const h = Math.floor(n / 100);
  const rem = n % 100;

  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }

  if (rem > 0) {
    if (rem < 20) {
      parts.push(ONES[rem]);
    } else {
      const o = rem % 10;
      const t = Math.floor(rem / 10);
      if (o > 0) {
        parts.push(ONES[o] + ' و' + TENS[t]);
      } else {
        parts.push(TENS[t]);
      }
    }
  }

  return parts.join(' و');
}

export function tafqeetEGP(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return 'صفر جنيه مصري لا غير';
  }

  const integerPart = Math.floor(amount);
  const piasters = Math.round((amount - integerPart) * 100);

  const parts: string[] = [];

  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    const milText = millions === 1 ? 'مليون' : millions === 2 ? 'مليونان' : convertUnderThousand(millions) + ' ملايين';
    parts.push(milText);
  }

  const remAfterMil = integerPart % 1000000;
  if (remAfterMil >= 1000) {
    const thousands = Math.floor(remAfterMil / 1000);
    const thouText = thousands === 1 ? 'ألف' : thousands === 2 ? 'ألفان' : convertUnderThousand(thousands) + ' آلاف';
    parts.push(thouText);
  }

  const remAfterThou = remAfterMil % 1000;
  if (remAfterThou > 0) {
    parts.push(convertUnderThousand(remAfterThou));
  }

  let result = 'فقط ';
  if (integerPart > 0) {
    result += parts.join(' و') + ' جنيهاً مصرياً';
  }

  if (piasters > 0) {
    result += (integerPart > 0 ? ' و' : '') + convertUnderThousand(piasters) + ' قرشاً';
  }

  result += ' لا غير';
  return result;
}

