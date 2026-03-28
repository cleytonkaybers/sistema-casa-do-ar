import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Agrupa serviços por data+equipe e resume com multiplicadores
function agruparPorData(historico) {
  const grupos = {};
  historico.forEach(item => {
    const dataKey = item.data ? format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR }) : 'Sem data';
    const equipe = item.equipe_nome || 'Sem equipe';
    const chave = `${dataKey}||${equipe}`;
    if (!grupos[chave]) {
      grupos[chave] = { data: dataKey, equipe, servicos: [], valor: 0 };
    }
    // Conta ocorrências de cada tipo de serviço
    const tipos = (item.descricao || '').split('+').map(s => s.trim()).filter(Boolean);
    tipos.forEach(t => {
      const ex = grupos[chave].servicos.find(s => s.tipo === t);
      if (ex) ex.qtd++;
      else grupos[chave].servicos.push({ tipo: t, qtd: 1 });
    });
    grupos[chave].valor += item.valor || 0;
  });

  return Object.values(grupos)
    .sort((a, b) => new Date(b.data.split('/').reverse().join('-')) - new Date(a.data.split('/').reverse().join('-')));
}

function resumirServicos(servicos) {
  return servicos.map(s => s.qtd > 1 ? `${s.tipo} x${s.qtd}` : s.tipo).join(' + ');
}

// Desenha tabela com larguras customizadas por coluna
const desenharTabela = (doc, colunas, larguras, linhas) => {
  const margemEsq = 15;
  const alturaLinha = 8;
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = doc.lastAutoTable?.finalY || doc._lastY || 75;

  const desenharCabecalho = () => {
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(30, 58, 138);
    doc.setTextColor(255, 255, 255);
    let x = margemEsq;
    colunas.forEach((col, i) => {
      doc.rect(x, y, larguras[i], alturaLinha, 'F');
      doc.text(col, x + 2, y + 5);
      x += larguras[i];
    });
    y += alturaLinha;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
  };

  desenharCabecalho();

  linhas.forEach((linha, rowIndex) => {
  // Calcular altura necessária para esta linha
  const maxLinhas = Math.max(...linha.map((celula, i) => {
    const linhasTexto = doc.splitTextToSize(celula, larguras[i] - 4);
    return linhasTexto.length;
  }));
  const alturaAtual = Math.max(alturaLinha, maxLinhas * 5 + 3);

  if (y + alturaAtual > pageHeight - 20) {
    doc.addPage();
    y = 15;
    desenharCabecalho();
  }

  let x = margemEsq;
  // Resetar para branco antes de cada linha de dados
  doc.setFillColor(255, 255, 255);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  linha.forEach((celula, i) => {
    doc.setFillColor(255, 255, 255);
    doc.setTextColor(0, 0, 0);
    doc.rect(x, y, larguras[i], alturaAtual, 'FD');
    const linhasTexto = doc.splitTextToSize(String(celula), larguras[i] - 4);
    doc.text(linhasTexto, x + 2, y + 5);
    x += larguras[i];
  });

  y += alturaAtual;
  });

  return y;
  };

export const gerarPDFCliente = (cliente, servicos, atendimentos) => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138);
  doc.text('Casa do Ar Climatização', 15, 15);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Histórico de Serviços - ${cliente}`, 15, 28);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data do Relatório: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 15, 40);

  const historico = [
    ...atendimentos.map(a => ({
      descricao: a.tipo_servico,
      data: a.data_conclusao || a.data_atendimento,
      valor: a.valor || 0,
      equipe_nome: a.equipe_nome || '',
    })),
    ...servicos.filter(s => s.status === 'concluido').map(s => ({
      descricao: s.tipo_servico,
      data: s.data_conclusao || s.data_programada,
      valor: s.valor || 0,
      equipe_nome: s.equipe_nome || '',
    }))
  ];

  const totalValor = historico.reduce((sum, item) => sum + item.valor, 0);
  const grupos = agruparPorData(historico);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Total de Serviços: ${grupos.length} visitas`, 15, 52);
  doc.text(`Valor Total Investido: R$ ${totalValor.toLocaleString('pt-BR')}`, 15, 60);

  const colunas = ['Data', 'Equipe', 'Serviços Realizados', 'Valor'];
  const larguras = [28, 45, 90, 27];

  const linhas = grupos.map(g => [
    g.data,
    g.equipe || 'Sem equipe',
    resumirServicos(g.servicos),
    `R$ ${g.valor.toLocaleString('pt-BR')}`
  ]);

  doc._lastY = 72;
  desenharTabela(doc, colunas, larguras, linhas);

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.text('Este documento serve como garantia e registro de todos os serviços prestados.', 15, pageHeight - 10);

  doc.save(`Historico_${cliente.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
};

export const gerarPDFTodos = (clientesAgrupados) => {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138);
  doc.text('Casa do Ar Climatização', 15, 15);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Histórico Completo de Clientes', 15, 28);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data do Relatório: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 15, 40);

  let y = 52;
  const pageHeight = doc.internal.pageSize.getHeight();
  const colunas = ['Data', 'Equipe', 'Serviços Realizados', 'Valor'];
  const larguras = [28, 45, 90, 27];

  Object.entries(clientesAgrupados).forEach(([cliente, itens]) => {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 15;
    }

    const totalCliente = itens.reduce((sum, item) => sum + (item.valor || 0), 0);

    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text(cliente, 15, y);
    y += 6;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Serviços: ${itens.length} | Total: R$ ${totalCliente.toLocaleString('pt-BR')}`, 15, y);
    y += 5;

    const historicoItens = itens.map(item => ({
      descricao: item.descricao || '',
      data: item.data || '',
      valor: item.valor || 0,
      equipe_nome: item.equipe_nome || item.usuario || '',
    }));

    const grupos = agruparPorData(historicoItens);
    const linhas = grupos.map(g => [
      g.data,
      g.equipe || 'Sem equipe',
      resumirServicos(g.servicos),
      `R$ ${g.valor.toLocaleString('pt-BR')}`
    ]);

    doc._lastY = y;
    y = desenharTabela(doc, colunas, larguras, linhas);
    y += 10;
  });

  doc.save(`Historico_Completo_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
};