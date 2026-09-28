-- Targeted correction requested for the provider account whose verified phone is
-- stored as 7569408235, 917569408235 or +917569408235 depending on legacy auth.
-- This changes only this provider's service visibility flag; it does not expose
-- the phone to unrelated API responses when the service is disabled later.
UPDATE service_profiles
SET phone_visible = 1,
    updated_at = unixepoch()
WHERE user_id IN (
  SELECT id FROM users
  WHERE replace(replace(replace(replace(phone, '+', ''), ' ', ''), '-', ''), '(', '') IN ('7569408235', '917569408235')
);
