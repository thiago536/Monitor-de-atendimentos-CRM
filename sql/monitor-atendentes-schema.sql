-- ==========================================
-- TABELA: monitor_atendentes
-- Descrição: Armazena status online/offline dos agentes em tempo real
-- ==========================================

CREATE TABLE IF NOT EXISTS monitor_atendentes (
    id_atendente TEXT PRIMARY KEY,
    online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    chats_snapshot JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para otimização de consultas
CREATE INDEX IF NOT EXISTS idx_monitor_online ON monitor_atendentes(online);
CREATE INDEX IF NOT EXISTS idx_monitor_last_seen ON monitor_atendentes(last_seen);

-- Comentários
COMMENT ON TABLE monitor_atendentes IS 'Monitoramento em tempo real do status dos agentes';
COMMENT ON COLUMN monitor_atendentes.id_atendente IS 'Identificador único do agente';
COMMENT ON COLUMN monitor_atendentes.online IS 'Status online/offline (calculado pelo last_seen)';
COMMENT ON COLUMN monitor_atendentes.last_seen IS 'Último ping recebido do agente';
COMMENT ON COLUMN monitor_atendentes.chats_snapshot IS 'Snapshot dos chats ativos do agente';
