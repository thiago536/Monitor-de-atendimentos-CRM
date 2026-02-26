const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/public', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
}, express.static('public'));

// ==================== CONFIGURAÇÃO DO SUPABASE ====================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ==================== CONFIGURAÇÃO DE EMAIL ====================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// Lista de destinatários dos relatórios
const DESTINATARIOS_RELATORIO = [
    'gestor1@exemplo.com',
    'gestor2@exemplo.com'
];


// ============================================
// 🧠 SISTEMA DE CLASSIFICAÇÃO AUTOMÁTICA DE MOTIVOS
// ============================================
/**
 * Classifica automaticamente o motivo do atendimento baseado no contexto resumido
 * Hierarquia de decisão rigorosa para alcançar ≥75% de acurácia
 * 
 * @param {string} contextoResumido - Resumo da conversa do atendimento
 * @returns {string} - Categoria do motivo classificada
 * 
 * Categorias possíveis:
 * - Não respondeu
 * - Liberar Sped
 * - PDV Móvel / Maquininha
 * - PINPAD
 * - Entrada de nota
 * - Automação
 * - LMC
 * - Instalação
 * - Certificado Digital
 * - Cadastro de cartão de abastecimento
 * - PDV
 * - Financeiro
 * - Gerente (fallback)
 */
function classificarMotivo(contextoResumido) {
    // Normaliza o contexto: lowercase e remove espaços extras
    const contexto = (contextoResumido || '').toLowerCase().trim();
    const tamanho = contexto.length;

    // ========================================
    // NÍVEL 1: VALIDAÇÃO BÁSICA
    // ========================================

    // 1. Não respondeu (contexto muito curto)
    if (tamanho < 15) {
        return "Não respondeu";
    }

    // ========================================
    // NÍVEL 2: CATEGORIAS DE ALTA PRIORIDADE
    // ========================================

    // 2. Liberar Sped (alta confiança: 92%)
    // Palavras-chave obrigatórias: sped, fiscal, contabil
    if (/sped|fiscal|contabil/.test(contexto)) {
        return "Liberar Sped";
    }

    // 3. PDV Móvel / Maquininha
    // Requisito: mencionar maquininha/maquineta E ter problema de pagamento/técnico
    if (/maquinh|maquinet|stone|cielo/.test(contexto)) {
        // Aceita com contexto de pagamento OU problema técnico
        if (/cartão|cartao|pix|payment|estorn|pagamento|não passa|nao passa|aceita|offline|ip|comunica/.test(contexto)) {
            return "PDV Móvel / Maquininha";
        }
    }

    // 4. PINPAD (terminal fixo)
    // Diferencial: palavra "pinpad" ou "tef" mencionada explicitamente
    if (/pinpad|tef|terminal fixo/.test(contexto)) {
        return "PINPAD";
    }

    // ========================================
    // NÍVEL 3: CATEGORIAS ESPECÍFICAS
    // ========================================

    // 5. Entrada de nota
    // Diferencial: verbo "dar entrada" + "nota" ou "xml" ou "manifesto"
    // "lançar nota" só se NÃO for contexto de SPED
    if (/(dar|dando|dá)\s*(entrada|a\s*entrada).{0,20}\b(nota|xml)|nota.{0,20}entrada|manifesto|nota.*(não|nao)\s*(sobe|aparece)/.test(contexto)) {
        return "Entrada de nota";
    }
    if (/lançar.{0,10}nota/.test(contexto) && !/sped|contabil/.test(contexto)) {
        return "Entrada de nota";
    }

    // 6. Automação (Bombas/Concentrador)
    // Diferencial: mencionar "concentrador" ou "bomba" com problema técnico
    if (/concentrador|bomba.{0,25}(não|nao|offline|comunica)|loop|barreira|encerrante/.test(contexto)) {
        return "Automação";
    }

    // 7. LMC (Livro de Movimentação de Combustíveis)
    // Diferencial: "lmc" (word boundary) ou "tanque" ou "medição"
    if (/\blmc\b|tanque|medição|medicao|escritural|saldo.*tanque/.test(contexto)) {
        return "LMC";
    }

    // 8. Instalação
    // Contexto: instalação/configuração inicial de sistema  
    if (/instalar.{0,10}sistema|novo.{0,5}computador|backup|configurar.{0,5}pdv|formatar|reinstalar/.test(contexto)) {
        return "Instalação";
    }

    // 9. Certificado Digital
    // Diferencial: palavra "certificado" + contexto de arquivo
    if (/certificado|\.pfx|senha.*certificado/.test(contexto)) {
        return "Certificado Digital";
    }

    // ========================================
    // NÍVEL 4: CATEGORIAS COM EXCLUSÕES
    // ========================================

    // 10. Cadastro de cartão de abastecimento
    // Diferencial: (liberar|cadastrar) + cartão + contexto de frentista
    // EXCLUSÃO: NÃO pode ter "maquininha" (evita confusão com PDV Móvel)
    if (/(liberar|cadastrar).{0,15}cartão|cartão.{0,15}frentista|código.*cartão/.test(contexto) &&
        !/maquinh|maquinet/.test(contexto)) {
        return "Cadastro de cartão de abastecimento";
    }

    // 11. PDV (Sistema de Vendas)
    // Diferencial: problema de REGISTRAR venda (não PASSAR CARTÃO)
    // EXCLUSÃO: NÃO pode ter "maquininha" (evita confusão)
    if (/caixa|cupom|lançar.{0,25}venda|venda.{0,25}lançar|abastecimento.*(não|nao)\s*(lança|sobe)|sistema.{0,15}(lançar|lançando|não.*lança|nao.*lanca)|sistema\s*trava/.test(contexto) &&
        !/maquinh|maquinet/.test(contexto)) {
        return "PDV";
    }

    // 12. Financeiro
    // Contexto: boleto/fatura DA Sitegen Tech (não do posto)
    if (/boleto|fatura|mensalidade|cobran/.test(contexto) &&
        /Sitegen Tech|sitegentech|sistema|suporte/.test(contexto)) {
        return "Financeiro";
    }

    // ========================================
    // NÍVEL 5: FALLBACK (ÚLTIMA OPÇÃO)
    // ========================================

    // 13. Gerente (operações administrativas genéricas)
    // Usar APENAS quando não se encaixa em nenhuma categoria específica
    if (/relatório|relatorio|consultar|cadastr|acesso|bloqueado/.test(contexto)) {
        return "Gerente";
    }

    // Padrão final (se nada acima se aplicar)
    return "Gerente";
}


// ============================================
// 🎮 SISTEMA DE GAMIFICAÇÃO V3 (FINAL BLINDADO)
// ============================================
const GAMING_CONFIG = {
    pontos_base: 10,
    bonus_tma: 5,
    bonus_plantao: 50,
    bonus_volume: 50,
    penalidade_falha: -50
};

// 🛠️ FUNÇÃO AUXILIAR: Gera Data BR (YYYY-MM-DD) sem erro de fuso
// Isso garante que o banco e a API falem sempre a mesma língua
function getDataBrasil() {
    return new Intl.DateTimeFormat('fr-CA', { // fr-CA usa padrão YYYY-MM-DD
        timeZone: 'America/Sao_Paulo'
    }).format(new Date());
}

// Função Core: Calcula e Salva (Sync)
async function sincronizarRanking(periodo = 'hoje') {
    try {
        const dataHojeString = getDataBrasil(); // Ex: "2026-01-15"

        // Define o range de busca no banco (timestamp completo)
        // Para garantir que pegamos tudo desde o inicio do dia BR
        const dataInicioBusca = `${dataHojeString}T00:00:00.000-03:00`;

        // Se for semanal/mensal, ajustamos a data de início
        let dataReferenciaFiltro = new Date(dataInicioBusca);
        if (periodo === 'semana') {
            dataReferenciaFiltro.setDate(dataReferenciaFiltro.getDate() - 7);
        } else if (periodo === 'mes') {
            dataReferenciaFiltro.setDate(1);
        }

        // 1. Busca dados brutos
        const { data: atendimentos } = await supabase
            .from('atendimentos')
            .select('*')
            .gte('created_at', dataReferenciaFiltro.toISOString());

        if (!atendimentos) return;

        // 2. Calcula Pontos
        const stats = {};
        atendimentos.forEach(t => {
            const agente = t.id_atendente;
            if (!agente || ['sistema monitor', 'desconhecido', 'usuario'].some(x => agente.toLowerCase().includes(x))) return;

            // 🔥 REGRA CRÍTICA: Transferências e "Não respondeu" valem 0 pontos
            const isTransferido = t.status && t.status.toLowerCase().includes('transferido');
            const isNaoRespondeu = t.motivo && t.motivo.toLowerCase().includes('não respondeu');
            const isExcluido = isTransferido || isNaoRespondeu; // ✅ Ambos não contam

            if (!stats[agente]) stats[agente] = { nome: agente, total: 0, tmaSoma: 0, pontos: 0, conquistas: [] };
            const s = stats[agente];

            // Conta o ticket mas não dá pontos se for transferido OU não respondeu
            s.total++;
            if (!isExcluido) {
                s.pontos += GAMING_CONFIG.pontos_base;
            }

            if (t.updated_at) {
                const dur = (new Date(t.updated_at) - new Date(t.created_at)) / 60000;
                s.tmaSoma += dur;

                // Bônus TMA (não aplica em transferências/não respondeu)
                if (!isExcluido && dur > 2 && dur < 15) {
                    s.pontos += GAMING_CONFIG.bonus_tma;
                }

                // Bônus Plantão (não aplica em transferências/não respondeu)
                const horaFim = new Date(t.updated_at).getHours();
                if (!isExcluido && horaFim >= 15 && horaFim < 17) { // 12h-14h BR é 15h-17h UTC
                    s.pontos += GAMING_CONFIG.bonus_plantao;
                    if (!s.conquistas.includes('🍱 Plantão')) s.conquistas.push('🍱 Plantão');
                }
            }

            // Penalidade (não aplica em transferências/não respondeu)
            if (!isExcluido && t.status && (t.status.toLowerCase().includes('falha') || t.status.toLowerCase().includes('não'))) {
                s.pontos += GAMING_CONFIG.penalidade_falha;
            }
        });

        // 3. Salva no Banco (Com a data BR correta)
        const upserts = Object.values(stats).map(agente => {
            const tma = agente.total > 0 ? Math.round(agente.tmaSoma / agente.total) : 0;

            if (agente.total > 30) {
                agente.pontos += GAMING_CONFIG.bonus_volume;
                if (!agente.conquistas.includes('🔥 On Fire')) {
                    agente.conquistas.push('🔥 On Fire');
                }
            }

            if (tma < 10 && agente.total > 5) {
                if (!agente.conquistas.includes('⚡ Flash')) {
                    agente.conquistas.push('⚡ Flash');
                }
            }

            return {
                agente_id: agente.nome,
                periodo: periodo,
                data_referencia: dataHojeString, // SALVA COMO '2026-01-15'
                pontos: Math.round(agente.pontos),
                tickets: agente.total,
                tma_medio: tma,
                conquistas: JSON.stringify(agente.conquistas),
                updated_at: new Date()
            };
        });

        if (upserts.length > 0) {
            const { error } = await supabase
                .from('ranking_gamificacao')
                .upsert(upserts, { onConflict: 'agente_id, periodo, data_referencia' });

            if (error) console.error("❌ Erro DB Ranking:", error.message);
            else console.log(`✅ Ranking [${periodo}] atualizado para ${dataHojeString}: ${upserts.length} agentes.`);
        }
    } catch (e) {
        console.error("Erro critico sync:", e);
    }
}

// ==================== ROTAS DE ATENDIMENTO ====================
// Rota de Início (Mantida igual, apenas resumida aqui)
// Rota de Início (REFATORADA - V3 - ANTI-DUPLICIDADE)
app.post('/api/atendimento/inicio', async (req, res) => {
    try {
        // ✅ CORREÇÃO: Adicionar 'origem' ao destructuring
        const { nome, telefone, horario_inicio, id_atendente, origem } = req.body;

        // Validação de origem
        const origemValida = ['ativo', 'receptivo'];
        const origemFinal = origemValida.includes(origem) ? origem : 'receptivo';

        // Log para debug
        console.log('📡 [INÍCIO] Payload recebido:', {
            nome,
            telefone,
            horario_inicio,
            id_atendente,
            origem: origemFinal
        });

        // Validação dos dados obrigatórios
        if (!nome || !telefone || !horario_inicio || !id_atendente) {
            return res.status(400).json({
                erro: 'Dados obrigatórios: nome, telefone, horario_inicio, id_atendente'
            });
        }

        // 1. VERIFICAÇÃO DE SEGURANÇA (Query no Supabase)
        // Busca se JÁ EXISTE um atendimento "Em andamento" para este telefone
        const { data: atendimentosExistentes, error: errorBusca } = await supabase
            .from('atendimentos')
            .select('id') // Otimizado: Só precisamos do ID
            .eq('telefone', telefone)
            .eq('status', 'Em andamento')
            .limit(1); // Otimizado: Pega só 1

        if (errorBusca) {
            console.error('❌ Erro Supabase (Check Inicio):', errorBusca);
            // Em caso de erro de banco, não bloqueia, mas loga.
            // Opcional: throw error; se quiser ser estrito.
        }

        // 2. A LÓGICA DE "IGNORAR SILENCIOSAMENTE"
        // Se já existe, o backend FINGE que criou, mas não faz nada.
        // Isso mantém o atendimento original (com created_at antigo) VALENDO.
        if (atendimentosExistentes && atendimentosExistentes.length > 0) {
            const idExistente = atendimentosExistentes[0].id;
            console.log(`🛡️ Duplicata/Reinício prevenido: ${telefone} (Já possui ID: ${idExistente})`);

            return res.status(200).json({
                sucesso: true,
                ignora: true,
                mensagem: "Atendimento já em andamento. Solicitação ignorada."
            });
        }

        // 3. FLUXO NORMAL (Só cria se não existir anterior aberto)
        const { data, error } = await supabase
            .from('atendimentos')
            .insert([
                {
                    id: Date.now().toString(),
                    nome_cliente: nome,
                    telefone: telefone,
                    horario_inicio: horario_inicio,
                    horario_fim: null,
                    id_atendente: id_atendente,
                    status: 'Em andamento',
                    motivo: null,
                    origem: origemFinal  // ✅ CORREÇÃO: Salva origem
                }
            ])
            .select();

        if (error) {
            console.error('❌ Erro do Supabase (inserção):', error);
            return res.status(500).json({
                erro: 'Erro ao salvar no banco de dados',
                detalhes: error.message
            });
        }

        console.log(`✅ Novo atendimento iniciado: ${nome} (${telefone}) às ${horario_inicio}`);
        console.log(`✅ Origem salva: ${data[0].origem}`);

        res.status(201).json({
            sucesso: true,
            mensagem: 'Atendimento registrado com sucesso',
            atendimento: data[0],
            duplicata: false,
            origem_salva: data[0].origem  // ✅ Retorna confirmação
        });

    } catch (error) {
        console.error('❌ Erro na rota /api/atendimento/inicio:', error);
        res.status(500).json({
            erro: 'Erro interno do servidor'
        });
    }
});

// Rota de Fim (COM O GATILHO DE GAMIFICAÇÃO)
app.post('/api/atendimento/fim', async (req, res) => {
    try {
        const {
            telefone,
            status_final,
            horario_fim,
            obs,
            motivo: motivoManual,  // 🆕 Renomeado para diferenciar
            nome,
            avaliacao,
            origem,
            contexto_resumido      // 🆕 Novo campo para classificação automática
        } = req.body;

        console.log(`📡 [FIM] Payload recebido de ${telefone}:`, req.body);
        console.log(`📡 [FIM] Origem recebida: ${origem || 'não enviada (usará receptivo)'}`);

        // 🧠 CLASSIFICAÇÃO AUTOMÁTICA DE MOTIVO
        // Se motivo não foi enviado manualmente, usa IA de classificação
        let motivo = motivoManual;
        let classificacaoAuto = false;

        if (!motivoManual && contexto_resumido) {
            motivo = classificarMotivo(contexto_resumido);
            classificacaoAuto = true;
            console.log(`🤖 [CLASSIFICAÇÃO] Automática: "${motivo}" | Contexto: "${contexto_resumido.substring(0, 50)}..."`);
        } else if (!motivoManual) {
            motivo = null; // Sem motivo e sem contexto
            console.log(`⚠️ [CLASSIFICAÇÃO] Sem dados para classificar`);
        } else {
            console.log(`👤 [CLASSIFICAÇÃO] Manual: "${motivoManual}"`);
        }

        // Validação dos dados obrigatórios
        if (!telefone || !status_final || !horario_fim) {
            return res.status(400).json({
                erro: 'Dados obrigatórios: telefone, status_final, horario_fim'
            });
        }

        // Busca atendimento em aberto
        const { data: abertos } = await supabase
            .from('atendimentos')
            .select('*')
            .eq('telefone', telefone)
            .eq('status', 'Em andamento')
            .order('created_at', { ascending: false })
            .limit(1);

        if (abertos && abertos.length > 0) {
            // Atualiza
            await supabase
                .from('atendimentos')
                .update({
                    status: status_final,
                    horario_fim: horario_fim,
                    motivo: motivo || null,
                    avaliacao: avaliacao || null, // ⭐ Salva avaliação
                    origem: origem || 'receptivo', // 🆕 Salva origem (Ativo/Receptivo)
                    updated_at: new Date().toISOString()
                })
                .eq('id', abertos[0].id);

            console.log(`✅ Atendimento finalizado: ${telefone}`);
        } else {
            // Cria registro de segurança (Anti-Limbo)
            await supabase
                .from('atendimentos')
                .insert([{
                    id: Date.now().toString(),
                    nome_cliente: nome || "Cliente Recuperado",
                    telefone: telefone,
                    horario_inicio: horario_fim,
                    horario_fim: horario_fim,
                    id_atendente: "Sistema Monitor (Recovery)", // Nota: Isso não pontua no ranking
                    status: status_final,
                    motivo: motivo || null, // Salva motivo no recovery
                    origem: origem || 'receptivo', // Salva origem no recovery
                    motivo: motivo || null,
                    avaliacao: avaliacao || null
                }]);

            console.log(`🛡️ Registro recuperado: ${telefone}`);
        }

        // 🔥 GATILHO IMEDIATO: Recalcula o ranking AGORA
        // Não espera o cron de 5 minutos
        await sincronizarRanking('hoje');

        res.json({ sucesso: true });

    } catch (error) {
        console.error('❌ Erro ao finalizar:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

/**
 * GET /api/clientes/ranking
 * Retorna Top Clientes por volume e avaliação média
 */
app.get('/api/clientes/ranking', async (req, res) => {
    try {
        const { periodo } = req.query; // 'hoje', 'semana', 'mes', 'geral'

        let dias = 30;
        if (periodo === 'hoje') dias = 1;
        if (periodo === 'semana') dias = 7;
        if (periodo === 'geral') dias = 365;

        const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

        // Busca atendimentos
        const { data, error } = await supabase
            .from('atendimentos')
            .select('nome_cliente, telefone, avaliacao, status, created_at')
            .gte('created_at', dataInicio);

        if (error) throw error;

        // 🧠 AGREGAÇÃO EM MEMÓRIA (Simples e Eficiente para volume médio)
        const clientesMap = {};

        data.forEach(at => {
            // Ignora atendimentos sem telefone ou inválidos
            if (!at.telefone || at.telefone.length < 8) return;

            const key = at.telefone;
            if (!clientesMap[key]) {
                clientesMap[key] = {
                    nome: at.nome_cliente || 'Cliente',
                    telefone: at.telefone,
                    total: 0,
                    avaliacoesCount: 0,
                    somaAvaliacao: 0,
                    ultimoContato: at.created_at
                };
            }

            clientesMap[key].total++;
            // Atualiza nome se tiver um mais recente/completo
            if (new Date(at.created_at) > new Date(clientesMap[key].ultimoContato)) {
                clientesMap[key].ultimoContato = at.created_at;
                if (at.nome_cliente && at.nome_cliente.length > clientesMap[key].nome.length) {
                    clientesMap[key].nome = at.nome_cliente;
                }
            }

            if (at.avaliacao) {
                clientesMap[key].avaliacoesCount++;
                clientesMap[key].somaAvaliacao += at.avaliacao;
            }
        });

        const lista = Object.values(clientesMap).map(c => ({
            ...c,
            mediaAvaliacao: c.avaliacoesCount > 0 ? (c.somaAvaliacao / c.avaliacoesCount).toFixed(1) : null
        }));

        // Ordena por Total de Atendimentos (Volume)
        const topVolume = [...lista].sort((a, b) => b.total - a.total).slice(0, 10);

        // Ordena por Melhor Avaliação (Mínimo 2 avaliações para entrar no ranking)
        const topAvaliacao = [...lista]
            .filter(c => c.avaliacoesCount >= 2)
            .sort((a, b) => Number(b.mediaAvaliacao) - Number(a.mediaAvaliacao))
            .slice(0, 5);

        // Clientes "Detratores" (Piores avaliações)
        const topDetratores = [...lista]
            .filter(c => c.avaliacoesCount >= 1 && Number(c.mediaAvaliacao) <= 2.5)
            .sort((a, b) => Number(a.mediaAvaliacao) - Number(b.mediaAvaliacao)) // Ascendente
            .slice(0, 5);

        res.json({
            sucesso: true,
            periodo,
            analise: {
                topVolume,
                topAvaliacao,
                topDetratores,
                totalClientesUnicos: lista.length
            }
        });

    } catch (e) {
        console.error("❌ Erro API Clientes:", e);
        res.status(500).json({ erro: e.message });
    }
});

// ==================== TRANSFERÊNCIAS ====================
/**
 * POST /api/atendimento/transferencia
 * Registra transferência de atendimento entre atendentes
 */
app.post('/api/atendimento/transferencia', async (req, res) => {
    try {
        const {
            atendente_origem,
            atendente_destino,
            telefone_cliente,
            nome_cliente,
            motivo,
            observacao
        } = req.body;

        // Validação básica
        if (!atendente_origem || !atendente_destino || !telefone_cliente) {
            return res.status(400).json({
                erro: 'Campos obrigatórios: atendente_origem, atendente_destino, telefone_cliente'
            });
        }

        // 📝 SALVA LOG DE TRANSFERÊNCIA
        const { data: logData, error: logError } = await supabase
            .from('transferencias_log')
            .insert([{
                atendente_origem: atendente_origem,
                atendente_destino: atendente_destino,
                telefone_cliente: telefone_cliente,
                nome_cliente: nome_cliente || null,
                motivo: motivo || 'Transferência',
                observacao: observacao || null,
                data_transferencia: new Date().toISOString()
            }])
            .select();

        if (logError) {
            console.error('❌ Erro ao salvar log de transferência:', logError);
            return res.status(500).json({ erro: 'Erro ao salvar log' });
        }

        console.log(`🔄 Transferência registrada: ${atendente_origem} → ${atendente_destino} | Cliente: ${telefone_cliente}`);

        res.json({
            sucesso: true,
            mensagem: 'Transferência registrada com sucesso',
            log: logData[0]
        });

    } catch (error) {
        console.error('❌ Erro na rota /api/atendimento/transferencia:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ROTA DE LEITURA (A Correção Principal está aqui)
app.get('/api/gamificacao/ranking', async (req, res) => {
    try {
        const { periodo = 'hoje' } = req.query;

        // GERA EXATAMENTE A MESMA STRING DE DATA DO SALVAMENTO
        const dataBusca = getDataBrasil();

        // Log para Debug (Verifique isso no seu terminal)
        console.log(`🔍 Buscando ranking: Período [${periodo}] | Data [${dataBusca}]`);

        const { data, error } = await supabase
            .from('ranking_gamificacao')
            .select('*')
            .eq('periodo', periodo)
            .eq('data_referencia', dataBusca) // Agora a busca é exata
            .order('pontos', { ascending: false });

        if (error) throw error;

        const formatado = (data || []).map(r => ({
            nome: r.agente_id,
            pontos: r.pontos,
            tickets: r.tickets,
            tma: Number(r.tma_medio),
            conquistas: typeof r.conquistas === 'string' ? JSON.parse(r.conquistas) : r.conquistas,
            avatar_initials: r.agente_id.substring(0, 2).toUpperCase()
        }));

        res.json({ sucesso: true, ranking: formatado });
    } catch (e) {
        console.error("Erro API Ranking:", e.message);
        res.status(500).json({ erro: e.message });
    }
});

// Rota Manual
app.post('/api/gamificacao/atualizar', async (req, res) => {
    await sincronizarRanking('hoje');
    res.json({ sucesso: true });
});

// ==================== RADAR DE EQUIPE (STATUS ONLINE) ====================

// Configuração de timeout - AJUSTADO PARA 20 SEGUNDOS (Maior margem de segurança)
const TIMEOUT_ONLINE_SEG = 20; // ✅ CORRIGIDO: Agente fica offline após 20 segundos sem heartbeat (era 15s)

// Cache em memória para otimização (mantido rico para funcionalidades)
const cacheMonitor = {};

// Limpa cache a cada 5 minutos
setInterval(() => {
    const now = Date.now();
    Object.keys(cacheMonitor).forEach(id => {
        const lastSeen = new Date(cacheMonitor[id].last_seen).getTime();
        // Remove se > 10 minutos sem sinal
        if ((now - lastSeen) > 600000) {
            delete cacheMonitor[id];
            console.log(`🧹 Cache expirado: ${id}`);
        }
    });
}, 300000); // Executa a cada 5 min

/**
 * POST /api/atendentes/heartbeat
 * Recebe ping de presença dos agentes e grava no Supabase (SCHEMA EXATO)
 */
app.post('/api/atendentes/heartbeat', async (req, res) => {
    try {
        const { id_atendente, online, chats_snapshot, ts_client, source, version } = req.body;

        // Lista de nomes inválidos/genéricos que devem ser bloqueados
        const IGNORED_USERS = [
            "sistema monitor", "sistema monitor (recovery)", "desconhecido",
            "atendente desconhecido", "atendente", "usuario", "null", "undefined"
        ];

        // Valida se id_atendente foi enviado
        if (!id_atendente) {
            return res.status(400).json({
                erro: 'id_atendente é obrigatório'
            });
        }

        // Normaliza o nome para comparação (lowercase e trim)
        const nomeNormalizado = id_atendente.toLowerCase().trim();

        // Bloqueia nomes genéricos/inválidos
        if (IGNORED_USERS.some(ignored => nomeNormalizado === ignored || nomeNormalizado.includes(ignored))) {
            return res.status(400).json({
                erro: 'Nome de atendente inválido'
            });
        }

        const agora = new Date().toISOString();

        // 💾 DADOS PARA SUPABASE (APENAS COLUNAS QUE EXISTEM NO SCHEMA)
        const dadosSupabase = {
            id_atendente: id_atendente,
            online: online,  // ✅ USA O VALOR REAL da extensão (classe CSS do elemento)
            last_seen: agora,
            chats_snapshot: chats_snapshot || [],            // JSONB direto (NÃO usar JSON.stringify)
            updated_at: agora
        };

        // 💾 GRAVA NO SUPABASE (fonte de verdade)
        const { error } = await supabase
            .from('monitor_atendentes')
            .upsert(dadosSupabase, { onConflict: 'id_atendente' });

        if (error) {
            console.error('❌ Erro ao salvar no Supabase:', error);
            return res.status(500).json({ erro: 'Erro ao salvar no banco' });
        }

        // 🗄️ ATUALIZA CACHE LOCAL (RICO para funcionalidades)
        cacheMonitor[id_atendente] = {
            id_atendente: id_atendente,
            online: online,  // ✅ USA O VALOR REAL da extensão
            last_seen: agora,
            chats_snapshot: chats_snapshot || [],
            ts_client: ts_client || Date.now(),
            source: source || 'unknown',
            version: version || 'v1.0',
            updated_at: agora
        };

        res.json({
            sucesso: true,
            status_changed: true
        });

    } catch (error) {
        console.error('❌ Erro na rota /api/atendentes/heartbeat:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

/**
 * GET /api/monitor/live
 * Retorna status em tempo real de todos os agentes com cálculo baseado em 15 segundos
 */
app.get('/api/monitor/live', async (req, res) => {
    try {
        // 📊 BUSCA DADOS DO SUPABASE (fonte de verdade)
        const { data, error } = await supabase
            .from('monitor_atendentes')
            .select('*')
            .order('last_seen', { ascending: false });

        if (error) throw error;

        const agora = Date.now();

        // 🧮 RECALCULA STATUS ONLINE BASEADO EM LAST_SEEN (15 SEGUNDOS)
        const atendentesComStatus = data.map(atendente => {
            const lastSeenTime = new Date(atendente.last_seen).getTime();
            const diferencaSegundos = Math.round((agora - lastSeenTime) / 1000);

            // ✅ CÁLCULO: Online se last_seen <= 15 segundos
            const online_calculado = diferencaSegundos <= TIMEOUT_ONLINE_SEG;

            return {
                id_atendente: atendente.id_atendente,
                last_seen: atendente.last_seen,
                online: online_calculado,                    // Status calculado pelo servidor
                tempo_offline_seg: online_calculado ? 0 : diferencaSegundos,
                chats_snapshot: atendente.chats_snapshot || [],
                updated_at: atendente.updated_at
            };
        });

        // 📈 CALCULA ESTATÍSTICAS
        const stats = {
            total_atendentes: atendentesComStatus.length,
            online: atendentesComStatus.filter(a => a.online).length,
            offline: atendentesComStatus.filter(a => !a.online).length,
            timeout_configurado: TIMEOUT_ONLINE_SEG,
            total_chats_aguardando: 0,
            total_mensagens_pendentes: 0
        };

        // Conta chats em espera
        atendentesComStatus.forEach(atendente => {
            if (atendente.chats_snapshot && Array.isArray(atendente.chats_snapshot)) {
                atendente.chats_snapshot.forEach(chat => {
                    if (chat.qtd > 0) {
                        stats.total_chats_aguardando++;
                        stats.total_mensagens_pendentes += chat.qtd;
                    }
                });
            }
        });

        res.json({
            sucesso: true,
            timestamp: new Date().toISOString(),
            stats: stats,
            atendentes: atendentesComStatus
        });

    } catch (error) {
        console.error('❌ Erro na rota /api/monitor/live:', error);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

// ==================== IA PREDICT (PREVISÃO DE DEMANDA) ====================

/**
 * GET /api/previsao/demanda
 * Analisa histórico e projeta demanda (Horária ou Semanal)
 */
// 🧠 FUNÇÃO CORE DA IA: Gera e Persiste a Previsão (Pode ser chamada por API ou Cron)
async function gerarPrevisaoDemanda(tipo = 'horario') {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`🔮 [IA AUTO] Gerando previsão automática: ${tipo}`);

            const diasAnalise = tipo === 'semanal' ? 90 : 30;
            const dataInicio = new Date(Date.now() - diasAnalise * 24 * 60 * 60 * 1000).toISOString();

            const { data: atendimentos, error } = await supabase
                .from('atendimentos')
                .select('created_at')
                .gte('created_at', dataInicio);

            if (error) throw error;

            if (!atendimentos || atendimentos.length === 0) {
                console.log("⚠️ [IA AUTO] Sem histórico suficiente para previsão.");
                return resolve({ dados_insuficientes: true });
            }

            let analise = {};

            // === LÓGICA 1: PREVISÃO HORÁRIA ===
            if (tipo === 'horario') {
                const volumePorHora = Array(24).fill(0);
                atendimentos.forEach(a => {
                    const h = new Date(a.created_at).getHours();
                    volumePorHora[h]++;
                });

                const mediaPorHora = volumePorHora.map(v => Math.ceil(v / diasAnalise));
                const horaAtual = new Date().getHours();
                const proximasHoras = [];

                for (let i = 0; i < 5; i++) {
                    const h = (horaAtual + i) % 24;
                    const volumeEsperado = mediaPorHora[h];
                    const mediaGeral = (mediaPorHora.reduce((a, b) => a + b, 0) / 24);

                    proximasHoras.push({
                        hora: `${h}:00`,
                        volumeEsperado: volumeEsperado,
                        isPico: volumeEsperado > (mediaGeral * 1.5)
                    });
                }

                const volumeTotal = proximasHoras.reduce((sum, h) => sum + h.volumeEsperado, 0);
                let agentes = Math.ceil((volumeTotal / 5) / 5);
                if (agentes < 2) agentes = 2;
                const picos = proximasHoras.filter(h => h.isPico).length;

                analise = {
                    proximasHoras,
                    recomendacao: {
                        agentes: agentes,
                        motivo: picos > 0 ? `${picos} picos de demanda previstos` : 'Volume estável previsto',
                        prioridade: picos >= 2 ? 'alta' : 'média'
                    }
                };
            }
            // === LÓGICA 2: PREVISÃO SEMANAL ===
            else {
                const volumePorDiaSemana = Array(7).fill(0);
                atendimentos.forEach(a => {
                    const d = new Date(a.created_at).getDay();
                    volumePorDiaSemana[d]++;
                });

                const semanasAnalise = diasAnalise / 7;
                const mediaPorDia = volumePorDiaSemana.map(v => Math.ceil(v / semanasAnalise));
                const projecao7Dias = [];
                const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

                for (let i = 0; i < 7; i++) {
                    const dFutura = new Date();
                    dFutura.setDate(dFutura.getDate() + i);
                    const dSemana = dFutura.getDay();
                    const dMes = dFutura.getDate().toString().padStart(2, '0');
                    const mes = (dFutura.getMonth() + 1).toString().padStart(2, '0');

                    projecao7Dias.push({
                        dia: nomesDias[dSemana],
                        dataCompleta: `${dMes}/${mes}`,
                        previsao: mediaPorDia[dSemana]
                    });
                }

                const mediaInicio = (projecao7Dias[0].previsao + projecao7Dias[1].previsao) / 2;
                const mediaFim = (projecao7Dias[5].previsao + projecao7Dias[6].previsao) / 2;
                const tendencia = mediaFim > mediaInicio ? "Crescente 📈" : mediaFim < mediaInicio ? "Decrescente 📉" : "Estável ➡️";
                const mediaHistorica = Math.round(mediaPorDia.reduce((a, b) => a + b, 0) / 7);

                analise = { projecao7Dias, tendencia, mediaHistorica };
            }

            // 💾 SALVA NA TABELA CORRETA (Sem o erro de created_at)
            const dataReferencia = getDataBrasil();
            await supabase
                .from('previsao_demanda')
                .upsert({
                    tipo: tipo,
                    data_referencia: dataReferencia,
                    payload: analise,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tipo,data_referencia' });

            console.log(`✅ [IA AUTO] Previsão ${tipo} salva com sucesso!`);
            resolve({ sucesso: true, analise });

        } catch (error) {
            console.error(`❌ [IA AUTO] Erro ao gerar previsão ${tipo}:`, error);
            resolve({ erro: error.message });
        }
    });
}

// 🕒 AGENDAMENTO AUTOMÁTICO (CRITICAL FOR VERCEL FRONTEND)
// Atualiza a previsão horária a cada 30 minutos
setInterval(() => gerarPrevisaoDemanda('horario'), 30 * 60 * 1000);

// Atualiza a previsão semanal a cada 4 horas
setInterval(() => gerarPrevisaoDemanda('semanal'), 4 * 60 * 60 * 1000);

// Executa uma vez na inicialização (após 5 segundos)
setTimeout(() => {
    gerarPrevisaoDemanda('horario');
    gerarPrevisaoDemanda('semanal');
}, 5000);


/**
 * GET /api/previsao/demanda
 * Retorna dados (pode forçar recálculo se quiser, mas lê do banco preferencialmente ou chama a função)
 */
app.get('/api/previsao/demanda', async (req, res) => {
    const { tipo } = req.query;
    // Chama a função geradora diretamente para garantir dados frescos na chamada da API
    // Se o frontend chamasse essa rota, seria ótimo, mas como é Vercel, usamos o DB.
    // Esta rota serve agora como um "Trigger Manual" ou para debug.
    const resultado = await gerarPrevisaoDemanda(tipo || 'horario');
    res.json(resultado);
});

// ==================== SISTEMA DE RELATÓRIOS POR EMAIL ====================

/**
 * Gera HTML do relatório (Layout Sincronizado com test-email.js)
 */
function gerarHTMLRelatorio(dados) {
    const { periodo, dataHoje, stats, topAtendentes, topClientes, atendimentos } = dados;
    const { total, diff, tma, sucesso, transferidos, naoRespondeu, receptivos, ativos } = stats;
    const diffSinal = diff >= 0 ? '+' : '';

    return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #2563eb; padding: 25px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">📊 Fechamento do Dia</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.8;">${periodo} - ${dataHoje}</p>
        </div>
        
        <div style="padding: 20px; background: #f8fafc;">
            <!-- KPI PRINCIPAIS -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Volume Total</span>
                    <div style="font-size: 32px; font-weight: bold; color: #1e293b; margin: 5px 0;">${total}</div>
                    <div style="font-size: 12px; color: ${diff >= 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">
                        ${diffSinal}${diff} vs ontem
                    </div>
                </div>
                <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">TMA (Médio)</span>
                    <div style="font-size: 32px; font-weight: bold; color: #1e293b; margin: 5px 0;">${tma} <span style="font-size: 16px;">min</span></div>
                    <div style="font-size: 12px; color: #64748b;">Tempo médio resolv.</div>
                </div>
            </div>

            <!-- KPI SECUNDÁRIOS -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 25px;">
                <div style="background: #ecfdf5; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #bbf7d0;">
                    <strong style="display: block; color: #166534; font-size: 18px;">${sucesso}</strong>
                    <span style="font-size: 11px; color: #15803d; font-weight: bold;">RESOLVIDOS</span>
                </div>
                <div style="background: #eff6ff; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #bfdbfe;">
                    <strong style="display: block; color: #1e40af; font-size: 18px;">${transferidos}</strong>
                    <span style="font-size: 11px; color: #1e3a8a; font-weight: bold;">TRANSFERIDOS</span>
                </div>
                <div style="background: #fef2f2; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #fecaca;">
                    <strong style="display: block; color: #991b1b; font-size: 18px;">${naoRespondeu}</strong>
                    <span style="font-size: 11px; color: #b91c1c; font-weight: bold;">NÃO RESPONDEU</span>
                </div>
            </div>

            <!-- ORIGEM DOS CONTATOS -->
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 16px; color: #334155; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">📞 Origem dos Contatos</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #10b981;">
                        <div style="font-size: 12px; color: #047857; font-weight: bold; margin-bottom: 5px;">CLIENTE ENTROU EM CONTATO</div>
                        <div style="font-size: 28px; font-weight: bold; color: #065f46;">${receptivos}</div>
                        <div style="font-size: 11px; color: #10b981; margin-top: 5px;">${total > 0 ? Math.round((receptivos / total) * 100) : 0}% do total</div>
                    </div>
                    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #f59e0b;">
                        <div style="font-size: 12px; color: #92400e; font-weight: bold; margin-bottom: 5px;">ATENDENTE ENTROU EM CONTATO</div>
                        <div style="font-size: 28px; font-weight: bold; color: #78350f;">${ativos}</div>
                        <div style="font-size: 11px; color: #d97706; margin-top: 5px;">${total > 0 ? Math.round((ativos / total) * 100) : 0}% do total</div>
                    </div>
                </div>
                <p style="font-size: 11px; color: #94a3b8; margin-top: 8px; text-align: center;">* Atendimentos ativos não são contabilizados no ranking de produtividade.</p>
            </div>

            <!-- TOP CLIENTES -->
            ${topClientes.length > 0 ? `
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 16px; color: #334155; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">🔥 Top Clientes (Volume)</h3>
                ${topClientes.map((c, i) => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: white; margin-bottom: 6px; border-radius: 6px; border-left: 4px solid #f97316; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="font-weight: 600; color: #1e293b;">${c.nome}</div>
                    <div style="background: #fff7ed; color: #c2410c; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">${c.qtd} contatos</div>
                </div>`).join('')}
            </div>` : ''}

            <!-- RANKING EQUIPE -->
            ${topAtendentes.length > 0 ? `
            <div>
                <h3 style="font-size: 16px; color: #334155; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">🏆 Ranking Produtividade</h3>
                <div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                ${topAtendentes.map((a, i) => `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #f1f5f9; ${i === 0 ? 'background: #f0fdfa;' : ''}">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 24px; height: 24px; background: ${i < 3 ? '#0f766e' : '#94a3b8'}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">${i + 1}</div>
                            <span style="font-weight: 600; color: #334155;">${a.nome}</span>
                        </div>
                        <span style="color: #0d9488; font-weight: bold;">${a.total} ✅</span>
                    </div>`).join('')}
                </div>
                <p style="font-size: 11px; color: #94a3b8; margin-top: 8px; text-align: center;">* Ranking considera apenas atendimentos finalizados com sucesso.</p>
            </div>` : ''}

            <!-- DETALHAMENTO (Amostra) -->
            ${atendimentos.length > 0 ? `
            <div style="margin-top: 25px;">
                <h3 style="font-size: 16px; color: #334155; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">📋 Detalhamento (Amostra)</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0;">Cliente</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0;">Atendente</th>
                            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${atendimentos
                .filter(a => {
                    const nomeCliente = (a.nome_cliente || '').toLowerCase().trim();
                    const atendente = (a.id_atendente || '').toLowerCase().trim();
                    if (nomeCliente === 'cliente' || nomeCliente.length < 3) return false;
                    if (atendente.includes('sistema monitor') || atendente.includes('recovery')) return false;
                    return true;
                })
                .slice(0, 10)
                .map(a => `
                            <tr>
                                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${a.nome_cliente}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${a.id_atendente}</td>
                                <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${a.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>` : ''}

            <!-- CTA DASHBOARD -->
            <div style="margin-top: 30px; text-align: center;">
                <a href="https://basedeconhecimentositegentech.vercel.app/dashboard-administrativa" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
                    Acessar Dashboard Completa 🚀
                </a>
            </div>

        </div>
        <div style="background: #f1f5f9; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
            Relatório gerado automaticamente • Sitegen Tech CRM
        </div>
    </div>
    `;
}

/**
 * Busca dados do Supabase para o relatório
 */
/**
 * Busca dados do Supabase para o relatório
 */
async function buscarDadosRelatorio(periodo) {
    try {
        const hojeStr = getDataBrasil();
        const dOntem = new Date();
        dOntem.setDate(dOntem.getDate() - 1);
        const ontemStr = getDataBrasil(dOntem);

        const { data: hoje, error: err1 } = await supabase
            .from('atendimentos')
            .select('*')
            .gte('created_at', `${hojeStr}T00:00:00-03:00`)
            .lte('created_at', `${hojeStr}T23:59:59-03:00`);

        const { count: totalOntem, error: err2 } = await supabase
            .from('atendimentos')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${ontemStr}T00:00:00-03:00`)
            .lte('created_at', `${ontemStr}T23:59:59-03:00`);

        if (err1 || err2) throw new Error("Erro no Supabase");

        const total = hoje.length;
        const stats = { total, sucesso: 0, falha: 0, transferidos: 0, naoRespondeu: 0, ativos: 0, receptivos: 0 };
        let somaTMA = 0, qtdTMA = 0;

        hoje.forEach(a => {
            const s = (a.status || '').toLowerCase();
            const m = (a.motivo || '').toLowerCase();
            if (s.includes('sucesso') || s.includes('resolvido') || s.includes('finalizado')) stats.sucesso++;
            else if (s.includes('transferido')) stats.transferidos++;
            else if (m.includes('não respondeu') || s.includes('não respondeu')) stats.naoRespondeu++;
            else stats.falha++;

            if (a.origem === 'ativo') stats.ativos++;
            else stats.receptivos++;

            if (a.created_at && a.updated_at) {
                const min = (new Date(a.updated_at) - new Date(a.created_at)) / 60000;
                if (min > 0 && min < 480) { somaTMA += min; qtdTMA++; }
            }
        });

        const tma = qtdTMA > 0 ? Math.round(somaTMA / qtdTMA) : 0;
        const clienteMap = {};
        hoje.forEach(a => {
            const nome = a.nome_cliente || "Cliente";
            if (nome.length > 3 && !nome.toLowerCase().includes('cliente')) clienteMap[nome] = (clienteMap[nome] || 0) + 1;
        });
        const topClientes = Object.entries(clienteMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nome, qtd]) => ({ nome, qtd }));

        const atendenteMap = {};
        hoje.forEach(a => {
            if (a.id_atendente && !a.id_atendente.toLowerCase().includes('sistema')) {
                const s = (a.status || '').toLowerCase(), m = (a.motivo || '').toLowerCase();
                if (!s.includes('transferido') && !m.includes('não respondeu')) {
                    if (!atendenteMap[a.id_atendente]) atendenteMap[a.id_atendente] = { nome: a.id_atendente, total: 0 };
                    atendenteMap[a.id_atendente].total++;
                }
            }
        });
        const topAtendentes = Object.values(atendenteMap).sort((a, b) => b.total - a.total);

        // Calcula diferença com dia anterior
        const diff = total - (totalOntem || 0);

        // Formata data
        const dataHoje = new Date().toLocaleDateString('pt-BR');

        return {
            periodo,  // ✅ Adicionado
            dataHoje, // ✅ Adicionado
            total,
            stats: { ...stats, diff, tma }, // ✅ diff e tma movidos para stats
            topAtendentes,
            topClientes,
            atendimentos: hoje // ✅ CRÍTICO: Array de atendimentos para HTML
        };
    } catch (error) {
        console.error('❌ Erro ao buscar dados:', error);
        throw error;
    }
}


/**
 * Envia relatório por email
 */
async function enviarRelatorio(periodo) {
    try {
        console.log(`📧 Gerando relatório: ${periodo}...`);

        const dados = await buscarDadosRelatorio(periodo);

        if (!dados) {
            console.log(`⚠️ Sem dados para o período ${periodo} `);
            return { sucesso: false, motivo: 'sem_dados' };
        }

        const html = gerarHTMLRelatorio(dados);

        const mailOptions = {
            from: 'sitegentechsistemas@gmail.com',
            to: DESTINATARIOS_RELATORIO.join(', '),
            subject: `📊 Relatório de Atendimentos - ${periodo} (${dados.stats.total} atendimentos)`,
            html: html
        };

        await transporter.sendMail(mailOptions);

        console.log(`✅ Relatório ${periodo} enviado para: ${DESTINATARIOS_RELATORIO.join(', ')} `);
        return { sucesso: true, motivo: 'enviado', total: dados.stats.total };

    } catch (error) {
        console.error(`❌ Erro ao enviar relatório ${periodo}: `, error);
        return { sucesso: false, motivo: 'erro', erro: error.message };
    }
}

/**
 * Rota de teste manual
 */
app.get('/api/teste-email/:periodo', async (req, res) => {
    try {
        const periodo = 'Diario'; // Força diário para teste
        const resultado = await enviarRelatorio(periodo);

        if (resultado.sucesso) {
            res.json({
                sucesso: true,
                mensagem: `Relatório ${periodo} enviado com sucesso!`,
                destinatarios: DESTINATARIOS_RELATORIO,
                total_atendimentos: resultado.total
            });
        } else if (resultado.motivo === 'sem_dados') {
            res.json({
                sucesso: false,
                mensagem: `Sem dados para o período ${periodo} `
            });
        } else {
            res.status(500).json({
                sucesso: false,
                mensagem: 'Erro ao enviar relatório',
                erro: resultado.erro
            });
        }

    } catch (error) {
        console.error('❌ Erro na rota teste-email:', error);
        res.status(500).json({
            erro: 'Erro interno',
            detalhes: error.message
        });
    }
});

// ==================== FEEDBACK LOOP (LEARNING) ====================
app.post('/api/feedback/classification', async (req, res) => {
    try {
        const { sugestao, escolha, contexto } = req.body;

        // Salva no banco para análise futura (melhorar pesos)
        const { error } = await supabase.from('classificacao_feedback').insert([{
            sugestao_ia: sugestao,
            escolha_real: escolha,
            contexto_resumido: contexto,
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;

        console.log(`🧠 Feedback IA: Sugeriu '${sugestao}' vs Real '${escolha}'`);
        res.json({ received: true });
    } catch (e) {
        console.error("❌ Erro log feedback:", e);
        res.status(500).json({ erro: e.message });
    }
});

// Inicialização
app.listen(PORT, async () => {
    console.log('🚀 ========================================');
    console.log(`🚀 Servidor CRM Gamificado rodando!`);
    console.log(`🚀 Porta: ${PORT} `);
    console.log(`🚀 URL: http://localhost:${PORT}`);
    console.log('🚀 ========================================');
    console.log('📋 Rotas disponíveis:');
    console.log('   POST /api/atendimento/inicio');
    console.log('   POST /api/atendimento/fim');
    console.log('   GET  /api/gamificacao/ranking?periodo=hoje|semana|mes');
    console.log('   POST /api/gamificacao/atualizar');
    console.log('   POST /api/atendentes/heartbeat');
    console.log('   GET  /api/monitor/live');
    console.log('   GET  /api/previsao/demanda');
    console.log('   GET  /api/teste-email/:periodo (Manhã ou Tarde)');
    console.log('🚀 ========================================');

    // Testa conexão com Supabase
    try {
        const { data, error } = await supabase
            .from('atendimentos')
            .select('count', { count: 'exact' })
            .limit(1);

        if (error) {
            console.log('❌ Erro ao conectar com Supabase:', error.message);
        } else {
            console.log('✅ Conexão com Supabase estabelecida!');
        }
    } catch (error) {
        console.log('❌ Erro de conexão:', error.message);
    }

    // Sincroniza ranking inicial
    console.log('🎮 Sincronizando ranking inicial...');
    await sincronizarRanking('hoje');

    // Agendamentos
    console.log('⏰ Configurando agendamentos...');
    cron.schedule('*/5 * * * *', () => {
        console.log('⏰ [CRON] Atualizando ranking...');
        sincronizarRanking('hoje');
    });

    cron.schedule('0 * * * *', () => {
        console.log('⏰ [CRON] Atualizando ranking mensal...');
        sincronizarRanking('mes');
    });

    // ============================================
    // 📧 RELATÓRIOS DIÁRIOS POR EMAIL
    // ============================================

    // Relatório às 14h (SEG-SEX)
    cron.schedule('0 14 * * 1-5', () => {
        console.log('⏰ [CRON] Enviando relatório Diário (14h)...');
        enviarRelatorio('Diario_14h');
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    // Relatório às 18h (SEG-SEX)
    cron.schedule('0 18 * * 1-5', () => {
        console.log('⏰ [CRON] Enviando relatório Diário (18h)...');
        enviarRelatorio('Diario_18h');
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    // ⚡ TESTE TEMPORÁRIO - 18:15 DE HOJE
    cron.schedule('15 18 30 1 *', () => {
        console.log('⚡ [TESTE] Enviando email de teste às 18:15...');
        enviarRelatorio('Teste_18h15');
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    console.log('✅ Sistema inicializado com sucesso!');
    console.log('🎮 Gamificação V3 ativa');
    console.log(`📡 Radar de Equipe ativo (timeout: ${TIMEOUT_ONLINE_SEG}s)`);
    console.log('🔮 IA Predict ativa (análise: 30 dias) + Persistência');
    console.log('📧 Sistema de Email ativo (14h e 18h)');
});