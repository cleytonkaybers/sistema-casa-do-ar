import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Retenção: remove LOGS antigos (puramente históricos) para o banco não inchar
// e o app não travar com o tempo. Mantém os últimos N meses (padrão 12).
// Os dados continuam preservados no BACKUP COMPLETO diário.
//
// Modo seguro:
// - apenas_contar: true  -> NÃO apaga nada, só retorna quantos seriam removidos (dry-run).
// - Antes de apagar, exige um backup COMPLETO com sucesso nos últimos 2 dias.
//
// Agende para rodar 1x/semana na automação do Base44.

const ENTIDADES_LOG = ['AlteracaoStatus', 'LogAuditoria', 'Notificacao'];
const PAGINA = 5000; // limite máximo do Base44 por request

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite execução por automação agendada (sem usuário) OU por admin.
    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Apenas administradores podem limpar logs' }, { status: 403 });
      }
    } catch {
      // automação agendada (sem token) — permitido
    }

    let meses = 12;
    let apenasContar = false;
    try {
      const body = await req.json();
      if (typeof body?.meses === 'number' && body.meses > 0) meses = body.meses;
      apenasContar = body?.apenas_contar === true;
    } catch { /* sem body — usa padrões */ }

    const db = base44.asServiceRole;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - meses);
    const cutoffISO = cutoff.toISOString();

    // SEGURANÇA: só apaga se houver backup COMPLETO recente (<= 2 dias) com sucesso.
    if (!apenasContar) {
      const backups = await db.entities.BackupIncremental
        .filter({ tipo: 'completo', status: 'sucesso' }, '-data_backup', 1)
        .catch(() => []);
      const ultimo = backups?.[0];
      const recente = ultimo && (Date.now() - new Date(ultimo.data_backup).getTime()) <= 2 * 24 * 60 * 60 * 1000;
      if (!recente) {
        return Response.json({
          status: 'abortado',
          message: 'Sem backup COMPLETO recente (<= 2 dias). Rode o backup completo antes de limpar logs.',
        }, { status: 409 });
      }
    }

    const resultado: Record<string, number> = {};
    let total = 0;

    for (const entidade of ENTIDADES_LOG) {
      let contador = 0;
      try {
        if (apenasContar) {
          // DRY-RUN: pagina com skip e soma (não apaga)
          for (let skip = 0; skip < 1_000_000; skip += PAGINA) {
            const lote = await db.entities[entidade]
              .filter({ created_date: { $lt: cutoffISO } }, 'created_date', PAGINA, skip);
            contador += lote.length;
            if (lote.length < PAGINA) break;
          }
        } else {
          // APAGA: busca a 1ª página de antigos e deleta; repete até esvaziar
          for (let iter = 0; iter < 300; iter++) {
            const antigos = await db.entities[entidade]
              .filter({ created_date: { $lt: cutoffISO } }, 'created_date', PAGINA);
            if (!antigos || antigos.length === 0) break;
            for (let i = 0; i < antigos.length; i += 50) {
              await Promise.all(
                antigos.slice(i, i + 50).map((r: { id: string }) =>
                  db.entities[entidade].delete(r.id).catch(() => {})
                )
              );
            }
            contador += antigos.length;
            if (antigos.length < PAGINA) break;
          }
        }
      } catch (e) {
        console.error(`Erro ao limpar ${entidade}:`, e);
      }
      resultado[entidade] = contador;
      total += contador;
    }

    return Response.json({
      status: 'success',
      modo: apenasContar ? 'contagem (dry-run)' : 'limpeza',
      meses_retidos: meses,
      corte: cutoffISO,
      total: apenasContar ? `${total} registros seriam removidos` : `${total} registros removidos`,
      por_entidade: resultado,
    });

  } catch (error) {
    console.error('Erro na limpeza de logs:', error);
    return Response.json({ status: 'error', message: (error as Error).message }, { status: 500 });
  }
});
