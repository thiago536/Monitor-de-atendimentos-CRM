/**
 * 🧪 TESTES DE CLASSIFICAÇÃO AUTOMÁTICA DE MOTIVOS
 * 
 * Execute com: node ServidorAPI/tests/classificacao.test.js
 * 
 * Meta: ≥75% de acurácia (vs. 43.4% atual)
 */

// ========================================
// IMPORTAR A FUNÇÃO (Simulação inline)
// ========================================
// NOTA: Em produção, você pode usar require('./server.js') e exportar a função
// Por ora, vamos duplicar a função aqui para teste standalone

function classificarMotivo(contextoResumido) {
    const contexto = (contextoResumido || '').toLowerCase().trim();
    const tamanho = contexto.length;

    if (tamanho < 15) return "Não respondeu";
    if (/sped|fiscal|contabil/.test(contexto)) return "Liberar Sped";
    if (/maquinh|maquinet|stone|cielo|pos\b/.test(contexto) &&
        /cartão|cartao|pix|payment|estorn|pagamento|não passa|nao passa/.test(contexto)) {
        return "PDV Móvel / Maquininha";
    }
    if (/pinpad|tef|terminal fixo/.test(contexto)) return "PINPAD";
    if (/(dar|dando|dá)\s*(entrada|a\s*entrada).{0,20}\b(nota|xml)|nota.{0,20}entrada|lançar\s*nota|manifesto|nota.*(não|nao)\s*(sobe|aparece)/.test(contexto)) {
        return "Entrada de nota";
    }
    if (/concentrador|bomba.{0,25}(não|nao|offline|comunica)|loop|barreira|encerrante/.test(contexto)) {
        return "Automação";
    }
    if (/\blmc\b|tanque|medição|medicao|escritural|saldo.*tanque/.test(contexto)) return "LMC";
    if (/instalar\s*sistema|novo\s*computador|backup|configurar\s*pdv|formatar|reinstalar/.test(contexto)) {
        return "Instalação";
    }
    if (/certificado|\.pfx|senha.*certificado/.test(contexto)) return "Certificado Digital";
    if (/(liberar|cadastrar).{0,15}cartão|cartão.{0,15}frentista|código.*cartão/.test(contexto) &&
        !/maquinh|maquinet/.test(contexto)) {
        return "Cadastro de cartão de abastecimento";
    }
    if (/caixa|cupom|lançar.{0,25}venda|venda.{0,25}lançar|abastecimento.*(não|nao)\s*(lança|sobe)|sistema\s*trava/.test(contexto) &&
        !/maquinh|maquinet/.test(contexto)) {
        return "PDV";
    }
    if (/boleto|fatura|mensalidade|cobran/.test(contexto) &&
        /Sitegen Tech|sitegentech|sistema|suporte/.test(contexto)) {
        return "Financeiro";
    }
    if (/relatório|relatorio|consultar|cadastr|acesso|bloqueado/.test(contexto)) return "Gerente";
    return "Gerente";
}

// ========================================
// CASOS DE TESTE
// ========================================
const casosDeTeste = [
    // ===== CATEGORIA: NÃO RESPONDEU =====
    { contexto: "Oi", esperado: "Não respondeu", descricao: "Saudação curta" },
    { contexto: "Bom dia", esperado: "Não respondeu", descricao: "Cumprimento genérico" },
    { contexto: "2", esperado: "Não respondeu", descricao: "Número solto" },
    { contexto: "", esperado: "Não respondeu", descricao: "Contexto vazio" },

    // ===== CATEGORIA: LIBERAR SPED =====
    { contexto: "Bom dia, pode gerar o sped fiscal de janeiro?", esperado: "Liberar Sped", descricao: "Solicitação SPED explícita" },
    { contexto: "preciso dos arquivos da contabilidade, pode enviar o sped?", esperado: "Liberar Sped", descricao: "SPED + contabilidade" },
    { contexto: "A contadora pediu o fiscal do mês passado", esperado: "Liberar Sped", descricao: "Contexto fiscal" },

    // ===== CATEGORIA: PDV MÓVEL / MAQUININHA =====
    { contexto: "As maquinetas estão estornando as vendas", esperado: "PDV Móvel / Maquininha", descricao: "Maquineta + estorno" },
    { contexto: "Maquininha não passa cartão", esperado: "PDV Móvel / Maquininha", descricao: "Problema com pagamento" },
    { contexto: "IP da maquininha Stone está offline", esperado: "PDV Móvel / Maquininha", descricao: "Maquininha + problema técnico" },
    { contexto: "Cielo não comunica, não aceita pix", esperado: "PDV Móvel / Maquininha", descricao: "Operadora + PIX" },

    // ===== CATEGORIA: ENTRADA DE NOTA =====
    { contexto: "Não consigo dar entrada nas notas de combustível", esperado: "Entrada de nota", descricao: "Dar entrada + notas" },
    { contexto: "As notas não aparecem para dar entrada", esperado: "Entrada de nota", descricao: "Notas não aparecem" },
    { contexto: "Preciso lançar nota fiscal no sistema", esperado: "Entrada de nota", descricao: "Lançar nota" },
    { contexto: "O XML da nota não sobe", esperado: "Entrada de nota", descricao: "XML + nota" },

    // ===== CATEGORIA: AUTOMAÇÃO =====
    { contexto: "O concentrador ficou offline após queda de energia", esperado: "Automação", descricao: "Concentrador offline" },
    { contexto: "Bomba 3 não comunica com o sistema", esperado: "Automação", descricao: "Bomba + problema comunicação" },
    { contexto: "Problemas no loop do concentrador", esperado: "Automação", descricao: "Problema em loop" },

    // ===== CATEGORIA: PDV =====
    { contexto: "O sistema não tá lançando as vendas", esperado: "PDV", descricao: "Lançar vendas" },
    { contexto: "Caixa travou, cupom não sai", esperado: "PDV", descricao: "Caixa + cupom" },
    { contexto: "Abastecimento não sobe no sistema", esperado: "PDV", descricao: "Abastecimento não registra" },

    // ===== CATEGORIA: PINPAD =====
    { contexto: "PINPAD inativo na porta USB", esperado: "PINPAD", descricao: "PINPAD explícito" },
    { contexto: "TEF não conecta no terminal", esperado: "PINPAD", descricao: "TEF explícito" },

    // ===== CATEGORIA: LMC =====
    { contexto: "Diferença no LMC do tanque 1", esperado: "LMC", descricao: "LMC explícito" },
    { contexto: "Saldo do tanque está zerado", esperado: "LMC", descricao: "Saldo + tanque" },
    { contexto: "Problema na medição do tanque de gasolina", esperado: "LMC", descricao: "Medição + tanque" },

    // ===== CATEGORIA: INSTALAÇÃO =====
    { contexto: "Preciso instalar o sistema no computador novo", esperado: "Instalação", descricao: "Instalar + novo computador" },
    { contexto: "Vou formatar a máquina, como reinstalo?", esperado: "Instalação", descricao: "Formatar + reinstalar" },

    // ===== CATEGORIA: CERTIFICADO DIGITAL =====
    { contexto: "Preciso instalar o certificado digital .pfx", esperado: "Certificado Digital", descricao: "Certificado + .pfx" },
    { contexto: "Senha do certificado para emitir NFe", esperado: "Certificado Digital", descricao: "Certificado + senha" },

    // ===== CATEGORIA: CADASTRO DE CARTÃO =====
    { contexto: "Preciso liberar o cartão do novo frentista", esperado: "Cadastro de cartão de abastecimento", descricao: "Liberar + cartão + frentista" },
    { contexto: "Como cadastrar código do cartão no sistema?", esperado: "Cadastro de cartão de abastecimento", descricao: "Cadastrar + código + cartão" },

    // ===== CATEGORIA: FINANCEIRO =====
    { contexto: "Não recebi o boleto do sistema Sitegen Tech", esperado: "Financeiro", descricao: "Boleto + Sitegen Tech" },
    { contexto: "Fatura da mensalidade do suporte", esperado: "Financeiro", descricao: "Fatura + suporte" },

    // ===== CATEGORIA: GERENTE =====
    { contexto: "Como emitir relatório de vendas por produto?", esperado: "Gerente", descricao: "Relatório administrativo" },
    { contexto: "Preciso consultar cadastro de cliente", esperado: "Gerente", descricao: "Consultar cadastro" },
    { contexto: "Acesso ao gerente bloqueado", esperado: "Gerente", descricao: "Acesso bloqueado" },

    // ===== CASOS AMBÍGUOS / EDGE CASES =====
    {
        contexto: "Não consigo dar entrada nas notas e também preciso do sped",
        esperado: "Entrada de nota",
        descricao: "Múltiplos problemas - deve priorizar o primeiro"
    },
    {
        contexto: "Maquininha aceita cartão mas PDV não lança venda",
        esperado: "PDV Móvel / Maquininha",
        descricao: "Menciona maquininha primeiro"
    }
];

// ========================================
// EXECUTAR TESTES
// ========================================
console.log('🧪 ========================================');
console.log('🧪 TESTES DE CLASSIFICAÇÃO AUTOMÁTICA');
console.log('🧪 ========================================\n');

let acertos = 0;
let erros = 0;
const errosDetalhados = [];

casosDeTeste.forEach((caso, index) => {
    const resultado = classificarMotivo(caso.contexto);
    const passou = resultado === caso.esperado;

    if (passou) {
        acertos++;
        console.log(`✅ Teste ${index + 1}: ${caso.descricao}`);
    } else {
        erros++;
        console.log(`❌ Teste ${index + 1}: ${caso.descricao}`);
        console.log(`   Esperado: "${caso.esperado}"`);
        console.log(`   Obtido:   "${resultado}"`);
        console.log(`   Contexto: "${caso.contexto}"\n`);

        errosDetalhados.push({
            teste: index + 1,
            descricao: caso.descricao,
            contexto: caso.contexto,
            esperado: caso.esperado,
            obtido: resultado
        });
    }
});

// ========================================
// RESUMO DOS RESULTADOS
// ========================================
console.log('\n🎯 ========================================');
console.log('🎯 RESUMO DOS TESTES');
console.log('🎯 ========================================');

const total = casosDeTeste.length;
const acuracia = ((acertos / total) * 100).toFixed(1);
const meta = 75;

console.log(`\n📊 Acertos: ${acertos}/${total}`);
console.log(`📊 Erros: ${erros}/${total}`);
console.log(`📊 Acurácia: ${acuracia}%`);
console.log(`📊 Meta: ${meta}%`);
console.log(`📊 Status: ${parseFloat(acuracia) >= meta ? '✅ META ATINGIDA!' : '❌ Abaixo da meta'}\n`);

if (errosDetalhados.length > 0) {
    console.log('❌ ========================================');
    console.log('❌ ERROS DETALHADOS PARA AJUSTE');
    console.log('❌ ========================================\n');

    errosDetalhados.forEach(erro => {
        console.log(`Teste ${erro.teste}: ${erro.descricao}`);
        console.log(`  Contexto: "${erro.contexto}"`);
        console.log(`  Esperado: "${erro.esperado}"`);
        console.log(`  Obtido:   "${erro.obtido}"\n`);
    });
}

// Retorna código de saída apropriado
process.exit(erros > 0 ? 1 : 0);
