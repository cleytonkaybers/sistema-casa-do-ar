import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.company_id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { email, nome, role } = await req.json();

    // Validar se o usuário é admin/dono da empresa
    const usuarios = await base44.entities.UsuarioEmpresa.filter({
      company_id: user.company_id,
      email: user.email
    });

    if (usuarios.length === 0 || !['dono', 'admin'].includes(usuarios[0].role)) {
      return Response.json({ 
        error: 'Sem permissão para convidar usuários' 
      }, { status: 403 });
    }

    // Verificar limite de usuários do plano
    const empresa = await base44.asServiceRole.entities.EmpresaSaaS.filter({
      company_id: user.company_id
    });

    if (empresa.length === 0) {
      return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    const usuariosAtivos = await base44.entities.UsuarioEmpresa.filter({
      company_id: user.company_id,
      ativo: true
    });

    const planoLimites = {
      basico: 3,
      profissional: 10,
      premium: Infinity
    };

    const limite = planoLimites[empresa[0].plano] || 3;

    if (usuariosAtivos.length >= limite) {
      return Response.json({
        error: `Limite de usuários (${limite}) atingido para o plano ${empresa[0].plano}`
      }, { status: 400 });
    }

    // Criar convite
    const usuarioExistente = await base44.entities.UsuarioEmpresa.filter({
      company_id: user.company_id,
      email: email
    });

    if (usuarioExistente.length > 0) {
      return Response.json({
        error: 'Usuário já existe na empresa'
      }, { status: 400 });
    }

    const novoUsuario = await base44.entities.UsuarioEmpresa.create({
      company_id: user.company_id,
      email,
      nome: nome || email,
      role: role || 'funcionario',
      data_convite: new Date().toISOString()
    });

    // Enviar email de convite
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `Convite para ClimaSaaS - ${empresa[0].nome}`,
      body: `Olá ${nome || email},\n\nVocê foi convidado para fazer parte da equipe de ${empresa[0].nome} no ClimaSaaS.\n\nClique aqui para aceitar o convite: [LINK DO CONVITE]\n\nAte logo!`
    });

    return Response.json({
      sucesso: true,
      usuario: novoUsuario,
      mensagem: 'Convite enviado com sucesso'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});