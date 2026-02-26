-- ==========================================
-- SCHEMA PARA MONITORAMENTO EM TEMPO REAL
-- ==========================================
-- Execute este SQL no Supabase SQL Editor se a tabela não for criada automaticamente

-- Cria a tabela de monitoramento de atendentes
CREATE TABLE IF NOT EXISTS monitor_atendentes (
    id_atendente TEXT PRIMARY KEY,
    online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    chats_snapshot JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cria índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_monitor_online ON monitor_atendentes(online);
CREATE INDEX IF NOT EXISTS idx_monitor_last_seen ON monitor_atendentes(last_seen);

-- Comentários para documentação
COMMENT ON TABLE monitor_atendentes IS 'Tabela de monitoramento em tempo real dos atendentes';
COMMENT ON COLUMN monitor_atendentes.id_atendente IS 'Nome/ID único do atendente';
COMMENT ON COLUMN monitor_atendentes.online IS 'Status online/offline do atendente';
COMMENT ON COLUMN monitor_atendentes.last_seen IS 'Último heartbeat recebido';
COMMENT ON COLUMN monitor_atendentes.chats_snapshot IS 'Snapshot dos chats com mensagens não lidas e timestamps de SLA';
COMMENT ON COLUMN monitor_atendentes.created_at IS 'Data de criação do registro';
COMMENT ON COLUMN monitor_atendentes.updated_at IS 'Data da última atualização';

-- Exemplo de estrutura do chats_snapshot:
-- [
--   {
--     "telefone": "+5583999999999",
--     "qtd": 3,
--     "unread_since": "2024-01-15T14:30:00.000Z"
--   },
--   {
--     "telefone": "+5583988888888",
--     "qtd": 0,
--     "unread_since": null
--   }
-- ]

-- Query de exemplo para verificar chats críticos (aguardando mais de 5 minutos)
-- SELECT 
--   id_atendente,
--   online,
--   jsonb_array_elements(chats_snapshot) as chat
-- FROM monitor_atendentes
-- WHERE 
--   online = true 
--   AND chats_snapshot @> '[{"qtd": 1}]'::jsonb
--   AND (jsonb_array_elements(chats_snapshot)->>'unread_since')::timestamp < NOW() - INTERVAL '5 minutes';
