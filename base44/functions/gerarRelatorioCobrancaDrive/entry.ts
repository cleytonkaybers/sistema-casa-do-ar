import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@2.5.2';
import autoTable from 'npm:jspdf-autotable@3.8.4';

const FOLDER_NAME = 'Relatorios Cobranca Casa do Ar';
const RETENCAO_DIAS = 7;

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
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folderData = await createRes.json();
  return folderData.id;
}

async function uploadPDFToDrive(
  accessToken: string,
  fileName: string,
  pdfBytes: Uint8Array,
  folderId: string
) {
  const boundary = '-------314159265358979323846';
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'application/pdf',
    parents: [folderId],
  });

  const bodyStart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
  const bodyEnd = `\r\n--${boundary}--`;

  const startBytes = new TextEncoder().encode(bodyStart);
  const endBytes = new TextEncoder().encode(bodyEnd);

  const fullBody = new Uint8Array(startBytes.length + pdfBytes.length + endBytes.length);
  fullBody.set(startBytes, 0);
  fullBody.set(pdfBytes, startBytes.length);
  fullBody.set(endBytes, startBytes.length + pdfBytes.length);

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
    throw new Error(`Falha ao enviar ${fileName} para o Drive: ${err}`);
  }

  return await res.json();
}

async function deleteFromDrive(accessToken: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Falha ao deletar arquivo ${fileId} do Drive: ${res.status}`);
  }
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const fmtData = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
};

const fmtDataHora = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const fmtTelefone = (tel?: string) => {
  if (!tel) return '-';
  const c = tel.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
  if (c.length === 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return tel;
};

function gerarPDF(
  pendentes: any[],
  parciais: any[],
  agendados: any[],
  totais: { total: number; totalDevido: number }
): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const agora = new Date();

  // Cabeçalho
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE COBRANÇA — CASA DO AR', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em ${fmtDataHora(agora.toISOString())}`, 14, 17);

  // Resumo
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo', 14, 32);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Clientes em aberto: ${totais.total}`, 14, 38);
  doc.text(
    `Pendentes: ${pendentes.length}   Parciais: ${parciais.length}   Agendados: ${agendados.length}`,
    14,
    44
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 30, 30);
  doc.text(`TOTAL DEVIDO: ${fmtBRL(totais.totalDevido)}`, 14, 51);
  doc.setTextColor(0, 0, 0);

  let cursorY = 58;

  const linhaResumo = (status: string, lista: any[]) => {
    return lista.reduce((s, p) => s + ((p.valor_total || 0) - (p.valor_pago || 0)), 0);
  };

  const tabela = (titulo: string, lista: any[], cor: [number, number, number], extras = false) => {
    if (!lista.length) return;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...cor);
    doc.text(
      `${titulo}  (${lista.length} clientes — ${fmtBRL(linhaResumo(titulo, lista))})`,
      14,
      cursorY
    );
    doc.setTextColor(0, 0, 0);
    cursorY += 3;

    const head = extras
      ? [['Cliente', 'Telefone', 'Serviço', 'Concluído em', 'Pagar em', 'Total', 'Pago', 'Saldo', 'Obs']]
      : [['Cliente', 'Telefone', 'Serviço', 'Concluído em', 'Total', 'Pago', 'Saldo', 'Obs']];

    const body = lista.map((p) => {
      const saldo = (p.valor_total || 0) - (p.valor_pago || 0);
      const base = [
        p.cliente_nome || '-',
        fmtTelefone(p.telefone),
        p.tipo_servico || '-',
        fmtData(p.data_conclusao),
      ];
      if (extras) base.push(fmtData(p.data_pagamento_agendado));
      base.push(
        fmtBRL(p.valor_total || 0),
        fmtBRL(p.valor_pago || 0),
        fmtBRL(saldo),
        (p.observacoes || '').slice(0, 60)
      );
      return base;
    });

    autoTable(doc, {
      startY: cursorY,
      head,
      body,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: cor, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: extras
        ? {
            0: { cellWidth: 40 },
            1: { cellWidth: 28 },
            2: { cellWidth: 32 },
            3: { cellWidth: 22 },
            4: { cellWidth: 22 },
            5: { cellWidth: 22, halign: 'right' },
            6: { cellWidth: 22, halign: 'right' },
            7: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
            8: { cellWidth: 'auto' },
          }
        : {
            0: { cellWidth: 45 },
            1: { cellWidth: 30 },
            2: { cellWidth: 38 },
            3: { cellWidth: 25 },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 25, halign: 'right' },
            6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
            7: { cellWidth: 'auto' },
          },
      didDrawPage: (data) => {
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(
          `Página ${doc.getCurrentPageInfo().pageNumber}  •  Gerado automaticamente — não editar manualmente`,
          14,
          pageH - 6
        );
      },
    });

    // @ts-ignore — autoTable injeta lastAutoTable em runtime
    cursorY = (doc as any).lastAutoTable.finalY + 8;
  };

  tabela('PENDENTE', pendentes, [200, 30, 30]);
  tabela('PARCIAL', parciais, [200, 140, 0]);
  tabela('AGENDADO', agendados, [30, 100, 200], true);

  if (!pendentes.length && !parciais.length && !agendados.length) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('Nenhum débito em aberto no momento.', 14, cursorY + 10);
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite chamada por automação (sem usuário) ou por admin
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
    const todos = await db.entities.PagamentoCliente.list('-data_conclusao');
    const abertos = todos.filter(
      (p: any) =>
        !p.arquivado && ['pendente', 'parcial', 'agendado'].includes(p.status)
    );

    // 2. Hash dos dados normalizados
    const normalizado = abertos
      .map((p: any) => ({
        id: p.id,
        vt: p.valor_total,
        vp: p.valor_pago,
        st: p.status,
        da: p.data_pagamento_agendado,
        h: (p.historico_pagamentos || []).length,
      }))
      .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
    const hash = await sha256(JSON.stringify(normalizado));

    // 3. Comparar com último sucesso
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
        message: 'Nenhuma mudança detectada — relatórios anteriores preservados',
        totalClientes: abertos.length,
      });
    }

    // 4. Gerar PDF
    const pendentes = abertos.filter((p: any) => p.status === 'pendente');
    const parciais = abertos.filter((p: any) => p.status === 'parcial');
    const agendados = abertos.filter((p: any) => p.status === 'agendado');
    const totalDevido = abertos.reduce(
      (s: number, p: any) => s + ((p.valor_total || 0) - (p.valor_pago || 0)),
      0
    );
    const pdfBytes = gerarPDF(pendentes, parciais, agendados, {
      total: abertos.length,
      totalDevido,
    });

    // 5. Upload para o Drive
    const { accessToken } = await db.connectors.getConnection('googledrive');
    const folderId = await getOrCreateFolder(accessToken);
    const dataStr = new Date().toISOString().split('T')[0];
    const fileName = `cobranca_casa_do_ar_${dataStr}.pdf`;
    const file = await uploadPDFToDrive(accessToken, fileName, pdfBytes, folderId);

    // 6. Registrar na entidade
    await db.entities.RelatorioCobrancaPDF.create({
      data_relatorio: new Date().toISOString(),
      arquivo_drive_id: file.id,
      arquivo_drive_url: `https://drive.google.com/file/d/${file.id}/view`,
      hash_dados: hash,
      total_clientes: abertos.length,
      total_devido: totalDevido,
      status: 'sucesso',
      mensagem: `${pendentes.length} pendentes, ${parciais.length} parciais, ${agendados.length} agendados`,
    });

    // 7. Retenção (só roda quando houve mudança — protege períodos estáticos)
    const sucessos = await db.entities.RelatorioCobrancaPDF.filter(
      { status: 'sucesso' },
      '-data_relatorio'
    );
    const antigos = sucessos.slice(RETENCAO_DIAS);
    let removidos = 0;
    const errosRetencao: any[] = [];
    for (const antigo of antigos) {
      try {
        if (antigo.arquivo_drive_id) {
          await deleteFromDrive(accessToken, antigo.arquivo_drive_id);
        }
        await db.entities.RelatorioCobrancaPDF.delete(antigo.id);
        removidos++;
      } catch (e: any) {
        errosRetencao.push({ id: antigo.id, erro: e.message });
      }
    }

    return Response.json({
      status: 'success',
      fileName,
      driveLink: `https://drive.google.com/file/d/${file.id}/view`,
      totalClientes: abertos.length,
      totalDevido,
      breakdown: {
        pendentes: pendentes.length,
        parciais: parciais.length,
        agendados: agendados.length,
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
