import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todos os clientes
    const clientes = await base44.asServiceRole.entities.Cliente.list('-created_date');

    // Converter para CSV
    const headers = ['Nome', 'Telefone', 'CPF', 'Endereço', 'Segmentação', 'Total Gasto', 'Qtd Serviços', 'Última Manutenção', 'Próxima Manutenção', 'Observações'];
    const rows = clientes.map(c => [
      c.nome || '',
      c.telefone || '',
      c.cpf || '',
      c.endereco || '',
      c.segmentacao || '',
      c.total_gasto || 0,
      c.quantidade_servicos || 0,
      c.ultima_manutencao || '',
      c.proxima_manutencao || '',
      (c.observacoes || '').replace(/,/g, ';').replace(/\n/g, ' '),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const csvBytes = new TextEncoder().encode('\uFEFF' + csvContent); // BOM para UTF-8

    // Obter token do Google Drive
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    const fileName = `clientes_casa_do_ar_${new Date().toISOString().split('T')[0]}.csv`;

    // Upload para o Google Drive usando multipart
    const boundary = '-------314159265358979323846';
    const metadata = JSON.stringify({ name: fileName, mimeType: 'text/csv' });

    const body = [
      `--${boundary}\r\n`,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      `${metadata}\r\n`,
      `--${boundary}\r\n`,
      `Content-Type: text/csv\r\n\r\n`,
    ].join('');

    const bodyEnd = `\r\n--${boundary}--`;

    const bodyBytes = new TextEncoder().encode(body);
    const endBytes = new TextEncoder().encode(bodyEnd);

    const fullBody = new Uint8Array(bodyBytes.length + csvBytes.length + endBytes.length);
    fullBody.set(bodyBytes, 0);
    fullBody.set(csvBytes, bodyBytes.length);
    fullBody.set(endBytes, bodyBytes.length + csvBytes.length);

    const uploadRes = await fetch(
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

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return Response.json({ error: `Erro ao enviar para o Drive: ${err}` }, { status: 500 });
    }

    const file = await uploadRes.json();

    return Response.json({
      success: true,
      fileName,
      fileId: file.id,
      total: clientes.length,
      driveLink: `https://drive.google.com/file/d/${file.id}/view`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});