-- ============================================
-- SCHEMA: Sistema de Alertas Inteligentes
-- ============================================
-- Execute este SQL no Supabase SQL Editor

-- Tabela de alertas do sistema
CREATE TABLE IF NOT EXISTS alertas_sistema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL,           -- CRITICO, URGENTE, ALERTA
  categoria TEXT NOT NULL,      -- TMA, QUALIDADE, SOBRECARGA, ABANDONO, PRODUTIVIDADE
  mensagem TEXT NOT NULL,       -- Descrição do alerta
  valor NUMERIC,                -- Valor atual da métrica
  limite NUMERIC,               -- Limite/threshold configurado
  agente TEXT,                  -- Nome do agente (se aplicável)
  sugestao TEXT,                -- Sugestão de ação corretiva
  resolvido BOOLEAN DEFAULT false,  -- Se o alerta foi resolvido
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_alertas_timestamp ON alertas_sistema(timestamp);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo ON alertas_sistema(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_categoria ON alertas_sistema(categoria);
CREATE INDEX IF NOT EXISTS idx_alertas_resolvido ON alertas_sistema(resolvido);
CREATE INDEX IF NOT EXISTS idx_alertas_agente ON alertas_sistema(agente);

-- Comentários para documentação
COMMENT ON TABLE alertas_sistema IS 'Armazena alertas gerados pelo sistema de monitoramento inteligente';
COMMENT ON COLUMN alertas_sistema.tipo IS 'Severidade: CRITICO, URGENTE, ALERTA';
COMMENT ON COLUMN alertas_sistema.categoria IS 'Categoria: TMA, QUALIDADE, SOBRECARGA, ABANDONO, PRODUTIVIDADE';
COMMENT ON COLUMN alertas_sistema.valor IS 'Valor atual da métrica que disparou o alerta';
COMMENT ON COLUMN alertas_sistema.limite IS 'Threshold/limite configurado que foi ultrapassado';
COMMENT ON COLUMN alertas_sistema.agente IS 'Nome do agente relacionado ao alerta (opcional)';
COMMENT ON COLUMN alertas_sistema.sugestao IS 'Sugestão de ação corretiva para resolver o problema';
COMMENT ON COLUMN alertas_sistema.resolvido IS 'Indica se o alerta foi marcado como resolvido';

-- View para alertas ativos (últimas 2 horas, não resolvidos)
CREATE OR REPLACE VIEW alertas_ativos AS
SELECT 
  id,
  tipo,
  categoria,
  mensagem,
  valor,
  limite,
  agente,
  sugestao,
  timestamp,
  EXTRACT(EPOCH FROM (NOW() - timestamp))/60 AS minutos_desde_alerta
FROM alertas_sistema
WHERE 
  timestamp >= NOW() - INTERVAL '2 hours'
  AND resolvido = false
ORDER BY 
  CASE tipo
    WHEN 'CRITICO' THEN 1
    WHEN 'URGENTE' THEN 2
    WHEN 'ALERTA' THEN 3
    ELSE 4
  END,
  timestamp DESC;

-- View para estatísticas de alertas
CREATE OR REPLACE VIEW estatisticas_alertas AS
SELECT 
  DATE(timestamp) AS data,
  tipo,
  categoria,
  COUNT(*) AS total_alertas,
  COUNT(CASE WHEN resolvido THEN 1 END) AS resolvidos,
  COUNT(CASE WHEN NOT resolvido THEN 1 END) AS pendentes,
  AVG(valor) AS valor_medio,
  MAX(valor) AS valor_maximo
FROM alertas_sistema
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), tipo, categoria
ORDER BY data DESC, tipo, categoria;

-- Função para limpar alertas antigos (mais de 30 dias)
CREATE OR REPLACE FUNCTION limpar_alertas_antigos()
RETURNS INTEGER AS $$
DECLARE
  linhas_deletadas INTEGER;
BEGIN
  DELETE FROM alertas_sistema
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS linhas_deletadas = ROW_COUNT;
  RETURN linhas_deletadas;
END;
$$ LANGUAGE plpgsql;

-- Comentário na função
COMMENT ON FUNCTION limpar_alertas_antigos() IS 'Remove alertas com mais de 30 dias para manter a tabela limpa';

-- ============================================
-- DADOS DE EXEMPLO (Opcional - para testes)
-- ============================================

-- Exemplo de alerta crítico de TMA
INSERT INTO alertas_sistema (tipo, categoria, mensagem, valor, limite, sugestao)
VALUES (
  'CRITICO',
  'TMA',
  'TMA em 52min (limite: 45min)',
  52,
  45,
  'Redistribuir atendimentos ou alocar mais agentes'
);

-- Exemplo de alerta de sobrecarga
INSERT INTO alertas_sistema (tipo, categoria, mensagem, valor, limite, agente, sugestao)
VALUES (
  'CRITICO',
  'SOBRECARGA',
  'Maria Santos com 10 atendimentos simultâneos',
  10,
  8,
  'Maria Santos',
  'Transferir atendimentos para outros agentes'
);

-- Exemplo de alerta de qualidade
INSERT INTO alertas_sistema (tipo, categoria, mensagem, valor, limite, sugestao)
VALUES (
  'CRITICO',
  'QUALIDADE',
  'Taxa de falha em 45.5% (18/40)',
  45.5,
  40,
  'Revisar processos e treinamento da equipe'
);

-- ============================================
-- QUERIES ÚTEIS
-- ============================================

-- Ver alertas ativos
-- SELECT * FROM alertas_ativos;

-- Ver estatísticas dos últimos 7 dias
-- SELECT * FROM estatisticas_alertas WHERE data >= CURRENT_DATE - INTERVAL '7 days';

-- Contar alertas por tipo (últimas 24h)
-- SELECT tipo, COUNT(*) as total
-- FROM alertas_sistema
-- WHERE timestamp >= NOW() - INTERVAL '24 hours'
-- GROUP BY tipo
-- ORDER BY total DESC;

-- Ver alertas de um agente específico
-- SELECT * FROM alertas_sistema
-- WHERE agente = 'Maria Santos'
-- ORDER BY timestamp DESC
-- LIMIT 10;

-- Limpar alertas antigos
-- SELECT limpar_alertas_antigos();
