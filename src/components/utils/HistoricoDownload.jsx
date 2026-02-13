import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const desenharTabela = (doc, colunas, linhas, startY) => {
  const margemEsq = 15;
  const margemDir = 15;
  const larguraPagina = doc.internal.pageSize.getWidth();
  const larguraDisponivel = larguraPagina - margemEsq - margemDir;
  const larguraColuna = larguraDisponivel / colunas.length;
  const alturaLinha = 8;

  let y = startY;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Cabeçalho da tabela
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setFillColor(30, 58, 138);
  doc.setTextColor(255, 255, 255);

  colunas.forEach((col, i) => {
    doc.rect(margemEsq + (i * larguraColuna), y, larguraColuna, alturaLinha, 'F');
    doc.text(col, margemEsq + (i * larguraColuna) + 2, y + 5);
  });

  y += alturaLinha;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);

  // Linhas da tabela
  linhas.forEach((linha, rowIndex) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 15;
      // Redesenhar cabeçalho
      doc.setFont(undefined, 'bold');
      doc.setFillColor(30, 58, 138);
      doc.setTextColor(255, 255, 255);
      colunas.forEach((col, i) => {
        doc.rect(margemEsq + (i * larguraColuna), y, larguraColuna, alturaLinha, 'F');
        doc.text(col, margemEsq + (i * larguraColuna) + 2, y + 5);
      });
      y += alturaLinha;
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(240, 245, 255);
    } else {
      doc.setFillColor(255, 255, 255);
    }

    linha.forEach((celula, i) => {
      doc.rect(margemEsq + (i * larguraColuna), y, larguraColuna, alturaLinha, 'FD');
      doc.text(celula, margemEsq + (i * larguraColuna) + 2, y + 5);
    });

    y += alturaLinha;
  });

  return y;
};

export const gerarPDFCliente = (cliente, servicos, atendimentos) => {
  const doc = new jsPDF();

  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138);
  doc.text('Casa do Ar Climatização', 15, 15);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Histórico de Serviços - ${cliente}`, 15, 30);

  // Informações do relatório
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data do Relatório: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 15, 42);

  // Combinar e ordenar histórico
  const historico = [
    ...servicos.map(s => ({
      tipo: 'Serviço',
      descricao: s.tipo_servico,
      data: s.data_programada,
      status: s.status,
      valor: s.valor || 0,
      usuario: s.usuario_atualizacao_status || 'N/A'
    })),
    ...atendimentos.map(a => ({
      tipo: 'Atendimento',
      descricao: a.tipo_servico,
      data: a.data_atendimento,
      status: a.status,
      valor: a.valor || 0,
      usuario: a.usuario_atualizacao_status || 'N/A'
    }))
  ].sort((a, b) => new Date(b.data) - new Date(a.data));

  const totalValor = historico.reduce((sum, item) => sum + item.valor, 0);

  // Resumo
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Total de Serviços: ${historico.length}`, 15, 54);
  doc.text(`Valor Total Investido: R$ ${totalValor.toLocaleString('pt-BR')}`, 15, 62);

  // Preparar dados da tabela
  const colunas = ['Data', 'Serviço', 'Tipo', 'Status', 'Técnico', 'Valor'];
  const linhas = historico.map(item => [
    format(new Date(item.data), 'dd/MM', { locale: ptBR }),
    item.descricao.substring(0, 20),
    item.tipo,
    item.status,
    item.usuario.substring(0, 15),
    `R$ ${item.valor.toLocaleString('pt-BR')}`
  ]);

  desenharTabela(doc, colunas, linhas, 75);

  // Rodapé
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.text('Este documento serve como garantia e registro de todos os serviços prestados.', 15, pageHeight - 10);

  doc.save(`Historico_${cliente.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
};

export const gerarPDFTodos = (clientesAgrupados) => {
  const doc = new jsPDF();

  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138);
  doc.text('Casa do Ar Climatização', 15, 15);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Histórico Completo de Clientes', 15, 30);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data do Relatório: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 15, 42);

  let yPosition = 55;
  const pageHeight = doc.internal.pageSize.getHeight();

  Object.entries(clientesAgrupados).forEach(([cliente, itens]) => {
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 15;
    }

    const totalCliente = itens.reduce((sum, item) => sum + (item.valor || 0), 0);

    // Título do cliente
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text(`${cliente}`, 15, yPosition);
    yPosition += 7;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Serviços: ${itens.length} | Total: R$ ${totalCliente.toLocaleString('pt-BR')}`, 15, yPosition);
    yPosition += 8;

    // Tabela com dados do cliente
    const colunas = ['Data', 'Serviço', 'Tipo', 'Status', 'Técnico', 'Valor'];
    const linhas = itens.map(item => [
      format(new Date(item.data), 'dd/MM', { locale: ptBR }),
      item.descricao.substring(0, 18),
      item.tipo,
      item.status,
      (item.usuario || 'N/A').substring(0, 12),
      `R$ ${(item.valor || 0).toLocaleString('pt-BR')}`
    ]);

    yPosition = desenharTabela(doc, colunas, linhas, yPosition);
    yPosition += 10;
  });

  doc.save(`Historico_Completo_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
};