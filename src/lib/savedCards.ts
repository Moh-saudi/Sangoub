import { supabase } from './supabase';

export type CardBrand = 'visa' | 'mastercard' | 'meeza' | 'card';

export interface SavedBankCard {
  id: string;
  userId: string;
  cardholderName: string;
  brand: CardBrand;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault: boolean;
  cardToken?: string;
  createdAt: string;
}

const STORAGE_KEY_PREFIX = 'sangoub_saved_cards_';
let isCloudCardsTableAvailable: boolean | null = null;

/**
 * كشف شبكة البطاقة (فيزا، ماستركارد، ميزة) بناءً على رقم البطاقة
 */
export function detectCardBrand(cardNumber: string): CardBrand {
  const clean = cardNumber.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
  if (/^(5078|6219|6281|6361)/.test(clean)) return 'meeza';
  return 'card';
}

/**
 * التحقق من صحة رقم البطاقة البنكية باستخدام خوارزمية لُوهن (Luhn Algorithm) المعتمدة عالمياً
 */
export function validateCardNumber(cardNumber: string): boolean {
  const clean = cardNumber.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * التحقق من تاريخ صلاحية البطاقة البنكية
 */
export function validateCardExpiry(month: string, year: string): boolean {
  const m = parseInt(month, 10);
  const rawY = year.trim();
  const y = parseInt(rawY.length === 2 ? `20${rawY}` : rawY, 10);
  if (isNaN(m) || isNaN(y) || m < 1 || m > 12) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (y < currentYear) return false;
  if (y === currentYear && m < currentMonth) return false;
  if (y > currentYear + 20) return false;
  return true;
}

/**
 * تنسيق رقم البطاقة مع مسافات كل 4 أرقام
 */
export function formatCardNumber(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * جلب البطاقات المحفوظة للعميل (مع مزامنة سحابية ومحلية)
 */
export async function getSavedCards(userId: string): Promise<SavedBankCard[]> {
  if (!userId) return [];
  const localKey = `${STORAGE_KEY_PREFIX}${userId}`;
  let localCards: SavedBankCard[] = [];
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) localCards = JSON.parse(raw);
  } catch {}

  // If cloud table was previously checked and not found, don't spam 404 network requests
  if (isCloudCardsTableAvailable === false) {
    return localCards;
  }

  try {
    const { data, error, status } = await supabase
      .from('user_saved_cards')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      if (status === 404 || error.code === '42P01' || error.message?.includes('not found') || error.message?.includes('does not exist')) {
        isCloudCardsTableAvailable = false;
      }
      return localCards;
    }

    isCloudCardsTableAvailable = true;
    if (Array.isArray(data) && data.length > 0) {
      const dbCards: SavedBankCard[] = data.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        cardholderName: row.cardholder_name,
        brand: (row.brand || 'card') as CardBrand,
        last4: row.last4,
        expiryMonth: row.expiry_month,
        expiryYear: row.expiry_year,
        isDefault: Boolean(row.is_default),
        cardToken: row.card_token || undefined,
        createdAt: row.created_at,
      }));
      try {
        localStorage.setItem(localKey, JSON.stringify(dbCards));
      } catch {}
      return dbCards;
    }
  } catch (err) {
    isCloudCardsTableAvailable = false;
    console.debug('Cloud cards sync fallback to local:', err);
  }

  return localCards;
}

/**
 * حفظ بطاقة بنكية جديدة للعميل
 */
export async function saveBankCard(
  cardInput: {
    userId: string;
    cardholderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    isDefault?: boolean;
    cardToken?: string;
  }
): Promise<SavedBankCard> {
  const cleanNumber = cardInput.cardNumber.replace(/\D/g, '');
  const last4 = cleanNumber.slice(-4) || '****';
  const brand = detectCardBrand(cleanNumber);
  const cardId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`;
  const now = new Date().toISOString();

  const newCard: SavedBankCard = {
    id: cardId,
    userId: cardInput.userId,
    cardholderName: cardInput.cardholderName.trim(),
    brand,
    last4,
    expiryMonth: cardInput.expiryMonth.trim().padStart(2, '0'),
    expiryYear: cardInput.expiryYear.trim().slice(-2),
    isDefault: cardInput.isDefault ?? true,
    cardToken: cardInput.cardToken,
    createdAt: now,
  };

  const localKey = `${STORAGE_KEY_PREFIX}${cardInput.userId}`;
  let currentList: SavedBankCard[] = [];
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) currentList = JSON.parse(raw);
  } catch {}

  // If this card is default, make others non-default
  if (newCard.isDefault) {
    currentList = currentList.map((c) => ({ ...c, isDefault: false }));
  }

  const updatedList = [newCard, ...currentList];
  try {
    localStorage.setItem(localKey, JSON.stringify(updatedList));
  } catch {}

  // Attempt database persistence in Supabase if table is available
  if (isCloudCardsTableAvailable !== false) {
    try {
      if (newCard.isDefault) {
        await supabase
          .from('user_saved_cards')
          .update({ is_default: false })
          .eq('user_id', cardInput.userId);
      }

      const { error, status } = await supabase.from('user_saved_cards').insert({
        id: cardId,
        user_id: cardInput.userId,
        cardholder_name: newCard.cardholderName,
        brand: newCard.brand,
        last4: newCard.last4,
        expiry_month: newCard.expiryMonth,
        expiry_year: newCard.expiryYear,
        is_default: newCard.isDefault,
        card_token: newCard.cardToken || null,
        created_at: now,
      });

      if (error && (status === 404 || error.code === '42P01' || error.message?.includes('not found') || error.message?.includes('does not exist'))) {
        isCloudCardsTableAvailable = false;
      }
    } catch (dbErr) {
      isCloudCardsTableAvailable = false;
      console.debug('Saved card Supabase sync skipped:', dbErr);
    }
  }

  window.dispatchEvent(new CustomEvent('sangoub_cards_updated', { detail: { userId: cardInput.userId } }));
  return newCard;
}

/**
 * حذف بطاقة بنكية
 */
export async function deleteSavedCard(userId: string, cardId: string): Promise<void> {
  const localKey = `${STORAGE_KEY_PREFIX}${userId}`;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      let list: SavedBankCard[] = JSON.parse(raw);
      list = list.filter((c) => c.id !== cardId);
      localStorage.setItem(localKey, JSON.stringify(list));
    }
  } catch {}

  if (isCloudCardsTableAvailable !== false) {
    try {
      await supabase.from('user_saved_cards').delete().eq('id', cardId).eq('user_id', userId);
    } catch (dbErr) {
      console.debug('Delete card Supabase sync skipped:', dbErr);
    }
  }

  window.dispatchEvent(new CustomEvent('sangoub_cards_updated', { detail: { userId } }));
}

/**
 * تعيين بطاقة كافتراضية
 */
export async function setDefaultCard(userId: string, cardId: string): Promise<void> {
  const localKey = `${STORAGE_KEY_PREFIX}${userId}`;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      let list: SavedBankCard[] = JSON.parse(raw);
      list = list.map((c) => ({ ...c, isDefault: c.id === cardId }));
      localStorage.setItem(localKey, JSON.stringify(list));
    }
  } catch {}

  if (isCloudCardsTableAvailable !== false) {
    try {
      await supabase.from('user_saved_cards').update({ is_default: false }).eq('user_id', userId);
      await supabase.from('user_saved_cards').update({ is_default: true }).eq('id', cardId).eq('user_id', userId);
    } catch (dbErr) {
      console.debug('Set default card Supabase sync skipped:', dbErr);
    }
  }

  window.dispatchEvent(new CustomEvent('sangoub_cards_updated', { detail: { userId } }));
}

