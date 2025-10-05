-- =====================================================
-- Audit-Trail Schema für Supabase
-- Speichert alle User-Aktionen für Nachvollziehbarkeit
-- =====================================================

-- Extension für UUID (falls nicht aktiviert)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Tabelle: audit_logs
-- Speichert alle User-Aktionen mit Kontext
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User-Kontext
    user_id TEXT NOT NULL, -- User-ID oder 'anonymous' oder 'system'
    ip_address INET,       -- IP-Adresse des Users
    user_agent TEXT,       -- Browser/Client Info
    
    -- Aktion
    action TEXT NOT NULL,  -- z.B. 'create', 'update', 'delete', 'search'
    resource TEXT NOT NULL, -- z.B. 'problem', 'solution', 'embedding'
    resource_id UUID,      -- ID des betroffenen Objekts
    
    -- Details
    method TEXT,           -- HTTP-Methode: GET, POST, PUT, DELETE
    endpoint TEXT,         -- API-Endpoint: /api/problems/:id
    request_body JSONB,    -- Request-Body (bei POST/PUT)
    response_status INTEGER, -- HTTP-Status-Code
    
    -- Zusätzliche Metadaten
    metadata JSONB,        -- Flexible zusätzliche Daten
    error_message TEXT,    -- Fehlermeldung falls vorhanden
    
    -- Zeitstempel
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite Index für häufige Queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC);

-- =====================================================
-- Funktion: Alte Audit-Logs automatisch löschen
-- Behält nur die letzten 90 Tage
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Views für häufige Audit-Abfragen
-- =====================================================

-- View: User-Aktivität der letzten 7 Tage
CREATE OR REPLACE VIEW recent_user_activity AS
SELECT 
    user_id,
    action,
    resource,
    COUNT(*) as action_count,
    MAX(created_at) as last_action
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id, action, resource
ORDER BY last_action DESC;

-- View: Fehlerhafte Requests
CREATE OR REPLACE VIEW failed_requests AS
SELECT 
    user_id,
    action,
    resource,
    endpoint,
    error_message,
    response_status,
    created_at
FROM audit_logs
WHERE response_status >= 400
ORDER BY created_at DESC;

-- =====================================================
-- Beispiel-Queries
-- =====================================================

-- Alle Aktionen eines Users:
-- SELECT * FROM audit_logs 
-- WHERE user_id = 'user-123' 
-- ORDER BY created_at DESC 
-- LIMIT 50;

-- Letzte Änderungen an einem Problem:
-- SELECT * FROM audit_logs 
-- WHERE resource = 'problem' 
--   AND resource_id = 'problem-uuid' 
-- ORDER BY created_at DESC;

-- Aktivitäts-Dashboard:
-- SELECT action, COUNT(*) as count
-- FROM audit_logs
-- WHERE created_at > NOW() - INTERVAL '24 hours'
-- GROUP BY action
-- ORDER BY count DESC;

-- =====================================================
-- Cron-Job (optional): Alte Logs löschen
-- =====================================================
-- In Supabase Dashboard unter "Database" > "Cron Jobs":
-- SELECT cron.schedule(
--     'cleanup-audit-logs',
--     '0 3 * * 0',  -- Jeden Sonntag um 3 Uhr
--     $$ SELECT cleanup_old_audit_logs(); $$
-- );
