import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar todos os ganhos e usuários
    const ganhos = await base44.asServiceRole.entities.GanhoTecnico.list();
    const usuarios = await base44.asServiceRole.entities.User.list();
    console.log(`Total de ganhos: ${ganhos.length}`);

    // Mapeamento correto de membros por equipe (apenas 2 técnicos por equipe)
    const membrosPorEquipe = {
      '699e53267d5629312b8742dd': ['vinihenrique781@gmail.com', 'vgabrielkaybersdossantos@gmail.com'],
      '699e54e99bb56cb59de69c61': ['witalok73@gmail.com', 'waglessonribero@gmail.com']
    };

    console.log('Equipes descobertas:', membrosPorEquipe);

    // Agrupar ganhos por atendimento_id
    const ganhosAgrupados = {};
    ganhos.forEach(g => {
      const chave = g.atendimento_id;
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
      const equipeId = ganhosAtendimento[0]?.equipe_id;
      if (!equipeId || !membrosPorEquipe[equipeId]) {
        continue;
      }

      const membrosDaEquipe = membrosPorEquipe[equipeId];
      const ganhosValidos = ganhosAtendimento.filter(g => membrosDaEquipe.includes(g.tecnico_email));

      if (ganhosValidos.length === 0) {
        continue;
      }

      // Calcular o valor médio de comissão
      const ganhoRef = ganhosValidos[0];
      const valorComissaoMedia = ganhoRef.valor_comissao / ganhosValidos.length;

      // Encontrar ganhos por técnico
      const ganhosPorTecnico = {};
      ganhosValidos.forEach(g => {
        ganhosPorTecnico[g.tecnico_email] = g;
      });

      // Remover ganhos duplicados do mesmo técnico (manter apenas o primeiro)
      for (let i = 0; i < ganhosAtendimento.length; i++) {
        const ganho = ganhosAtendimento[i];
        if (!membrosDaEquipe.includes(ganho.tecnico_email)) {
          continue;
        }

        const ganhoDoTecnico = ganhosPorTecnico[ganho.tecnico_email];
        if (ganho.id !== ganhoDoTecnico.id) {
          idsParaRemover.push(ganho.id);
          ganhosRemovidos++;
          console.log(`Removendo duplicado: ${ganho.id} de ${ganho.tecnico_email}`);
        }
      }

      // Atualizar todos os ganhos válidos para terem o mesmo valor
      for (const ganho of ganhosValidos) {
        if (Math.abs(ganho.valor_comissao - valorComissaoMedia) > 0.01) {
          await base44.asServiceRole.entities.GanhoTecnico.update(ganho.id, {
            valor_comissao: valorComissaoMedia
          });
          console.log(`Ajustando ganho ${ganho.id} para R$ ${valorComissaoMedia.toFixed(2)}`);
          ganhosCorrigidos++;
        }
      }

      // Se faltam ganhos para algum técnico da equipe, criar
      const tecnicosComGanho = Object.keys(ganhosPorTecnico);
      const tecnicosFaltando = membrosDaEquipe.filter(t => !tecnicosComGanho.includes(t));

      for (const tecnicoFaltando of tecnicosFaltando) {
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
          valor_comissao: valorComissaoMedia,
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