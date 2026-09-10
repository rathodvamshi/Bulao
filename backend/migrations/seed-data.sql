-- Seed data for categories and roles

-- Insert categories (job categories only for Post Work flow)
INSERT OR IGNORE INTO categories (id, name, icon, kind) VALUES
('events', 'Event & Function Workers', 'calendar', 'job'),
('food', 'Food & Hospitality', 'restaurant', 'job'),
('household', 'Household & Personal Services', 'home', 'job'),
('promotion', 'Promotional & Temporary Workers', 'megaphone', 'job'),
('shops', 'Shop & Business Helpers', 'storefront', 'job');

-- Insert roles for Event & Function Workers
INSERT OR IGNORE INTO roles (id, category_id, name) VALUES
('event-helper', 'events', 'Event Helper'),
('event-server', 'events', 'Event Server');

-- Insert roles for Food & Hospitality
INSERT OR IGNORE INTO roles (id, category_id, name) VALUES
('bakery', 'food', 'Bakery & Sweets Staff'),
('barista', 'food', 'Café & Beverage Staff'),
('catering', 'food', 'Catering & Event Staff'),
('kitchen-cleaner', 'food', 'Food Business Cleaning & Support'),
('packing', 'food', 'Food Packing & Kitchen Support'),
('hotel', 'food', 'Hotel Food & Service Staff'),
('kitchen-helper', 'food', 'Kitchen Staff'),
('restaurant', 'food', 'Restaurant & Café Staff');

-- Insert roles for Household & Personal Services
INSERT OR IGNORE INTO roles (id, category_id, name) VALUES
('housekeeper', 'household', 'Housekeeper'),
('personal-driver', 'household', 'Personal Driver');

-- Insert roles for Promotional & Temporary Workers
INSERT OR IGNORE INTO roles (id, category_id, name) VALUES
('promoter', 'promotion', 'Promoter'),
('temp-helper', 'promotion', 'Temporary Helper');

-- Insert roles for Shop & Business Helpers
INSERT OR IGNORE INTO roles (id, category_id, name) VALUES
('sales-assistant', 'shops', 'Sales Assistant'),
('shop-helper', 'shops', 'Shop Helper');
