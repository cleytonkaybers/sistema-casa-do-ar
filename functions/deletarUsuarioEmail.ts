import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Apenas admin pode deletar usuários
    if (user.tipo_usuario !== 'admin_empresa' && user.tipo_usuario !== 'super_admin') {
      return Response.json({ error: 'Apenas admin pode deletar usuários' }, { status: 403 });
    }

    const emailDeletar = 'casadoarclima@gmail.com';

    // Buscar usuário por email
    const usuarios = await base44.asServiceRole.entities.User.filter({
      email: emailDeletar
    });

    if (usuarios.length === 0) {
      return Response.json({ 
        message: 'Usuário não encontrado',
        email: emailDeletar
      });
    }

    // Deletar usuário
    await base44.asServiceRole.entities.User.delete(usuarios[0].id);

    return Response.json({
      success: true,
      message: `Usuário ${emailDeletar} deletado com sucesso`
    });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});