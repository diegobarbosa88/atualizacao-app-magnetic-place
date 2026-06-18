-- Migrar system_settings de Tink para Salt Edge
-- tink_access_token guardava o access_token OAuth; em Salt Edge guardamos o connection_id directamente
ALTER TABLE system_settings RENAME COLUMN tink_access_token TO saltedge_connection_id;

-- tink_refresh_token guardava o refresh_token; em Salt Edge guardamos o customer_id
ALTER TABLE system_settings RENAME COLUMN tink_refresh_token TO saltedge_customer_id;

-- Salt Edge não tem token com expiração no mesmo sentido
ALTER TABLE system_settings DROP COLUMN IF EXISTS tink_token_expires_at;
