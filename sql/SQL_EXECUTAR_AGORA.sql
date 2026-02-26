-- ==========================================
-- 🚀 EXECUTE ESTE SQL NO SUPABASE AGORA
-- ==========================================

-- 1. ADICIONAR NOVOS CAMPOS
ALTER TABLE monitor_atendentes 
ADD COLUMN IF NOT EXISTS online_raw BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS online_calculado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ts_client BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'v1.0';

-- 2. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_monitor_online_calculado ON monitor_atendentes(online_calculado);
CREATE INDEX IF NOT EXISTS idx_monitor_source ON monitor_atendentes(source);

-- 3. MIGRAR DADOS EXISTENTES
UPDATE monitor_atendentes 
SET 
    online_raw = online,
    online_calculado = online,
    ts_client = EXTRACT(EPOCH FROM updated_at) * 1000,
    source = 'migrated',
    version = 'v1.0'
WHERE online_raw IS NULL;

-- 4. VERIFICAR RESULTADO
SELECT 
    id_atendente,
    online,
    online_raw,
    online_calculado,
    source,
    version,
    last_seen
FROM monitor_atendentes
LIMIT 5;