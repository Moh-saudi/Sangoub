-- ==============================================================================
-- 🚀 SANGOUB ENTERPRISE PHARMACY, MEDICAL & CLEANING CATALOG SEEDING
-- إضافة شجرة تصنيفات الصيدلية والمستلزمات الطبية والمنظفات والكتالوج الموحد
-- Project Ref: tvnsqatkaqyubeznhnmu
-- ==============================================================================

-- 1. التأكد من وجود قطاع الصيدلية في catalog_verticals
INSERT INTO public.catalog_verticals (id, name_ar, icon, requires_prescription, supports_modifiers)
VALUES 
    ('pharmacy', 'صيدلية وعناية شخصية', 'cross', false, false)
ON CONFLICT (id) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    requires_prescription = EXCLUDED.requires_prescription;

-- 2. زرع شجرة التصنيفات الهرمية (L1 > L2) للصيدلية والمنظفات
DO $$
DECLARE
    -- معرفات أقسام الصيدلية الرئيسية (L1)
    v_pharm_meds UUID := 'c1111111-1111-4000-8000-000000000001';
    v_pharm_supplies UUID := 'c1111111-1111-4000-8000-000000000002';
    v_pharm_derma UUID := 'c1111111-1111-4000-8000-000000000003';

    -- معرفات أقسام الصيدلية الفرعية (L2)
    v_sub_analgesics UUID := 'c1111111-2222-4000-8000-000000000001';
    v_sub_cold UUID := 'c1111111-2222-4000-8000-000000000002';
    v_sub_digestive UUID := 'c1111111-2222-4000-8000-000000000003';
    v_sub_vitamins UUID := 'c1111111-2222-4000-8000-000000000004';
    v_sub_wound UUID := 'c1111111-2222-4000-8000-000000000005';
    v_sub_devices UUID := 'c1111111-2222-4000-8000-000000000006';
    v_sub_ppe UUID := 'c1111111-2222-4000-8000-000000000007';
    v_sub_creams UUID := 'c1111111-2222-4000-8000-000000000008';

    -- معرفات أقسام المنظفات (L1 > L2)
    v_clean_home UUID := 'c2222222-1111-4000-8000-000000000001';
    v_sub_laundry UUID := 'c2222222-2222-4000-8000-000000000001';
    v_sub_dish UUID := 'c2222222-2222-4000-8000-000000000002';
    v_sub_surfaces UUID := 'c2222222-2222-4000-8000-000000000003';
    v_sub_paper UUID := 'c2222222-2222-4000-8000-000000000004';
    v_sub_fresheners UUID := 'c2222222-2222-4000-8000-000000000005';

    -- متجر الصيدلية المعتمد
    v_pharmacy_store UUID := 'b1111111-2222-3333-4444-555555555501';
    -- متجر السوبر ماركت (موجود مسبقاً)
    v_supermarket_store UUID := '54a6c2f6-6c29-4177-ac65-32fadddea83d';
BEGIN
    -- أ. تصنيفات الصيدلية الرئيسية (L1)
    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (v_pharm_meds, 'pharmacy', NULL, 'أدوية وعلاجات', 'Medications & Treatments', 'seed-pharm-meds', 'pill', 1),
        (v_pharm_supplies, 'pharmacy', NULL, 'مستلزمات طبية وإسعافات أولية', 'Medical Supplies & First Aid', 'seed-pharm-supplies', 'heart-pulse', 2),
        (v_pharm_derma, 'pharmacy', NULL, 'العناية الشخصية والعلاجية', 'Personal & Derma Care', 'seed-pharm-derma', 'sparkles', 3)
    ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;

    -- ب. تصنيفات الصيدلية الفرعية (L2)
    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (v_sub_analgesics, 'pharmacy', v_pharm_meds, 'مسكنات وخافض للحرارة', 'Pain Relief & Fever', 'seed-sub-analgesics', 'activity', 1),
        (v_sub_cold, 'pharmacy', v_pharm_meds, 'أدوية البرد والإنفلونزا والسعال', 'Cold, Cough & Flu', 'seed-sub-cold', 'thermometer', 2),
        (v_sub_digestive, 'pharmacy', v_pharm_meds, 'الجهاز الهضمي والمعدة والقولون', 'Digestive & Antacids', 'seed-sub-digestive', 'shield', 3),
        (v_sub_vitamins, 'pharmacy', v_pharm_meds, 'فيتامينات ومكملات غذائية', 'Vitamins & Supplements', 'seed-sub-vitamins', 'sparkles', 4),
        (v_sub_wound, 'pharmacy', v_pharm_supplies, 'مطهرات ومعقمات وإسعاف الجروح', 'Antiseptics & Wound Care', 'seed-sub-wound', 'shield-check', 1),
        (v_sub_devices, 'pharmacy', v_pharm_supplies, 'أجهزة طبية وقياسات منزلية', 'Medical Devices & Monitors', 'seed-sub-devices', 'gauge', 2),
        (v_sub_ppe, 'pharmacy', v_pharm_supplies, 'مستهلكات ووقاية طبية', 'Disposables & PPE', 'seed-sub-ppe', 'heart', 3),
        (v_sub_creams, 'pharmacy', v_pharm_derma, 'كريمات ومراهم موضعية', 'Topical Creams & Ointments', 'seed-sub-creams', 'droplet', 1)
    ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;

    -- ج. تصنيفات المنظفات (L1 و L2) تحت قطاع السوبرماركت
    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (v_clean_home, 'supermarket', NULL, 'منظفات وعناية بالمنزل', 'Household Cleaning & Laundry', 'seed-clean-home', 'sparkles', 5)
    ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;

    INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
    VALUES
        (v_sub_laundry, 'supermarket', v_clean_home, 'مساحيق ومنظفات الغسيل', 'Laundry Detergents', 'seed-sub-laundry', 'shirt', 1),
        (v_sub_dish, 'supermarket', v_clean_home, 'غسيل الصحون والمطبخ', 'Dishwashing & Kitchen Care', 'seed-sub-dish', 'utensils', 2),
        (v_sub_surfaces, 'supermarket', v_clean_home, 'مطهرات ومعقمات الأسطح والأرضيات', 'Disinfectants & Surface Cleaners', 'seed-sub-surfaces', 'shield', 3),
        (v_sub_paper, 'supermarket', v_clean_home, 'مناديل ومستلزمات ورقية', 'Paper Towels & Tissues', 'seed-sub-paper', 'scroll', 4),
        (v_sub_fresheners, 'supermarket', v_clean_home, 'معطرات ومبيدات حشرية', 'Air Fresheners & Insecticides', 'seed-sub-fresheners', 'wind', 5)
    ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;

    -- 3. تسجيل متجر الصيدلية المعتمد بالحي الحكومي والعاصمة
    INSERT INTO public.stores (
        id, name, name_en, type, category, status, rating, rating_count,
        delivery_time, min_order, delivery_fee, location_in_district,
        coverage_radius_km, commission_rate, tax_rate
    )
    VALUES (
        v_pharmacy_store,
        'صيدلية العاصمة المركزية - 24/7',
        'The Capital Central Pharmacy - 24/7',
        'صيدلية وعناية طبية',
        'pharmacy',
        'open',
        4.95,
        120,
        '15-25 دقيقة',
        30.00,
        10.00,
        'الحي الحكومي - المجمع الطبي والخدمي مبنى C1',
        10,
        8.00,
        14.00
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        name_en = EXCLUDED.name_en,
        category = EXCLUDED.category,
        status = EXCLUDED.status;

    -- 4. إضافة الأصناف إلى الكتالوج العام الموحد (Master SPU)
    -- =========================================================================

    -- أ. الأدوية
    INSERT INTO public.master_spu (id, vertical_id, category_id, name_ar, name_en, primary_barcode, description, suggested_price)
    VALUES
        (gen_random_uuid(), 'pharmacy', v_sub_analgesics, 'بنادول أزرق أدفانس 24 قرص 500 مجم', 'Panadol Advance 500mg 24 Tablets', '5054563044174', 'مسكن سريع للآلام وخافض للحرارة وآمن ولطيف على جدار المعدة', 35.00),
        (gen_random_uuid(), 'pharmacy', v_sub_analgesics, 'بنادول إكسترا أحمر 24 قرص', 'Panadol Extra 24 Tablets', '5054563044181', 'تركيبة مضاعفة بالباراسيتامول والكافيين لمقاومة الصداع الشديد وآلام الجسم', 45.00),
        (gen_random_uuid(), 'pharmacy', v_sub_analgesics, 'بروفين 400 مجم 30 قرص مسكن ومضاد للالتهاب', 'Brufen 400mg 30 Tablets', '6221155020011', 'مسكن قوي لآلام المفاصل والأسنان والعضلات وخافض للحرارة', 58.00),
        (gen_random_uuid(), 'pharmacy', v_sub_cold, 'كونجستال 20 قرص لنزلات البرد والرشح', 'Congestal Cold & Flu 20 Tablets', '6221155020028', 'علاج متكامل لأعراض الرشح والزكام وانسداد الأنف وتكسير الجسم', 39.00),
        (gen_random_uuid(), 'pharmacy', v_sub_cold, 'كومتركس 24 قرص لعلاج أعراض البرد القوية', 'Comtrex Multi-Symptom Cold 24 Tablets', '6221155020035', 'تركيبة ثلاثية المفعول لاحتقان الجيوب الأنفية وسيلان الأنف والصداع', 48.00),
        (gen_random_uuid(), 'pharmacy', v_sub_digestive, 'أقراص ريني للمضغ لحموضة وحرقة المعدة 24 قرص', 'Rennie Spearmint Antacid 24 Chewable Tablets', '5000425010012', 'أقراص بنكهة النعناع لمعادلة حموضة المعدة الزائدة والتخلص السريع من الحرقان', 42.00),
        (gen_random_uuid(), 'pharmacy', v_sub_digestive, 'شراب جافيسكون بنكهة النعناع 150 مل', 'Gaviscon Peppermint Liquid 150ml', '5000158067891', 'حاجز وقائي سريع ضد ارتجاع المريء وحموضة المعدة يدوم لساعات', 65.00),
        (gen_random_uuid(), 'pharmacy', v_sub_vitamins, 'فيتامين سي فوار فيتاسيد سي 1000 مجم 12 قرص', 'Vitacid C 1000mg Effervescent 12 Tablets', '6221155020042', 'فوار فيتامين سي لتقوية الجهاز المناعي ومقاومة نزلات البرد', 32.00),
        (gen_random_uuid(), 'pharmacy', v_sub_vitamins, 'زنكترون كبسولات زنك وفيتامينات 30 كبسولة', 'Zinctron Zinc & Multivitamins 30 Capsules', '6221155020059', 'مكمل غذائي غني بالزنك العضوي ومجموعة فيتامينات لدعم المناعة والشعر', 75.00),
        (gen_random_uuid(), 'pharmacy', v_sub_vitamins, 'أوميجا 3 بلس 30 كبسولة جيلاتينية زيت سمك', 'Omega 3 Plus 30 Softgels', '6221155020066', 'أحماض أوميجا 3 النقية لدعم صحة القلب والشرايين وخفض الكوليسترول', 98.00),
        (gen_random_uuid(), 'pharmacy', v_sub_vitamins, 'سنتروم لوتين مالتي فيتامين ومعادن 30 قرص', 'Centrum with Lutein 30 Tablets', '300054452033', 'تركيبة غذائية متكاملة من 26 فيتامين ومعدن أساسي مع اللوتين', 260.00),
        (gen_random_uuid(), 'pharmacy', v_sub_creams, 'كريم فيوسيدين مضاد حيوي موضعي 30 جم', 'Fucidin 2% Antibiotic Cream 30g', '5702191001012', 'مضاد حيوي موضعي لعلاج التهابات الجلد والدمامل والجروح السطحية', 46.00),
        (gen_random_uuid(), 'pharmacy', v_sub_creams, 'بانثينول كريم طبي مرطب وملطف للجلد 50 جم', 'Panthenol Skin Moisturizing Cream 50g', '6221155020073', 'كريم مرطب غني بفيتامين B5 لتجديد خلايا البشرة وعلاج الجفاف', 30.00),

    -- ب. المستلزمات الطبية
        (gen_random_uuid(), 'pharmacy', v_sub_wound, 'بيتادين محلول مطهر ومعقم للجروح 120 مل', 'Betadine Antiseptic Solution 120ml', '6221155020080', 'محلول بوفيدون يود 10% مطهر واسع المدى يقتل البكتيريا والفيروسات', 48.00),
        (gen_random_uuid(), 'pharmacy', v_sub_wound, 'كحول إيثيلي نقي طبي 70% بخاخ 500 مل', 'Medical Ethyl Alcohol 70% Spray 500ml', '6221155020097', 'كحول طبي 70% للتعقيم الفوري للأيدي والأسطح والأدوات', 45.00),
        (gen_random_uuid(), 'pharmacy', v_sub_wound, 'قطن طبي مصري معقم ومبيض 100 جم', 'Pure Sterile Medical Cotton 100g', '6221155020103', 'قطن طبي نقي 100% عالي الامتصاص ومعقم لتنظيف الجروح', 22.00),
        (gen_random_uuid(), 'pharmacy', v_sub_wound, 'شاش طبي معقم باكت 10 قطع 10x10 سم', 'Sterile Medical Gauze Swabs 10x10cm (10 Pcs)', '6221155020110', 'قطع شاش طبي معقمة فردياً لحماية الجروح وامتصاص الإفرازات', 28.00),
        (gen_random_uuid(), 'pharmacy', v_sub_wound, 'بلاستر لاصق جروح طبي مضاد للماء 20 قطعة', 'Waterproof First Aid Plasters 20 Pcs', '6221155020127', 'ضمادات لاصقة طبية مقاومة للماء لا تلتصق بالجروح', 25.00),
        (gen_random_uuid(), 'pharmacy', v_sub_wound, 'رباط ضاغط طبي مطاطي 10 سم مع مشابك', 'Elastic Crepe Bandage 10cm', '6221155020134', 'رباط ضاغط مرن قطني لدعم المفاصل والأوتار في حالات الالتواء', 20.00),
        (gen_random_uuid(), 'pharmacy', v_sub_devices, 'جهاز قياس ضغط الدم ديجيتال أومرون M2', 'Omron M2 Digital Blood Pressure Monitor', '4015672101018', 'جهاز إلكتروني ياباني دقيق لقياس ضغط الدم والنبض مع مؤشر اضطراب النبض', 1650.00),
        (gen_random_uuid(), 'pharmacy', v_sub_devices, 'جهاز قياس سكر الدم أكيوتشيك إنستانت', 'Accu-Chek Instant Blood Glucose Meter Kit', '4015672101025', 'جهاز قياس دقيق للسكر في 4 ثوانٍ مع قلم شك وخازات', 720.00),
        (gen_random_uuid(), 'pharmacy', v_sub_devices, 'شرائط قياس السكر أكيوتشيك إنستانت 50 شريط', 'Accu-Chek Instant Test Strips 50 Pcs', '4015672101032', 'شرائط اختبار سكر الدم الأصلية مجهزة بامتصاص سريع وموثوق', 420.00),
        (gen_random_uuid(), 'pharmacy', v_sub_devices, 'ترمومتر طبي رقمي ديجيتال سريع لقياس الحرارة', 'Digital Clinical Thermometer Rapid Read', '6221155020141', 'مقياس حرارة رقمي دقيق يعطي النتيجة في 30 ثانية مع تنبيه صوتي', 85.00),
        (gen_random_uuid(), 'pharmacy', v_sub_ppe, 'كمامات طبية 3 طبقات مع دعامة أنف عبوة 50 قطعة', '3-Ply Surgical Medical Face Masks (Box of 50)', '6221155020158', 'كمامات طبية ثلاثية الطبقات عالية الفلترة ومقاومة للرذاذ', 65.00),
        (gen_random_uuid(), 'pharmacy', v_sub_ppe, 'قفازات لاتكس فحص طبي بدون بودرة 100 قفاز', 'Powder-Free Latex Examination Gloves (100 Pcs)', '6221155020165', 'قفازات طبية مرنة عالية الحماية ومقاومة للتمزق', 140.00),
        (gen_random_uuid(), 'pharmacy', v_sub_ppe, 'سرنجات طبية معقمة 3 سم بيك عبوة 10 سرنجات', 'Sterile Disposable Syringes 3ml (Pack of 10)', '6221155020172', 'سرنجات طبية ثلاثية القطع معقمة فردياً بسن رفيع وتدريج دقيق', 35.00),

    -- ج. المنظفات والعناية بالمنزل
        (gen_random_uuid(), 'supermarket', v_sub_laundry, 'مسحوق غسيل أريال أوتوماتيك لافندر 4 كجم', 'Ariel Automatic Laundry Detergent Lavender 4kg', '8001090123456', 'مسحوق أوتوماتيك مركز بقوة إزالة البقع من أول غسلة ورائحة اللافندر', 265.00),
        (gen_random_uuid(), 'supermarket', v_sub_laundry, 'مسحوق غسيل تايد أوتوماتيك أصلي 5 كجم', 'Tide Automatic Laundry Detergent Original 5kg', '8001090543210', 'بياض ناصع ونظافة فائقة للغسالات الأوتوماتيك مع تقنية تنظيف الأنسجة العميقة', 295.00),
        (gen_random_uuid(), 'supermarket', v_sub_laundry, 'برسيل باور جل أوتوماتيك برائحة اللافندر 3 لتر', 'Persil Deep Clean Power Gel Lavender 3L', '6221085010012', 'جل غسيل مركز يذوب فوراً دون ترك رواسب ويزيل أصعب الدهون والبقع', 215.00),
        (gen_random_uuid(), 'supermarket', v_sub_laundry, 'داوني منعم ومعطر أقمشة مركز نسيم الوادي 1 لتر', 'Downy Concentrate Fabric Softener Valley Dew 1L', '8001090777888', 'منعم أقمشة فاخر يمنح الملابس نعومة فائقة وانتعاشاً عاطراً يدوم لأسابيع', 95.00),
        (gen_random_uuid(), 'supermarket', v_sub_dish, 'سائل غسيل الأطباق فيري بلس برائحة الليمون 1 لتر', 'Fairy Plus Lemon Dishwashing Liquid 1L', '8001090999000', 'رغوة كثيفة وقوة قاطعة للدهون تدوم 3 مرات أطول وتوفر نظافة براقة', 68.00),
        (gen_random_uuid(), 'supermarket', v_sub_dish, 'بريل سائل تنظيف الصحون المركز 1 لتر بالليمون', 'Pril Dishwashing Liquid Lemon 1L', '6221085010029', 'تركيبة ألمانية متطورة فعالة ضد الدهون المحروقة مع ترطيب اليدين', 48.00),
        (gen_random_uuid(), 'supermarket', v_sub_surfaces, 'ديتول سائل مطهر ومعقم مركز 500 مل', 'Dettol Original Antiseptic Liquid 500ml', '5000158010019', 'المطهر الأشهر لحماية الأسرة من 100 نوع من الجراثيم المسببة للأمراض', 98.00),
        (gen_random_uuid(), 'supermarket', v_sub_surfaces, 'كلوركس مبيض ومطهر للملابس والأسطح 950 مل', 'Clorox Regular Bleach 950ml', '6221055010015', 'مبيض ومطهر فائق القوة يقضي على 99.9% من الفيروسات والبكتيريا', 35.00),
        (gen_random_uuid(), 'supermarket', v_sub_surfaces, 'مستر ماسل منظف وملمع الزجاج بخاخ 500 مل', 'Mr Muscle Glass Cleaner Spray 500ml', '5000204010017', 'يمنح الزجاج والمرايا لمعاناً فائقاً بدون أي خطوط أو ترسبات', 52.00),
        (gen_random_uuid(), 'supermarket', v_sub_paper, 'مناديل فاين كلاسيك معقمة للوجه عبوة 550 منديل', 'Fine Classic Facial Tissues Sterilized 550s', '6221020010011', 'مناديل ورقية فائقة النعومة معقمة بتقنية ستيري برو لحماية قصوى', 42.00),
        (gen_random_uuid(), 'supermarket', v_sub_paper, 'بكرة ورق مطبخ زينة ماكسي رول عالي الامتصاص', 'Zeina Kitchen Maxi Roll High Absorption', '6221020010028', 'رول مناديل مطبخ عملاق لامتصاص الزيوت وتنظيف أسطح الطهي والانسكابات', 58.00),
        (gen_random_uuid(), 'supermarket', v_sub_paper, 'مناديل مبللة ديتول مضادة للبكتيريا عبوة 40 منديل', 'Dettol Antibacterial Wet Wipes 40 Wipes', '5000158010026', 'مناديل مبللة لطيفة على الجلد تقضي على 99.9% من الجراثيم ومناسبة للتنقل', 55.00),
        (gen_random_uuid(), 'supermarket', v_sub_fresheners, 'معطر جو فريدال بخاخ برائحة العود الفاخر 460 مل', 'Fridal Air Freshener Luxury Oud 460ml', '6223005010013', 'معطر جو مائي برائحة العود الملكي الأصيل يزيل الروائح الكريهة وينشر عبقاً يدوم', 45.00),
        (gen_random_uuid(), 'supermarket', v_sub_fresheners, 'ريد جهاز طارد الناموس الكهربائي مع سائل 30 ليلة', 'Raid Liquid Electric Mosquito Killer 30 Nights', '5000204010024', 'حماية مستمرة وهادئة ضد البعوض والحشرات الطائرة طوال الليل بدون دخان', 110.00)
    ON CONFLICT DO NOTHING;

    -- 5. إضافة الأصناف إلى جدول products لظهورها في المتاجر ولوحة الإدارة
    -- =========================================================================

    -- أدوية ومستلزمات صيدلية (تابعة لصيدلية العاصمة)
    INSERT INTO public.products (
        id, store_id, name, name_en, description, price, category, category_id,
        barcode, merchant_pos_sku, is_available, archived, image_url
    )
    VALUES
        (gen_random_uuid(), v_pharmacy_store, 'بنادول أزرق أدفانس 24 قرص 500 مجم', 'Panadol Advance 500mg 24 Tablets', 'مسكن سريع للآلام وخافض للحرارة وآمن ولطيف على جدار المعدة', 35.00, 'أدوية وصيدلية', v_sub_analgesics, '5054563044174', 'PH-PAN-ADV', true, false, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'بنادول إكسترا أحمر 24 قرص', 'Panadol Extra 24 Tablets', 'تركيبة مضاعفة بالباراسيتامول والكافيين لمقاومة الصداع الشديد وآلام الجسم', 45.00, 'أدوية وصيدلية', v_sub_analgesics, '5054563044181', 'PH-PAN-EXT', true, false, 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'بروفين 400 مجم 30 قرص مسكن ومضاد للالتهاب', 'Brufen 400mg 30 Tablets', 'مسكن قوي لآلام المفاصل والأسنان والعضلات وخافض للحرارة', 58.00, 'أدوية وصيدلية', v_sub_analgesics, '6221155020011', 'PH-BRU-400', true, false, 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'كونجستال 20 قرص لنزلات البرد والرشح', 'Congestal Cold & Flu 20 Tablets', 'علاج متكامل لأعراض الرشح والزكام وانسداد الأنف وتكسير الجسم', 39.00, 'أدوية وصيدلية', v_sub_cold, '6221155020028', 'PH-CON-COLD', true, false, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'كومتركس 24 قرص لعلاج أعراض البرد القوية', 'Comtrex Multi-Symptom Cold 24 Tablets', 'تركيبة ثلاثية المفعول لاحتقان الجيوب الأنفية وسيلان الأنف والصداع', 48.00, 'أدوية وصيدلية', v_sub_cold, '6221155020035', 'PH-COM-COLD', true, false, 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'أقراص ريني للمضغ لحموضة وحرقة المعدة 24 قرص', 'Rennie Spearmint Antacid 24 Chewable Tablets', 'أقراص بنكهة النعناع لمعادلة حموضة المعدة الزائدة والتخلص السريع من الحرقان', 42.00, 'أدوية وصيدلية', v_sub_digestive, '5000425010012', 'PH-REN-ANT', true, false, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'شراب جافيسكون بنكهة النعناع 150 مل', 'Gaviscon Peppermint Liquid 150ml', 'حاجز وقائي سريع ضد ارتجاع المريء وحموضة المعدة يدوم لساعات', 65.00, 'أدوية وصيدلية', v_sub_digestive, '5000158067891', 'PH-GAV-LIQ', true, false, 'https://images.unsplash.com/photo-1608248597367-96a8be225cb2?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'فيتامين سي فوار فيتاسيد سي 1000 مجم 12 قرص', 'Vitacid C 1000mg Effervescent 12 Tablets', 'فوار فيتامين سي لتقوية الجهاز المناعي ومقاومة نزلات البرد', 32.00, 'أدوية وصيدلية', v_sub_vitamins, '6221155020042', 'PH-VIT-C', true, false, 'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'زنكترون كبسولات زنك وفيتامينات 30 كبسولة', 'Zinctron Zinc & Multivitamins 30 Capsules', 'مكمل غذائي غني بالزنك العضوي ومجموعة فيتامينات لدعم المناعة والشعر', 75.00, 'أدوية وصيدلية', v_sub_vitamins, '6221155020059', 'PH-ZNC-CAP', true, false, 'https://images.unsplash.com/photo-1550572017-4fcdbb59cc32?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'أوميجا 3 بلس 30 كبسولة جيلاتينية زيت سمك', 'Omega 3 Plus 30 Softgels', 'أحماض أوميجا 3 النقية لدعم صحة القلب والشرايين وخفض الكوليسترول', 98.00, 'أدوية وصيدلية', v_sub_vitamins, '6221155020066', 'PH-OMG-3', true, false, 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'سنتروم لوتين مالتي فيتامين ومعادن 30 قرص', 'Centrum with Lutein 30 Tablets', 'تركيبة غذائية متكاملة من 26 فيتامين ومعدن أساسي مع اللوتين', 260.00, 'أدوية وصيدلية', v_sub_vitamins, '300054452033', 'PH-CEN-LUT', true, false, 'https://images.unsplash.com/photo-1550572017-4fcdbb59cc32?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'كريم فيوسيدين مضاد حيوي موضعي 30 جم', 'Fucidin 2% Antibiotic Cream 30g', 'مضاد حيوي موضعي لعلاج التهابات الجلد والدمامل والجروح السطحية', 46.00, 'أدوية وصيدلية', v_sub_creams, '5702191001012', 'PH-FUC-CRM', true, false, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'بانثينول كريم طبي مرطب وملطف للجلد 50 جم', 'Panthenol Skin Moisturizing Cream 50g', 'كريم مرطب غني بفيتامين B5 لتجديد خلايا البشرة وعلاج الجفاف', 30.00, 'أدوية وصيدلية', v_sub_creams, '6221155020073', 'PH-PAN-CRM', true, false, 'https://images.unsplash.com/photo-1556228722-d0b730415a77?w=600&auto=format&fit=crop&q=80'),

        -- مستلزمات طبية
        (gen_random_uuid(), v_pharmacy_store, 'بيتادين محلول مطهر ومعقم للجروح 120 مل', 'Betadine Antiseptic Solution 120ml', 'محلول بوفيدون يود 10% مطهر واسع المدى يقتل البكتيريا والفيروسات', 48.00, 'مستلزمات طبية', v_sub_wound, '6221155020080', 'MED-BET-120', true, false, 'https://images.unsplash.com/photo-1608248597367-96a8be225cb2?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'كحول إيثيلي نقي طبي 70% بخاخ 500 مل', 'Medical Ethyl Alcohol 70% Spray 500ml', 'كحول طبي 70% للتعقيم الفوري للأيدي والأسطح والأدوات', 45.00, 'مستلزمات طبية', v_sub_wound, '6221155020097', 'MED-ALC-500', true, false, 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'قطن طبي مصري معقم ومبيض 100 جم', 'Pure Sterile Medical Cotton 100g', 'قطن طبي نقي 100% عالي الامتصاص ومعقم لتنظيف الجروح', 22.00, 'مستلزمات طبية', v_sub_wound, '6221155020103', 'MED-COT-100', true, false, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'شاش طبي معقم باكت 10 قطع 10x10 سم', 'Sterile Medical Gauze Swabs 10x10cm (10 Pcs)', 'قطع شاش طبي معقمة فردياً لحماية الجروح وامتصاص الإفرازات', 28.00, 'مستلزمات طبية', v_sub_wound, '6221155020110', 'MED-GAU-10', true, false, 'https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'بلاستر لاصق جروح طبي مضاد للماء 20 قطعة', 'Waterproof First Aid Plasters 20 Pcs', 'ضمادات لاصقة طبية مقاومة للماء لا تلتصق بالجروح', 25.00, 'مستلزمات طبية', v_sub_wound, '6221155020127', 'MED-PLA-20', true, false, 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'رباط ضاغط طبي مطاطي 10 سم مع مشابك', 'Elastic Crepe Bandage 10cm', 'رباط ضاغط مرن قطني لدعم المفاصل والأوتار في حالات الالتواء', 20.00, 'مستلزمات طبية', v_sub_wound, '6221155020134', 'MED-BAN-10', true, false, 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'جهاز قياس ضغط الدم ديجيتال أومرون M2', 'Omron M2 Digital Blood Pressure Monitor', 'جهاز إلكتروني ياباني دقيق لقياس ضغط الدم والنبض مع مؤشر اضطراب النبض', 1650.00, 'مستلزمات طبية', v_sub_devices, '4015672101018', 'MED-OMR-M2', true, false, 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'جهاز قياس سكر الدم أكيوتشيك إنستانت', 'Accu-Chek Instant Blood Glucose Meter Kit', 'جهاز قياس دقيق للسكر في 4 ثوانٍ مع قلم شك وخازات', 720.00, 'مستلزمات طبية', v_sub_devices, '4015672101025', 'MED-ACC-INS', true, false, 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'شرائط قياس السكر أكيوتشيك إنستانت 50 شريط', 'Accu-Chek Instant Test Strips 50 Pcs', 'شرائط اختبار سكر الدم الأصلية مجهزة بامتصاص سريع وموثوق', 420.00, 'مستلزمات طبية', v_sub_devices, '4015672101032', 'MED-ACC-ST50', true, false, 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'ترمومتر طبي رقمي ديجيتال سريع لقياس الحرارة', 'Digital Clinical Thermometer Rapid Read', 'مقياس حرارة رقمي دقيق يعطي النتيجة في 30 ثانية مع تنبيه صوتي', 85.00, 'مستلزمات طبية', v_sub_devices, '6221155020141', 'MED-THR-DIG', true, false, 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'كمامات طبية 3 طبقات مع دعامة أنف عبوة 50 قطعة', '3-Ply Surgical Medical Face Masks (Box of 50)', 'كمامات طبية ثلاثية الطبقات عالية الفلترة ومقاومة للرذاذ', 65.00, 'مستلزمات طبية', v_sub_ppe, '6221155020158', 'MED-MSK-50', true, false, 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'قفازات لاتكس فحص طبي بدون بودرة 100 قفاز', 'Powder-Free Latex Examination Gloves (100 Pcs)', 'قفازات طبية مرنة عالية الحماية ومقاومة للتمزق', 140.00, 'مستلزمات طبية', v_sub_ppe, '6221155020165', 'MED-GLV-100', true, false, 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_pharmacy_store, 'سرنجات طبية معقمة 3 سم بيك عبوة 10 سرنجات', 'Sterile Disposable Syringes 3ml (Pack of 10)', 'سرنجات طبية ثلاثية القطع معقمة فردياً بسن رفيع وتدريج دقيق', 35.00, 'مستلزمات طبية', v_sub_ppe, '6221155020172', 'MED-SYR-3ML', true, false, 'https://images.unsplash.com/photo-1583912267670-6575ad4736e8?w=600&auto=format&fit=crop&q=80'),

        -- منظفات وعناية بالمنزل (تابعة لمتجر سوبرماركت النخبة)
        (gen_random_uuid(), v_supermarket_store, 'مسحوق غسيل أريال أوتوماتيك لافندر 4 كجم', 'Ariel Automatic Laundry Detergent Lavender 4kg', 'مسحوق أوتوماتيك مركز بقوة إزالة البقع من أول غسلة ورائحة اللافندر', 265.00, 'منظفات وعناية بالمنزل', v_sub_laundry, '8001090123456', 'CLN-ARI-4KG', true, false, 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'مسحوق غسيل تايد أوتوماتيك أصلي 5 كجم', 'Tide Automatic Laundry Detergent Original 5kg', 'بياض ناصع ونظافة فائقة للغسالات الأوتوماتيك مع تقنية تنظيف الأنسجة العميقة', 295.00, 'منظفات وعناية بالمنزل', v_sub_laundry, '8001090543210', 'CLN-TID-5KG', true, false, 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'برسيل باور جل أوتوماتيك برائحة اللافندر 3 لتر', 'Persil Deep Clean Power Gel Lavender 3L', 'جل غسيل مركز يذوب فوراً دون ترك رواسب ويزيل أصعب الدهون والبقع', 215.00, 'منظفات وعناية بالمنزل', v_sub_laundry, '6221085010012', 'CLN-PER-3L', true, false, 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'داوني منعم ومعطر أقمشة مركز نسيم الوادي 1 لتر', 'Downy Concentrate Fabric Softener Valley Dew 1L', 'منعم أقمشة فاخر يمنح الملابس نعومة فائقة وانتعاشاً عاطراً يدوم لأسابيع', 95.00, 'منظفات وعناية بالمنزل', v_sub_laundry, '8001090777888', 'CLN-DOW-1L', true, false, 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'سائل غسيل الأطباق فيري بلس برائحة الليمون 1 لتر', 'Fairy Plus Lemon Dishwashing Liquid 1L', 'رغوة كثيفة وقوة قاطعة للدهون تدوم 3 مرات أطول وتوفر نظافة براقة', 68.00, 'منظفات وعناية بالمنزل', v_sub_dish, '8001090999000', 'CLN-FAI-1L', true, false, 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'بريل سائل تنظيف الصحون المركز 1 لتر بالليمون', 'Pril Dishwashing Liquid Lemon 1L', 'تركيبة ألمانية متطورة فعالة ضد الدهون المحروقة مع ترطيب اليدين', 48.00, 'منظفات وعناية بالمنزل', v_sub_dish, '6221085010029', 'CLN-PRL-1L', true, false, 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'ديتول سائل مطهر ومعقم مركز 500 مل', 'Dettol Original Antiseptic Liquid 500ml', 'المطهر الأشهر لحماية الأسرة من 100 نوع من الجراثيم المسببة للأمراض', 98.00, 'منظفات وعناية بالمنزل', v_sub_surfaces, '5000158010019', 'CLN-DET-500', true, false, 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'كلوركس مبيض ومطهر للملابس والأسطح 950 مل', 'Clorox Regular Bleach 950ml', 'مبيض ومطهر فائق القوة يقضي على 99.9% من الفيروسات والبكتيريا', 35.00, 'منظفات وعناية بالمنزل', v_sub_surfaces, '6221055010015', 'CLN-CLX-950', true, false, 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'مستر ماسل منظف وملمع الزجاج بخاخ 500 مل', 'Mr Muscle Glass Cleaner Spray 500ml', 'يمنح الزجاج والمرايا لمعاناً فائقاً بدون أي خطوط أو ترسبات', 52.00, 'منظفات وعناية بالمنزل', v_sub_surfaces, '5000204010017', 'CLN-MSL-500', true, false, 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'مناديل فاين كلاسيك معقمة للوجه عبوة 550 منديل', 'Fine Classic Facial Tissues Sterilized 550s', 'مناديل ورقية فائقة النعومة معقمة بتقنية ستيري برو لحماية قصوى', 42.00, 'منظفات وعناية بالمنزل', v_sub_paper, '6221020010011', 'CLN-FIN-550', true, false, 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'بكرة ورق مطبخ زينة ماكسي رول عالي الامتصاص', 'Zeina Kitchen Maxi Roll High Absorption', 'رول مناديل مطبخ عملاق لامتصاص الزيوت وتنظيف أسطح الطهي والانسكابات', 58.00, 'منظفات وعناية بالمنزل', v_sub_paper, '6221020010028', 'CLN-ZEI-MAX', true, false, 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'مناديل مبللة ديتول مضادة للبكتيريا عبوة 40 منديل', 'Dettol Antibacterial Wet Wipes 40 Wipes', 'مناديل مبللة لطيفة على الجلد تقضي على 99.9% من الجراثيم ومناسبة للتنقل', 55.00, 'منظفات وعناية بالمنزل', v_sub_paper, '5000158010026', 'CLN-DET-W40', true, false, 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'معطر جو فريدال بخاخ برائحة العود الفاخر 460 مل', 'Fridal Air Freshener Luxury Oud 460ml', 'معطر جو مائي برائحة العود الملكي الأصيل يزيل الروائح الكريهة وينشر عبقاً يدوم', 45.00, 'منظفات وعناية بالمنزل', v_sub_fresheners, '6223005010013', 'CLN-FRI-OUD', true, false, 'https://images.unsplash.com/photo-1616949755610-8c9bbc08f138?w=600&auto=format&fit=crop&q=80'),
        (gen_random_uuid(), v_supermarket_store, 'ريد جهاز طارد الناموس الكهربائي مع سائل 30 ليلة', 'Raid Liquid Electric Mosquito Killer 30 Nights', 'حماية مستمرة وهادئة ضد البعوض والحشرات الطائرة طوال الليل بدون دخان', 110.00, 'منظفات وعناية بالمنزل', v_sub_fresheners, '5000204010024', 'CLN-RAI-30N', true, false, 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&auto=format&fit=crop&q=80')
    ON CONFLICT DO NOTHING;

END $$;

