import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar todos os backups ordenados do mais recente para o mais antigo
    const backups = await base44.asServiceRole.entities.BackupIncremental.list('-data_backup');

    // Manter apenas os últimos 5 dias — backups além do 5º são removidos
    const MANTER = 5;
    const backupsAntigos = backups.slice(MANTER);

    if (backupsAntigos.length === 0) {
      return Response.json({
        status: 'success',
        message: 'Nenhum backup antigo para remover',
        total_removidos: 0
      });
    }

    // Obter conexão com Google Drive
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    let removidos = 0;
    const erros = [];

    for (const backup of backupsAntigos) {
      try {
        // Deletar arquivo do Google Drive se existir
        if (backup.arquivo_drive_id) {
          const driveResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${backup.arquivo_drive_id}`,
            {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }
          );

          if (!driveResponse.ok && driveResponse.status !== 404) {
            throw new Error(`Erro ao deletar arquivo do Drive: ${driveResponse.status}`);
          }
        }

        // Deletar registro do banco
        await base44.asServiceRole.entities.BackupIncremental.delete(backup.id);
        removidos++;
      } catch (error) {
        erros.push({
          backup_id: backup.id,
          data: backup.data_backup,
          erro: error.message
        });
      }
    }

    return Response.json({
      status: 'success',
      message: `Limpeza concluída: ${removidos} backups removidos (mantidos os últimos ${MANTER})`,
      total_antigos: backupsAntigos.length,
      total_removidos: removidos,
      erros: erros.length > 0 ? erros : undefined
    });

  } catch (error) {
    console.error('Erro na limpeza de backups:', error);
    return Response.json({
      status: 'error',
      message: error.message
    }, { status: 500 });
  }
});