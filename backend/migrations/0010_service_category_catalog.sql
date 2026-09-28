-- Service creation catalog. Existing job categories and service references are preserved.
-- Safe to run repeatedly; category IDs match the original service catalog where present.
INSERT OR IGNORE INTO categories (id, kind, name, icon) VALUES
  ('mechanic', 'service', 'Automotive', 'car-sport-outline'),
  ('plumber', 'service', 'Plumbing', 'water-outline'),
  ('electrician', 'service', 'Electrical', 'flash-outline'),
  ('carpenter', 'service', 'Carpenter', 'hammer-outline'),
  ('painter', 'service', 'Painting', 'color-palette-outline'),
  ('mobile-repair', 'service', 'Mobile Repair', 'phone-portrait-outline'),
  ('computer-repair', 'service', 'Computer Repair', 'laptop-outline'),
  ('tutoring', 'service', 'Tutoring', 'school-outline'),
  ('beauty-service', 'service', 'Beauty', 'cut-outline'),
  ('cleaner', 'service', 'Cleaning', 'sparkles-outline'),
  ('food-catering', 'service', 'Food & Catering', 'restaurant-outline'),
  ('ac', 'service', 'AC Service & Repair', 'snow-outline'),
  ('appliance', 'service', 'Appliance Repair', 'construct-outline'),
  ('gardener', 'service', 'Gardening', 'leaf-outline'),
  ('driver', 'service', 'Driving', 'car-outline'),
  ('other', 'service', 'Other Services', 'build-outline');
