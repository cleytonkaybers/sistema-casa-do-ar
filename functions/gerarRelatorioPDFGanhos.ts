import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@2.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dataInicio, dataFim, filtroEquipe, filtroTecnico, ganhos, tecnicos, resumo } = await req.json();

    if (!dataInicio || !dataFim || !ganhos) {
      return Response.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    // Função para adicionar nova página
    const addNewPage = () => {
      doc.addPage();
      y = 20;
    };

    // Função para verificar espaço
    const checkSpace = (needed) => {
      if (y + needed > pageHeight - 20) {
        addNewPage();
      }
    };

    // ===== CABEÇALHO =====
    doc.setFillColor(30, 58, 138); // #1e3a8a
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('RELATÓRIO DE GANHOS', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Período: ${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`, pageWidth / 2, 25, { align: 'center' });
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 32, { align: 'center' });

    y = 50;

    // ===== RESUMO GERAL =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('RESUMO GERAL', 14, y);
    y += 10;

    doc.setFillColor(240, 240, 240);
    doc.rect(14, y, pageWidth - 28, 50, 'F');

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    const col1X = 20;
    const col2X = pageWidth / 2 + 10;
    
    y += 8;
    doc.text(`Total de Serviços: ${resumo.totalServicos}`, col1X, y);
    doc.text(`Valor Total Serviços: R$ ${resumo.totalValor.toFixed(2)}`, col2X, y);
    
    y += 7;
    doc.text(`Comissão Total: R$ ${resumo.totalComissao.toFixed(2)}`, col1X, y);
    doc.text(`Total Pago: R$ ${resumo.totalPago.toFixed(2)}`, col2X, y);
    
    y += 7;
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 140, 0);
    doc.text(`Total Pendente: R$ ${resumo.totalPendente.toFixed(2)}`, col1X, y);

    y += 20;
    doc.setTextColor(0, 0, 0);

    // ===== DETALHAMENTO POR TÉCNICO =====
    checkSpace(30);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('DETALHAMENTO POR TÉCNICO', 14, y);
    y += 10;

    tecnicos.forEach((tecnico, index) => {
      checkSpace(45);

      // Box do técnico
      doc.setFillColor(59, 130, 246, 20);
      doc.rect(14, y, pageWidth - 28, 35, 'F');
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.rect(14, y, pageWidth - 28, 35);

      y += 7;
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${tecnico.nome}`, 20, y);
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      y += 5;
      doc.text(`Email: ${tecnico.email}`, 20, y);
      doc.text(`Serviços: ${tecnico.ganhos.length}`, pageWidth - 80, y);

      y += 5;
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total: R$ ${tecnico.total.toFixed(2)}`, 20, y);
      doc.setTextColor(34, 197, 94);
      doc.text(`Pago: R$ ${tecnico.pago.toFixed(2)}`, pageWidth / 2 - 20, y);
      doc.setTextColor(251, 146, 60);
      doc.text(`Pendente: R$ ${tecnico.pendente.toFixed(2)}`, pageWidth - 80, y);

      y += 13;
      doc.setTextColor(0, 0, 0);

      // Lista de serviços do técnico
      if (tecnico.ganhos.length > 0) {
        checkSpace(15);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Serviços:', 20, y);
        y += 6;

        tecnico.ganhos.forEach((ganho, idx) => {
          checkSpace(10);
          
          doc.setFontSize(8);
          doc.setFont(undefined, 'normal');
          
          const dataFormatada = new Date(ganho.data_conclusao).toLocaleDateString('pt-BR');
          const statusTexto = ganho.pago ? '[PAGO]' : '[PENDENTE]';
          const statusCor = ganho.pago ? [34, 197, 94] : [251, 146, 60];
          
          doc.setTextColor(100, 100, 100);
          doc.text(`${idx + 1}.`, 25, y);
          doc.setTextColor(0, 0, 0);
          doc.text(`${ganho.cliente_nome} - ${ganho.tipo_servico}`, 30, y);
          
          doc.setTextColor(...statusCor);
          doc.text(statusTexto, pageWidth - 70, y);
          
          doc.setTextColor(0, 0, 0);
          doc.text(`R$ ${(ganho.valor_comissao || 0).toFixed(2)}`, pageWidth - 45, y);
          
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(7);
          y += 4;
          doc.text(`Data: ${dataFormatada} | Valor Serviço: R$ ${(ganho.valor_servico || 0).toFixed(2)} | Comissão: ${ganho.comissao_percentual || 0}%`, 30, y);
          
          y += 6;
        });
      }

      y += 5;
    });

    // ===== RODAPÉ =====
    const addFooter = (pageNum) => {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Relatório gerado pelo sistema Casa do Ar - Página ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    // Adicionar rodapé em todas as páginas
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i);
    }

    // Gerar PDF como arraybuffer
    const pdfBytes = doc.output('arraybuffer');

    // Upload para storage
    const fileName = `relatorio-ganhos-${dataInicio}-${dataFim}-${Date.now()}.pdf`;
    const uploadResponse = await base44.asServiceRole.integrations.Core.UploadFile({
      file: new Blob([pdfBytes], { type: 'application/pdf' }),
    });

    return Response.json({
      sucesso: true,
      pdfUrl: uploadResponse.file_url,
      fileName,
      resumo
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});