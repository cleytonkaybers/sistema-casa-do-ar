import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar serviço recém concluído do payload
    const payload = await req.json().catch(() => ({}));
    const servicoId = payload.event?.entity_id;

    if (!servicoId) {
      return Response.json({ error: 'Serviço não encontrado' }, { status: 400 });
    }

    // Buscar serviço específico
    const servico = await base44.asServiceRole.entities.Servico.get(servicoId);
    
    if (!servico || servico.status !== 'concluido') {
      return Response.json({ sucesso: true, mensagem: 'Serviço não está concluído' });
    }

    if (!servico.equipe_id) {
      return Response.json({ sucesso: true, mensagem: 'Serviço sem equipe atribuída' });
    }

    // Buscar todos os usuários
    const usuarios = await base44.asServiceRole.entities.User.list();
    
    // Filtrar membros da equipe dinamicamente
    const membrosMapeados = {
      '699e53267d5629312b8742dd': ['vinihenrique781@gmail.com', 'vgabrielkaybersdossantos@gmail.com'], // Equipe 1: Vini e Vitor
      '699e54e99bb56cb59de69c61': ['witalok73@gmail.com', 'waglessonribero@gmail.com'] // Equipe 2: Kaue e Waglesson
    };

    const emailsMembros = membrosMapeados[servico.equipe_id] || [];
    
    if (emailsMembros.length === 0) {
      return Response.json({ sucesso: true, mensagem: 'Equipe não mapeada' });
    }

    // Buscar precificação
    const precificacoes = await base44.asServiceRole.entities.PrecificacaoServico.filter({
      tipo_servico: servico.tipo_servico
    });

    const comissaoPercentual = precificacoes.length > 0 ? 
      (precificacoes[0].comissao_tecnico_percentual || 15) : 15;

    const valorComissao = (servico.valor || 0) * (comissaoPercentual / 100);

    let ganhosCriados = 0;

    // Criar ganho para cada membro
    for (const emailMembro of emailsMembros) {
      const usuarioMembro = usuarios.find(u => u.email === emailMembro);
      
      const novoGanho = {
        tecnico_email: emailMembro,
        tecnico_nome: usuarioMembro?.full_name || 'Sistema',
        atendimento_id: servicoId,
        cliente_nome: servico.cliente_nome,
        tipo_servico: servico.tipo_servico,
        valor_servico: servico.valor || 0,
        comissao_percentual: comissaoPercentual,
        valor_comissao: valorComissao,
        data_conclusao: servico.data_atualizacao_status || new Date().toISOString(),
        semana: getWeekOfYear(new Date(servico.data_atualizacao_status || new Date())),
        mes: getMesAno(new Date(servico.data_atualizacao_status || new Date())),
        pago: false,
        equipe_id: servico.equipe_id,
        equipe_nome: servico.equipe_nome
      };

      await base44.asServiceRole.entities.GanhoTecnico.create(novoGanho);
      ganhosCriados++;
    }

    return Response.json({
      sucesso: true,
      ganhosCriados,
      mensagem: `${ganhosCriados} ganhos criados para equipe`
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