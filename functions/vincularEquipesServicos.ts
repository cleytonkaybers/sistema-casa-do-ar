import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem vincular equipes' }, { status: 403 });
    }

    // Buscar todas as equipes
    const equipes = await base44.entities.Equipe.list();
    if (equipes.length === 0) {
      return Response.json({ error: 'Nenhuma equipe disponível' }, { status: 400 });
    }

    const equipePadrao = equipes[0];

    // Buscar todos os serviços sem equipe_id
    const todosServicos = await base44.entities.Servico.list();
    const servicosSemEquipe = todosServicos.filter(s => !s.equipe_id);

    let vinculados = 0;
    let erros = [];

    // Vincular cada serviço sem equipe à equipe padrão
    for (const servico of servicosSemEquipe) {
      try {
        await base44.entities.Servico.update(servico.id, {
          equipe_id: equipePadrao.id,
          equipe_nome: equipePadrao.nome
        });
        vinculados++;
      } catch (error) {
        erros.push(`Erro ao vincular serviço ${servico.id}: ${error.message}`);
      }
    }

    return Response.json({
      sucesso: true,
      vinculados,
      totalSemEquipe: servicosSemEquipe.length,
      equipePadrao: equipePadrao.nome,
      erros,
      mensagem: `${vinculados} serviços vinculados à equipe "${equipePadrao.nome}"`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});