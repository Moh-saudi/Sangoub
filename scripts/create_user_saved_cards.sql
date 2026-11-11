-- ==============================================================================
-- 🚀 SANGOUB USER SAVED BANK CARDS (PCI-DSS TOKENIZED SECURE STORAGE)
-- منظومة سنجوب - جدول البطاقات البنكية المشفرة للعملاء
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_saved_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cardholder_name text NOT NULL,
  brand text NOT NULL DEFAULT 'card' CHECK (brand IN ('visa', 'mastercard', 'meeza', 'card')),
  last4 text NOT NULL CHECK (length(last4) = 4),
  expiry_month text NOT NULL,
  expiry_year text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  card_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- الفهارس لتحسين سرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_user_saved_cards_user_id ON public.user_saved_cards(user_id);

-- تفعيل أمان مستوى الصف (Row Level Security)
ALTER TABLE public.user_saved_cards ENABLE ROW LEVEL SECURITY;

-- سياسات RLS: العميل يصل لبطاقاته فقط
DROP POLICY IF EXISTS "Users can view their own saved cards" ON public.user_saved_cards;
CREATE POLICY "Users can view their own saved cards"
  ON public.user_saved_cards FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own saved cards" ON public.user_saved_cards;
CREATE POLICY "Users can insert their own saved cards"
  ON public.user_saved_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own saved cards" ON public.user_saved_cards;
CREATE POLICY "Users can update their own saved cards"
  ON public.user_saved_cards FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saved cards" ON public.user_saved_cards;
CREATE POLICY "Users can delete their own saved cards"
  ON public.user_saved_cards FOR DELETE
  USING (auth.uid() = user_id);

-- الصلاحيات
GRANT ALL ON public.user_saved_cards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_cards TO authenticated;
