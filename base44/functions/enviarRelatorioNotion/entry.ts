import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const NOTION_VERSION = '2022-06-28';

async function notionRequest(accessToken, path, method = 'GET', body = null) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
}

function fmtCurrency(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function txt(content, bold = false) {
  return { type: 'text', text: { content: String(content) }, annotations: { bold } };
}

function heading(text, level = 2) {
  return {
    object: 'block',
    type: `heading_${level}`,
    [`heading_${level}`]: { rich_text: [txt(text)] }
  };
}

function paragraph(text, bold = false) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [txt(text, bold)] }
  };
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

function bulletItem(text) {
  return {
    object: 'block',
      type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [txt(text)] }
  };
}

function callout(text, emoji = '📊') {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [txt(text)],
      icon: { type: 'emoji', emoji }
    }
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { parent_page_id, tipo, periodo } = await req.json();
  if (!parent_page_id) {
    return Response.json({ error: 'parent_page_id é obrigatório' }, { status: 400 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('notion');

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Determinar período
  let dataInicio, dataFim;
  if (periodo === 'semana') {
    const dow = hoje.getDay();
    const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((dow + 6) % 7));
    seg.setHours(0,0,0,0);
    const dom = new Date(seg); dom.setDate(seg.getDate() + 6); dom.setHours(23,59,59,999);
    dataInicio = seg; dataFim = dom;
  } else {
    dataInicio = new Date(inicioMes); dataFim = new Date(fimMes);
  }

  const periodoLabel = periodo === 'semana' ? 'Semana Atual' : `Mês ${hoje.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}`;
  const dateStr = hoje.toLocaleDateString('pt-BR');

  const blocks = [];

  // ===== PAGAMENTOS =====
  if (tipo === 'pagamentos' || tipo === 'todos') {
    const pagamentos = await base44.asServiceRole.entities.PagamentoCliente.list('-data_conclusao', 500);
    const filtrados = pagamentos.filter(p => {
      if (!p.data_conclusao) return false;
      const d = new Date(p.data_conclusao);
      return d >= dataInicio && d <= dataFim;
    });

    const totalFaturado = filtrados.reduce((s, p) => s + (p.valor_total || 0), 0);
    const totalPago = filtrados.reduce((s, p) => s + (p.valor_pago || 0), 0);
    const devedores = filtrados.filter(p => (p.valor_total || 0) - (p.valor_pago || 0) > 0.01 && p.status !== 'pago');

    blocks.push(heading('💰 Pagamentos de Clientes', 2));
    blocks.push(callout(`Período: ${periodoLabel} | Gerado em ${dateStr}`, '📅'));
    blocks.push(paragraph(`Total Faturado: ${fmtCurrency(totalFaturado)}`, true));
    blocks.push(paragraph(`Total Recebido: ${fmtCurrency(totalPago)}`, true));
    blocks.push(paragraph(`Saldo em Aberto: ${fmtCurrency(totalFaturado - totalPago)}`, true));
    blocks.push(paragraph(`Registros: ${filtrados.length} | Devedores: ${devedores.length}`));
    blocks.push(divider());

    if (devedores.length > 0) {
      blocks.push(heading('⚠️ Clientes com Saldo Pendente', 3));
      devedores.slice(0, 30).forEach(p => {
        const saldo = (p.valor_total || 0) - (p.valor_pago || 0);
        blocks.push(bulletItem(`${p.cliente_nome} — Deve: ${fmtCurrency(saldo)} | Serviço: ${p.tipo_servico || '—'} | Status: ${p.status}`));
      });
      blocks.push(divider());
    }
  }

  // ===== SERVIÇOS CONCLUÍDOS =====
  if (tipo === 'servicos' || tipo === 'todos') {
    const servicos = await base44.asServiceRole.entities.Servico.filter({ status: 'concluido' }, '-data_conclusao', 500);
    const filtrados = servicos.filter(s => {
      if (!s.data_conclusao) return false;
      const d = new Date(s.data_conclusao);
      return d >= dataInicio && d <= dataFim;
    });

    // Agrupar por equipe
    const porEquipe = {};
    filtrados.forEach(s => {
      const eq = s.equipe_nome || 'Sem equipe';
      if (!porEquipe[eq]) porEquipe[eq] = { total: 0, valor: 0 };
      porEquipe[eq].total++;
      porEquipe[eq].valor += s.valor || 0;
    });

    blocks.push(heading('🔧 Serviços Concluídos', 2));
    blocks.push(callout(`Período: ${periodoLabel} | Total: ${filtrados.length} serviços`, '📅'));
    
    Object.entries(porEquipe).sort((a,b) => b[1].total - a[1].total).forEach(([eq, data]) => {
      blocks.push(bulletItem(`${eq}: ${data.total} serviço(s) — ${fmtCurrency(data.valor)}`));
    });
    blocks.push(divider());

    if (filtrados.length > 0) {
      blocks.push(heading('📋 Últimos Serviços', 3));
      filtrados.slice(0, 20).forEach(s => {
        const data = s.data_conclusao ? new Date(s.data_conclusao).toLocaleDateString('pt-BR') : '—';
        blocks.push(bulletItem(`${data} — ${s.cliente_nome} | ${s.tipo_servico} | Equipe: ${s.equipe_nome || '—'} | ${fmtCurrency(s.valor)}`));
      });
      blocks.push(divider());
    }
  }

  // ===== COMISSÕES =====
  if (tipo === 'comissoes' || tipo === 'todos') {
    const lancamentos = await base44.asServiceRole.entities.LancamentoFinanceiro.list('-data_geracao', 500);
    const filtrados = lancamentos.filter(l => {
      if (!l.data_geracao) return false;
      const d = new Date(l.data_geracao);
      return d >= dataInicio && d <= dataFim;
    });

    const porTecnico = {};
    filtrados.forEach(l => {
      const tec = l.tecnico_nome || l.tecnico_id || 'Desconhecido';
      if (!porTecnico[tec]) porTecnico[tec] = { pendente: 0, pago: 0, total: 0 };
      if (l.status === 'pago') porTecnico[tec].pago += l.valor_comissao_tecnico || 0;
      else porTecnico[tec].pendente += l.valor_comissao_tecnico || 0;
      porTecnico[tec].total += l.valor_comissao_tecnico || 0;
    });

    const totalComissoes = filtrados.reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);
    const totalPendente = filtrados.filter(l => l.status !== 'pago').reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);

    blocks.push(heading('💼 Comissões dos Técnicos', 2));
    blocks.push(callout(`Período: ${periodoLabel} | Total: ${fmtCurrency(totalComissoes)} | Pendente: ${fmtCurrency(totalPendente)}`, '💰'));

    Object.entries(porTecnico).sort((a,b) => b[1].total - a[1].total).forEach(([tec, data]) => {
      blocks.push(bulletItem(`${tec} — Total: ${fmtCurrency(data.total)} | Pendente: ${fmtCurrency(data.pendente)} | Pago: ${fmtCurrency(data.pago)}`));
    });
    blocks.push(divider());
  }

  // Criar página no Notion
  const pageTitle = `Casa do Ar — ${tipo === 'todos' ? 'Relatório Completo' : tipo === 'pagamentos' ? 'Pagamentos' : tipo === 'servicos' ? 'Serviços' : 'Comissões'} — ${periodoLabel}`;

  // Formatar ID do Notion corretamente (com ou sem hífens)
  const cleanId = parent_page_id.replace(/-/g, '');
  const formattedId = cleanId.length === 32
    ? `${cleanId.slice(0,8)}-${cleanId.slice(8,12)}-${cleanId.slice(12,16)}-${cleanId.slice(16,20)}-${cleanId.slice(20)}`
    : parent_page_id;

  const pageBody = {
    parent: { page_id: formattedId },
    properties: {
      title: { title: [{ text: { content: pageTitle } }] }
    },
    children: blocks.slice(0, 100), // Notion permite até 100 blocks por request
  };

  const result = await notionRequest(accessToken, '/pages', 'POST', pageBody);

  if (result.object === 'error') {
    return Response.json({ error: result.message }, { status: 400 });
  }

  return Response.json({
    success: true,
    page_url: result.url,
    page_id: result.id,
    blocks_created: blocks.length,
  });
});