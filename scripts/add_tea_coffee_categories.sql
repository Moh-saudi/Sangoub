-- Add Tea & Coffee and additional essential categories
INSERT INTO public.categories (id, vertical_id, parent_id, name_ar, name_en, slug, icon, display_order)
VALUES
    -- Under 'مشروبات ومياه' (63e2167b-e04c-4491-8db0-65699f3a1428)
    ('a1111111-2222-3333-4444-555555555501', 'supermarket', '63e2167b-e04c-4491-8db0-65699f3a1428', 'شاي وقهوة ومشروبات ساخنة', 'Tea, Coffee & Hot Drinks', 'seed-tea-coffee', 'coffee', 4),
    ('a1111111-2222-3333-4444-555555555502', 'supermarket', 'a1111111-2222-3333-4444-555555555501', 'شاي أسود وأخضر وأعشاب', 'Black & Green Tea', 'seed-tea-leaf', 'cup-soda', 1),
    ('a1111111-2222-3333-4444-555555555503', 'supermarket', 'a1111111-2222-3333-4444-555555555501', 'بن تركي وإسبريسو ونسكافيه', 'Coffee & Espresso', 'seed-coffee-beans', 'coffee', 2),

    -- Under 'ألبان وأجبان وبيض' (c8c63ea6-6971-46f2-8992-f86618ce4916)
    ('a1111111-2222-3333-4444-555555555504', 'supermarket', 'c8c63ea6-6971-46f2-8992-f86618ce4916', 'بيض مائدة طازج', 'Fresh Eggs', 'seed-eggs', 'egg', 5),
    ('a1111111-2222-3333-4444-555555555505', 'supermarket', 'c8c63ea6-6971-46f2-8992-f86618ce4916', 'زبادي ورائب ودانيت', 'Yogurt & Laban', 'seed-yogurt', 'milk', 6),

    -- Under 'مؤن وبقالة أساسية' (d5bceb21-8528-44db-a906-227e8d0f850b)
    ('a1111111-2222-3333-4444-555555555506', 'supermarket', 'd5bceb21-8528-44db-a906-227e8d0f850b', 'بهارات وتوابل ومرقة', 'Spices & Seasonings', 'seed-spices', 'sparkles', 7),
    ('a1111111-2222-3333-4444-555555555507', 'supermarket', 'd5bceb21-8528-44db-a906-227e8d0f850b', 'سكر ودقيق ومستلزمات حلويات', 'Sugar & Flour', 'seed-baking', 'cookie', 8)
ON CONFLICT (id) DO UPDATE 
SET name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    slug = EXCLUDED.slug;

