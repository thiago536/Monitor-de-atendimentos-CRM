-- ========================================
-- SCHEMA PARA SUPABASE - TABELA ATENDIMENTOS
-- ========================================

-- Criar tabela de atendimentos
CREATE TABLE IF NOT EXISTS atendimentos (
  id TEXT PRIMARY KEY,
  nome_cliente TEXT NOT NULL,
  telefone TEXT NOT NULL,
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT,
  id_atendente TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Em andamento',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_atendimentos_telefone ON atendimentos(telefone);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_created_at ON atendimentos(created_at);
CREATE INDEX IF NOT EXISTS idx_atendimentos_telefone_status ON atendimentos(telefone, status);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_atendimentos_updated_at ON atendimentos;
CREATE TRIGGER update_atendimentos_updated_at
    BEFORE UPDATE ON atendimentos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários na tabela
COMMENT ON TABLE atendimentos IS 'Tabela para armazenar dados de atendimentos do sistema CRM';
COMMENT ON COLUMN atendimentos.id IS 'ID único do atendimento gerado pelo sistema';
COMMENT ON COLUMN atendimentos.nome_cliente IS 'Nome completo do cliente';
COMMENT ON COLUMN atendimentos.telefone IS 'Número de telefone do cliente (usado como identificador)';
COMMENT ON COLUMN atendimentos.horario_inicio IS 'Horário de início do atendimento (HH:MM)';
COMMENT ON COLUMN atendimentos.horario_fim IS 'Horário de fim do atendimento (HH:MM)';
COMMENT ON COLUMN atendimentos.id_atendente IS 'Identificador do atendente responsável';
COMMENT ON COLUMN atendimentos.status IS 'Status atual do atendimento (Em andamento, Resolvido, etc.)';
COMMENT ON COLUMN atendimentos.created_at IS 'Data e hora de criação do registro';
COMMENT ON COLUMN atendimentos.updated_at IS 'Data e hora da última atualização';

-- Inserir dados de exemplo (opcional)
INSERT INTO atendimentos (
  id, 
  nome_cliente, 
  telefone, 
  horario_inicio, 
  horario_fim, 
  id_atendente, 
  status
) VALUES 
(
  '1736542800000abc123',
  'João Silva Exemplo',
  '11999999999',
  '09:30',
  '10:15',
  'Atendente PC Local',
  'Resolvido'
),
(
  '1736542900000def456',
  'Maria Santos Exemplo',
  '11888888888',
  '10:00',
  NULL,
  'Atendente PC Local',
  'Em andamento'
)
ON CONFLICT (id) DO NOTHING;

-- Verificar se a tabela foi criada corretamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'atendimentos'
ORDER BY ordinal_position;