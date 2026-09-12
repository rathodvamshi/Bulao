-- Add icon column to roles table
ALTER TABLE roles ADD COLUMN icon TEXT NOT NULL DEFAULT '👤';

-- Update existing roles with their respective icons from seed data
UPDATE roles SET icon = '👷' WHERE id = 'construction-helper';
UPDATE roles SET icon = '🧱' WHERE id = 'mason';
UPDATE roles SET icon = '🎨' WHERE id = 'painter';
UPDATE roles SET icon = '🪚' WHERE id = 'carpenter';
UPDATE roles SET icon = '⚡' WHERE id = 'electrician';
UPDATE roles SET icon = '🔧' WHERE id = 'plumber';
UPDATE roles SET icon = '🔲' WHERE id = 'tile-worker';
UPDATE roles SET icon = '🔥' WHERE id = 'welder';

UPDATE roles SET icon = '🧹' WHERE id = 'housekeeper';
UPDATE roles SET icon = '🍳' WHERE id = 'cook-home';
UPDATE roles SET icon = '👶' WHERE id = 'nanny';
UPDATE roles SET icon = '🚗' WHERE id = 'personal-driver';
UPDATE roles SET icon = '🌱' WHERE id = 'gardener';

UPDATE roles SET icon = '👨‍🍳' WHERE id = 'chef';
UPDATE roles SET icon = '🥘' WHERE id = 'kitchen-helper';
UPDATE roles SET icon = '🍽️' WHERE id = 'waiter';
UPDATE roles SET icon = '☕' WHERE id = 'barista';
UPDATE roles SET icon = '🥐' WHERE id = 'baker';
UPDATE roles SET icon = '🍱' WHERE id = 'catering-staff';
UPDATE roles SET icon = '🧽' WHERE id = 'dishwasher';
UPDATE roles SET icon = '📦' WHERE id = 'food-packer';

UPDATE roles SET icon = '📦' WHERE id = 'delivery-person';
UPDATE roles SET icon = '🏍️' WHERE id = 'bike-rider';
UPDATE roles SET icon = '🚗' WHERE id = 'driver';
UPDATE roles SET icon = '📦' WHERE id = 'loader';
UPDATE roles SET icon = '✉️' WHERE id = 'courier';

UPDATE roles SET icon = '🛍️' WHERE id = 'sales-assistant';
UPDATE roles SET icon = '💳' WHERE id = 'cashier';
UPDATE roles SET icon = '🏪' WHERE id = 'shop-helper';
UPDATE roles SET icon = '📦' WHERE id = 'inventory-manager';
UPDATE roles SET icon = '🛒' WHERE id = 'merchandiser';

UPDATE roles SET icon = '🙋' WHERE id = 'event-helper';
UPDATE roles SET icon = '🍽️' WHERE id = 'event-server';
UPDATE roles SET icon = '🎈' WHERE id = 'decorator';
UPDATE roles SET icon = '📋' WHERE id = 'event-coordinator';

UPDATE roles SET icon = '💂' WHERE id = 'security-guard';
UPDATE roles SET icon = '🔐' WHERE id = 'watchman';
UPDATE roles SET icon = '🕴️' WHERE id = 'bouncer';

UPDATE roles SET icon = '➗' WHERE id = 'tutor-maths';
UPDATE roles SET icon = '🔬' WHERE id = 'tutor-science';
UPDATE roles SET icon = '📖' WHERE id = 'tutor-english';
UPDATE roles SET icon = '📚' WHERE id = 'tutor-all-subjects';
UPDATE roles SET icon = '🎵' WHERE id = 'music-teacher';
UPDATE roles SET icon = '💃' WHERE id = 'dance-teacher';
UPDATE roles SET icon = '🧘' WHERE id = 'yoga-instructor';
UPDATE roles SET icon = '💻' WHERE id = 'computer-teacher';
UPDATE roles SET icon = '🗣️' WHERE id = 'language-tutor';
UPDATE roles SET icon = '🏅' WHERE id = 'sports-coach';

UPDATE roles SET icon = '🧓' WHERE id = 'elderly-caretaker';
UPDATE roles SET icon = '👩‍⚕️' WHERE id = 'home-nurse';
UPDATE roles SET icon = '🧑‍⚕️' WHERE id = 'patient-attendant';
UPDATE roles SET icon = '🦵' WHERE id = 'physiotherapist';
UPDATE roles SET icon = '👶' WHERE id = 'baby-care-nurse';

UPDATE roles SET icon = '💄' WHERE id = 'beautician';
UPDATE roles SET icon = '🤲' WHERE id = 'mehendi-artist';
UPDATE roles SET icon = '💋' WHERE id = 'makeup-artist';
UPDATE roles SET icon = '💇‍♀️' WHERE id = 'hair-stylist';
UPDATE roles SET icon = '💆' WHERE id = 'massage-therapist';

UPDATE roles SET icon = '📣' WHERE id = 'promoter';
UPDATE roles SET icon = '⭐' WHERE id = 'brand-ambassador';
UPDATE roles SET icon = '📄' WHERE id = 'leaflet-distributor';
UPDATE roles SET icon = '📝' WHERE id = 'survey-collector';

UPDATE roles SET icon = '🧑‍💼' WHERE id = 'office-boy';
UPDATE roles SET icon = '🛎️' WHERE id = 'receptionist';
UPDATE roles SET icon = '⌨️' WHERE id = 'data-entry';
UPDATE roles SET icon = '📞' WHERE id = 'telecaller';
