import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Função executada por automação - não precisa de autenticação
    console.log('Iniciando reset semanal de ganhos...');

    // Calcular período da semana que está sendo finalizada
    const agora = new Date();
    const domingoAtual = new Date(agora);
    domingoAtual.setHours(23, 59, 59, 999);
    
    // Início da semana = segunda-feira anterior (7 dias atrás do domingo)
    const inicioSemana = new Date(domingoAtual);
    inicioSemana.setDate(inicioSemana.getDate() - 6);
    inicioSemana.setHours(0, 0, 0, 0);

    // Buscar todos os técnicos
    const tecnicos = await base44.asServiceRole.entities.TecnicoFinanceiro.list();
    console.log(`Encontrados ${tecnicos.length} técnicos para resetar`);

    const historicosCriados = [];

    for (const tecnico of tecnicos) {
      // Salvar histórico da semana
      const historico = await base44.asServiceRole.entities.HistoricoGanhosSemanal.create({
        tecnico_id: tecnico.tecnico_id,
        tecnico_nome: tecnico.tecnico_nome,
        equipe_id: tecnico.equipe_id,
        equipe_nome: tecnico.equipe_nome,
        semana_inicio: inicioSemana.toISOString().split('T')[0],
        semana_fim: domingoAtual.toISOString().split('T')[0],
        credito_pendente: tecnico.credito_pendente || 0,
        credito_pago: tecnico.credito_pago || 0,
        total_ganho: tecnico.total_ganho || 0,
        data_reset: agora.toISOString()
      });
      
      historicosCriados.push(historico);

      // Resetar ganhos do técnico (manter apenas crédito pago acumulado)
      await base44.asServiceRole.entities.TecnicoFinanceiro.update(tecnico.id, {
        credito_pendente: 0,
        total_ganho: 0,
        data_ultima_atualizacao: agora.toISOString()
      });

      console.log(`Reset concluído para ${tecnico.tecnico_nome}`);
    }

    return Response.json({
      success: true,
      message: 'Reset semanal concluído',
      tecnicos_resetados: tecnicos.length,
      historicos_criados: historicosCriados.length,
      periodo: {
        inicio: inicioSemana.toISOString().split('T')[0],
        fim: domingoAtual.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Erro ao resetar ganhos semanais:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});