-- Adiciona coluna para rastrear origem do contato (ativo vs receptivo)
ALTER TABLE atendimentos 
ADD COLUMN IF NOT EXISTS origem VARCHAR(20) DEFAULT 'receptivo';

-- Índices para relatórios rápidos
CREATE INDEX IF NOT EXISTS idx_atendimentos_origem ON atendimentos(origem);
