import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const gerarPDFCliente = (cliente, servicos, atendimentos) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138);
  doc.text('Casa do Ar Climatização', 20, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Histórico de Serviços - ${cliente}`, 20, 35);
  
  // Informações do cliente
  doc.setFontSize(10);
  doc.text(`Data do Relatório: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 50);
  
  // Combinar e ordenar
  const historico = [
    ...servicos.map(s => ({
      tipo: 'Serviço',
      descricao: s.tipo_servico,
      data: s.data_programada,
      status: s.status,
      valor: s.valor || 0,
      usuario: s.usuario_atualizacao_status || 'N/A',
      data_atualizacao: s.data_atualizacao_status
    })),
    ...atendimentos.map(a => ({
      tipo: 'Atendimento',
      descricao: a.tipo_servico,
      data: a.data_atendimento,
      status: a.status,
      valor: a.valor || 0,
      usuario: a.usuario_atualizacao_status || 'N/A',
      data_atualizacao: a.data_atualizacao_status
    }))
  ].sort((a, b) => new Date(b.data) - new Date(a.data));

  const totalValor = historico.reduce((sum, item) => sum + item.valor, 0);

  // Resumo
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Total de Serviços: ${historico.length}`, 20, 65);
  doc.text(`Valor Total Investido: R$ ${totalValor.toLocaleString('pt-BR')}`, 20, 75);

  // Tabela
  const tableData = historico.map(item => [
    format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR }),
    item.descricao,
    item.tipo,
    item.status,
    item.usuario,
    `R$ ${item.valor.toLocaleString('pt-BR')}`
  ]);

  doc.autoTable({
    head: [['Data', 'Serviço', 'Tipo', 'Status', 'Técnico', 'Valor']],
    body: tableData,
    startY: 85,
    margin: { left: 20, right: 20 },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [0, 0, 0]
    },
    alternateRowStyles: {
      fillColor: [240, 245, 255]
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 50 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 }
    }
  });

  // Rodapé
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Este documento serve como garantia e registro de todos os serviços prestados.', 20, finalY);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}`, 20, finalY + 6);

  // Salvar
  doc.save(`Historico_${cliente.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
};

export const gerarPDFTodos = (clientesAgrupados) => {
  const doc = new jsPDF();
  
  // Cabeçalho
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 138);
  doc.text('Casa do Ar Climatização', 20, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Histórico Completo de Clientes', 20, 35);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data do Relatório: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 50);

  let yPosition = 60;
  const pageHeight = doc.internal.pageSize.getHeight();

  Object.entries(clientesAgrupados).forEach(([cliente, itens]) => {
    // Nova página se necessário
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    const totalCliente = itens.reduce((sum, item) => sum + (item.valor || 0), 0);

    // Título do cliente
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text(`${cliente}`, 20, yPosition);
    yPosition += 7;

    // Resumo
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Serviços: ${itens.length} | Total Gasto: R$ ${totalCliente.toLocaleString('pt-BR')}`, 20, yPosition);
    yPosition += 10;

    // Tabela
    const tableData = itens.map(item => [
      format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR }),
      item.descricao,
      item.tipo,
      item.status,
      item.usuario || 'N/A',
      `R$ ${(item.valor || 0).toLocaleString('pt-BR')}`
    ]);

    doc.autoTable({
      head: [['Data', 'Serviço', 'Tipo', 'Status', 'Técnico', 'Valor']],
      body: tableData,
      startY: yPosition,
      margin: { left: 20, right: 20 },
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [0, 0, 0]
      },
      alternateRowStyles: {
        fillColor: [240, 245, 255]
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 }
      },
      didDrawPage: (data) => {
        yPosition = data.cursor.y + 10;
      }
    });

    yPosition = doc.lastAutoTable.finalY + 15;
  });

  // Rodapé final
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Relatório completo de clientes e serviços prestados.', 20, pageHeight - 15);

  doc.save(`Historico_Completo_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
};