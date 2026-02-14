import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function GerarRelatorioManual({ open, onClose }) {
  const queryClient = useQueryClient();
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [emails, setEmails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const gerarRelatorioMutation = useMutation({
    mutationFn: async () => {
      if (!dataInicio || !dataFim) {
        throw new Error('Selecione as datas');
      }

      setIsGenerating(true);

      // Buscar serviços no período
      const todosServicos = await base44.entities.Servico.list('-data_programada');
      
      const servicosFiltrados = todosServicos.filter(s => {
        if (!s.data_programada) return false;
        
        const dataServico = new Date(s.data_programada);
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        
        const dentroData = dataServico >= inicio && dataServico <= fim;
        const matchTipo = !filtroTipo || s.tipo_servico === filtroTipo;
        const matchStatus = !filtroStatus || s.status === filtroStatus;
        
        return dentroData && matchTipo && matchStatus;
      });

      // Calcular estatísticas
      const stats = {
        total: servicosFiltrados.length,
        concluidos: servicosFiltrados.filter(s => s.status === 'concluido').length,
        andamento: servicosFiltrados.filter(s => s.status === 'andamento').length,
        pausados: servicosFiltrados.filter(s => s.status === 'pausado').length,
        abertos: servicosFiltrados.filter(s => s.status === 'aberto').length,
        valorTotal: servicosFiltrados.reduce((sum, s) => sum + (s.valor || 0), 0),
      };

      // Gerar PDF
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Título
      pdf.setFontSize(20);
      pdf.text('Relatório de Serviços', pageWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.text(`Período: ${format(dataInicio, 'dd/MM/yyyy')} - ${format(dataFim, 'dd/MM/yyyy')}`, pageWidth / 2, 30, { align: 'center' });
      
      // Estatísticas
      pdf.setFontSize(14);
      pdf.text('Resumo', 20, 45);
      
      pdf.setFontSize(11);
      let y = 55;
      pdf.text(`Total de Serviços: ${stats.total}`, 20, y);
      y += 7;
      pdf.text(`Concluídos: ${stats.concluidos}`, 20, y);
      y += 7;
      pdf.text(`Em Andamento: ${stats.andamento}`, 20, y);
      y += 7;
      pdf.text(`Pausados: ${stats.pausados}`, 20, y);
      y += 7;
      pdf.text(`Abertos: ${stats.abertos}`, 20, y);
      y += 7;
      pdf.text(`Valor Total: R$ ${stats.valorTotal.toFixed(2)}`, 20, y);
      
      // Lista de serviços (primeiros 20)
      y += 15;
      pdf.setFontSize(14);
      pdf.text('Serviços', 20, y);
      
      pdf.setFontSize(9);
      y += 10;
      
      servicosFiltrados.slice(0, 20).forEach((servico, idx) => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        
        pdf.text(`${idx + 1}. ${servico.cliente_nome} - ${servico.tipo_servico}`, 20, y);
        y += 5;
        pdf.text(`   Status: ${servico.status || 'aberto'} | Valor: R$ ${(servico.valor || 0).toFixed(2)}`, 20, y);
        y += 8;
      });
      
      if (servicosFiltrados.length > 20) {
        pdf.text(`... e mais ${servicosFiltrados.length - 20} serviços`, 20, y);
      }

      // Upload do PDF
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], `relatorio-${Date.now()}.pdf`, { type: 'application/pdf' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Salvar registro do relatório
      const relatorio = await base44.entities.RelatorioGerado.create({
        configuracao_nome: 'Relatório Manual',
        periodo_inicio: format(dataInicio, 'yyyy-MM-dd'),
        periodo_fim: format(dataFim, 'yyyy-MM-dd'),
        total_servicos: stats.total,
        servicos_concluidos: stats.concluidos,
        servicos_em_andamento: stats.andamento,
        valor_total: stats.valorTotal,
        pdf_url: file_url,
        enviado_para: emails ? emails.split(',').map(e => e.trim()) : [],
        status_envio: emails ? 'pendente' : 'enviado',
      });

      // Enviar e-mails se solicitado
      if (emails) {
        const emailList = emails.split(',').map(e => e.trim());
        
        for (const email of emailList) {
          try {
            await base44.integrations.Core.SendEmail({
              to: email,
              subject: `Relatório de Serviços - ${format(dataInicio, 'dd/MM/yyyy')} a ${format(dataFim, 'dd/MM/yyyy')}`,
              body: `
                <h2>Relatório de Serviços</h2>
                <p><strong>Período:</strong> ${format(dataInicio, 'dd/MM/yyyy')} - ${format(dataFim, 'dd/MM/yyyy')}</p>
                
                <h3>Resumo:</h3>
                <ul>
                  <li>Total de Serviços: ${stats.total}</li>
                  <li>Concluídos: ${stats.concluidos}</li>
                  <li>Em Andamento: ${stats.andamento}</li>
                  <li>Valor Total: R$ ${stats.valorTotal.toFixed(2)}</li>
                </ul>
                
                <p>Acesse o PDF completo: <a href="${file_url}">Baixar Relatório</a></p>
                
                <p><small>Casa do Ar Climatização</small></p>
              `
            });
          } catch (error) {
            console.error('Erro ao enviar e-mail para', email, error);
          }
        }

        await base44.entities.RelatorioGerado.update(relatorio.id, { status_envio: 'enviado' });
      }

      return { file_url, stats };
    },
    onSuccess: ({ file_url }) => {
      queryClient.invalidateQueries({ queryKey: ['relatorios-gerados'] });
      toast.success('Relatório gerado com sucesso!');
      window.open(file_url, '_blank');
      onClose();
      setIsGenerating(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao gerar relatório');
      setIsGenerating(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Gerar Relatório Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, 'dd/MM/yyyy') : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fim *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, 'dd/MM/yyyy') : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por Tipo</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos os tipos</SelectItem>
                <SelectItem value="Limpeza de 9k">Limpeza de 9k</SelectItem>
                <SelectItem value="Limpeza de 12k">Limpeza de 12k</SelectItem>
                <SelectItem value="Instalação de 9k">Instalação de 9k</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos os status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="andamento">Em Andamento</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Enviar por E-mail (opcional)</Label>
            <Input
              placeholder="email1@example.com, email2@example.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
            />
            <p className="text-xs text-gray-500">Separe múltiplos e-mails com vírgula</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button 
              onClick={() => gerarRelatorioMutation.mutate()} 
              disabled={isGenerating || !dataInicio || !dataFim}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}