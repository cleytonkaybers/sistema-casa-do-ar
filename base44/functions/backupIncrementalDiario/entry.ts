import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// BACKUP DIÁRIO COMPLETO.
// (Mantém o nome "backupIncrementalDiario" para não quebrar a automação já
// agendada no Base44.) ANTES esta função salvava só as alterações das últimas
// 24h — um arquivo pequeno que NÃO reconstrói o sistema. Agora gera um snapshot
// COMPLETO de todas as entidades, no formato v3.0 (compatível com a restauração
// da Central de Backup E com o app offline), para que nada seja perdido.

const FOLDER_NAME = 'Backup sistema casa do ar';

// [entidade, chave camelCase no arquivo] — as chaves batem com a Central de
// Backup (restauração online) e com o app offline.
const ENTIDADES: [string, string][] = [
  ['Cliente', 'clientes'],
  ['Servico', 'servicos'],
  ['Atendimento', 'atendimentos'],
  ['AlteracaoStatus', 'alteracaoStatus'],
  ['Agendamento', 'agendamentos'],
  ['Equipe', 'equipes'],
  ['TipoServicoValor', 'tipoServicoValor'],
  ['LancamentoFinanceiro', 'lancamentosFinanceiros'],
  ['PagamentoCliente', 'pagamentosClientes'],
  ['PagamentoTecnico', 'pagamentosTecnicos'],
  ['TecnicoFinanceiro', 'tecnicoFinanceiro'],
  ['Cheque', 'cheques'],
  ['Emprestimo', 'emprestimos'],
  ['ManutencaoPreventiva', 'manutencaoPreventiva'],
  ['Despesa', 'despesas'],
  ['CompanySettings', 'companySettings'],
  ['PDFSettings', 'pdfSettings'],
  ['ConfiguracaoRelatorio', 'configuracaoRelat'],
  ['Notificacao', 'notificacoes'],
  ['PreferenciaNotificacao', 'preferenciasNotif'],
  ['LogAuditoria', 'logsAuditoria'],
];

async function getOrCreateFolder(accessToken: string): Promise<string> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return (await createRes.json()).id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite execução por automação agendada (sem usuário) OU por admin.
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Apenas administradores podem executar backups' }, { status: 403 });
      }
    } catch {
      // Chamada via automação agendada (sem token de usuário) — permitido
    }

    const agora = new Date();
    const db = base44.asServiceRole;

    // Coleta TODOS os registros de cada entidade (sem filtro de 24h).
    const dataObj: Record<string, unknown[]> = {};
    const metadata: Record<string, number> = {};
    let totalRegistros = 0;

    for (let i = 0; i < ENTIDADES.length; i += 6) {
      const lote = ENTIDADES.slice(i, i + 6);
      await Promise.all(lote.map(async ([entidade, chave]) => {
        try {
          // PAGINA em blocos de 5000 (limite MAXIMO do Base44 por request).
          // Sem isso, o backup truncava em 5000 por entidade -> perderia dados
          // quando uma entidade (ex: Atendimento) passasse de 5000 registros.
          const PAGINA = 5000;
          const registros: unknown[] = [];
          for (let skip = 0; ; skip += PAGINA) {
            const lotePag = await db.entities[entidade].list('-created_date', PAGINA, skip);
            registros.push(...lotePag);
            if (lotePag.length < PAGINA) break; // ultima pagina
            if (skip > 500000) break;           // trava de seguranca (>500k)
          }
          dataObj[chave] = registros;
          metadata[`total_${chave}`] = registros.length;
          totalRegistros += registros.length;
        } catch (error) {
          console.error(`Erro ao coletar ${entidade}:`, error);
          dataObj[chave] = [];
          metadata[`total_${chave}`] = 0;
        }
      }));
    }

    // Arquivo no formato v3.0 (igual ao Exportar da Central de Backup).
    const backupData = {
      version: '3.0',
      app: 'Casa do Ar Antigravity',
      tipo: 'completo',
      exported_at: agora.toISOString(),
      data_backup: agora.toISOString(),
      total_registros: totalRegistros,
      entidades_exportadas: ENTIDADES.map(([, chave]) => chave),
      data: dataObj,
      metadata,
    };

    const jsonContent = JSON.stringify(backupData);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const fileName = `backup_completo_${agora.toISOString().split('T')[0]}_${agora.getHours()}h.json`;

    const { accessToken } = await db.connectors.getConnection('googledrive');
    const folderId = await getOrCreateFolder(accessToken);

    const metadataDrive = { name: fileName, mimeType: 'application/json', parents: [folderId] };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadataDrive)], { type: 'application/json' }));
    formData.append('file', blob);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      if (uploadRes.status === 403) {
        throw new Error('Erro no upload: 403 — sem permissao de gravar no Google Drive. Reconecte a conta Google no Base44 APROVANDO o acesso ao Drive (escopo drive.file).');
      }
      throw new Error(`Erro no upload: ${uploadRes.status}`);
    }

    const fileData = await uploadRes.json();

    await db.entities.BackupIncremental.create({
      data_backup: agora.toISOString(),
      tipo: 'completo',
      entidades_backup: ENTIDADES.map(([entidade]) => entidade),
      total_registros: totalRegistros,
      arquivo_drive_id: fileData.id,
      arquivo_drive_url: `https://drive.google.com/file/d/${fileData.id}/view`,
      status: 'sucesso',
      tamanho_bytes: jsonContent.length,
    });

    // Notificar ADMs com link do backup.
    try {
      const usuarios = await db.entities.User.list();
      const admins = usuarios.filter((u: { role: string; email: string }) => u?.role === 'admin' && u?.email);
      const driveUrl = `https://drive.google.com/file/d/${fileData.id}/view`;
      const tamanhoKb = Math.round(jsonContent.length / 1024);
      await Promise.all(admins.map((adm: { email: string }) =>
        db.entities.Notificacao.create({
          usuario_email: adm.email,
          tipo: 'atendimento_atualizado',
          titulo: `💾 Backup completo diário (${totalRegistros} registros)`,
          mensagem: `Snapshot COMPLETO do sistema salvo no Google Drive (pasta "${FOLDER_NAME}"). Arquivo: ${fileName} (${tamanhoKb}KB). Use este arquivo para restaurar ou no app offline. Link: ${driveUrl}`,
          cliente_nome: '',
          lida: false,
        }).catch((err: Error) => console.error('Falha notif admin', adm.email, err))
      ));
    } catch (e) {
      console.error('Erro notificando admins:', e);
    }

    return Response.json({
      status: 'success',
      message: 'Backup completo realizado com sucesso',
      total_registros: totalRegistros,
      arquivo: fileName,
      pasta: FOLDER_NAME,
      drive_url: `https://drive.google.com/file/d/${fileData.id}/view`,
    });

  } catch (error) {
    console.error('Erro no backup diário:', error);
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.BackupIncremental.create({
        data_backup: new Date().toISOString(),
        tipo: 'completo',
        status: 'erro',
        mensagem_erro: (error as Error).message,
      });
    } catch {}
    return Response.json({ status: 'error', message: (error as Error).message }, { status: 500 });
  }
});
