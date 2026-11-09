-- Ensure service creation has a complete, stable category catalog.
-- Preserve job categories on any ID conflict; canonicalize existing service rows.
INSERT INTO categories (id, kind, name, icon) VALUES
  ('mechanic', 'service', 'Automotive', 'car-sport-outline'),
  ('plumber', 'service', 'Plumbing', 'water-outline'),
  ('electrician', 'service', 'Electrical', 'flash-outline'),
  ('carpenter', 'service', 'Carpentry', 'hammer-outline'),
  ('painter', 'service', 'Painting', 'color-palette-outline'),
  ('mobile-repair', 'service', 'Mobile Repair', 'phone-portrait-outline'),
  ('computer-repair', 'service', 'Computer Repair', 'laptop-outline'),
  ('tutoring', 'service', 'Tutoring', 'school-outline'),
  ('beauty-service', 'service', 'Beauty & Personal Care', 'cut-outline'),
  ('cleaner', 'service', 'Cleaning', 'sparkles-outline'),
  ('food-catering', 'service', 'Food & Catering', 'restaurant-outline'),
  ('ac', 'service', 'AC Service & Repair', 'snow-outline'),
  ('appliance', 'service', 'Appliance Repair', 'construct-outline'),
  ('gardener', 'service', 'Gardening', 'leaf-outline'),
  ('driver', 'service', 'Driving', 'car-outline'),
  ('health', 'service', 'Home Health & Care', 'medkit-outline'),
  ('security', 'service', 'Security & CCTV', 'shield-checkmark-outline'),
  ('other', 'service', 'Other Services', 'build-outline')
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  icon = excluded.icon
WHERE categories.kind = 'service';
