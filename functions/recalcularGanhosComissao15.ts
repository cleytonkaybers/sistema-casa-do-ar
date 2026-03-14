import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' }, { status: 403 });
    }

    // Buscar todos os ganhos
    const ganhos = await base44.asServiceRole.entities.GanhoTecnico.list();
    
    let atualizados = 0;
    let erros = 0;

    for (const ganho of ganhos) {
      try {
        const valorServico = ganho.valor_servico || 0;
        const novaComissao = Number((valorServico * 0.15).toFixed(2)); // 15% com precisão
        
        // Atualizar se o valor estiver diferente
        if (ganho.comissao_percentual !== 15 || ganho.valor_comissao !== novaComissao) {
          await base44.asServiceRole.entities.GanhoTecnico.update(ganho.id, {
            comissao_percentual: 15,
            valor_comissao: novaComissao
          });
          atualizados++;
        }
      } catch (error) {
        console.error(`Erro ao atualizar ganho ${ganho.id}:`, error);
        erros++;
      }
    }

    return Response.json({
      success: true,
      total: ganhos.length,
      atualizados,
      erros,
      message: `Recálculo concluído. ${atualizados} registros atualizados de ${ganhos.length} totais.`
    });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});