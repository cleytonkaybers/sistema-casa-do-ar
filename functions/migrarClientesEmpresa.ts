import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.tipo_usuario !== 'admin_empresa') {
      return Response.json({ error: 'Apenas admin da empresa pode executar' }, { status: 403 });
    }

    // Buscar todos os clientes sem empresa_id
    const clientesSemEmpresa = await base44.asServiceRole.entities.Cliente.filter({
      empresa_id: { $exists: false }
    });

    if (clientesSemEmpresa.length === 0) {
      return Response.json({ 
        success: true,
        message: 'Nenhum cliente para migrar',
        migrados: 0 
      });
    }

    // Atualizar cada cliente com o empresa_id do usuário
    const atualizacoes = clientesSemEmpresa.map(cliente => 
      base44.asServiceRole.entities.Cliente.update(cliente.id, {
        empresa_id: user.empresa_id
      })
    );

    await Promise.all(atualizacoes);

    return Response.json({ 
      success: true,
      message: `${clientesSemEmpresa.length} cliente(s) migrado(s) com sucesso`,
      migrados: clientesSemEmpresa.length
    });
  } catch (error) {
    console.error('Erro na migração:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});