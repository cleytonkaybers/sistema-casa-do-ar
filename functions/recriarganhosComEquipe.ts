import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem recriar ganhos' }, { status: 403 });
    }

    // Buscar todos os serviços concluídos
    const servicosConcluidos = await base44.entities.Servico.filter({ status: 'concluido' });

    // Buscar precificações para referência
    const precificacoes = await base44.entities.PrecificacaoServico.list();
    const precMap = {};
    precificacoes.forEach(p => {
      precMap[p.tipo_servico] = p;
    });

    // Buscar todos os ganhos existentes
    const ganhosExistentes = await base44.entities.GanhoTecnico.list();

    let deletados = 0;
    let recriados = 0;
    let erros = [];

    // Deletar todos os ganhos existentes
    for (const ganho of ganhosExistentes) {
      try {
        await base44.entities.GanhoTecnico.delete(ganho.id);
        deletados++;
      } catch (error) {
        erros.push(`Erro ao deletar ganho ${ganho.id}: ${error.message}`);
      }
    }

    // Recriar ganhos - 15% para cada técnico
    for (const servico of servicosConcluidos) {
      const prec = precMap[servico.tipo_servico];
      if (!prec || servico.valor <= 0) continue;

      const atendimentos = await base44.entities.Atendimento.filter({ servico_id: servico.id });
      if (atendimentos.length === 0) continue;

      const atendimento = atendimentos[0];

      try {
        let tecnicoEmail = atendimento.usuario_conclusao || 'sistema@app.com';
        let tecnicoNome = 'Sistema';

        if (atendimento.usuario_conclusao) {
          const usuarios = await base44.entities.User.filter({ email: atendimento.usuario_conclusao });
          if (usuarios.length > 0) {
            tecnicoNome = usuarios[0].full_name || atendimento.usuario_conclusao;
          }
        }

        // Comissão fixa de 15% para cada técnico
        const comissaoPerc = 15;
        const valorComissao = (servico.valor * comissaoPerc) / 100;

        const dataConc = new Date(atendimento.data_conclusao || servico.data_atualizacao_status || new Date().toISOString());
        const getWeekNumber = (d) => {
          d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
          d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        };
        const semana = `${dataConc.getFullYear()}-W${String(getWeekNumber(dataConc)).padStart(2, '0')}`;
        const mes = `${dataConc.getFullYear()}-${String(dataConc.getMonth() + 1).padStart(2, '0')}`;

        const ganhoData = {
          tecnico_email: tecnicoEmail,
          tecnico_nome: tecnicoNome,
          equipe_id: equipeId,
          equipe_nome: equipeNome,
          atendimento_id: atendimento.id,
          cliente_nome: servico.cliente_nome,
          tipo_servico: servico.tipo_servico,
          valor_servico: servico.valor,
          comissao_percentual: comissaoPerc,
          valor_comissao: valorComissao,
          data_conclusao: dataConc.toISOString(),
          semana: semana,
          mes: mes,
          pago: false
        };

        await base44.entities.GanhoTecnico.create(ganhoData);
        recriados++;
      } catch (error) {
        erros.push(`Erro ao recriar ganho para serviço ${servico.id}: ${error.message}`);
      }
    }

    return Response.json({
      sucesso: true,
      deletados,
      recriados,
      totalServicos: servicosConcluidos.length,
      erros,
      mensagem: `${deletados} ganhos deletados e ${recriados} recriados com equipes vinculadas`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});