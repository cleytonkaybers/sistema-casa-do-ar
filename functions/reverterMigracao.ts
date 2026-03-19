import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Apenas cleyton pode reverter
    if (user.email !== 'cleyton_trylogya@hotmail.com') {
      return Response.json({ error: 'Apenas cleyton_trylogya@hotmail.com pode executar' }, { status: 403 });
    }

    const empresaAtualId = user.empresa_id;

    // Encontrar a empresa antiga de cleyton
    const empresasAntiga = await base44.asServiceRole.entities.Empresa.filter({
      created_by: 'cleyton_trylogya@hotmail.com'
    });

    if (empresasAntiga.length === 0) {
      return Response.json({ error: 'Empresa antiga não encontrada' }, { status: 404 });
    }

    const empresaAntiga = empresasAntiga[0];

    // Reverter clientes
    const clientes = await base44.asServiceRole.entities.Cliente.filter({
      empresa_id: empresaAtualId
    });

    const clientesRevertidos = await Promise.all(
      clientes.map(cliente =>
        base44.asServiceRole.entities.Cliente.update(cliente.id, {
          empresa_id: empresaAntiga.id
        })
      )
    );

    // Reverter serviços
    const servicos = await base44.asServiceRole.entities.Servico.filter({
      empresa_id: empresaAtualId
    });

    const servicosRevertidos = await Promise.all(
      servicos.map(servico =>
        base44.asServiceRole.entities.Servico.update(servico.id, {
          empresa_id: empresaAntiga.id
        })
      )
    );

    // Reverter atendimentos
    const atendimentos = await base44.asServiceRole.entities.Atendimento.filter({
      empresa_id: empresaAtualId
    });

    const atendimentosRevertidos = await Promise.all(
      atendimentos.map(atendimento =>
        base44.asServiceRole.entities.Atendimento.update(atendimento.id, {
          empresa_id: empresaAntiga.id
        })
      )
    );

    // Reverter preventivas
    const preventivas = await base44.asServiceRole.entities.PreventivaFutura.filter({
      empresa_id: empresaAtualId
    });

    const preventivasRevertidas = await Promise.all(
      preventivas.map(preventiva =>
        base44.asServiceRole.entities.PreventivaFutura.update(preventiva.id, {
          empresa_id: empresaAntiga.id
        })
      )
    );

    return Response.json({
      success: true,
      message: 'Reversão concluída com sucesso',
      resumo: {
        clientesRevertidos: clientesRevertidos.length,
        servicosRevertidos: servicosRevertidos.length,
        atendimentosRevertidos: atendimentosRevertidos.length,
        preventivasRevertidas: preventivasRevertidas.length
      }
    });
  } catch (error) {
    console.error('Erro na reversão:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});