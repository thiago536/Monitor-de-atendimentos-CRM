 // ==================== TRANSFERÊNCIAS - CÓDIGO PARA ADICIONAR NO SERVER.JS ====================
// Adicionar APÓS a rota app.post('/api/atendimento/fim', ...)
// Antes de app.get('/api/gamificacao/ranking', ...)

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
