// ========================================
// CRM ATENDIMENTOS MONITOR - VERSÃO CONFIGURÁVEL (V5)
// ========================================

(function () {
    'use strict';

    // ✅ OTIMIZAÇÃO 1: Flag de debug (false em produção para reduzir CPU -50%)
    const DEBUG_MODE = false;

    // ✅ Funções de log condicionais
    const debugLog = DEBUG_MODE ? console.log.bind(console) : () => { };
    const debugWarn = DEBUG_MODE ? console.warn.bind(console) : () => { };
    const debugError = console.error.bind(console); // Erros sempre aparecem

    // ✅ URL DA API (Forçado HTTP para rede local - servidor sem certificado)
    // ✅ URL DA API (Placeholder para produção)
    const API_URL = "http://sua-api-url.com/api";

    // ==================== ⚙️ GERENCIADOR DE CONFIGURAÇÃO (NOVO) ====================
    const ConfigManager = {
        STORAGE_KEY: 'crm_monitor_config_v1',
        defaults: {
            autoClassify: true,    // 🤖 Classificação Automática e Envio
            smartReply: true,      // 💡 Sugestões Inteligentes
            interceptClosing: true,// 🔒 Bloquear Fechamento para Classificar
            typingMonitor: true,   // ⌨️ Monitorar Digitação (Gatilhos)
            performanceMode: true  // ⚡ Modo Performance (Debounce) - Sempre True
        },
        get: function () {
            try {
                const stored = localStorage.getItem(this.STORAGE_KEY);
                return stored ? { ...this.defaults, ...JSON.parse(stored) } : this.defaults;
            } catch (e) { return this.defaults; }
        },
        set: function (newConfig) {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newConfig));
                console.log("⚙️ Configurações salvas:", newConfig);
            } catch (e) { console.error("Erro ao salvar config", e); }
        },
        toggle: function (key) {
            const config = this.get();
            config[key] = !config[key];
            this.set(config);
            return config[key];
        }
    };

    // Carrega configurações iniciais
    const USER_CONFIG = ConfigManager.get();

    // ==================== RECUPERAÇÃO DE ESTADO ====================
    let storedCards = [];
    try {
        storedCards = JSON.parse(sessionStorage.getItem('cartoesProcessados') || '[]');
    } catch (e) {
        console.error("Erro ao ler sessionStorage", e);
    }
    const cartoesProcessados = new Set(storedCards);
    let isTransferring = false;
    let destinoTransferencia = null;

    // ==================== FLAG ANTI-LOOP ====================
    let ignoreNextClick = false;

    // ==================== LISTA DE MOTIVOS ====================
    const MOTIVOS_PADRAO = [
        "Financeiro", "Liberar Sped", "Automação", "Gerente", "Gerente Web",
        "Impressoras", "Instalação", "Integração", "PDV", "PDV Móvel / Maquininha",
        "Liberação Maquininha", "PINPAD", "Certificado Digital", "Entrada de nota",
        "Cadastro de cartão de abastecimento", "LMC", "Não respondeu"
    ];

    // ==================== ENGINE DE CLASSIFICAÇÃO V4 ====================
    const CLASSIFICATION_RULES = {
        "Liberar Sped": {
            keywords: ["sped", "fiscal", "bloco", "inventario", "sintegra", "contabilidade", "gerar", "arquivo"],
            combos: ["liberar sped", "gerar sped", "notas lancadas", "notas ok", "solicitar sped", "enviar sped"],
            excludeWords: ["entrada", "importar xml", "cfop", "cst"],
            temporalBonus: () => {
                const dia = new Date().getDate();
                return (dia >= 1 && dia <= 15) ? 60 : 0;
            },
            weight: 25, priority: 100
        },
        "Entrada de nota": {
            keywords: ["cfop", "entrada", "cst", "aliquota", "icms", "dar entrada", "importar", "lancamento"],
            combos: ["dar entrada na nota", "entrada de nota", "importar xml", "erro na nota", "lancamento de nota"],
            requiredAny: ["entrada", "importar", "cfop"],
            excludeWords: ["sped", "fiscal", "bloco"],
            weight: 30, priority: 90
        },
        "Certificado Digital": {
            keywords: ["certificado", "digital", "token", "assinatura", "vencido", "renovar", "expirou", "senha certificado", "a3", "a1"],
            combos: ["certificado digital", "senha do certificado", "token bloqueado", "instalacao do certificado"],
            weight: 25, priority: 85
        },
        "Cadastro de cartão de abastecimento": {
            keywords: ["frentista", "numeracao", "codigo cartao", "frota", "motorista", "placa"],
            combos: ["carga de tabela", "liberar o cartao", "cadastrado no gerente", "numeracao do cartao"],
            contextPositive: (text) => (text.includes("cartao") || text.includes("cartão")) && (text.includes("frentista") || text.includes("frota") || text.includes("placa")),
            excludeWords: ["credito", "debito", "transacao", "pinpad", "tef"],
            weight: 30, priority: 80
        },
        "LMC": {
            keywords: ["lmc", "diferenca", "combustivel", "volume", "escritural", "tanque", "bomba", "litragem", "sobra", "falta", "ajuste saldo"],
            combos: ["livro de movimentacao", "fechamento de lmc", "abertura de lmc", "diferenca no lmc"],
            weight: 28, priority: 95
        },
        "PINPAD": {
            keywords: ["pinpad", "tef", "stone", "cielo", "pagseguro", "rede", "bin", "getnet", "transacao", "debito", "credito"],
            combos: ["erro no pinpad", "nao comunica", "transacao negada", "atualizar tabelas", "erro tef"],
            contextPositive: (text) => (text.includes("cartao") || text.includes("cartão")) && (text.includes("tef") || text.includes("stone") || text.includes("cielo")),
            weight: 25, priority: 88
        },
        "PDV Móvel / Maquininha": {
            keywords: ["maquininha", "pos", "mobile", "android", "app", "aplicativo", "movel"],
            combos: ["nao passa", "erro leitura", "parear", "integrar maquininha", "app da acs"],
            excludeWords: ["computador", "caixa principal", "pdv principal"],
            weight: 20, priority: 75
        },
        "PDV": {
            keywords: ["pdv", "caixa", "frente", "venda", "cupom", "sangria", "fechamento", "diferenca", "nfce", "pista", "sistema", "tela"],
            combos: ["abrir caixa", "fechar caixa", "tela de vendas", "cancelar cupom", "lancar venda", "encerrar caixa"],
            contextPositive: (text) => text.includes("computador") || text.includes("caixa") || text.includes("sistema da pista"),
            weight: 18, priority: 70
        },
        "Automação": {
            keywords: ["wifi", "internet", "rede", "lento", "cabo", "sinal", "concentrador", "ip", "roteador", "energia", "queimou", "offline"],
            combos: ["nao conecta", "caiu a rede", "sem internet", "desligar e ligar", "reiniciar concentrador"],
            weight: 22, priority: 92
        },
        "Impressoras": {
            keywords: ["impressora", "imprimir", "papel", "toner", "termica", "elgin", "bematech", "epson"],
            combos: ["nao imprime", "travou impressao", "fila de impressao", "cortar papel"],
            weight: 20, priority: 65
        },
        "Instalação": {
            keywords: ["instalar", "formatar", "configurar", "baixar", "computador novo", "formatado", "troca"],
            combos: ["instalar sistema", "formatou pc", "trocou pc", "acesso remoto", "preciso de instalacao"],
            weight: 22, priority: 78
        },
        "Gerente": {
            keywords: ["relatorio", "usuario", "senha gerente", "acesso", "permissao", "cadastro", "produto", "estoque", "cliente", "funcionario"],
            combos: ["resetar senha", "criar usuario", "liberar acesso", "cadastro de produto"],
            onlyIfNoMatch: true,
            weight: 12, priority: 30
        },
        "Gerente Web": {
            keywords: ["gerente web", "online", "navegador", "browser", "internet gerente"],
            combos: ["acessar gerente web", "gerente pela internet"],
            weight: 18, priority: 60
        },
        "Financeiro": {
            keywords: ["boleto sistema", "fatura sitegentech", "mensalidade", "pagamento sistema"],
            combos: ["pagar sistema", "segunda via boleto", "enviar boleto", "fatura atrasada"],
            contextPositive: (text) => text.includes("boleto") && (text.includes("sistema") || text.includes("mensalidade") || text.includes("sitegentech")),
            weight: 20, priority: 68
        },
        "Integração": {
            keywords: ["integracao", "pix cnpj", "conciliador", "api", "webhook"],
            combos: ["integracao pix", "liberar conciliador", "configurar integracao"],
            weight: 18, priority: 72
        },
        "Não respondeu": {
            keywords: ["vacuo", "nao responde", "encerrando por falta"],
            combos: ["encerrando por falta de interacao", "sem retorno"],
            weight: 5, priority: 10
        }
    };

    class ContextAnalyzer {
        constructor() { this.rules = CLASSIFICATION_RULES; }
        normalize(text) { return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
        analyze(messages) {
            const scores = {};
            Object.keys(this.rules).forEach(cat => scores[cat] = 0);

            const clientMessages = messages.filter(m => m.sender === 'client');
            const attendantMessages = messages.filter(m => m.sender === 'attendant');

            if (clientMessages.length === 0) {
                scores["Não respondeu"] += 1000;
                return { suggestion: "Não respondeu", confidence: 1000, reason: "Vácuo", showModal: false };
            }

            if (clientMessages.length <= 1) {
                attendantMessages.forEach(msg => {
                    const txt = this.normalize(msg.text);
                    if (txt.includes("falta de interacao") || txt.includes("encerrando")) scores["Não respondeu"] += 80;
                });
            }

            messages.forEach((msg, index) => {
                const text = this.normalize(msg.text);
                const isAttendant = msg.sender === 'attendant';
                let messageWeight = isAttendant ? 2.0 : 1.0;
                if (index < 3 || index >= messages.length - 3) messageWeight *= 1.5;

                Object.entries(this.rules).forEach(([category, rule]) => {
                    if (rule.combos) rule.combos.forEach(c => { if (text.includes(this.normalize(c))) scores[category] += 50 * messageWeight; });
                    if (rule.keywords) rule.keywords.forEach(k => { if (text.includes(this.normalize(k))) scores[category] += rule.weight * messageWeight; });
                    if (rule.excludeWords) rule.excludeWords.forEach(w => { if (text.includes(this.normalize(w))) scores[category] -= 30; });
                    if (rule.contextPositive && rule.contextPositive(text)) scores[category] += 40;
                    if (rule.requiredAny && !rule.requiredAny.some(w => text.includes(this.normalize(w)))) scores[category] -= 20;
                });
            });

            Object.entries(this.rules).forEach(([category, rule]) => {
                if (rule.temporalBonus && rule.temporalBonus() > 0) scores[category] += rule.temporalBonus();
            });

            const maxScore = Math.max(...Object.values(scores));
            Object.entries(this.rules).forEach(([category, rule]) => {
                if (rule.onlyIfNoMatch && maxScore > 40) scores[category] = 0;
            });

            const sorted = Object.entries(scores).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
            const winner = sorted[0];

            return {
                suggestion: winner ? winner[0] : null,
                confidence: winner ? winner[1] : 0,
                allScores: sorted.slice(0, 3),
                showModal: false // Automático por padrão agora
            };
        }
    }
    const contextEngine = new ContextAnalyzer();

    // ==================== FUNÇÕES AUXILIARES ====================
    function isVisible(el) { return el && (el.offsetWidth > 0 || el.offsetHeight > 0); }

    function extrairHistoricoConversa() {
        try {
            const messages = [];
            const msgElements = document.querySelectorAll('.message_container');
            const ultimas = Array.from(msgElements).slice(-15);
            const MENSAGENS_SISTEMA = ['selecione uma tabulação', 'finalizado', 'transferido', 'em andamento', 'aguardando', 'iniciado'];

            ultimas.forEach(el => {
                const senderNameElement = el.querySelector('.message_sender');
                const bodyElement = el.querySelector('.message_body');
                if (senderNameElement && bodyElement) {
                    let sender = 'unknown';
                    const nameText = senderNameElement.innerText.toLowerCase();
                    const bodyText = bodyElement.innerText.toLowerCase().trim();

                    if (MENSAGENS_SISTEMA.some(msg => bodyText.includes(msg))) return;
                    if (bodyText.length < 3) return;

                    if (nameText.includes('bot')) sender = 'bot';
                    else if (nameText.includes('Sitegen Tech')) sender = 'attendant';
                    else sender = 'client';

                    if (sender !== 'bot') messages.push({ sender, text: bodyElement.innerText });
                }
            });
            return messages;
        } catch (e) { return []; }
    }

    async function enviarFeedbackAprendizado(sugestaoIA, escolhaHumana, historico) {
        try {
            fetch(`${API_URL}/feedback/classification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sugestao: sugestaoIA, escolha: escolhaHumana,
                    contexto: historico.map(m => m.text).join(" | ").substring(0, 1000)
                })
            }).catch(() => { });
        } catch (e) { }
    }

    function obterNomeAtendente() {
        try {
            const seletores = ['.m-topbar__welcome', '.user-name', '.agent-name', '[data-user-name]', '.profile-name'];
            for (const seletor of seletores) {
                const el = document.querySelector(seletor);
                if (el) {
                    let nome = el.hasAttribute('data-user-name') ? el.getAttribute('data-user-name') : el.textContent;
                    nome = nome.replace(/^olá,?\s*/i, '').replace(/&nbsp;/g, ' ').trim();
                    if (nome && nome.length > 2 && !["Atendente", "Usuário"].includes(nome)) {
                        try { localStorage.setItem('crm_monitor_atendente_nome', nome); } catch (e) { }
                        return nome;
                    }
                }
            }
            return localStorage.getItem('crm_monitor_atendente_nome');
        } catch (e) { return null; }
    }

    // ==================== AÇÕES API ====================
    async function enviarInicio(dados) {
        try {
            let origem = 'receptivo';
            const origemActive = localStorage.getItem('crm_origem_active');
            const origemTimestamp = localStorage.getItem('crm_origem_timestamp');

            if (origemActive === 'true' && origemTimestamp && (Date.now() - parseInt(origemTimestamp) < 30000)) {
                origem = 'ativo';
                localStorage.removeItem('crm_origem_timestamp');
                localStorage.removeItem('crm_origem_active');
            }

            const payload = {
                nome: dados.nome, telefone: dados.telefone, horario_inicio: dados.horario,
                id_atendente: obterNomeAtendente(), origem: origem
            };

            fetch(`${API_URL}/atendimento/inicio`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            }).catch(console.error);
        } catch (e) { console.error('Falha enviarInicio', e); }
    }

    async function enviarFim(dados, motivo = null, observacao = null, avaliacao = null) {
        try {
            const payload = {
                telefone: dados.telefone, status_final: dados.status, horario_fim: dados.horario_fim,
                motivo: motivo, nome: dados.nome, origem: dados.origem || 'receptivo'
            };
            if (observacao) payload.obs = observacao;
            if (avaliacao) payload.avaliacao = avaliacao;

            await fetch(`${API_URL}/atendimento/fim`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload), keepalive: true
            });

            if (cartoesProcessados.has(dados.telefone)) {
                cartoesProcessados.delete(dados.telefone);
                sessionStorage.setItem('cartoesProcessados', JSON.stringify([...cartoesProcessados]));
            }
        } catch (e) { console.error('Falha enviarFim', e); }
    }

    function extrairDadosCartao(cartao) {
        try {
            const nome = cartao.querySelector('.contact_name')?.textContent.trim();
            const telefone = cartao.querySelector('.channel .value')?.textContent.trim();
            const horario = cartao.querySelector('.datetime')?.textContent.trim();
            if (!nome || !telefone) return null;
            return { nome, telefone, horario };
        } catch (e) { return null; }
    }

    function obterNomeClienteAtivo() {
        const elAtivo = document.getElementById('name_contact');
        if (elAtivo && isVisible(elAtivo)) return elAtivo.textContent.trim();
        const el = document.querySelector('.contact_name');
        return (el && isVisible(el) && !el.closest('.item_data')) ? el.textContent.trim() : "Cliente";
    }

    function obterTelefoneClienteAtivo() {
        const titleEl = document.querySelector('div.value[title^="+"]');
        if (titleEl && isVisible(titleEl) && !titleEl.closest('.item_data')) return titleEl.getAttribute('title');
        const valueEls = document.querySelectorAll('.value');
        for (const el of valueEls) {
            if (!el.closest('.item_data') && isVisible(el)) {
                const txt = el.textContent.trim();
                if (txt.length > 8 && (txt.includes('+') || /^\d+$/.test(txt))) return txt;
            }
        }
        return null;
    }

    function obterStatusSelecionado() {
        const el = document.querySelector('.select2-selection__rendered');
        return el ? el.title.trim() : "Finalizado";
    }

    // ==================== INTERCEPTAÇÃO E LÓGICA DE NEGÓCIO ====================

    function configurarDeteccaoEncerramento() {
        document.addEventListener('click', function (event) {
            if (ignoreNextClick) {
                ignoreNextClick = false;
                return;
            }

            const btn = event.target.closest('.btn_submit');
            // ✅ CONFIG CHECK: Se interceptClosing for falso, não faz nada
            if (btn && btn.textContent.toLowerCase().includes('fechar atendimento') && USER_CONFIG.interceptClosing) {
                event.preventDefault();
                event.stopPropagation();

                const tel = obterTelefoneClienteAtivo();
                const nome = obterNomeClienteAtivo();

                if (!tel) {
                    ignoreNextClick = true;
                    btn.click();
                    return;
                }

                // ✅ CONFIG CHECK: Classificação Automática
                let motivoFinal = "Não informado";
                if (USER_CONFIG.autoClassify) {
                    const historico = extrairHistoricoConversa();
                    const analise = contextEngine.analyze(historico);
                    motivoFinal = analise.suggestion || "Não informado";
                    console.log("🤖 Motivo Auto:", motivoFinal);
                    enviarFeedbackAprendizado(motivoFinal, motivoFinal, historico);
                } else {
                    console.log("⚠️ Auto Classificação Desativada (Config)");
                }

                enviarFim({
                    telefone: tel, nome: nome, status: obterStatusSelecionado(),
                    horario_fim: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    origem: localStorage.getItem('crm_origem_active') === 'true' ? 'ativo' : 'receptivo'
                }, motivoFinal);

                ignoreNextClick = true;
                btn.click();
            }
        }, true);

        // DETECÇÃO DE INÍCIO (CLIQUE NOVO ATENDIMENTO)
        document.addEventListener('click', function (e) {
            const btnPrimary = e.target.closest('.rcx-btn_primary');
            if (btnPrimary && btnPrimary.title === "Iniciar novo atendimento") {
                sessionStorage.setItem('crm_active_intent_ts', Date.now().toString());
            }
            const btnIcon = e.target.closest('.fa-comments');
            if (btnIcon && btnIcon.title === "Clique para iniciar um novo atendimento") {
                sessionStorage.setItem('crm_active_intent_ts', Date.now().toString());
            }
        }, true);

        // DETECÇÃO CONFIRMAÇÃO (SWEETALERT)
        document.addEventListener('click', function (e) {
            const btnSim = e.target.closest('.swal2-confirm');
            if (btnSim && (btnSim.textContent.trim() === 'Sim' || btnSim.innerText.includes('Sim'))) {
                const intentTs = sessionStorage.getItem('crm_active_intent_ts');
                if (intentTs && (Date.now() - parseInt(intentTs) < 15000)) {
                    localStorage.setItem('crm_origem_active', 'true');
                    localStorage.setItem('crm_origem_timestamp', Date.now().toString());
                    sessionStorage.removeItem('crm_active_intent_ts');
                    setTimeout(() => processarNovosCartoes(document.querySelectorAll('.item_data')), 3000);
                }
            } else if (e.target.classList.contains('swal2-cancel')) {
                sessionStorage.removeItem('crm_active_intent_ts');
            }
        }, true);
    }

    function configurarDeteccaoTransferencia() {
        document.addEventListener('click', function (e) {
            const link = e.target.closest('a[title^="Transferido para"]');
            if (link) {
                destinoTransferencia = link.title.replace(/^Transferido para\s*/i, '').trim();
                isTransferring = true;
                setTimeout(() => { isTransferring = false; }, 8000);
            }

            if (e.target.classList.contains('swal2-confirm') && isTransferring) {
                setTimeout(async () => {
                    const tel = obterTelefoneClienteAtivo();
                    const nomeCliente = obterNomeClienteAtivo();
                    const nomeAtendente = obterNomeAtendente();
                    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    if (tel && nomeAtendente && destinoTransferencia) {
                        fetch(`${API_URL}/atendimento/transferencia`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                atendente_origem: nomeAtendente, atendente_destino: destinoTransferencia,
                                telefone_cliente: tel, nome_cliente: nomeCliente, motivo: "Transferência", observacao: `Transferido às ${hora}`
                            })
                        }).catch(() => { });

                        enviarFim({
                            telefone: tel, nome: nomeCliente, status: "Transferido", horario_fim: hora
                        }, "Transferência", destinoTransferencia);
                    }
                    isTransferring = false;
                }, 500);
            }
        }, true);
    }

    function processarNovosCartoes(cartoes) {
        cartoes.forEach(cartao => {
            const dados = extrairDadosCartao(cartao);
            if (!dados || cartoesProcessados.has(dados.telefone)) return;
            cartoesProcessados.add(dados.telefone);
            sessionStorage.setItem('cartoesProcessados', JSON.stringify([...cartoesProcessados]));
            enviarInicio(dados);
        });
    }

    // ==================== FEATURES OPCIONAIS ====================

    // HEARTBEAT
    let heartbeatIntervalId = null;
    async function enviarHeartbeat() {
        const nome = obterNomeAtendente();
        if (!nome || ["Atendente", "Usuário"].includes(nome)) return false;
        const el = document.getElementById("text-channel-status");
        const isOnline = el ? el.classList.contains("online") : false;

        try {
            const res = await fetch(`${API_URL}/atendentes/heartbeat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_atendente: nome, online: isOnline, ts: Date.now(), source: "extension", version: "v5.0-config" }),
                keepalive: true
            });
            return res.ok;
        } catch (e) { return false; }
    }
    async function iniciarHeartbeat() {
        if (heartbeatIntervalId !== null) return;
        enviarHeartbeat();
        heartbeatIntervalId = setInterval(enviarHeartbeat, 5000);
    }

    // SMART REPLY
    const SMART_REPLIES = {
        "Relatorio": ["Relatorio > Fiscal > Vendas por cupom", "Relatorio > Operacional > Movimento Diario Analitico", "Relatorio > Financeiro > Controle de Cartões"],
        "Cadastros": ["Cadastros > Produtos > Consulta", "Cadastros > Clientes > Novo"],
        "Caminho": ["Sistema > Configurações > Parâmetros"]
    };

    function configurarMonitorDigitacao() {
        // ✅ O MONITORAMENTO DE DIGITAÇÃO DEVE FICAR ATIVO PARA DETECTAR O COMANDO /CONFIG
        // (A configuração 'typingMonitor' agora controla apenas logs ou gatilhos extras, não o comando base)

        document.addEventListener('keyup', (e) => {
            if (e.target.classList.contains('emojionearea-editor')) {
                const texto = e.target.innerText.trim();

                // ⚙️ GATILHO DE CONFIGURAÇÃO (PRIORIDADE MÁXIMA - Ignora todos os bloqueios)
                if (texto === '/config') {
                    console.log("🛠️ Comando /config detectado!");
                    e.target.innerText = "";
                    if (e.target.innerHTML) e.target.innerHTML = "";
                    mostrarModalConfiguracao();
                    return;
                }

                // 🛑 SE O MONITOR ESTIVER DESLIGADO E NÃO FOR COMANDO, PARE AQUI
                if (!USER_CONFIG.typingMonitor && !USER_CONFIG.smartReply) return;

                // SMART REPLY LOGIC
                if (USER_CONFIG.smartReply) {
                    const palavras = texto.split(/[\s\n]+/);
                    const termo = palavras[palavras.length - 1].replace(/[^\w]/g, '');
                    if (termo.length >= 3) {
                        for (const [key, lista] of Object.entries(SMART_REPLIES)) {
                            if (key.toLowerCase().startsWith(termo.toLowerCase())) {
                                mostrarSugestoes(lista, e.target);
                                break;
                            }
                        }
                    }
                }
            }
        }, true);
    }

    function mostrarSugestoes(sugestoes, targetElement) {
        let container = document.getElementById('smart-reply-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'smart-reply-container';
            container.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 5px;`;
            document.body.appendChild(container);
        }
        container.innerHTML = '';

        const closeBtn = document.createElement('div');
        closeBtn.innerText = "✖";
        closeBtn.style.cssText = "align-self: flex-end; cursor: pointer; color: #333; margin-bottom: 5px;";
        closeBtn.onclick = () => container.remove();
        container.appendChild(closeBtn);

        sugestoes.forEach(texto => {
            const btn = document.createElement('button');
            btn.innerHTML = texto;
            btn.style.cssText = `background: white; border: 1px solid #ddd; padding: 10px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: left;`;
            btn.onclick = (e) => {
                e.preventDefault();
                targetElement.focus();
                targetElement.innerHTML = texto;
                targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                container.remove();
            };
            container.appendChild(btn);
        });
    }

    // ==================== ⚙️ UI DE CONFIGURAÇÃO (MODAL) ====================
    function mostrarModalConfiguracao() {
        const id = 'crm-config-modal';
        if (document.getElementById(id)) return;

        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; justify-content: center; align-items: center; font-family: 'Segoe UI', sans-serif;`;

        const card = document.createElement('div');
        card.style.cssText = `background: white; width: 400px; padding: 20px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); animation: fadeIn 0.2s;`;

        const title = document.createElement('h2');
        title.innerText = "⚙️ Configurações do Monitor";
        title.style.cssText = "margin: 0 0 20px 0; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;";
        card.appendChild(title);

        const createToggle = (key, label, icon) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;";

            const labelEl = document.createElement('span');
            labelEl.innerHTML = `${icon} ${label}`;
            labelEl.style.fontSize = "15px";

            const toggle = document.createElement('div');
            toggle.style.cssText = `width: 40px; height: 20px; background: ${USER_CONFIG[key] ? '#4CAF50' : '#ccc'}; border-radius: 20px; position: relative; cursor: pointer; transition: background 0.2s;`;

            const knob = document.createElement('div');
            knob.style.cssText = `width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: ${USER_CONFIG[key] ? '22px' : '2px'}; transition: left 0.2s;`;

            toggle.appendChild(knob);
            toggle.onclick = () => {
                const newState = ConfigManager.toggle(key);
                toggle.style.background = newState ? '#4CAF50' : '#ccc';
                knob.style.left = newState ? '22px' : '2px';
            };

            wrapper.appendChild(labelEl);
            wrapper.appendChild(toggle);
            return wrapper;
        };

        card.appendChild(createToggle('autoClassify', 'Classificação Automática', '🤖'));
        card.appendChild(createToggle('smartReply', 'Respostas Inteligentes', '💡'));
        card.appendChild(createToggle('interceptClosing', 'Bloquear Fechamento', '🔒'));
        card.appendChild(createToggle('typingMonitor', 'Monitor de Digitação', '⌨️'));

        const info = document.createElement('div');
        info.innerHTML = "⚡ Modo Performance: <b>ATIVO</b> (Padrão)";
        info.style.cssText = "margin-top: 20px; font-size: 12px; color: #666; text-align: center; background: #f9f9f9; padding: 8px; border-radius: 4px;";
        card.appendChild(info);

        const closeBtn = document.createElement('button');
        closeBtn.innerText = "Salvar e Fechar";
        closeBtn.style.cssText = "width: 100%; padding: 12px; margin-top: 15px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;";
        closeBtn.onclick = () => {
            // Reload para aplicar limpo
            overlay.remove();
            location.reload();
        };
        card.appendChild(closeBtn);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
    }

    // ==================== INICIALIZAÇÃO ====================
    function inicializar() {
        const observer = new MutationObserver((mutations) => {
            let hasChanges = false;
            mutations.forEach(m => { if (m.addedNodes.length) hasChanges = true; });
            if (hasChanges) {
                // DEBOUNCE OTIMIZADO (Sempre ativo)
                if (window.monitorDebounce) clearTimeout(window.monitorDebounce);
                window.monitorDebounce = setTimeout(() => {
                    const cards = document.querySelectorAll('.item_data');
                    if (cards.length) processarNovosCartoes(cards);
                }, 500);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Configura Listeners baseados na Config
        configurarDeteccaoEncerramento();
        configurarDeteccaoTransferencia();
        configurarMonitorDigitacao(); // Inclui detecção do /config
        iniciarHeartbeat();

        console.log(`✅ Monitor V5 (Configurável) Iniciado. Digite /config para opções.`);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar);
    else inicializar();

})();
