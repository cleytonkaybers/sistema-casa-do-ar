import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Deletar ganhos existentes para refazer
    const ganhosExistentes = await base44.asServiceRole.entities.GanhoTecnico.list();
    
    if (ganhosExistentes.length > 0) {
      // Deletar em lotes para evitar rate limit
      for (let i = 0; i < ganhosExistentes.length; i += 100) {
        const lote = ganhosExistentes.slice(i, i + 100);
        for (const ganho of lote) {
          await base44.asServiceRole.entities.GanhoTecnico.delete(ganho.id);
        }
      }
    }

    // Buscar serviços concluídos
    const servicos = await base44.asServiceRole.entities.Servico.filter({ status: 'concluido' });
    const usuarios = await base44.asServiceRole.entities.User.list();
    
    // Filtrar usuários não-admin
    const usuariosAtivos = usuarios.filter(u => u.role !== 'admin');
    
    // Buscar precificações
    const precificacoes = await base44.asServiceRole.entities.PrecificacaoServico.list();

    let ganhosCriados = 0;
    const ganhosParaCriar = [];

    // Mapeamento de membros por equipe
    const membrosPorEquipe = {
      '699e53267d5629312b8742dd': ['vinihenrique781@gmail.com', 'vgabrielkaybersdossantos@gmail.com'], // Equipe 1
      '699e54e99bb56cb59de69c61': ['witalok73@gmail.com', 'waglessonribero@gmail.com'] // Equipe 2
    };

    // Para cada serviço concluído
    for (const servico of servicos) {
      // Pular se não tem técnico que completou ou equipe
      if (!servico.usuario_atualizacao_status || !servico.equipe_id) {
        continue;
      }

      const precificacao = precificacoes.find(p => p.tipo_servico === servico.tipo_servico);
      const comissaoPercentual = precificacao?.comissao_tecnico_percentual || 15;

      // Buscar membros da equipe
      const membrosEquipe = membrosPorEquipe[servico.equipe_id] || [];

      // Se não tem membros definidos, criar ganho só para quem completou
      if (membrosEquipe.length === 0) {
        const usuarioMembro = usuariosAtivos.find(u => u.email === servico.usuario_atualizacao_status);
        const valorComissao = (servico.valor || 0) * (comissaoPercentual / 100);

        ganhosParaCriar.push({
          tecnico_email: servico.usuario_atualizacao_status,
          tecnico_nome: usuarioMembro?.full_name || 'Sistema',
          atendimento_id: servico.id,
          cliente_nome: servico.cliente_nome,
          tipo_servico: servico.tipo_servico,
          valor_servico: servico.valor || 0,
          comissao_percentual: comissaoPercentual,
          valor_comissao: valorComissao,
          data_conclusao: servico.data_atualizacao_status || new Date().toISOString(),
          semana: getWeekOfYear(new Date(servico.data_atualizacao_status || new Date())),
          mes: getMesAno(new Date(servico.data_atualizacao_status || new Date())),
          equipe_id: servico.equipe_id,
          equipe_nome: servico.equipe_nome,
          pago: false
        });
        continue;
      }

      // Criar ganho apenas para o primeiro membro (evita duplicação)
       const emailMembro = membrosEquipe[0];
       const usuarioMembro = usuariosAtivos.find(u => u.email === emailMembro);
       const valorComissaoTotal = (servico.valor || 0) * (comissaoPercentual / 100);

       ganhosParaCriar.push({
         tecnico_email: emailMembro,
         tecnico_nome: usuarioMembro?.full_name || 'Sistema',
         atendimento_id: servico.id,
         cliente_nome: servico.cliente_nome,
         tipo_servico: servico.tipo_servico,
         valor_servico: servico.valor || 0,
         comissao_percentual: comissaoPercentual,
         valor_comissao: valorComissaoTotal,
         data_conclusao: servico.data_atualizacao_status || new Date().toISOString(),
         semana: getWeekOfYear(new Date(servico.data_atualizacao_status || new Date())),
         mes: getMesAno(new Date(servico.data_atualizacao_status || new Date())),
         equipe_id: servico.equipe_id,
         equipe_nome: servico.equipe_nome,
         pago: false
       });
    }

    // Criar todos em lote
    if (ganhosParaCriar.length > 0) {
      await base44.asServiceRole.entities.GanhoTecnico.bulkCreate(ganhosParaCriar);
      ganhosCriados = ganhosParaCriar.length;
    }

    return Response.json({
      sucesso: true,
      ganhosCriados,
      totalEquipes: Object.keys(servicosPorEquipe).length,
      mensagem: `${ganhosCriados} ganhos sincronizados para todas as equipes`
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function getWeekOfYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil((d - yearStart) / 86400000 / 7)).padStart(2, '0')}`;
}

function getMesAno(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}