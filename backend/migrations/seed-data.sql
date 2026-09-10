-- ============================================================
-- Bulao — Complete Categories & Roles Seed Data
-- Version: v3
-- Purpose: Job posting / worker profile catalog
--
-- Tier 1 = Highest-frequency categories
-- Tier 2 = Additional categories under "More Categories"
--
-- Every category and every role has an actual icon.
-- ============================================================

-- ============================================================
-- CATEGORIES
-- ============================================================
INSERT OR IGNORE INTO categories(id, name, icon, kind)
VALUES
-- ============================================================
-- TIER 1 — PINNED / HIGH DEMAND
-- ============================================================
('construction', 'Construction & Labour', '🏗️', 'job'),
('household', 'Home Services', '🏠', 'job'),
('food', 'Food & Hospitality', '🍽️', 'job'),
('transport', 'Transport & Delivery', '�', 'job'),
('shops', 'Retail & Sales', '🏪', 'job'),
('events', 'Events & Functions', '🎉', 'job'),

-- ============================================================
-- TIER 2 — MORE CATEGORIES
-- ============================================================
('security', 'Security & Safety', '🛡️', 'job'),
('education', 'Education & Tuition', '🎓', 'job'),
('healthcare', 'Healthcare & Caregiving', '🩺', 'job'),
('beauty', 'Beauty & Wellness', '💇‍♀️', 'job'),
('promotion', 'Marketing & Promotion', '📢', 'job'),
('office', 'Office & Admin Support', '💼', 'job');

-- ============================================================
-- CONSTRUCTION & LABOUR
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('construction-helper','construction','Helper / Labourer','👷'),
('mason','construction','Mason','🧱'),
('painter','construction','Painter','🎨'),
('carpenter','construction','Carpenter','🪚'),
('electrician','construction','Electrician','⚡'),
('plumber','construction','Plumber','🔧'),
('tile-worker','construction','Tile Worker','🔲'),
('welder','construction','Welder','🔥');

-- ============================================================
-- HOME SERVICES
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('housekeeper','household','Housekeeper / Maid','🧹'),
('cook-home','household','Home Cook','🍳'),
('nanny','household','Nanny / Babysitter','👶'),
('personal-driver','household','Personal Driver','🚗'),
('gardener','household','Gardener','🌱');

-- ============================================================
-- FOOD & HOSPITALITY
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('chef','food','Chef / Cook','👨‍🍳'),
('kitchen-helper','food','Kitchen Helper','🥘'),
('waiter','food','Waiter / Server','🍽️'),
('barista','food','Barista','☕'),
('baker','food','Baker','🥐'),
('catering-staff','food','Catering Staff','🍱'),
('dishwasher','food','Dishwasher','🧽'),
('food-packer','food','Food Packer','📦');

-- ============================================================
-- TRANSPORT & DELIVERY
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('delivery-person','transport','Delivery Person','📦'),
('bike-rider','transport','Bike Rider','🏍️'),
('driver','transport','Driver','🚗'),
('loader','transport','Loader / Helper','📦'),
('courier','transport','Courier','✉️');

-- ============================================================
-- RETAIL & SALES
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('sales-assistant','shops','Sales Assistant','🛍️'),
('cashier','shops','Cashier','💳'),
('shop-helper','shops','Shop Helper','🏪'),
('inventory-manager','shops','Inventory Manager','📦'),
('merchandiser','shops','Merchandiser','🛒');

-- ============================================================
-- EVENTS & FUNCTIONS
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('event-helper','events','Event Helper','🙋'),
('event-server','events','Event Server','🍽️'),
('decorator','events','Decorator','🎈'),
('event-coordinator','events','Event Coordinator','📋');

-- ============================================================
-- SECURITY & SAFETY
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('security-guard','security','Security Guard','💂'),
('watchman','security','Watchman','🔐'),
('bouncer','security','Bouncer','🕴️');

-- ============================================================
-- EDUCATION & TUITION
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('tutor-maths','education','Maths Tutor','➗'),
('tutor-science','education','Science Tutor','🔬'),
('tutor-english','education','English Tutor','📖'),
('tutor-all-subjects','education','All Subjects Tutor','📚'),
('music-teacher','education','Music Teacher','🎵'),
('dance-teacher','education','Dance Teacher','💃'),
('yoga-instructor','education','Yoga Instructor','🧘'),
('computer-teacher','education','Computer Teacher','💻'),
('language-tutor','education','Language Tutor','🗣️'),
('sports-coach','education','Sports Coach','🏅');

-- ============================================================
-- HEALTHCARE & CAREGIVING
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('elderly-caretaker','healthcare','Elderly Caretaker','🧓'),
('home-nurse','healthcare','Home Nurse','👩‍⚕️'),
('patient-attendant','healthcare','Patient Attendant','🧑‍⚕️'),
('physiotherapist','healthcare','Physiotherapist','🦵'),
('baby-care-nurse','healthcare','Baby Care Nurse','👶');

-- ============================================================
-- BEAUTY & WELLNESS
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('beautician','beauty','Beautician','💄'),
('mehendi-artist','beauty','Mehendi Artist','🤲'),
('makeup-artist','beauty','Makeup Artist','💋'),
('hair-stylist','beauty','Hair Stylist','💇‍♀️'),
('massage-therapist','beauty','Massage Therapist','💆');

-- ============================================================
-- MARKETING & PROMOTION
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('promoter','promotion','Promoter','📣'),
('brand-ambassador','promotion','Brand Ambassador','⭐'),
('leaflet-distributor','promotion','Leaflet Distributor','📄'),
('survey-collector','promotion','Survey Collector','📝');

-- ============================================================
-- OFFICE & ADMIN SUPPORT
-- ============================================================
INSERT OR IGNORE INTO roles(id, category_id, name, icon)
VALUES
('office-boy','office','Office Boy / Peon','🧑‍💼'),
('receptionist','office','Receptionist','🛎️'),
('data-entry','office','Data Entry Operator','⌨️'),
('telecaller','office','Telecaller','📞');

-- ============================================================
-- END OF SEED DATA
-- ============================================================
