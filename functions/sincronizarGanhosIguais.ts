import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const equipeId = '699e54e99bb56cb59de69c61';
    const membros = ['witalok73@gmail.com', 'waglessonribero@gmail.com'];

    // Buscar todos os ganhos atuais
    const ganhosExistentes = await base44.asServiceRole.entities.GanhoTecnico.filter({
      tecnico_email: { $in: membros }
    });

    // Agrupar por atendimento_id
    const ganhosPorAtendimento = {};
    const atendimentosProcurados = new Set();

    ganhosExistentes.forEach(g => {
      if (!ganhosPorAtendimento[g.atendimento_id]) {
        ganhosPorAtendimento[g.atendimento_id] = {};
      }
      ganhosPorAtendimento[g.atendimento_id][g.tecnico_email] = g;
      atendimentosProcurados.add(g.atendimento_id);
    });

    // Para cada atendimento, garantir que ambos membros têm ganho igual
    let ganhosParaCriar = [];
    let ganhosParaDeletar = [];

    Object.entries(ganhosPorAtendimento).forEach(([atendimentoId, ganhosPorMembro]) => {
      const ganhoExemplo = Object.values(ganhosPorMembro)[0];
      
      membros.forEach(email => {
        if (!ganhosPorMembro[email] && ganhoExemplo.valor_comissao > 0) {
          // Criar ganho faltante
          ganhosParaCriar.push({
            tecnico_email: email,
            tecnico_nome: email === 'witalok73@gmail.com' ? 'Kaue Witalo' : 'Waglesson Ribero',
            atendimento_id: atendimentoId,
            cliente_nome: ganhoExemplo.cliente_nome,
            tipo_servico: ganhoExemplo.tipo_servico,
            valor_servico: ganhoExemplo.valor_servico,
            comissao_percentual: ganhoExemplo.comissao_percentual,
            valor_comissao: ganhoExemplo.valor_comissao,
            data_conclusao: ganhoExemplo.data_conclusao,
            semana: ganhoExemplo.semana,
            mes: ganhoExemplo.mes,
            pago: ganhoExemplo.pago
          });
        }
      });

      // Deletar ganhos com valor 0
      Object.values(ganhosPorMembro).forEach(g => {
        if (g.valor_comissao === 0) {
          ganhosParaDeletar.push(g.id);
        }
      });
    });

    // Executar operações
    if (ganhosParaCriar.length > 0) {
      await base44.asServiceRole.entities.GanhoTecnico.bulkCreate(ganhosParaCriar);
    }

    if (ganhosParaDeletar.length > 0) {
      for (const id of ganhosParaDeletar) {
        await base44.asServiceRole.entities.GanhoTecnico.delete(id);
      }
    }

    return Response.json({
      sucesso: true,
      ganhosParaDeletar: ganhosParaDeletar.length,
      ganhosParaCriar: ganhosParaCriar.length,
      mensagem: `Sincronizado: criados ${ganhosParaCriar.length}, deletados ${ganhosParaDeletar.length}`
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});