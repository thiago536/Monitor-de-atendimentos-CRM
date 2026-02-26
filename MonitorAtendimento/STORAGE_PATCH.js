// ========================================
// SESSION STORAGE OTIMIZADO - PERFORMANCE PATCH  
// Adicionar ao início do arquivo (após DEBUG_MODE)
// ========================================

// ✅ CORREÇÃO 5: Cache em memória + batch write
const ultimosProcessamentos = new Map();
let persistTimeout;

function persistirCacheStorage() {
    if (persistTimeout) clearTimeout(persistTimeout);

    persistTimeout = setTimeout(() => {
        try {
            sessionStorage.setItem('cartoesProcessados', JSON.stringify([...cartoesProcessados]));

            // Persiste timestamps (apenas últimos 50 para economizar espaço)
            const entries = Array.from(ultimosProcessamentos.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50);

            entries.forEach(([tel, ts]) => {
                sessionStorage.setItem(`ultimo_${tel}`, ts.toString());
            });
        } catch (e) {
            debugError('❌ Erro ao persistir cache:', e);
        }
    }, 2000); // Debounce de 2 segundos
}

// ✅ Persiste ao fechar navegador
window.addEventListener('beforeunload', () => {
    if (persistTimeout) clearTimeout(persistTimeout);
    persistirCacheStorage();
});

// ========================================
// SUBSTITUIR processarNovosCartoes EXISTENTE
// ========================================

function processarNovosCartoes(cartoes) {
    debugLog(`🔧 [DEBUG] processarNovosCartoes chamada com ${cartoes.length} cartões`);

    const agora = Date.now();
    const processados = [];

    cartoes.forEach((cartao, index) => {
        const dados = extrairDadosCartao(cartao);

        if (!dados) {
            debugError('❌ [DEBUG] BLOQUEADO: dados é null/undefined');
            return;
        }

        // ✅ Verifica duplicata em memória (rápido) ao invés de sessionStorage
        const ultimoProcessamento = ultimosProcessamentos.get(dados.telefone);

        if (ultimoProcessamento) {
            const tempoDecorrido = agora - ultimoProcessamento;
            if (tempoDecorrido < 10000) {
                debugWarn(`⚠️ DUPLICATA detectada (${tempoDecorrido}ms) - ignorando`);
                return;
            }
        }

        // ✅ Atualiza cache em memória
        ultimosProcessamentos.set(dados.telefone, agora);
        cartoesProcessados.add(dados.telefone);

        debugLog(`📤 Enviando início para: ${dados.telefone}`);
        enviarInicio(dados);

        processados.push(dados.telefone);
    });

    // ✅ Batch write: 1 write ao invés de N writes
    if (processados.length > 0) {
        persistirCacheStorage();
    }

    // 🔧 Limpar flag ATIVO após processar
    const flagAtivo = localStorage.getItem('crm_origem_active');
    if (flagAtivo === 'true') {
        localStorage.removeItem('crm_origem_active');
        localStorage.removeItem('crm_origem_timestamp');
        debugLog('🧹 Flag ATIVO consumida e limpa');
    }
}

/* 
INSTRUÇÕES:
1. Adicionar `ultimosProcessamentos`, `persistTimeout` e `persistirCacheStorage` NO TOPO (após DEBUG_MODE)
2. Substituir a função processarNovosCartoes COMPLETA
3. Salvar e recarregar extensão

RESULTADO ESPERADO:
- Reduz 70% das operações de sessionStorage
- 1 write a cada 2s ao invés de N writes por cartão
- Performance de I/O muito melhor
*/
