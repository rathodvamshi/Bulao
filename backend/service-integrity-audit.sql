-- Read-only pre-deployment audit. No phones, names or secrets are selected.
PRAGMA foreign_key_check;
SELECT s.id,'missing_or_wrong_category' AS issue FROM service_profiles s
 LEFT JOIN categories c ON c.id=s.category_id WHERE c.id IS NULL OR c.kind!='service';
SELECT s.id,'missing_or_suspended_provider' AS issue FROM service_profiles s
 LEFT JOIN users u ON u.id=s.user_id WHERE u.id IS NULL OR (s.available=1 AND u.suspended!=0);
SELECT service_id,worker_id,COUNT(*) AS active_count FROM interactions
 WHERE kind='service' AND status IN ('PENDING','ACCEPTED','IN_PROGRESS') GROUP BY service_id,worker_id HAVING COUNT(*)>1;
SELECT i.id,'invalid_participants' AS issue FROM interactions i LEFT JOIN service_profiles s ON s.id=i.service_id
 WHERE i.kind='service' AND (s.id IS NULL OR i.owner_id!=s.user_id OR i.owner_id=i.worker_id);
SELECT id,'invalid_service_fields' AS issue FROM service_profiles WHERE radius_km NOT BETWEEN 1 AND 50
 OR experience NOT BETWEEN 0 AND 70 OR latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180
 OR available NOT IN (0,1) OR phone_visible NOT IN (0,1) OR json_valid(portfolio_urls)=0 OR json_valid(wizard_state)=0;
-- Historical defaults cannot be distinguished from provider-entered matching values.
-- Review these IDs with the provider before clearing or confirming their values.
SELECT id,'legacy_defaults_require_provenance_review' AS issue FROM service_profiles
 WHERE wizard_state='{}' AND (operating_hours='9:00 AM - 7:00 PM' OR (pricing_model='fixed' AND base_price_paise=0));
SELECT r.id,'rating_without_completed_request' AS issue FROM service_ratings r
 WHERE NOT EXISTS(SELECT 1 FROM interactions i WHERE i.service_id=r.service_id AND i.worker_id=r.customer_id AND i.status='COMPLETED');
