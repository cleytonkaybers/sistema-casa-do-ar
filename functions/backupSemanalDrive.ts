import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function uploadToDrive(accessToken, fileName, content, mimeType = 'application/json') {
  const boundary = '-------314159265358979323846';
  const metadata = JSON.stringify({ name: fileName, mimeType });

  const bodyStart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const bodyEnd = `\r\n--${boundary}--`;

  const contentBytes = new TextEncoder().encode(content);
  const startBytes = new TextEncoder().encode(bodyStart);
  const endBytes = new TextEncoder().encode(bodyEnd);

  const fullBody = new Uint8Array(startBytes.length + contentBytes.length + endBytes.length);
  fullBody.set(startBytes, 0);
  fullBody.set(contentBytes, startBytes.length);
  fullBody.set(endBytes, startBytes.length + contentBytes.length);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: fullBody,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao enviar ${fileName}: ${err}`);
  }

  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite chamada por automação (sem usuário) ou por admin
    let isAutomation = false;
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
    } catch {
      // Chamada via automação agendada (sem token de usuário)
      isAutomation = true;
    }

    const db = base44.asServiceRole;
    const dateStr = new Date().toISOString().split('T')[0];

    // Buscar todas as 11 entidades em paralelo
    const [
      clientes,
      servicos,
      atendimentos,
      equipes,
      alteracoesStatus,
      notificacoes,
      preferenciasNotificacao,
      configuracoesRelatorio,
      relatoriosGerados,
      manutencoesPreventivas,
      usuarios,
    ] = await Promise.all([
      db.entities.Cliente.list('-created_date'),
      db.entities.Servico.list('-created_date'),
      db.entities.Atendimento.list('-created_date'),
      db.entities.Equipe.list('-created_date'),
      db.entities.AlteracaoStatus.list('-created_date'),
      db.entities.Notificacao.list('-created_date'),
      db.entities.PreferenciaNotificacao.list('-created_date'),
      db.entities.ConfiguracaoRelatorio.list('-created_date'),
      db.entities.RelatorioGerado.list('-created_date'),
      db.entities.ManutencaoPreventiva.list('-created_date'),
      db.entities.User.list(),
    ]);

    const backup = {
      data_backup: new Date().toISOString(),
      versao: '1.0',
      totais: {
        clientes: clientes.length,
        servicos: servicos.length,
        atendimentos: atendimentos.length,
        equipes: equipes.length,
        alteracoes_status: alteracoesStatus.length,
        notificacoes: notificacoes.length,
        preferencias_notificacao: preferenciasNotificacao.length,
        configuracoes_relatorio: configuracoesRelatorio.length,
        relatorios_gerados: relatoriosGerados.length,
        manutencoes_preventivas: manutencoesPreventivas.length,
        usuarios: usuarios.length,
      },
      dados: {
        clientes,
        servicos,
        atendimentos,
        equipes,
        alteracoes_status: alteracoesStatus,
        notificacoes,
        preferencias_notificacao: preferenciasNotificacao,
        configuracoes_relatorio: configuracoesRelatorio,
        relatorios_gerados: relatoriosGerados,
        manutencoes_preventivas: manutencoesPreventivas,
        usuarios,
      },
    };

    const { accessToken } = await db.connectors.getConnection('googledrive');

    const fileName = `backup_casa_do_ar_${dateStr}.json`;
    const file = await uploadToDrive(accessToken, fileName, JSON.stringify(backup, null, 2));

    const totalRegistros = Object.values(backup.totais).reduce((a, b) => a + b, 0);

    return Response.json({
      success: true,
      fileName,
      fileId: file.id,
      driveLink: `https://drive.google.com/file/d/${file.id}/view`,
      totalRegistros,
      totais: backup.totais,
      dataBackup: backup.data_backup,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});