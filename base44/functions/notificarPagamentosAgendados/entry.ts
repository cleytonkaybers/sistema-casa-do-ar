import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Permite chamada de automação (sem user) usando serviceRole
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Buscar todos os pagamentos agendados
  const pagamentos = await base44.asServiceRole.entities.PagamentoCliente.filter({ status: 'agendado' });

  // Filtrar os que têm data_pagamento_agendado <= hoje e ainda têm saldo
  const vencidos = pagamentos.filter(p => {
    if (!p.data_pagamento_agendado) return false;
    const saldo = (p.valor_total || 0) - (p.valor_pago || 0);
    if (saldo <= 0.01) return false;
    return p.data_pagamento_agendado <= hojeStr;
  });

  if (vencidos.length === 0) {
    return Response.json({ message: 'Nenhum pagamento agendado para hoje.', total: 0 });
  }

  // Buscar todos os usuários admin
  const usuarios = await base44.asServiceRole.entities.User.list();
  const admins = usuarios.filter(u => u.role === 'admin');

  if (admins.length === 0) {
    return Response.json({ message: 'Nenhum admin encontrado.', total: 0 });
  }

  // Para cada pagamento vencido, criar notificação para cada admin
  // Evitar duplicatas: verificar se já existe notificação de hoje para o mesmo pagamento
  const notifExistentes = await base44.asServiceRole.entities.Notificacao.filter({ tipo: 'pagamento_agendado' });

  let criadas = 0;
  for (const pag of vencidos) {
    const saldo = (pag.valor_total || 0) - (pag.valor_pago || 0);
    const saldoFmt = saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataAgendada = pag.data_pagamento_agendado;

    for (const admin of admins) {
      // Verificar se já notificou hoje para este pagamento + admin
      const jaNotificou = notifExistentes.some(n =>
        n.usuario_email === admin.email &&
        n.atendimento_id === (pag.atendimento_id || pag.id) &&
        n.created_date?.startsWith(hojeStr)
      );

      if (jaNotificou) continue;

      await base44.asServiceRole.entities.Notificacao.create({
        usuario_email: admin.email,
        tipo: 'pagamento_agendado',
        titulo: `💰 Cobrar hoje: ${pag.cliente_nome}`,
        mensagem: `${pag.cliente_nome} tem pagamento agendado para ${dataAgendada} — Saldo: ${saldoFmt}. Serviço: ${pag.tipo_servico || '—'}`,
        atendimento_id: pag.atendimento_id || pag.id,
        cliente_nome: pag.cliente_nome,
        lida: false,
      });
      criadas++;
    }
  }

  return Response.json({
    message: `${criadas} notificação(ões) criada(s) para ${vencidos.length} pagamento(s) agendado(s).`,
    total: criadas,
  });
});