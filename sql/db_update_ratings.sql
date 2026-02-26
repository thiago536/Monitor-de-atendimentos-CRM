-- Adiciona coluna para avaliação (1 a 5 estrelas)
ALTER TABLE public.atendimentos 
ADD COLUMN IF NOT EXISTS avaliacao smallint;

-- Adiciona coluna para tags (ex: 'vip', 'reclamao')
ALTER TABLE public.atendimentos 
ADD COLUMN IF NOT EXISTS tags_cliente text[];

-- Adiciona comentário para documentação
COMMENT ON COLUMN public.atendimentos.avaliacao IS 'Avaliação do atendimento pelo agente (1-5 estrelas)';
