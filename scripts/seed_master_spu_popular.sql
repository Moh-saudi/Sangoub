-- Ensure column suggested_price exists
ALTER TABLE public.master_spu ADD COLUMN IF NOT EXISTS suggested_price NUMERIC(10,2);

-- Also ensure products has barcode, merchant_pos_sku, name_en
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS merchant_pos_sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name_en TEXT;

-- Seed master SPU items
INSERT INTO public.master_spu (id, vertical_id, category_id, name_ar, name_en, primary_barcode, description, suggested_price)
VALUES
    -- TEA & COFFEE
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555502', 'شاي ليبتون ناعم أحمر 250 جم', 'Lipton Red Label Black Tea 250g', '6221155010012', 'شاي أسود ناعم عالي الجودة من أفضل مزارع الشاي العالمية', 75),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555502', 'شاي ليبتون العلامة الصفراء 100 فتلة', 'Lipton Yellow Label Tea 100 Bags', '6221155010029', 'شاي أسود فاخر 100 كيس فلتر مع فتلة', 110),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555502', 'شاي العروسة ناعم 250 جم', 'El Arosa Black Tea 250g', '6223000530018', 'شاي أسود كيني متميز بطعم أصيل وقوي', 65),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555502', 'شاي العروسة 100 فتلة', 'El Arosa Tea 100 Bags', '6223000530025', 'شاي العروسة 100 فتلة مغلفة فردياً', 95),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555502', 'شاي أخضر أحمد تي بالنعناع 20 كيس', 'Ahmad Tea Green Tea with Mint 20 Bags', '054881007421', 'شاي أخضر طبيعي بنكهة النعناع المنعش', 60),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555503', 'قهوة نسكافيه جولد سريعة التحضير 100 جم', 'Nescafe Gold Instant Coffee 100g', '7613035882011', 'قهوة ذهبية نقية غنية بالرائحة والنكهة الفاخرة', 220),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555503', 'نسكافيه كلاسيك 3 في 1 كيس', 'Nescafe 3 in 1 Sachet', '7613031234567', 'مزيج القهوة السريع مع المبيض والسكر', 10),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555503', 'بن عبد المعبود محوج فاتح 100 جم', 'Abdel Maboud Light Cardamom Coffee 100g', '6224000123456', 'بن يمني وبرازيلي مطحون ومحوج بالحبان والمستكة', 60),

    -- DAIRY & CHEESE
    (gen_random_uuid(), 'supermarket', '841f3f22-25c5-450b-beb8-5eaec53b29e9', 'حليب جهينة كامل الدسم 1 لتر', 'Juhayna Full Cream Milk 1L', '6221007010014', 'حليب بقري طبيعي 100% معقم ومعبأ تتراباك', 48),
    (gen_random_uuid(), 'supermarket', '841f3f22-25c5-450b-beb8-5eaec53b29e9', 'حليب المراعي كامل الدسم 1 لتر', 'Almarai Full Fat Milk 1L', '6281007010021', 'حليب طازج معالج بدرجة حرارة فائقة', 50),
    (gen_random_uuid(), 'supermarket', '841f3f22-25c5-450b-beb8-5eaec53b29e9', 'لبن رايب جهينة طبيعي 440 مل', 'Juhayna Rayeb Natural 440ml', '6221007010038', 'لبن رائب صحي غني بالبروبيوتيك وخفيف على المعدة', 22),
    (gen_random_uuid(), 'supermarket', '683a12ba-7b14-44f4-948d-d1a937bef103', 'جبنة دومتي فيتا بلس بطعم القشطة 500 جم', 'Domty Feta Cheese with Cream 500g', '6221054010115', 'جبنة بيضاء فيتا كريمية سهلة الفرد والسندوتشات', 42),
    (gen_random_uuid(), 'supermarket', '683a12ba-7b14-44f4-948d-d1a937bef103', 'جبنة عبور لاند فيتا 500 جم', 'Obour Land Feta Cheese 500g', '6223001850123', 'جبنة بيضاء نباتية الدهن مبسترة عالية الجودة', 38),
    (gen_random_uuid(), 'supermarket', '683a12ba-7b14-44f4-948d-d1a937bef103', 'جبنة براميلي بالفلفل الأخضر 250 جم', 'Baramily Cheese with Green Pepper 250g', '6223001850999', 'جبنة براميلي طبيعية معتقة بالفلفل الحار', 55),
    (gen_random_uuid(), 'supermarket', '0c1b5623-2f67-42bd-b8af-f86eb148e46e', 'جبن قريش طبيعي بلدي 500 جم', 'Natural Fresh Cottage Cheese 500g', '6223001850555', 'جبن قريش فلاحي طازج خالي من الملح والزيوت المهدرجة', 60),
    (gen_random_uuid(), 'supermarket', 'a1111111-2222-3333-4444-555555555504', 'طبق بيض أحمر مائدة 30 بيضة', 'Red Table Eggs Carton 30 Pcs', '6229999010011', 'بيض مائدة أحمر طازج مبستر ونظيف من مزارع معتمدة', 175),

    -- WATER & BEVERAGES
    (gen_random_uuid(), 'supermarket', '29522a6e-fda0-4ed0-b911-977e496b260a', 'مياه معدنية نستله بيور لايف 1.5 لتر', 'Nestle Pure Life Mineral Water 1.5L', '6221003010018', 'مياه شرب طبيعية نقية معبأة تحت أعلى معايير الجودة', 10),
    (gen_random_uuid(), 'supermarket', '29522a6e-fda0-4ed0-b911-977e496b260a', 'مياه معدنية بركة 600 مل', 'Baraka Natural Water 600ml', '6221003010025', 'مياه شرب صغيرة مناسبة للاستخدام اليومي والعمل', 6),
    (gen_random_uuid(), 'supermarket', '3e65aa40-f891-445d-ad33-7c4940564568', 'بيبسي كانز 330 مل', 'Pepsi Can 330ml', '6221001010012', 'مشروب غازي كولا منعش وبارد', 15),
    (gen_random_uuid(), 'supermarket', '3e65aa40-f891-445d-ad33-7c4940564568', 'كوكاكولا كانز 330 مل', 'Coca-Cola Can 330ml', '6221002010019', 'المذاق الأصلي المنعش لمشروب كوكاكولا', 15),
    (gen_random_uuid(), 'supermarket', '3e65aa40-f891-445d-ad33-7c4940564568', 'سفن آب كانز 330 مل', '7Up Can 330ml', '6221001010029', 'مشروب غازي بنكهة الليمون واللايم المنعش', 15),
    (gen_random_uuid(), 'supermarket', '33c3edcf-0fa1-4653-9b88-4582b6a046ef', 'عصير جهينة بيور برتقال 1 لتر', 'Juhayna Pure Orange Juice 1L', '6221007020013', 'عصير برتقال طبيعي 100% بدون سكر مضاف', 52),

    -- OILS, RICE & GRAINS
    (gen_random_uuid(), 'supermarket', '9cf1e897-0fef-4397-9280-5b2fdd113b8e', 'زيت عافية ذرة نقي 800 مل', 'Afia Pure Corn Oil 800ml', '6221025010016', 'زيت ذرة نقي وخفيف مناسب للقلي والطبخ الصحي', 95),
    (gen_random_uuid(), 'supermarket', '9cf1e897-0fef-4397-9280-5b2fdd113b8e', 'زيت كريستال عباد الشمس 800 مل', 'Crystal Sunflower Oil 800ml', '6221025010023', 'زيت عباد الشمس نقي 100% غني بفيتامين هـ', 88),
    (gen_random_uuid(), 'supermarket', '3e80ce86-0146-477a-b54d-7502d470a092', 'أرز مصري الضحى رفيع الحبة 1 كجم', 'El Doha Egyptian Rice 1kg', '6223001220015', 'أرز مصري أبيض منقى ومغسول إلكترونياً جاهز للطهي', 45),
    (gen_random_uuid(), 'supermarket', '3e80ce86-0146-477a-b54d-7502d470a092', 'مكرونة الملكة أقلام 400 جم', 'El Maleka Penne Pasta 400g', '6221045010017', 'مكرونة سيملينا فاخرة متماسكة عند السلق', 18),
    (gen_random_uuid(), 'supermarket', 'c6f4c099-6228-479d-9caa-105780062ecf', 'تونة صن شاين قطع سهلة الفتح 185 جم', 'Sunshine Tuna Chunks 185g', '6223000880014', 'لحم تونة أبيض قطع في زيت دوار الشمس', 65),

    -- SNACKS & SWEETS
    (gen_random_uuid(), 'supermarket', '5d4eb43f-9fdd-4d0f-b707-91da5afca2c0', 'شيبسي عائلي بالجبنة المتبلة', 'Chipsy Seasoned Cheese Big Bag', '6221035010013', 'رقائق بطاطس مقرمشة متبلة بأشهى أنواع الجبن', 20),
    (gen_random_uuid(), 'supermarket', '5d4eb43f-9fdd-4d0f-b707-91da5afca2c0', 'شيبسي بالملح والخل حجم وسط', 'Chipsy Salt & Vinegar Medium', '6221035010020', 'رقائق بطاطس طبيعية بنكهة الملح والخل اللاذعة', 10),
    (gen_random_uuid(), 'supermarket', '8e90f253-8b39-47ee-9e73-9dac3395e4b3', 'شوكولاتة كادبوري ديري ميلك سادة 90 جم', 'Cadbury Dairy Milk Chocolate 90g', '7622210123456', 'شوكولاتة الحليب الناعمة الأصلية من كادبوري', 65),

    -- RESTAURANT & FAST FOOD
    (gen_random_uuid(), 'restaurant', '24583ec9-9d04-4212-ad25-2ee86c9695e5', 'ساندوتش دبل تشيز برجر لحم بقري', 'Double Cheeseburger Beef', 'FOOD-BRG-001', 'قطعتين لحم بقري مشوي 150 جم مع جبن شيدر ذائب وصوص سنجوب الخاص', 145),
    (gen_random_uuid(), 'restaurant', '24583ec9-9d04-4212-ad25-2ee86c9695e5', 'ساندوتش سنجل بيف برجر كلاسيك', 'Single Classic Beef Burger', 'FOOD-BRG-002', 'شريحة برجر لحم بقري صافي مع خس وطماطم وخيار مخلل', 95),
    (gen_random_uuid(), 'restaurant', '38c02dce-5992-4e24-8a1a-4fc933a4bb9b', 'ساندوتش شاورما دجاج سوري بالثومية كبير', 'Syrian Chicken Shawarma Large', 'FOOD-SHW-001', 'شاورما صدور دجاج متبلة في خبز صاج مقرمش مع ثومية وبطاطس', 85),
    (gen_random_uuid(), 'restaurant', '38c02dce-5992-4e24-8a1a-4fc933a4bb9b', 'ساندوتش شاورما لحم بلدي بالطحينة', 'Beef Shawarma with Tahini', 'FOOD-SHW-002', 'شاورما لحم بلدي طازج مع بقدونس وبصل وطحينة في خبز كيزر أو صاج', 105),
    (gen_random_uuid(), 'restaurant', '4935f6ac-8b97-4f7a-a21b-498fb1ed1605', 'بيتزا مارجريتا إيطالية وسط', 'Italian Margherita Pizza Medium', 'FOOD-PIZ-001', 'عجينة إيطالية هشة مع صلصة طماطم وجبنة موتزاريلا وريحان طازج', 110),
    (gen_random_uuid(), 'restaurant', '4935f6ac-8b97-4f7a-a21b-498fb1ed1605', 'بيتزا بيبروني سجق وموتزاريلا كبيرة', 'Pepperoni Pizza Large', 'FOOD-PIZ-002', 'شرائح البيبروني البقري مع صلصة الطماطم وجبنة الموتزاريلا الغنية', 165),
    (gen_random_uuid(), 'restaurant', 'a7ca8f2b-8456-44bc-bf86-63f02676d7b3', 'ساندوتش فول إسكندراني بالزيت الحار والليمون', 'Alexandrian Foul Sandwich with Flaxseed Oil', 'FOOD-FOL-001', 'فول مدمس بالخلطة الإسكندرانية والطحينة والزيت الحار في خبز بلدي', 15),
    (gen_random_uuid(), 'restaurant', 'a7ca8f2b-8456-44bc-bf86-63f02676d7b3', 'ساندوتش فلافل طعمية محشية كيري وبسطرمة', 'Stuffed Falafel Sandwich', 'FOOD-FLF-001', 'قرص طعمية مقرمش ومحشو جبن وبسطرمة مع سلطة وطحينة', 20),
    (gen_random_uuid(), 'restaurant', '28a7ecdb-c2a9-463f-ad9a-11e6d5b034ef', 'بطاطس محمرة فارم فريتس مقرمشة صوابع', 'Crispy French Fries Plate', 'FOOD-FRS-001', 'بطاطس مقلية ذهبية مقرمشة تقدم مع بهارات خاصة', 35);
