-- ==========================================
-- ATUALIZAÇÃO DA TABELA: monitor_atendentes v3.3
-- Descrição: Adiciona novos campos para sistema de status estável
-- Data: Janeiro 2026
-- ==========================================

-- 1. ADICIONAR NOVOS CAMPOS
ALTER TABLE monitor_atendentes 
ADD COLUMN IF NOT EXISTS online_raw BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS online_calculado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ts_client BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'v1.0';

-- 2. ATUALIZAR COMENTÁRIOS
COMMENT ON COLUMN monitor_atendentes.online IS 'DEPRECATED: Use online_calculado. Mantido para compatibilidade';
COMMENT ON COLUMN monitor_atendentes.online_raw IS 'Status enviado pelo cliente (para debug)';
COMMENT ON COLUMN monitor_atendentes.online_calculado IS 'Status calculado pelo servidor baseado em last_seen (FONTE DE VERDADE)';
COMMENT ON COLUMN monitor_atendentes.ts_client IS 'Timestamp do cliente (milissegundos)';
COMMENT ON COLUMN monitor_atendentes.source IS 'Origem da requisição (extension, api, etc)';
COMMENT ON COLUMN monitor_atendentes.version IS 'Versão da extensão/cliente';

-- 3. CRIAR ÍNDICES PARA OS NOVOS CAMPOS
CREATE INDEX IF NOT EXISTS idx_monitor_online_calculado ON monitor_atendentes(online_calculado);
CREATE INDEX IF NOT EXISTS idx_monitor_source ON monitor_atendentes(source);
CREATE INDEX IF NOT EXISTS idx_monitor_version ON monitor_atendentes(version);

-- 4. MIGRAR DADOS EXISTENTES (se houver)
-- Copia o valor de 'online' para 'online_raw' e 'online_calculado'
UPDATE monitor_atendentes 
SET 
    online_raw = online,
    online_calculado = online,
    ts_client = EXTRACT(EPOCH FROM updated_at) * 1000,
    source = 'migrated',
    version = 'v1.0'
WHERE online_raw IS NULL;

-- 5. ATUALIZAR DESCRIÇÃO DA TABELA
COMMENT ON TABLE monitor_atendentes IS 'Monitoramento em tempo real do status dos agentes - v3.3 com status estável';

-- ==========================================
-- VERIFICAÇÃO DA ESTRUTURA ATUALIZADA
-- ==========================================

-- Execute este SELECT para verificar se a atualização foi aplicada:
/*
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'monitor_atendentes' 
ORDER BY ordinal_position;
*/

-- ==========================================
-- ESTRUTURA FINAL ESPERADA
-- ==========================================

/*
CAMPOS DA TABELA monitor_atendentes (v3.3):

1. id_atendente          TEXT (PK)           - Nome do atendente
2. online                BOOLEAN             - DEPRECATED (compatibilidade)
3. last_seen             TIMESTAMP WITH TZ   - Último heartbeat recebido
4. chats_snapshot        JSONB               - Snapshot dos chats
5. created_at            TIMESTAMP WITH TZ   - Data de criação
6. updated_at            TIMESTAMP WITH TZ   - Última atualização
7. online_raw            BOOLEAN             - Status enviado pelo cliente
8. online_calculado      BOOLEAN             - Status calculado (FONTE DE VERDADE)
9. ts_client             BIGINT              - Timestamp do cliente
10. source               TEXT                - Origem (extension, api, etc)
11. version              TEXT                - Versão da extensão

ÍNDICES:
- idx_monitor_online (existente)
- idx_monitor_last_seen (existente)
- idx_monitor_online_calculado (novo)
- idx_monitor_source (novo)
- idx_monitor_version (novo)
*/

-- ==========================================
-- EXEMPLO DE USO
-- ==========================================

/*
-- Inserir/atualizar registro
INSERT INTO monitor_atendentes (
    id_atendente, 
    last_seen, 
    online_raw, 
    online_calculado, 
    chats_snapshot, 
    ts_client, 
    source, 
    version,
    updated_at
) VALUES (
    'João Silva',
    NOW(),
    true,
    true,
    '[]'::jsonb,
    1642345678901,
    'extension',
    'v3.2',
    NOW()
) ON CONFLICT (id_atendente) 
DO UPDATE SET
    last_seen = EXCLUDED.last_seen,
    online_raw = EXCLUDED.online_raw,
    online_calculado = EXCLUDED.online_calculado,
    chats_snapshot = EXCLUDED.chats_snapshot,
    ts_client = EXCLUDED.ts_client,
    source = EXCLUDED.source,
    version = EXCLUDED.version,
    updated_at = EXCLUDED.updated_at;

-- Consultar com cálculo de status
SELECT 
    id_atendente,
    last_seen,
    online_raw,
    online_calculado,
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - last_seen)) <= 20 THEN true
        ELSE false
    END as status_recalculado,
    EXTRACT(EPOCH FROM (NOW() - last_seen))::INTEGER as segundos_offline,
    source,
    version
FROM monitor_atendentes
ORDER BY last_seen DESC;
*/

-- ==========================================
-- LIMPEZA (OPCIONAL)
-- ==========================================

/*
-- Para remover registros antigos (mais de 7 dias offline):
DELETE FROM monitor_atendentes 
WHERE last_seen < NOW() - INTERVAL '7 days';

-- Para resetar todos os status (emergência):
UPDATE monitor_atendentes 
SET online_calculado = false, online_raw = false;
*/