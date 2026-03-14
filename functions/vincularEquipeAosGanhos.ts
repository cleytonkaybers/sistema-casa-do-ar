import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar todos os ganhos
    const ganhos = await base44.asServiceRole.entities.GanhoTecnico.list();
    console.log(`Total de ganhos: ${ganhos.length}`);

    // Buscar todos os serviços
    const servicos = await base44.asServiceRole.entities.Servico.list();
    console.log(`Total de serviços: ${servicos.length}`);

    let ganhosAtualizados = 0;
    let ganhosSemEquipe = 0;

    // Para cada ganho, buscar o serviço correspondente e atualizar equipe
    for (const ganho of ganhos) {
      // Pular se já tem equipe_id
      if (ganho.equipe_id) {
        console.log(`Ganho ${ganho.id} já tem equipe_id: ${ganho.equipe_id}`);
        continue;
      }

      // Buscar o serviço pelo atendimento_id (que é o ID do serviço original)
      const servico = servicos.find(s => s.id === ganho.atendimento_id);

      if (servico && servico.equipe_id) {
        await base44.asServiceRole.entities.GanhoTecnico.update(ganho.id, {
          equipe_id: servico.equipe_id,
          equipe_nome: servico.equipe_nome
        });
        console.log(`Ganho ${ganho.id} atualizado com equipe ${servico.equipe_nome}`);
        ganhosAtualizados++;
      } else {
        console.log(`Ganho ${ganho.id} - serviço não encontrado ou sem equipe`);
        ganhosSemEquipe++;
      }
    }

    return Response.json({
      sucesso: true,
      totalGanhos: ganhos.length,
      ganhosAtualizados,
      ganhosSemEquipe,
      mensagem: `${ganhosAtualizados} ganhos vinculados às equipes`
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});