// ========================================
// MUTATION OBSERVER OTIMIZADO - PERFORMANCE PATCH
// Substituir observer existente (linhas ~1748-1765)
// ========================================

// ✅ CORREÇÃO: Debounce para evitar processamento excessivo
let observerTimeout;
const observer = new MutationObserver((mutations) => {
    // Cancela timeout anterior se houver
    if (observerTimeout) clearTimeout(observerTimeout);

    // Aguarda 150ms de "silêncio" antes de processar
    observerTimeout = setTimeout(() => {
        const novosCartoes = new Set();

        mutations.forEach((mut) => {
            if (mut.addedNodes.length) {
                mut.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        // ✅ Verifica classe diretamente
                        if (node.classList?.contains('item_data')) {
                            novosCartoes.add(node);
                        }
                        // ✅ Se for container, busca apenas UMA VEZ
                        else if (node.querySelector) {
                            const cartoes = node.querySelectorAll('.item_data');
                            cartoes.forEach(c => novosCartoes.add(c));
                        }
                    }
                });
            }
        });

        if (novosCartoes.size > 0) {
            processarNovosCartoes(Array.from(novosCartoes));
        }
    }, 150); // Debounce de 150ms
});

// ✅ Observa apenas container específico de atendimentos (não document.body!)
const containerAtendimentos = document.querySelector('#attendance_container') ||
    document.querySelector('.attendances') ||
    document.querySelector('.list-attendance') ||
    document.body;

observer.observe(containerAtendimentos, {
    childList: true,
    subtree: true
});

debugLog('✅ Observer configurado em:', containerAtendimentos.id || containerAtendimentos.className);

/* 
INSTRUÇÕES:
1. Localizar o MutationObserver existente (buscar por "new MutationObserver")
2. Substituir TODO o bloco (desde "const observer = new" até "observer.observe(...)")
3. Salvar e recarregar extensão

RESULTADO ESPERADO:
- CPU reduz mais 30%
- Menos chamadas de processarNovosCartoes
- Debounce elimina processamento repetido
*/
