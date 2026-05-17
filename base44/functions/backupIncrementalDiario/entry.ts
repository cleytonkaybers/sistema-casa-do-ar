import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const FOLDER_NAME = 'Backup sistema casa do ar';

async function getOrCreateFolder(accessToken) {
  // Buscar pasta existente
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Criar pasta se não existir
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const folderData = await createRes.json();
  return folderData.id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verificar admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar backups' }, { status: 403 });
    }

    const agora = new Date();
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    // Definir entidades para backup incremental — TODAS as entidades de
    // dados operacionais (excluindo entidades SaaS multi-tenant e logs muito
    // grandes). Aumentado de 7 para 21 entidades para cobrir tudo que importa.
    const entidades = [
      'Servico',
      'Atendimento',
      'Cliente',
      'Agendamento',
      'Equipe',
      'LancamentoFinanceiro',
      'PagamentoCliente',
      'PagamentoTecnico',
      'TecnicoFinanceiro',
      'Cheque',
      'Emprestimo',
      'ManutencaoPreventiva',
      'TipoServicoValor',
      'CompanySettings',
      'ConfiguracaoRelatorio',
      'Despesa',
      'AlteracaoStatus',
      'LogAuditoria',
      'Notificacao',
      'PreferenciaNotificacao',
      'PDFSettings',
    ];

    // Coletar apenas registros novos/alterados (últimas 24h)
    const dadosBackup = {};
    let totalRegistros = 0;

    for (const entidade of entidades) {
      try {
        // limit 5000 (era 500) — cobre operacao normal de 1 dia mesmo em volume alto
        const registros = await base44.asServiceRole.entities[entidade].list('-updated_date', 5000);
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
    const fileName = `backup_${agora.toISOString().split('T')[0]}_${agora.getHours()}h.json`;

    // Obter token e pasta no Drive
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    const folderId = await getOrCreateFolder(accessToken);

    // Upload para a pasta correta
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [folderId]
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
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

    // Notificar ADMs com link do backup (substitui email — Base44 nao tem
    // conector SMTP nativo, mas a notificacao aparece no sino do app).
    try {
      const usuarios = await base44.asServiceRole.entities.User.list();
      const admins = usuarios.filter(u => u?.role === 'admin' && u?.email);
      const driveUrl = `https://drive.google.com/file/d/${fileData.id}/view`;
      const tamanhoKb = Math.round(jsonContent.length / 1024);
      await Promise.all(admins.map(adm =>
        base44.asServiceRole.entities.Notificacao.create({
          usuario_email: adm.email,
          tipo: 'atendimento_atualizado',
          titulo: `💾 Backup diário concluído (${totalRegistros} registros)`,
          mensagem: `Backup das últimas 24h salvo no Google Drive (pasta "${FOLDER_NAME}"). Arquivo: ${fileName} (${tamanhoKb}KB). Link: ${driveUrl}`,
          cliente_nome: '',
          lida: false,
        }).catch(err => console.error('Falha notif admin', adm.email, err))
      ));
    } catch (e) {
      console.error('Erro notificando admins:', e);
    }

    return Response.json({
      status: 'success',
      message: 'Backup incremental realizado com sucesso',
      total_registros: totalRegistros,
      arquivo: fileName,
      pasta: FOLDER_NAME,
      drive_url: `https://drive.google.com/file/d/${fileData.id}/view`
    });

  } catch (error) {
    console.error('Erro no backup incremental:', error);

    try {
      const base44 = createClientFromRequest(req);
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