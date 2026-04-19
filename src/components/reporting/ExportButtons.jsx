import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatTipoServicoCompact } from '@/utils';

export default function ExportButtons({ reportData, dateRange }) {
  const exportCSV = () => {
    try {
      const { services, clients } = reportData;
      let csv = 'Relatório de Serviços\n';
      csv += `Período: ${dateRange.start} a ${dateRange.end}\n\n`;
      csv += 'Data,Tipo,Cliente,Status,Valor\n';
      
      services.forEach(s => {
        csv += `"${s.data_programada}","${formatTipoServicoCompact(s.tipo_servico)}","${s.cliente_nome}","${s.status}","${s.valor}"\n`;
      });
      
      csv += '\n\nRelatório de Clientes\n';
      csv += 'Nome,Telefone,Data Criação\n';
      
      clients.forEach(c => {
        csv += `"${c.nome}","${c.telefone}","${c.created_date}"\n`;
      });
      
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
      element.setAttribute('download', `relatorio_${new Date().getTime()}.csv`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
      toast.success('CSV exportado com sucesso');
    } catch (error) {
      toast.error('Erro ao exportar CSV');
    }
  };

  const exportPDF = async () => {
    try {
      const element = document.getElementById('report-container');
      if (!element) {
        toast.error('Conteúdo do relatório não encontrado');
        return;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#111827',
        scale: 2
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      pdf.save(`relatorio_${new Date().getTime()}.pdf`);
      toast.success('PDF exportado com sucesso');
    } catch (error) {
      toast.error('Erro ao exportar PDF');
    }
  };

  return (
    <div className="flex gap-3">
      <Button
        onClick={exportCSV}
        variant="outline"
        className="border-purple-700/50 text-white hover:bg-purple-900/20"
      >
        <Download className="w-4 h-4 mr-2" />
        Exportar CSV
      </Button>
      <Button
        onClick={exportPDF}
        className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
      >
        <FileText className="w-4 h-4 mr-2" />
        Exportar PDF
      </Button>
    </div>
  );
}