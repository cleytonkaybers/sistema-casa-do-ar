import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (event.type !== 'update') {
      return Response.json({ success: true, message: 'Apenas edições são processadas' });
    }

    const clienteId = event.entity_id;
    const clienteNome = data.nome;
    const clienteTelefone = data.telefone;
    const clienteEndereco = data.endereco;
    const clienteLatitude = data.latitude;
    const clienteLongitude = data.longitude;

    // Campos que mudaram
    const camposMudaram = {
      nome: old_data?.nome !== data.nome,
      telefone: old_data?.telefone !== data.telefone,
      endereco: old_data?.endereco !== data.endereco,
      latitude: old_data?.latitude !== data.latitude,
      longitude: old_data?.longitude !== data.longitude
    };

    const algumCampoMudou = Object.values(camposMudaram).some(v => v);
    if (!algumCampoMudou) {
      return Response.json({ success: true, message: 'Nenhum campo relevante foi alterado' });
    }

    const nomeAntigo = old_data?.nome;

    // Atualizar Serviços
    if (camposMudaram.nome || camposMudaram.telefone || camposMudaram.endereco || camposMudaram.latitude || camposMudaram.longitude) {
      const servicos = await base44.asServiceRole.entities.Servico.filter({ cliente_nome: nomeAntigo });
      for (const servico of servicos) {
        const updateData = {};
        if (camposMudaram.nome) updateData.cliente_nome = clienteNome;
        if (camposMudaram.telefone) updateData.telefone = clienteTelefone;
        if (camposMudaram.endereco) updateData.endereco = clienteEndereco;
        if (camposMudaram.latitude) updateData.latitude = clienteLatitude;
        if (camposMudaram.longitude) updateData.longitude = clienteLongitude;
        await base44.asServiceRole.entities.Servico.update(servico.id, updateData);
      }
    }

    // Atualizar Atendimentos
    if (camposMudaram.nome || camposMudaram.telefone || camposMudaram.endereco || camposMudaram.latitude || camposMudaram.longitude) {
      const atendimentos = await base44.asServiceRole.entities.Atendimento.filter({ cliente_nome: nomeAntigo });
      for (const atendimento of atendimentos) {
        const updateData = {};
        if (camposMudaram.nome) updateData.cliente_nome = clienteNome;
        if (camposMudaram.telefone) updateData.telefone = clienteTelefone;
        if (camposMudaram.endereco) updateData.endereco = clienteEndereco;
        if (camposMudaram.latitude) updateData.latitude = clienteLatitude;
        if (camposMudaram.longitude) updateData.longitude = clienteLongitude;
        await base44.asServiceRole.entities.Atendimento.update(atendimento.id, updateData);
      }
    }

    // Atualizar PagamentosClientes
    if (camposMudaram.nome || camposMudaram.telefone) {
      const pagamentos = await base44.asServiceRole.entities.PagamentoCliente.filter({ cliente_nome: nomeAntigo });
      for (const pagamento of pagamentos) {
        const updateData = {};
        if (camposMudaram.nome) updateData.cliente_nome = clienteNome;
        if (camposMudaram.telefone) updateData.telefone = clienteTelefone;
        await base44.asServiceRole.entities.PagamentoCliente.update(pagamento.id, updateData);
      }
    }

    // Atualizar ManutençãoPreventiva (se existir)
    try {
      if (camposMudaram.nome || camposMudaram.telefone || camposMudaram.endereco) {
        const manutencoes = await base44.asServiceRole.entities.ManutencaoPreventiva.filter({ cliente_nome: nomeAntigo });
        for (const manutencao of manutencoes) {
          const updateData = {};
          if (camposMudaram.nome) updateData.cliente_nome = clienteNome;
          if (camposMudaram.telefone) updateData.telefone = clienteTelefone;
          if (camposMudaram.endereco) updateData.endereco = clienteEndereco;
          await base44.asServiceRole.entities.ManutencaoPreventiva.update(manutencao.id, updateData);
        }
      }
    } catch (e) {
      console.log('ManutencaoPreventiva não encontrada ou erro:', e.message);
    }

    return Response.json({ 
      success: true, 
      message: `Cliente ${clienteNome} sincronizado em todos os registros`
    });
  } catch (error) {
    console.error('Erro ao sincronizar cliente:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});