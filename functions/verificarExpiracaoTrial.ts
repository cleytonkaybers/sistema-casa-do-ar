import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Verifica e atualiza assinaturas trial expiradas
 * Pode ser executada como scheduled task
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar empresa do usuário
    const empresas = await base44.entities.EmpresaSaaS.filter({
      company_id: user.company_id
    });

    if (empresas.length === 0) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const empresa = empresas[0];
    const agora = new Date();

    // Se trial, verificar se expirou
    if (empresa.status_assinatura === 'trial') {
      const fimTrial = new Date(empresa.data_fim_trial);

      if (agora > fimTrial) {
        // Atualizar para vencida
        await base44.asServiceRole.entities.EmpresaSaaS.update(empresa.id, {
          status_assinatura: 'vencida'
        });

        // Log
        await base44.asServiceRole.entities.LogAuditoriaSaaS.create({
          company_id: user.company_id,
          usuario_email: 'sistema@climasaas.com',
          tipo_acao: 'trial_expirado_automatico',
          entidade: 'EmpresaSaaS',
          entidade_id: empresa.id,
          descricao: `Trial expirado em ${fimTrial.toISOString()}`
        });

        return Response.json({
          sucesso: true,
          acao: 'trial_expirado',
          mensagem: 'Assinatura marcada como vencida'
        });
      }

      const diasRestantes = Math.ceil((fimTrial - agora) / (1000 * 60 * 60 * 24));
      return Response.json({
        sucesso: true,
        acao: 'trial_ativo',
        diasRestantes,
        dataVencimento: fimTrial.toISOString()
      });
    }

    // Se ativa, verificar se venceu
    if (empresa.status_assinatura === 'ativa') {
      const proximaCobranca = new Date(empresa.data_proxima_cobranca);

      if (agora > proximaCobranca) {
        // Assinatura venceu
        await base44.asServiceRole.entities.EmpresaSaaS.update(empresa.id, {
          status_assinatura: 'vencida'
        });

        await base44.asServiceRole.entities.LogAuditoriaSaaS.create({
          company_id: user.company_id,
          usuario_email: 'sistema@climasaas.com',
          tipo_acao: 'assinatura_vencida_automatico',
          entidade: 'EmpresaSaaS',
          entidade_id: empresa.id,
          descricao: `Assinatura vencida em ${proximaCobranca.toISOString()}`
        });

        return Response.json({
          sucesso: true,
          acao: 'assinatura_vencida',
          mensagem: 'Assinatura marcada como vencida'
        });
      }

      const diasRestantes = Math.ceil((proximaCobranca - agora) / (1000 * 60 * 60 * 24));
      return Response.json({
        sucesso: true,
        acao: 'assinatura_ativa',
        diasRestantes,
        dataProximaCobranca: proximaCobranca.toISOString()
      });
    }

    return Response.json({
      sucesso: true,
      status: empresa.status_assinatura,
      mensagem: 'Empresa em dia'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});