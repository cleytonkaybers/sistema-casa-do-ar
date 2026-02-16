import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Cria transação financeira com validação multi-tenant obrigatória
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const dados = await req.json();

    // Validar que ordem_servico_id pertence à empresa do usuário
    if (dados.ordem_servico_id) {
      const ordens = await base44.entities.OrdemServicoSaaS.filter({
        company_id: user.company_id,
        id: dados.ordem_servico_id
      });

      if (ordens.length === 0) {
        return Response.json({ 
          error: 'Ordem de serviço não encontrada ou não pertence à sua empresa' 
        }, { status: 403 });
      }
    }

    // Validar que cliente_id pertence à empresa do usuário
    if (dados.cliente_id) {
      const clientes = await base44.entities.ClienteSaaS.filter({
        company_id: user.company_id,
        id: dados.cliente_id
      });

      if (clientes.length === 0) {
        return Response.json({ 
          error: 'Cliente não encontrado ou não pertence à sua empresa' 
        }, { status: 403 });
      }
    }

    // Criar transação com company_id obrigatório
    const transacao = await base44.entities.FinanceiroSaaS.create({
      ...dados,
      company_id: user.company_id
    });

    // Log de auditoria
    await base44.asServiceRole.entities.LogAuditoriaSaaS.create({
      company_id: user.company_id,
      usuario_email: user.email,
      tipo_acao: 'criar_transacao_financeira',
      entidade: 'FinanceiroSaaS',
      entidade_id: transacao.id,
      descricao: `Transação ${dados.tipo_transacao}: R$ ${dados.valor}`
    });

    return Response.json({ sucesso: true, transacao });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});