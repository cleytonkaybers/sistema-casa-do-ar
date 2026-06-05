// Backup COMPLETO diário — gera snapshot de TODAS as entidades operacionais
// e salva no Google Drive na mesma pasta do backup semanal.
// Deve ser agendado 1×/dia na automação do Base44.
// O arquivo gerado alimenta o modo offline (CasaDoAr-Offline.html).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FOLDER_NAME = 'Backup sistema casa do ar';

async function getOrCreateFolder(accessToken: string): Promise<string> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return (await createRes.json()).id;
}

async function uploadToDrive(accessToken: string, fileName: string, content: string, folderId: string) {
  const boundary = '-------314159265358979323846';
  const metadata = JSON.stringify({ name: fileName, mimeType: 'application/json', parents: [folderId] });
  const bodyStart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`;
  const bodyEnd = `\r\n--${boundary}--`;
  const contentBytes = new TextEncoder().encode(content);
  const startBytes = new TextEncoder().encode(bodyStart);
  const endBytes = new TextEncoder().encode(bodyEnd);
  const fullBody = new Uint8Array(startBytes.length + contentBytes.length + endBytes.length);
  fullBody.set(startBytes, 0);
  fullBody.set(contentBytes, startBytes.length);
  fullBody.set(endBytes, startBytes.length + contentBytes.length);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
    body: fullBody,
  });
  if (!res.ok) throw new Error(`Upload falhou: ${await res.text()}`);
  return await res.json();
}

// Todas as entidades operacionais (mesmo conjunto da Central de Backup)
const ENTIDADES = [
  { key: 'clientes',               entity: 'Cliente' },
  { key: 'servicos',               entity: 'Servico' },
  { key: 'atendimentos',           entity: 'Atendimento' },
  { key: 'alteracaoStatus',        entity: 'AlteracaoStatus' },
  { key: 'agendamentos',           entity: 'Agendamento' },
  { key: 'equipes',                entity: 'Equipe' },
  { key: 'tipoServicoValor',       entity: 'TipoServicoValor' },
  { key: 'lancamentosFinanceiros', entity: 'LancamentoFinanceiro' },
  { key: 'pagamentosClientes',     entity: 'PagamentoCliente' },
  { key: 'pagamentosTecnicos',     entity: 'PagamentoTecnico' },
  { key: 'tecnicoFinanceiro',      entity: 'TecnicoFinanceiro' },
  { key: 'cheques',                entity: 'Cheque' },
  { key: 'emprestimos',            entity: 'Emprestimo' },
  { key: 'manutencaoPreventiva',   entity: 'ManutencaoPreventiva' },
  { key: 'companySettings',        entity: 'CompanySettings' },
  { key: 'pdfSettings',            entity: 'PDFSettings' },
  { key: 'notificacoes',           entity: 'Notificacao' },
  { key: 'preferenciasNotif',      entity: 'PreferenciaNotificacao' },
  { key: 'configuracaoRelat',      entity: 'ConfiguracaoRelatorio' },
  { key: 'relatoriosGerados',      entity: 'RelatorioGerado' },
  { key: 'logsAuditoria',          entity: 'LogAuditoria' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite chamada por automação agendada (sem token) ou por admin
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Apenas administradores podem executar backups' }, { status: 403 });
      }
    } catch {
      // automação agendada sem token — permitido
    }

    const agora = new Date();
    const dateStr = agora.toISOString().split('T')[0];
    const db = base44.asServiceRole;

    // Coleta todas as entidades em paralelo (lotes de 6 para não sobrecarregar)
    const dataObj: Record<string, unknown[]> = {};
    const metaObj: Record<string, number> = {};
    let totalRegistros = 0;

    for (let i = 0; i < ENTIDADES.length; i += 6) {
      const lote = ENTIDADES.slice(i, i + 6);
      await Promise.all(lote.map(async ({ key, entity }) => {
        try {
          const records = await db.entities[entity].list('-created_date', 50000);
          dataObj[key] = records;
          metaObj[`total_${key}`] = records.length;
          totalRegistros += records.length;
        } catch (e) {
          console.error(`Erro ao coletar ${entity}:`, e);
          dataObj[key] = [];
          metaObj[`total_${key}`] = 0;
        }
      }));
    }

    const backup = {
      version: '3.0',
      app: 'Casa do Ar Antigravity',
      exported_at: agora.toISOString(),
      exported_by: 'backup_completo_diario',
      tipo: 'completo',
      entidades_exportadas: ENTIDADES.map(e => e.key),
      total_registros: totalRegistros,
      data: dataObj,
      metadata: metaObj,
    };

    const jsonContent = JSON.stringify(backup, null, 2);
    const fileName = `backup_casa_do_ar_${dateStr}.json`;

    const { accessToken } = await db.connectors.getConnection('googledrive');
    const folderId = await getOrCreateFolder(accessToken);
    const file = await uploadToDrive(accessToken, fileName, jsonContent, folderId);

    // Registrar na entidade BackupIncremental (reutiliza o mesmo registro histórico)
    await db.entities.BackupIncremental.create({
      data_backup: agora.toISOString(),
      tipo: 'completo',
      entidades_backup: ENTIDADES.map(e => e.entity),
      total_registros: totalRegistros,
      arquivo_drive_id: file.id,
      arquivo_drive_url: `https://drive.google.com/file/d/${file.id}/view`,
      status: 'sucesso',
      tamanho_bytes: jsonContent.length,
    });

    // Notificar ADMs
    try {
      const usuarios = await db.entities.User.list();
      const admins = usuarios.filter((u: { role: string; email: string }) => u?.role === 'admin' && u?.email);
      const tamanhoKb = Math.round(jsonContent.length / 1024);
      await Promise.all(admins.map((adm: { email: string }) =>
        db.entities.Notificacao.create({
          usuario_email: adm.email,
          tipo: 'atendimento_atualizado',
          titulo: `💾 Backup completo diário (${totalRegistros} registros)`,
          mensagem: `Backup completo salvo no Google Drive (pasta "${FOLDER_NAME}"). Arquivo: ${fileName} (${tamanhoKb}KB). Use este arquivo para o modo offline. Link: https://drive.google.com/file/d/${file.id}/view`,
          cliente_nome: '',
          lida: false,
        }).catch((e: Error) => console.error('Falha notif admin', adm.email, e))
      ));
    } catch (e) {
      console.error('Erro notificando admins:', e);
    }

    return Response.json({
      status: 'success',
      message: 'Backup completo diário realizado com sucesso',
      total_registros: totalRegistros,
      arquivo: fileName,
      pasta: FOLDER_NAME,
      drive_url: `https://drive.google.com/file/d/${file.id}/view`,
    });

  } catch (error) {
    console.error('Erro no backup completo diário:', error);
    return Response.json({ status: 'error', message: (error as Error).message }, { status: 500 });
  }
});
