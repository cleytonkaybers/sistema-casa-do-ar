import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar empresa
    const empresas = await base44.entities.EmpresaSaaS.filter({
      company_id: user.company_id
    });

    if (empresas.length === 0) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const empresa = empresas[0];

    // Verificar status de bloqueio
    if (empresa.bloqueada) {
      return Response.json({
        valida: false,
        motivo: 'empresa_bloqueada',
        detalhes: empresa.motivo_bloqueio
      });
    }

    // Verificar assinatura
    if (empresa.status_assinatura === 'vencida') {
      return Response.json({
        valida: false,
        motivo: 'assinatura_vencida',
        proxima_cobranca: empresa.data_proxima_cobranca
      });
    }

    // Se é trial, verificar se ainda está válido
    if (empresa.status_assinatura === 'trial') {
      const agora = new Date();
      const fimTrial = new Date(empresa.data_fim_trial);

      if (agora > fimTrial) {
        // Atualizar para vencida
        await base44.asServiceRole.entities.EmpresaSaaS.update(empresa.id, {
          status_assinatura: 'vencida'
        });

        return Response.json({
          valida: false,
          motivo: 'trial_expirado'
        });
      }

      const diasRestantes = Math.ceil((fimTrial - agora) / (1000 * 60 * 60 * 24));
      return Response.json({
        valida: true,
        status: 'trial',
        diasRestantes,
        empresa: {
          id: empresa.id,
          nome: empresa.nome,
          plano: empresa.plano,
          usuarios_ativos: empresa.usuarios_ativos
        }
      });
    }

    // Assinatura ativa
    return Response.json({
      valida: true,
      status: 'ativa',
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        plano: empresa.plano,
        proxima_cobranca: empresa.data_proxima_cobranca,
        usuarios_ativos: empresa.usuarios_ativos
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});