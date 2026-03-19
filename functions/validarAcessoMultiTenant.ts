import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Middleware de validação multi-tenant
 * Valida que o usuário tem acesso ao company_id fornecido
 */
export async function validarAcessoMultiTenant(req, companyIdRequerido) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      throw new Error('Usuário não autenticado ou sem empresa associada');
    }

    // Validar que o company_id do usuário corresponde ao solicitado
    if (user.company_id !== companyIdRequerido) {
      throw new Error('Acesso negado: empresa não autorizada');
    }

    // Verificar se a empresa existe e está ativa
    const empresas = await base44.asServiceRole.entities.EmpresaSaaS.filter({
      company_id: companyIdRequerido
    });

    if (empresas.length === 0) {
      throw new Error('Empresa não encontrada');
    }

    const empresa = empresas[0];

    // Validar status da assinatura
    if (empresa.bloqueada) {
      throw new Error('Empresa bloqueada');
    }

    if (empresa.status_assinatura === 'vencida') {
      throw new Error('Assinatura vencida');
    }

    return { user, empresa, autorizado: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Aplicar filtro automático de company_id em queries
 */
export function filtrarPorCompanyId(query, companyId) {
  if (!query) {
    return { company_id: companyId };
  }
  return { ...query, company_id: companyId };
}

Deno.serve(async (req) => {
  // Este arquivo contém apenas funções helper, não é um endpoint
  return Response.json({ error: 'Use as funções exportadas' }, { status: 400 });
});