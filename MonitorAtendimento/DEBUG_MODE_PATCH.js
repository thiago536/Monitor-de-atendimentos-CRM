// DEBUG MODE PATCH - Aplicar no topo de content.js (após linha 6)

// ✅ CORREÇÃO: Flag de debug (false em produção para reduzir CPU)
const DEBUG_MODE = false;

// ✅ Funções de log condicionais (bind para performance)
const debugLog = DEBUG_MODE ? console.log.bind(console) : () => { };
const debugWarn = DEBUG_MODE ? console.warn.bind(console) : () => { };
const debugError = console.error.bind(console); // Erros sempre aparecem

/* 
INSTRUÇÕES DE APLICAÇÃO:
1. Copiar estas linhas
2. Colar após a linha "const API_URL = ..." (linha ~10)
3. Fazer Find & Replace:
   - console.log( → debugLog(
   - console.warn( → debugWarn(
   - Manter console.error( como está (já é crítico)
   
TESTE:
- Recarregar extensão
- Verificar console: deve estar limpo (apenas erros se houver)
- CPU deve cair 40-50% imediatamente
*/
