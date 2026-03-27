import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const payload = await req.json();
  const servicoId = payload?.event?.entity_id || payload?.servico_id;

  if (!servicoId) {
    return Response.json({ error: 'servico_id ausente' }, { status: 400 });
  }

  // Busca todos os PagamentoCliente vinculados ao serviço excluído
  const registros = await base44.asServiceRole.entities.PagamentoCliente.filter({ servico_id: servicoId });

  let deletados = 0;
  for (const r of registros) {
    await base44.asServiceRole.entities.PagamentoCliente.delete(r.id);
    deletados++;
  }

  // Também verifica pelo atendimento_id via servico_id nos atendimentos
  // (caso o link seja via atendimento_id no pagamento mas servico_id no atendimento)
  const atendimentos = await base44.asServiceRole.entities.Atendimento.filter({ servico_id: servicoId });
  for (const at of atendimentos) {
    const pags = await base44.asServiceRole.entities.PagamentoCliente.filter({ atendimento_id: at.id });
    for (const p of pags) {
      await base44.asServiceRole.entities.PagamentoCliente.delete(p.id);
      deletados++;
    }
  }

  return Response.json({ ok: true, deletados });
});