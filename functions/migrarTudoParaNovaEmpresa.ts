import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Apenas o usuário original pode executar
    if (user.email !== 'cleyton_trylogya@hotmail.com') {
      return Response.json({ error: 'Apenas cleyton_trylogya@hotmail.com pode executar' }, { status: 403 });
    }

    const empresaAtual = user.empresa_id;
    const novoAdminEmail = 'casadoarclima@gmail.com';

    // 1. Buscar ou criar empresa para o novo admin
    let empresaNova = null;
    const empresasNovoAdmin = await base44.asServiceRole.entities.Empresa.filter({
      created_by: novoAdminEmail
    });
    
    if (empresasNovoAdmin.length === 0) {
      empresaNova = await base44.asServiceRole.entities.Empresa.create({
        nome: 'Casa do Ar'
      });
    } else {
      empresaNova = empresasNovoAdmin[0];
    }

    // 2. Migrar clientes
    const clientes = await base44.asServiceRole.entities.Cliente.filter({
      empresa_id: empresaAtual
    });

    let clientesMigrados = 0;
    if (clientes.length > 0) {
      await Promise.all(
        clientes.map(cliente =>
          base44.asServiceRole.entities.Cliente.update(cliente.id, {
            empresa_id: empresaNova.id
          })
        )
      );
      clientesMigrados = clientes.length;
    }

    // 3. Migrar serviços
    const servicos = await base44.asServiceRole.entities.Servico.filter({
      empresa_id: empresaAtual
    });

    let servicosMigrados = 0;
    if (servicos.length > 0) {
      await Promise.all(
        servicos.map(servico =>
          base44.asServiceRole.entities.Servico.update(servico.id, {
            empresa_id: empresaNova.id
          })
        )
      );
      servicosMigrados = servicos.length;
    }

    // 4. Migrar atendimentos
    const atendimentos = await base44.asServiceRole.entities.Atendimento.filter({
      empresa_id: empresaAtual
    });

    let atendimentosMigrados = 0;
    if (atendimentos.length > 0) {
      await Promise.all(
        atendimentos.map(atendimento =>
          base44.asServiceRole.entities.Atendimento.update(atendimento.id, {
            empresa_id: empresaNova.id
          })
        )
      );
      atendimentosMigrados = atendimentos.length;
    }

    return Response.json({
      success: true,
      message: 'Migração concluída com sucesso',
      resumo: {
        empresaId: empresaNova.id,
        empresaNome: empresaNova.nome,
        clientesMigrados,
        servicosMigrados,
        atendimentosMigrados,
        preventivasMigradas: 0,
        usuariosMigrados: 0
      }
    });
  } catch (error) {
    console.error('Erro na migração:', error);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});