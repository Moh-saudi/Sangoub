-- ==============================================================================
-- 🚀 SANGOUB ENTERPRISE CATALOG SEED DATA
-- بيانات تجريبية حقيقية توضح دقة المعمارية في كل قطاع (مطعم، سوبر ماركت، صيدلية)
-- ==============================================================================

DO $$
DECLARE
    v_foul_store_id UUID := '27d12743-8106-4ef0-ba3c-84abefdb75d6';
    v_super_store_id UUID := '54a6c2f6-6c29-4177-ac65-32fadddea83d';
    
    v_meal_spu_id UUID;
    v_domty_spu_id UUID;
    v_panadol_spu_id UUID;
    
    v_meal_offer_id UUID;
    v_domty_offer_id UUID;
    
    v_group1_id UUID;
    v_group2_id UUID;
BEGIN
    -- 1. صنف قياسي لمطعم (SPU)
    INSERT INTO public.master_spu (vertical_id, name_ar, name_en, description, brand_name, specifications)
    VALUES (
        'restaurant',
        'ساندوتش فطور مشكل العاصمة',
        'Capital Breakfast Sandwich Combo',
        'ساندوتش عيش بلدي طازج مع تشكيلة الفول والطعمية والإضافات',
        'فول وفلافل العاصمة',
        '{"serving_size": "ساندوتش كبير", "bread_type": "عيش بلدي طازج"}'::jsonb
    )
    RETURNING id INTO v_meal_spu_id;

    -- عرض التاجر للمطعم (Offer)
    INSERT INTO public.store_offers (store_id, spu_id, merchant_pos_sku, base_price, is_available)
    VALUES (v_foul_store_id, v_meal_spu_id, 'POS-FL-101', 15.00, true)
    RETURNING id INTO v_meal_offer_id;

    -- مجموعة خيارات 1: نوع الساندوتش (إجباري اختيار واحد)
    INSERT INTO public.product_modifier_groups (offer_id, title_ar, min_selection, max_selection, sort_order)
    VALUES (v_meal_offer_id, 'اختر نوع الساندوتش الأساسي', 1, 1, 1)
    RETURNING id INTO v_group1_id;

    INSERT INTO public.product_modifier_items (group_id, name_ar, extra_price, is_default, sort_order)
    VALUES 
        (v_group1_id, 'فول بالخلطة والليمون المعصفر', 0.00, true, 1),
        (v_group1_id, 'طعمية إسكندراني محشية كيري', 0.00, false, 2),
        (v_group1_id, 'ميكس فول على طعمية (سنجوب سبيشال)', 2.00, false, 3);

    -- مجموعة خيارات 2: إضافات حسب الرغبة (اختياري متعدد)
    INSERT INTO public.product_modifier_groups (offer_id, title_ar, min_selection, max_selection, sort_order)
    VALUES (v_meal_offer_id, 'إضافات حسب رغبتك', 0, 4, 2)
    RETURNING id INTO v_group2_id;

    INSERT INTO public.product_modifier_items (group_id, name_ar, extra_price, is_default, sort_order)
    VALUES 
        (v_group2_id, 'طحينة بيضاء خام زيادة', 2.00, false, 1),
        (v_group2_id, 'سلطة بلدي خضراء', 1.50, false, 2),
        (v_group2_id, 'باذنجان مخلل دقة ثوم', 3.00, false, 3),
        (v_group2_id, 'بيض مسلوق مدحرج في سمن بلدي', 6.00, false, 4);

    -- 2. صنف قياسي لسوبر ماركت (SPU) مع باركود دولي ومحول كاشير
    INSERT INTO public.master_spu (vertical_id, primary_barcode, brand_name, name_ar, name_en, specifications)
    VALUES (
        'supermarket',
        '6223000512345',
        'دومتي (Domty)',
        'جبنة دومتي فيتا بلس بطعم القشطة 500 جم',
        'Domty Feta Plus Cheese 500g',
        '{"weight": "500g", "packaging": "تتراباك", "flavor": "قشطة"}'::jsonb
    )
    RETURNING id INTO v_domty_spu_id;

    -- عرض التاجر للسوبر ماركت مع كود كاشيره الداخلي
    INSERT INTO public.store_offers (store_id, spu_id, merchant_pos_sku, base_price, is_available, track_inventory, stock_qty)
    VALUES (v_super_store_id, v_domty_spu_id, 'SKU-DOMTY-7701', 38.00, true, true, 45)
    RETURNING id INTO v_domty_offer_id;

    -- ربط الباركود الدولي + كود ميزان الكاشير الداخلي للتاجر
    INSERT INTO public.store_offer_barcodes (offer_id, barcode, barcode_type)
    VALUES 
        (v_domty_offer_id, '6223000512345', 'international'),
        (v_domty_offer_id, '990007701005', 'internal_label');

    -- 3. صنف صيدلية قياسي (SPU)
    INSERT INTO public.master_spu (vertical_id, primary_barcode, brand_name, name_ar, name_en, specifications)
    VALUES (
        'pharmacy',
        '5000347065095',
        'Panadol',
        'بنادول إكسترا أحمر 24 قرص مسكن للصداع والآلام',
        'Panadol Extra 24 Tablets',
        '{"active_ingredients": "Paracetamol 500mg + Caffeine 65mg", "dosage_form": "أقراص", "requires_prescription": false}'::jsonb
    )
    RETURNING id INTO v_panadol_spu_id;

END $$;

