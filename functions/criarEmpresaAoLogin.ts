import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar se o usuário já tem uma empresa associada
    const userWithEmpresa = await base44.asServiceRole.entities.User.filter({
      email: user.email
    });

    if (userWithEmpresa && userWithEmpresa.length > 0) {
      const userData = userWithEmpresa[0];
      
      // Se já tem empresa_id mas não é admin, atualizar para admin
      if (userData.empresa_id) {
        if (userData.tipo_usuario !== 'admin_empresa') {
          await base44.asServiceRole.entities.User.update(userData.id, {
            tipo_usuario: 'admin_empresa'
          });
        }
        return Response.json({ 
          message: 'Usuário já tem empresa', 
          empresa_id: userData.empresa_id,
          tipo_usuario: 'admin_empresa'
        });
      }

      // Criar uma nova empresa com o nome baseado no email
      const empresaNome = user.full_name || user.email.split('@')[0];
      
      const novaEmpresa = await base44.asServiceRole.entities.Empresa.create({
        nome: empresaNome,
        email: user.email,
        ativa: true,
        plano: 'profissional'
      });

      // Associar o usuário à empresa como admin
      await base44.asServiceRole.entities.User.update(userWithEmpresa[0].id, {
        empresa_id: novaEmpresa.id,
        tipo_usuario: 'admin_empresa',
        perfil: 'admin'
      });

      return Response.json({ 
        success: true,
        empresa_id: novaEmpresa.id,
        message: `Empresa criada com sucesso para ${empresaNome}`
      });
    }

    return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});