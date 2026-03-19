import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar backups' }, { status: 403 });
    }

    // Buscar último backup completo
    const backups = await base44.asServiceRole.entities.BackupIncremental.list('-data_backup', 1);
    const ultimoBackup = backups[0];
    const agora = new Date();
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    // Definir entidades para backup incremental
    const entidades = [
      'Servico',
      'Atendimento',
      'Cliente',
      'LancamentoFinanceiro',
      'PagamentoTecnico',
      'AlteracaoStatus',
      'LogAuditoria'
    ];

    // Coletar apenas registros novos/alterados (últimas 24h)
    const dadosBackup = {};
    let totalRegistros = 0;

    for (const entidade of entidades) {
      try {
        const registros = await base44.asServiceRole.entities[entidade].list('-updated_date', 500);
        const registrosRecentes = registros.filter(r => {
          const dataAtualizacao = new Date(r.updated_date);
          return dataAtualizacao >= ontem;
        });

        if (registrosRecentes.length > 0) {
          dadosBackup[entidade] = registrosRecentes;
          totalRegistros += registrosRecentes.length;
        }
      } catch (error) {
        console.error(`Erro ao coletar ${entidade}:`, error);
      }
    }

    // Se não há mudanças, não fazer backup
    if (totalRegistros === 0) {
      return Response.json({
        status: 'skipped',
        message: 'Nenhuma alteração nas últimas 24h'
      });
    }

    // Preparar arquivo JSON
    const backupData = {
      tipo: 'incremental',
      data_backup: agora.toISOString(),
      periodo: {
        inicio: ontem.toISOString(),
        fim: agora.toISOString()
      },
      total_registros: totalRegistros,
      dados: dadosBackup
    };

    const jsonContent = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const fileName = `backup_incremental_${agora.toISOString().split('T')[0]}_${agora.getHours()}h.json`;

    // Upload para Google Drive
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    
    // Criar arquivo no Drive
    const metadata = {
      name: fileName,
      mimeType: 'application/json'
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error(`Erro no upload: ${uploadRes.status}`);
    }

    const fileData = await uploadRes.json();

    // Registrar backup na entidade
    await base44.asServiceRole.entities.BackupIncremental.create({
      data_backup: agora.toISOString(),
      tipo: 'incremental',
      entidades_backup: Object.keys(dadosBackup),
      total_registros: totalRegistros,
      arquivo_drive_id: fileData.id,
      arquivo_drive_url: `https://drive.google.com/file/d/${fileData.id}/view`,
      status: 'sucesso',
      tamanho_bytes: jsonContent.length
    });

    return Response.json({
      status: 'success',
      message: 'Backup incremental realizado com sucesso',
      total_registros: totalRegistros,
      arquivo: fileName,
      drive_url: `https://drive.google.com/file/d/${fileData.id}/view`
    });

  } catch (error) {
    console.error('Erro no backup incremental:', error);
    
    try {
      await base44.asServiceRole.entities.BackupIncremental.create({
        data_backup: new Date().toISOString(),
        tipo: 'incremental',
        status: 'erro',
        mensagem_erro: error.message
      });
    } catch {}

    return Response.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
});