-- ==========================================
-- TABELA: previsao_demanda
-- Descrição: Armazena histórico das previsões de demanda geradas pela IA
-- ==========================================

CREATE TABLE IF NOT EXISTS previsao_demanda (
    id SERIAL PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'horario' ou 'semanal'
    data_referencia DATE NOT NULL, -- Data da previsão (YYYY-MM-DD)
    payload JSONB NOT NULL, -- Objeto 'analise' completo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraint única para evitar duplicatas
ALTER TABLE previsao_demanda 
ADD CONSTRAINT unique_tipo_data 
UNIQUE (tipo, data_referencia);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_previsao_tipo ON previsao_demanda(tipo);
CREATE INDEX IF NOT EXISTS idx_previsao_data ON previsao_demanda(data_referencia);
CREATE INDEX IF NOT EXISTS idx_previsao_created ON previsao_demanda(created_at);

-- Comentários
COMMENT ON TABLE previsao_demanda IS 'Histórico das previsões de demanda geradas pela IA';
COMMENT ON COLUMN previsao_demanda.tipo IS 'Tipo da previsão: horario ou semanal';
COMMENT ON COLUMN previsao_demanda.data_referencia IS 'Data de referência da previsão (YYYY-MM-DD)';
COMMENT ON COLUMN previsao_demanda.payload IS 'Objeto analise completo em formato JSONB';

-- ==========================================
-- EXEMPLO DE DADOS
-- ==========================================

/*
-- Previsão horária
INSERT INTO previsao_demanda (tipo, data_referencia, payload) VALUES (
    'horario',
    '2026-01-19',
    '{
        "proximasHoras": [
            {"hora": "15:00", "volumeEsperado": 12, "isPico": false},
            {"hora": "16:00", "volumeEsperado": 18, "isPico": true}
        ],
        "recomendacao": {
            "agentes": 4,
            "motivo": "1 picos de demanda previstos",
            "prioridade": "média"
        }
    }'::jsonb
);

-- Previsão semanal
INSERT INTO previsao_demanda (tipo, data_referencia, payload) VALUES (
    'semanal',
    '2026-01-19',
    '{
        "projecao7Dias": [
            {"dia": "Dom", "dataCompleta": "19/01", "previsao": 45},
            {"dia": "Seg", "dataCompleta": "20/01", "previsao": 78}
        ],
        "tendencia": "Crescente 📈",
        "mediaHistorica": 65
    }'::jsonb
);
*/

-- ==========================================
-- CONSULTAS ÚTEIS
-- ==========================================

/*
-- Ver previsões de hoje
SELECT * FROM previsao_demanda 
WHERE data_referencia = CURRENT_DATE
ORDER BY tipo;

-- Ver histórico de previsões horárias
SELECT 
    data_referencia,
    payload->'recomendacao'->>'agentes' as agentes_recomendados,
    payload->'recomendacao'->>'prioridade' as prioridade,
    created_at
FROM previsao_demanda 
WHERE tipo = 'horario'
ORDER BY data_referencia DESC
LIMIT 10;

-- Ver tendências semanais
SELECT 
    data_referencia,
    payload->>'tendencia' as tendencia,
    payload->>'mediaHistorica' as media_historica,
    created_at
FROM previsao_demanda 
WHERE tipo = 'semanal'
ORDER BY data_referencia DESC
LIMIT 10;

-- Limpeza de dados antigos (mais de 30 dias)
DELETE FROM previsao_demanda 
WHERE created_at < NOW() - INTERVAL '30 days';
*/