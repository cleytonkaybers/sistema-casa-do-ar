import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import ExcelJS from 'npm:exceljs@4.4.0';

const FOLDER_NAME = 'Relatorios Cobranca Casa do Ar';
const RETENCAO_DIAS = 7;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

async function uploadToDrive(
  accessToken: string,
  fileName: string,
  fileBytes: Uint8Array,
  folderId: string,
  mimeType: string
) {
  const boundary = '-------314159265358979323846';
  const metadata = JSON.stringify({ name: fileName, mimeType, parents: [folderId] });

  const bodyStart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const bodyEnd   = `\r\n--${boundary}--`;
  const startBytes = new TextEncoder().encode(bodyStart);
  const endBytes   = new TextEncoder().encode(bodyEnd);

  const fullBody = new Uint8Array(startBytes.length + fileBytes.length + endBytes.length);
  fullBody.set(startBytes, 0);
  fullBody.set(fileBytes, startBytes.length);
  fullBody.set(endBytes, startBytes.length + fileBytes.length);

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
  if (!res.ok) throw new Error(`Falha ao enviar ${fileName} para o Drive: ${await res.text()}`);
  return await res.json();
}

async function deleteFromDrive(accessToken: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Falha ao deletar ${fileId}: ${res.status}`);
  }
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

const fmtData = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
};

const fmtDataHora = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const fmtTelefone = (tel?: string) => {
  if (!tel) return '-';
  const c = tel.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return tel;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Agrupa "X + X + Y" → "2x X, Y"
const fmtTipoServico = (t?: string): string => {
  if (!t) return '';
  const parts = t.split('+').map(s => s.trim()).filter(Boolean);
  const counts: Record<string, number> = {};
  for (const part of parts) counts[part] = (counts[part] || 0) + 1;
  return Object.entries(counts)
    .map(([name, count]) => (count > 1 ? `${count}x ${name}` : name))
    .join(', ');
};

// ─── Agrupamento por cliente ──────────────────────────────────────────────────

function agruparPorCliente(lista: any[]): any[] {
  const mapa = new Map<string, any>();
  for (const p of lista) {
    const chave = `${(p.cliente_nome || '').trim().toLowerCase()}||${(p.telefone || '').replace(/\D/g, '')}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        cliente_nome: p.cliente_nome || '-',
        telefone: p.telefone || '',
        valor_total: 0,
        valor_pago: 0,
        servicos: [] as string[],
        data_pagamento_agendado: p.data_pagamento_agendado || null,
        observacoes: [] as string[],
      });
    }
    const reg = mapa.get(chave)!;
    reg.valor_total += p.valor_total || 0;
    reg.valor_pago  += p.valor_pago  || 0;
    if (p.tipo_servico) {
      reg.servicos.push(`${fmtTipoServico(p.tipo_servico)} (${fmtData(p.data_conclusao)} — ${fmtBRL(p.valor_total || 0)})`);
    }
    if (p.observacoes) reg.observacoes.push(p.observacoes);
    if (
      p.data_pagamento_agendado &&
      (!reg.data_pagamento_agendado || p.data_pagamento_agendado > reg.data_pagamento_agendado)
    ) {
      reg.data_pagamento_agendado = p.data_pagamento_agendado;
    }
  }
  // Ordena por maior saldo devedor
  return Array.from(mapa.values()).sort(
    (a, b) => (b.valor_total - b.valor_pago) - (a.valor_total - a.valor_pago)
  );
}

// ─── Geração do Excel ─────────────────────────────────────────────────────────

async function gerarExcel(
  pendentes: any[],
  parciais: any[],
  agendados: any[],
  totais: { total: number; totalDevido: number }
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Casa do Ar — Sistema';
  wb.created  = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet('Cobrança', {
    properties: { defaultColWidth: 18 },
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  // Larguras de coluna (em caracteres)
  ws.columns = [
    { width: 32 }, // A — Cliente
    { width: 18 }, // B — Telefone
    { width: 16 }, // C — Pagar em / Serviços (flex)
    { width: 52 }, // D — Serviços realizados
    { width: 16 }, // E — Total
    { width: 16 }, // F — Pago
    { width: 16 }, // G — Saldo
    { width: 40 }, // H — Obs
  ];

  // Estilos reutilizáveis
  const styleTitle: Partial<ExcelJS.Style> = {
    font:      { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  };
  const styleSubtitle: Partial<ExcelJS.Style> = {
    font:      { size: 9, color: { argb: 'FFAAB4C4' } },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  };
  const styleSummaryLabel: Partial<ExcelJS.Style> = {
    font:      { bold: true, size: 10 },
    alignment: { vertical: 'middle' },
  };
  const styleTotal: Partial<ExcelJS.Style> = {
    font:      { bold: true, size: 12, color: { argb: 'FFB41E1E' } },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } },
    alignment: { vertical: 'middle' },
  };

  const makeSecaoHeader = (argb: string): Partial<ExcelJS.Style> => ({
    font:      { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  });
  const makeColHeader = (argb: string): Partial<ExcelJS.Style> => ({
    font:      { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    },
  });
  const styleCurrency: Partial<ExcelJS.Style> = {
    numFmt:    'R$ #,##0.00',
    alignment: { horizontal: 'right', vertical: 'middle' },
  };
  const styleSaldo: Partial<ExcelJS.Style> = {
    numFmt:    'R$ #,##0.00',
    font:      { bold: true },
    alignment: { horizontal: 'right', vertical: 'middle' },
  };
  const styleData: Partial<ExcelJS.Style> = {
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  const styleWrap: Partial<ExcelJS.Style> = {
    alignment: { wrapText: true, vertical: 'top' },
  };
  const styleRowEven: Partial<ExcelJS.Style> = {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } },
  };

  const NUM_COLS = 8;
  const applyRowBorder = (row: ExcelJS.Row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } },
        left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };
    });
  };

  // ── Linha 1: Título ───────────────────────────────────────────────────────
  const rowTitle = ws.addRow(['RELATÓRIO DE COBRANÇA — CASA DO AR']);
  rowTitle.height = 28;
  ws.mergeCells(`A1:H1`);
  Object.assign(rowTitle.getCell(1), styleTitle);

  // ── Linha 2: Data de geração ───────────────────────────────────────────────
  const rowSub = ws.addRow([`Gerado em: ${fmtDataHora(new Date().toISOString())}`]);
  rowSub.height = 16;
  ws.mergeCells(`A2:H2`);
  Object.assign(rowSub.getCell(1), styleSubtitle);

  // ── Linha 3: Resumo ────────────────────────────────────────────────────────
  const agrupPend = agruparPorCliente(pendentes);
  const agrupParc = agruparPorCliente(parciais);
  const agrupAgen = agruparPorCliente(agendados);

  const rowRes = ws.addRow([
    `Clientes em aberto: ${totais.total}`,
    '',
    `Agendados: ${agrupAgen.length}`,
    `Parciais: ${agrupParc.length}`,
    `Pendentes: ${agrupPend.length}`,
  ]);
  rowRes.height = 18;
  ws.mergeCells('A3:B3');
  rowRes.getCell(1).style = styleSummaryLabel;

  // ── Linha 4: Total devido ──────────────────────────────────────────────────
  const rowTot = ws.addRow([`TOTAL DEVIDO: ${fmtBRL(totais.totalDevido)}`]);
  rowTot.height = 20;
  ws.mergeCells('A4:H4');
  Object.assign(rowTot.getCell(1), styleTotal);

  // ── Linha 5: Espaço ────────────────────────────────────────────────────────
  ws.addRow([]);

  // ── Renderiza uma seção ────────────────────────────────────────────────────
  const renderSecao = (
    titulo: string,
    agrupada: any[],
    corArgb: string,
    mostrarAgendado: boolean
  ) => {
    if (!agrupada.length) return;

    const totalSaldo = agrupada.reduce(
      (s, p) => s + ((p.valor_total || 0) - (p.valor_pago || 0)), 0
    );

    // Cabeçalho da seção
    const rowSec = ws.addRow([
      `${titulo}  —  ${agrupada.length} clientes  —  ${fmtBRL(totalSaldo)}`,
    ]);
    rowSec.height = 20;
    ws.mergeCells(`A${rowSec.number}:H${rowSec.number}`);
    Object.assign(rowSec.getCell(1), makeSecaoHeader(corArgb));

    // Cabeçalhos das colunas
    const colHeaders = mostrarAgendado
      ? ['Cliente', 'Telefone', 'Pagar em', 'Serviços realizados', 'Total (R$)', 'Pago (R$)', 'Saldo (R$)', 'Observações']
      : ['Cliente', 'Telefone', 'Serviços realizados', 'Total (R$)', 'Pago (R$)', 'Saldo (R$)', 'Observações', ''];
    const rowHead = ws.addRow(mostrarAgendado ? colHeaders : colHeaders.slice(0, 7));
    rowHead.height = 18;
    rowHead.eachCell({ includeEmpty: true }, (cell) => {
      Object.assign(cell, makeColHeader(corArgb));
    });

    // Linhas de dados
    agrupada.forEach((p, idx) => {
      const saldo      = (p.valor_total || 0) - (p.valor_pago || 0);
      const servicosTxt = p.servicos.length ? p.servicos.join('\n') : '-';
      const obsTxt     = p.observacoes.join(' | ').slice(0, 120);

      const rowData = mostrarAgendado
        ? ws.addRow([
            p.cliente_nome,
            fmtTelefone(p.telefone),
            fmtData(p.data_pagamento_agendado),
            servicosTxt,
            p.valor_total || 0,
            p.valor_pago  || 0,
            saldo,
            obsTxt,
          ])
        : ws.addRow([
            p.cliente_nome,
            fmtTelefone(p.telefone),
            servicosTxt,
            p.valor_total || 0,
            p.valor_pago  || 0,
            saldo,
            obsTxt,
          ]);

      rowData.height = Math.min(15 + p.servicos.length * 14, 80);

      // Fundo alternado
      if (idx % 2 === 1) {
        rowData.eachCell({ includeEmpty: true }, (cell) => {
          if (!cell.style.fill || (cell.style.fill as any).pattern !== 'solid') {
            Object.assign(cell, styleRowEven);
          }
        });
      }

      // Estilos por coluna
      if (mostrarAgendado) {
        rowData.getCell(3).style = styleData;   // Pagar em
        rowData.getCell(4).style = styleWrap;   // Serviços
        rowData.getCell(5).style = styleCurrency;
        rowData.getCell(6).style = styleCurrency;
        rowData.getCell(7).style = styleSaldo;
        rowData.getCell(7).font  = { bold: true, color: { argb: saldo > 0 ? 'FFB41E1E' : 'FF166534' } };
      } else {
        rowData.getCell(3).style = styleWrap;   // Serviços
        rowData.getCell(4).style = styleCurrency;
        rowData.getCell(5).style = styleCurrency;
        rowData.getCell(6).style = styleSaldo;
        rowData.getCell(6).font  = { bold: true, color: { argb: saldo > 0 ? 'FFB41E1E' : 'FF166534' } };
      }

      applyRowBorder(rowData);
    });

    // Linha de subtotal da seção
    const rowSub2 = ws.addRow(
      mostrarAgendado
        ? ['', '', '', 'SUBTOTAL', '', '', totalSaldo, '']
        : ['', '', 'SUBTOTAL', '', '', totalSaldo, '', '']
    );
    const subColIdx = mostrarAgendado ? 7 : 6;
    rowSub2.getCell(subColIdx).style = {
      font:  { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      fill:  { type: 'pattern', pattern: 'solid', fgColor: { argb: corArgb } },
      numFmt: 'R$ #,##0.00',
      alignment: { horizontal: 'right', vertical: 'middle' },
    };
    const labelColIdx = mostrarAgendado ? 4 : 3;
    rowSub2.getCell(labelColIdx).style = {
      font:  { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      fill:  { type: 'pattern', pattern: 'solid', fgColor: { argb: corArgb } },
      alignment: { horizontal: 'right', vertical: 'middle' },
    };

    // Espaço entre seções
    ws.addRow([]);
  };

  // Ordem: Agendados → Parciais → Pendentes
  renderSecao('AGENDADOS',  agrupAgen, 'FF1E64C8', true);
  renderSecao('PARCIAIS',   agrupParc, 'FFC88C00', false);
  renderSecao('PENDENTES',  agrupPend, 'FFC81E1E', false);

  if (!agrupAgen.length && !agrupParc.length && !agrupPend.length) {
    const rowVazio = ws.addRow(['Nenhum débito em aberto no momento.']);
    ws.mergeCells(`A${rowVazio.number}:H${rowVazio.number}`);
    rowVazio.getCell(1).style = {
      font:      { italic: true, size: 12, color: { argb: 'FF6B7280' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    };
  }

  // Rodapé
  ws.addRow([]);
  const rowRodape = ws.addRow([
    `Gerado automaticamente pelo Sistema Casa do Ar — ${fmtDataHora(new Date().toISOString())}`,
  ]);
  ws.mergeCells(`A${rowRodape.number}:H${rowRodape.number}`);
  rowRodape.getCell(1).style = {
    font:      { italic: true, size: 8, color: { argb: 'FF9CA3AF' } },
    alignment: { horizontal: 'center' },
  };

  // Proteger planilha (somente leitura)
  await ws.protect('casadoar2024', {
    selectLockedCells:   true,
    selectUnlockedCells: true,
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    try {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Acesso negado' }, { status: 403 });
      }
    } catch {
      // chamada agendada (sem token de usuário) — segue como service role
    }

    const db = base44.asServiceRole;

    // 1. Buscar pagamentos em aberto
    const todos   = await db.entities.PagamentoCliente.list('-data_conclusao');
    const abertos = todos.filter(
      (p: any) => !p.arquivado && ['pendente', 'parcial', 'agendado'].includes(p.status)
    );

    // 2. Hash para detecção de mudanças
    const normalizado = abertos
      .map((p: any) => ({
        id: p.id,
        vt: p.valor_total,
        vp: p.valor_pago,
        st: p.status,
        da: p.data_pagamento_agendado,
        h:  (p.historico_pagamentos || []).length,
      }))
      .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
    const hash = await sha256(JSON.stringify(normalizado));

    // 3. Verificar se há mudanças desde o último relatório bem-sucedido
    const ultimos = await db.entities.RelatorioCobrancaPDF.filter(
      { status: 'sucesso' },
      '-data_relatorio',
      1
    );
    if (ultimos[0]?.hash_dados === hash) {
      await db.entities.RelatorioCobrancaPDF.create({
        data_relatorio: new Date().toISOString(),
        hash_dados: hash,
        status: 'skipped',
        total_clientes: abertos.length,
        mensagem: 'Sem mudanças desde o último relatório',
      });
      return Response.json({
        status: 'skipped',
        message: 'Nenhuma mudança detectada — relatório anterior preservado',
        totalClientes: abertos.length,
      });
    }

    // 4. Gerar Excel
    const pendentes   = abertos.filter((p: any) => p.status === 'pendente');
    const parciais    = abertos.filter((p: any) => p.status === 'parcial');
    const agendados   = abertos.filter((p: any) => p.status === 'agendado');
    const totalDevido = abertos.reduce(
      (s: number, p: any) => s + ((p.valor_total || 0) - (p.valor_pago || 0)), 0
    );

    const xlsxBytes = await gerarExcel(pendentes, parciais, agendados, {
      total: abertos.length,
      totalDevido,
    });

    // 5. Upload para o Google Drive
    const { accessToken } = await db.connectors.getConnection('googledrive');
    const folderId  = await getOrCreateFolder(accessToken);
    const dataStr   = new Date().toISOString().split('T')[0];
    const fileName  = `cobranca_casa_do_ar_${dataStr}.xlsx`;
    const file      = await uploadToDrive(accessToken, fileName, xlsxBytes, folderId, XLSX_MIME);

    // 6. Registrar na entidade
    await db.entities.RelatorioCobrancaPDF.create({
      data_relatorio:   new Date().toISOString(),
      arquivo_drive_id:  file.id,
      arquivo_drive_url: `https://drive.google.com/file/d/${file.id}/view`,
      hash_dados:    hash,
      total_clientes: abertos.length,
      total_devido:   totalDevido,
      status: 'sucesso',
      mensagem: `${agendados.length} agendados, ${parciais.length} parciais, ${pendentes.length} pendentes`,
    });

    // 7. Retenção: manter apenas os últimos RETENCAO_DIAS
    const sucessos = await db.entities.RelatorioCobrancaPDF.filter(
      { status: 'sucesso' },
      '-data_relatorio'
    );
    const antigos = sucessos.slice(RETENCAO_DIAS);
    let removidos = 0;
    const errosRetencao: any[] = [];
    for (const antigo of antigos) {
      try {
        if (antigo.arquivo_drive_id) await deleteFromDrive(accessToken, antigo.arquivo_drive_id);
        await db.entities.RelatorioCobrancaPDF.delete(antigo.id);
        removidos++;
      } catch (e: any) {
        errosRetencao.push({ id: antigo.id, erro: e.message });
      }
    }

    return Response.json({
      status: 'success',
      fileName,
      driveLink:    `https://drive.google.com/file/d/${file.id}/view`,
      totalClientes: abertos.length,
      totalDevido,
      breakdown: {
        agendados: agendados.length,
        parciais:  parciais.length,
        pendentes: pendentes.length,
      },
      retencao: { removidos, erros: errosRetencao.length ? errosRetencao : undefined },
    });
  } catch (error: any) {
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.RelatorioCobrancaPDF.create({
        data_relatorio: new Date().toISOString(),
        status: 'erro',
        mensagem: error.message,
      });
    } catch {}
    return Response.json({ status: 'error', message: error.message }, { status: 500 });
  }
});
