import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem sincronizar ganhos' }, { status: 403 });
    }

    // Buscar todos os serviços concluídos
     const servicosConcluidos = await base44.entities.Servico.filter({ status: 'concluido' });

     // Buscar todos os ganhos já registrados
     const ganhosExistentes = await base44.entities.GanhoTecnico.list();
     const servicosComGanho = new Set(ganhosExistentes.map(g => g.atendimento_id));

     // Buscar precificações para referência
     const precificacoes = await base44.entities.PrecificacaoServico.list();
     const precMap = {};
     precificacoes.forEach(p => {
       precMap[p.tipo_servico] = p;
     });

     let sincronizados = 0;
     let erros = [];

     // Para cada serviço concluído, criar ganho se existir precificação
     for (const servico of servicosConcluidos) {
       // Validar se tem precificação
       const prec = precMap[servico.tipo_servico];
       if (!prec) {
         continue;
       }

       // Validar dados mínimos
       if (!servico.equipe_id || servico.valor <= 0) {
         continue;
       }

       // Buscar atendimento correspondente
       const atendimentos = await base44.entities.Atendimento.filter({ servico_id: servico.id });
       if (atendimentos.length === 0) {
         erros.push(`Serviço ${servico.id} não tem atendimento`);
         continue;
       }

       const atendimento = atendimentos[0];

       // Verificar se já existe ganho para este serviço
       if (servicosComGanho.has(atendimento.id)) {
         continue;
       }

      try {
        // Buscar nome do usuário que concluiu
        let tecnicoEmail = atendimento.usuario_conclusao || 'sistema@app.com';
        let tecnicoNome = 'Sistema';

        if (atendimento.usuario_conclusao) {
          const usuarios = await base44.entities.User.filter({ email: atendimento.usuario_conclusao });
          if (usuarios.length > 0) {
            tecnicoNome = usuarios[0].full_name || atendimento.usuario_conclusao;
          }
        }

        const prec = precMap[atendimento.tipo_servico];
        const comissaoPerc = prec?.comissao_tecnico_percentual || 30;
        const valorComissao = (atendimento.valor * comissaoPerc) / 100;

        // Calcular semana e mês
        const dataConc = new Date(atendimento.data_conclusao || atendimento.created_date);
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
          equipe_id: atendimento.equipe_id,
          equipe_nome: atendimento.equipe_nome,
          atendimento_id: atendimento.id,
          cliente_nome: atendimento.cliente_nome,
          tipo_servico: atendimento.tipo_servico,
          valor_servico: atendimento.valor,
          comissao_percentual: comissaoPerc,
          valor_comissao: valorComissao,
          data_conclusao: atendimento.data_conclusao || dataConc.toISOString(),
          semana: semana,
          mes: mes,
          pago: false
        };

        await base44.entities.GanhoTecnico.create(ganhoData);
        sincronizados++;
      } catch (error) {
        erros.push(`Erro ao sincronizar atendimento ${atendimento.id}: ${error.message}`);
      }
    }

    return Response.json({
      sucesso: true,
      sincronizados,
      erros,
      mensagem: `${sincronizados} ganhos sincronizados com sucesso`
    });
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});