import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Mapeamento de membros por equipe
    const membrosPorEquipe = {
      '699e53267d5629312b8742dd': ['vinihenrique781@gmail.com', 'vgabrielkaybersdossantos@gmail.com'],
      '699e54e99bb56cb59de69c61': ['witalok73@gmail.com', 'waglessonribero@gmail.com']
    };

    // Buscar todos os ganhos
    const ganhos = await base44.asServiceRole.entities.GanhoTecnico.list();
    console.log(`Total de ganhos: ${ganhos.length}`);

    // Agrupar ganhos por atendimento_id e equipe
    const ganhosAgrupados = {};
    ganhos.forEach(g => {
      const chave = `${g.atendimento_id}`;
      if (!ganhosAgrupados[chave]) {
        ganhosAgrupados[chave] = [];
      }
      ganhosAgrupados[chave].push(g);
    });

    let ganhosRemovidos = 0;
    let ganhosCorrigidos = 0;
    const idsParaRemover = [];

    // Processar cada grupo de ganhos do mesmo atendimento
    for (const [atendimentoId, ganhosAtendimento] of Object.entries(ganhosAgrupados)) {
      if (ganhosAtendimento.length < 2) {
        continue; // Pular se tem menos de 2 ganhos
      }

      // Obter a equipe do primeiro ganho
      const equipeId = ganhosAtendimento[0].equipe_id;
      const membrosDaEquipe = membrosPorEquipe[equipeId] || [];

      if (membrosDaEquipe.length === 0) {
        continue; // Pular se equipe não é mapeada
      }

      // Separar ganhos por técnico
      const ganhosValidos = ganhosAtendimento.filter(g => 
        membrosDaEquipe.includes(g.tecnico_email)
      );

      console.log(`Atendimento ${atendimentoId}: ${ganhosAtendimento.length} ganhos, ${ganhosValidos.length} válidos`);

      if (ganhosValidos.length === 0) {
        continue; // Nenhum ganho válido
      }

      // Se tem ganhos válidos, manter só um por técnico
      const ganhosPorTecnico = {};
      ganhosValidos.forEach(g => {
        if (!ganhosPorTecnico[g.tecnico_email]) {
          ganhosPorTecnico[g.tecnico_email] = [];
        }
        ganhosPorTecnico[g.tecnico_email].push(g);
      });

      // Remover duplicatas mantendo apenas um por técnico
      Object.values(ganhosPorTecnico).forEach(ganhosDoTecnico => {
        if (ganhosDoTecnico.length > 1) {
          // Manter o primeiro, remover os demais
          for (let i = 1; i < ganhosDoTecnico.length; i++) {
            idsParaRemover.push(ganhosDoTecnico[i].id);
            ganhosRemovidos++;
            console.log(`Removendo ganho duplicado: ${ganhosDoTecnico[i].id} (técnico: ${ganhosDoTecnico[i].tecnico_email})`);
          }
        }
      });

      // Se faltam ganhos para algum técnico da equipe, adicionar
      const tecnicosComGanho = Object.keys(ganhosPorTecnico);
      const tecnicosFaltando = membrosDaEquipe.filter(t => !tecnicosComGanho.includes(t));

      if (tecnicosFaltando.length > 0) {
        // Usar o primeiro ganho como referência
        const ganhoRef = ganhosValidos[0];
        const valorComissaoReparte = ganhoRef.valor_comissao;

        for (const tecnicoFaltando of tecnicosFaltando) {
          const usuarios = await base44.asServiceRole.entities.User.list();
          const usuario = usuarios.find(u => u.email === tecnicoFaltando);

          console.log(`Criando ganho faltante para: ${tecnicoFaltando}`);

          await base44.asServiceRole.entities.GanhoTecnico.create({
            tecnico_email: tecnicoFaltando,
            tecnico_nome: usuario?.full_name || 'Sistema',
            atendimento_id: ganhoRef.atendimento_id,
            cliente_nome: ganhoRef.cliente_nome,
            tipo_servico: ganhoRef.tipo_servico,
            valor_servico: ganhoRef.valor_servico,
            comissao_percentual: ganhoRef.comissao_percentual,
            valor_comissao: valorComissaoReparte,
            data_conclusao: ganhoRef.data_conclusao,
            semana: ganhoRef.semana,
            mes: ganhoRef.mes,
            equipe_id: ganhoRef.equipe_id,
            equipe_nome: ganhoRef.equipe_nome,
            pago: false
          });
          ganhosCorrigidos++;
        }
      }
    }

    // Remover ganhos duplicados
    for (const id of idsParaRemover) {
      await base44.asServiceRole.entities.GanhoTecnico.delete(id);
    }

    return Response.json({
      sucesso: true,
      totalGanhos: ganhos.length,
      ganhosRemovidos,
      ganhosCorrigidos,
      mensagem: `${ganhosRemovidos} ganhos duplicados removidos, ${ganhosCorrigidos} ganhos corrigidos`
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});