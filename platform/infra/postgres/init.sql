-- CSaaS Platform — PostgreSQL Initialisation
-- Extensions, schemas, RLS policies, partitioning, indexes

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector for face embeddings + semantic memory

-- ─── Core Tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'trial',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    product VARCHAR(50) NOT NULL,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    limits JSONB NOT NULL DEFAULT '{}',
    features JSONB NOT NULL DEFAULT '[]',
    stripe_price_id VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE tenants ADD CONSTRAINT fk_tenants_plan
    FOREIGN KEY (plan_id) REFERENCES plans(id);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'operator',
    permissions JSONB DEFAULT '[]',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CCTV Tables ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    rtsp_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    resolution VARCHAR(20),
    fps INTEGER DEFAULT 15,
    ai_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cameras_tenant ON cameras(tenant_id);

CREATE TABLE IF NOT EXISTS ai_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    camera_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    confidence REAL NOT NULL,
    bounding_box JSONB,
    metadata JSONB,
    snapshot_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_events_tenant_time ON ai_events(tenant_id, created_at DESC);
CREATE INDEX idx_ai_events_camera ON ai_events(camera_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_id BIGINT,
    camera_id UUID,
    severity VARCHAR(20) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_to UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alerts_tenant_status ON alerts(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS known_faces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'known',
    embedding VECTOR(512),
    photo_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_faces_tenant ON known_faces(tenant_id);

CREATE TABLE IF NOT EXISTS cua_sandboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    container_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'provisioning',
    vnc_port INTEGER,
    novnc_port INTEGER,
    api_port INTEGER,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Cybersecurity Tables ───────────────────────────────────

CREATE TABLE IF NOT EXISTS security_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    source VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(100),
    rule_id VARCHAR(100),
    description TEXT,
    raw_log JSONB,
    source_ip INET,
    destination_ip INET,
    ioc_matches JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_security_events_tenant_time ON security_events(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    attack_type VARCHAR(100),
    affected_assets JSONB,
    timeline JSONB,
    response_actions JSONB,
    assigned_to UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_incidents_tenant_status ON incidents(tenant_id, status);

CREATE TABLE IF NOT EXISTS iocs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    ioc_type VARCHAR(50) NOT NULL,
    value TEXT NOT NULL,
    source VARCHAR(100),
    threat_score REAL,
    tags JSONB DEFAULT '[]',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_iocs_type_value ON iocs(ioc_type, value);

-- ─── Audit & Agent Logs ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID,
    agent_id VARCHAR(100) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    trace_id VARCHAR(100),
    input JSONB,
    output JSONB,
    status VARCHAR(20) NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_logs_time ON agent_logs(created_at DESC);

-- ─── Row-Level Security ─────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE known_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE cua_sandboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ─── Seed Plans ─────────────────────────────────────────────

INSERT INTO plans (name, product, price_monthly, price_yearly, limits, features) VALUES
-- CCTV plans
('Starter', 'cctv', 29.00, 290.00,
 '{"cameras": 5, "cua_agents": 1, "retention_days": 7, "events_per_day": 10000}',
 '["live_monitoring", "basic_alerts", "motion_detection"]'),
('Professional', 'cctv', 99.00, 990.00,
 '{"cameras": 25, "cua_agents": 3, "retention_days": 30, "events_per_day": 100000}',
 '["live_monitoring", "advanced_alerts", "face_recognition", "anyware_ai_analytics", "cua_operator"]'),
('Enterprise', 'cctv', 299.00, 2990.00,
 '{"cameras": -1, "cua_agents": -1, "retention_days": 90, "events_per_day": -1}',
 '["live_monitoring", "advanced_alerts", "face_recognition", "anyware_ai_analytics", "cua_operator", "custom_models", "api_access", "priority_support"]'),
-- Cybersecurity plans
('Starter', 'cybersecurity', 49.00, 490.00,
 '{"users": 5, "events_per_day": 100, "retention_days": 7}',
 '["basic_siem", "alert_rules", "email_notifications"]'),
('Professional', 'cybersecurity', 149.00, 1490.00,
 '{"users": 25, "events_per_day": 10000, "retention_days": 30}',
 '["advanced_siem", "anomaly_detection", "auto_response", "threat_intel", "incident_management"]'),
('Enterprise', 'cybersecurity', 499.00, 4990.00,
 '{"users": -1, "events_per_day": -1, "retention_days": 90}',
 '["advanced_siem", "anomaly_detection", "auto_response", "threat_intel", "incident_management", "custom_playbooks", "api_access", "sso", "priority_support"]'),
-- Bundle plans
('Bundle Starter', 'bundle', 69.00, 690.00,
 '{"cameras": 5, "users": 5, "cua_agents": 1, "retention_days": 7}',
 '["live_monitoring", "basic_alerts", "basic_siem"]'),
('Bundle Professional', 'bundle', 199.00, 1990.00,
 '{"cameras": 25, "users": 25, "cua_agents": 3, "retention_days": 30}',
 '["live_monitoring", "advanced_alerts", "face_recognition", "anyware_ai_analytics", "cua_operator", "advanced_siem", "anomaly_detection", "auto_response"]'),
('Bundle Enterprise', 'bundle', 699.00, 6990.00,
 '{"cameras": -1, "users": -1, "cua_agents": -1, "retention_days": 90}',
 '["all"]')
ON CONFLICT DO NOTHING;
