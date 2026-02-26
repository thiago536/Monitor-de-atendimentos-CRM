// ========================================
// HEARTBEAT OTIMIZADO - PERFORMANCE PATCH
// Substituir função iniciarHeartbeat existente
// ========================================

// ✅ Heartbeat mais espaçado + cleanup + pausa em tab inativa
let heartbeatIntervalId = null;

async function iniciarHeartbeat() {
    if (heartbeatIntervalId !== null) {
        debugWarn("⚠️ Heartbeat já está rodando");
        return;
    }

    // Envia imediatamente
    try {
        await enviarHeartbeat();
    } catch (e) {
        debugError("❌ Erro no heartbeat inicial:", e);
    }

    // ✅ Intervalo de 30s (ao invés de 5s) = -83% de Network
    heartbeatIntervalId = setInterval(async () => {
        // ✅ Não envia se tab estiver inativa
        if (document.hidden) {
            debugLog('⏸️ Heartbeat pausado (tab inativa)');
            return;
        }

        try {
            await enviarHeartbeat();
        } catch (error) {
            debugError("❌ Erro no heartbeat:", error);
        }
    }, 30000); // 30 segundos (era 5s)

    debugLog("✅ Heartbeat configurado (30s)");
}

// ✅ Cleanup ao fechar
window.addEventListener('beforeunload', () => {
    if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
    }
});

// ✅ Pausa/resume quando tab fica inativa/ativa
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        debugLog('🔕 Tab inativa - heartbeat pausado');
    } else {
        debugLog('🔔 Tab ativa - heartbeat resumido');
        enviarHeartbeat(); // Envia imediatamente ao voltar
    }
});

/* 
INSTRUÇÕES:
1. Localizar função iniciarHeartbeat() (buscar por "function iniciarHeartbeat")
2. Substituir TODA a função e adicionar os event listeners
3. Salvar e recarregar extensão

RESULTADO ESPERADO:
- Reduz 83% das requisições de heartbeat (5s → 30s)
- Zero heartbeats quando tab inativa
- Menos overhead de network
*/
