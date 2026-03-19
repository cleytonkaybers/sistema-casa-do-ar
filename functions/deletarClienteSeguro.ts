import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Deleta cliente com validação multi-tenant obrigatória
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { cliente_id } = await req.json();

    // Validar que cliente pertence à empresa do usuário
    const clientes = await base44.entities.ClienteSaaS.filter({
      company_id: user.company_id,
      id: cliente_id
    });

    if (clientes.length === 0) {
      return Response.json({ 
        error: 'Cliente não encontrado ou não pertence à sua empresa' 
      }, { status: 403 });
    }

    const cliente = clientes[0];

    // Deletar cliente
    await base44.entities.ClienteSaaS.delete(cliente_id);

    // Log de auditoria
    await base44.asServiceRole.entities.LogAuditoriaSaaS.create({
      company_id: user.company_id,
      usuario_email: user.email,
      tipo_acao: 'deletar_cliente',
      entidade: 'ClienteSaaS',
      entidade_id: cliente_id,
      descricao: `Cliente deletado: ${cliente.nome}`
    });

    return Response.json({ sucesso: true, mensagem: 'Cliente removido' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});