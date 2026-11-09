-- Offline payments are handled directly between service customers and providers.
-- These timestamps record each person's acknowledgement; they do not represent verified transactions.
CREATE TABLE IF NOT EXISTS service_offline_payments (
  interaction_id TEXT PRIMARY KEY REFERENCES interactions(id),
  provider_confirmed_at INTEGER,
  customer_confirmed_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS service_offline_payment_insert_guard BEFORE INSERT ON service_offline_payments BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM interactions WHERE id=NEW.interaction_id AND kind='service' AND status='COMPLETED'
  ) THEN RAISE(ABORT,'PAYMENT_CONFIRMATION_REQUIRES_COMPLETED_SERVICE') END;
  SELECT CASE WHEN NEW.provider_confirmed_at IS NOT NULL OR NEW.customer_confirmed_at IS NOT NULL
    THEN RAISE(ABORT,'PAYMENT_CONFIRMATION_MUST_BE_ACKNOWLEDGED') END;
END;

CREATE TRIGGER IF NOT EXISTS service_offline_payment_update_guard BEFORE UPDATE ON service_offline_payments BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM interactions WHERE id=NEW.interaction_id AND kind='service' AND status='COMPLETED'
  ) THEN RAISE(ABORT,'PAYMENT_CONFIRMATION_REQUIRES_COMPLETED_SERVICE') END;
  SELECT CASE WHEN OLD.interaction_id!=NEW.interaction_id
    OR (OLD.provider_confirmed_at IS NOT NEW.provider_confirmed_at AND NOT (
      (OLD.provider_confirmed_at IS NULL AND NEW.provider_confirmed_at IS NOT NULL)
      OR (OLD.provider_confirmed_at IS NOT NULL AND NEW.provider_confirmed_at IS NULL
        AND OLD.customer_confirmed_at IS NULL AND NEW.customer_confirmed_at IS NULL)
    ))
    OR (OLD.customer_confirmed_at IS NOT NEW.customer_confirmed_at AND NOT (
      (OLD.customer_confirmed_at IS NULL AND NEW.customer_confirmed_at IS NOT NULL)
      OR (OLD.customer_confirmed_at IS NOT NULL AND NEW.customer_confirmed_at IS NULL
        AND OLD.provider_confirmed_at IS NULL AND NEW.provider_confirmed_at IS NULL)
    ))
    THEN RAISE(ABORT,'PAYMENT_CONFIRMATION_LOCKED') END;
END;
