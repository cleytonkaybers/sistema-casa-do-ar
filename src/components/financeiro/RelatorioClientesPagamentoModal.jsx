import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { jsPDF } from 'jspdf';
import { formatCurrency } from '@/lib/utils/formatters';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { formatTipoServicoCompact } from '@/utils';

export default function RelatorioClientesPagamentoModal({ isOpen, onClose, pagamentos = [], servicos = [] }) {
  const [filtroTipo, setFiltroTipo] = useState('mes');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [incluirClientes, setIncluirClientes] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleGerarRelatorio = async () => {
    try {
      setLoading(true);
      const hoje = new Date();
      let inicio, fim;

      if (filtroTipo === 'semana') {
        const primeiroDiaSemana = new Date(hoje);
        primeiroDiaSemana.setDate(hoje.getDate() - hoje.getDay());
        const ultimoDiaSemana = new Date(primeiroDiaSemana);
        ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6);
        inicio = primeiroDiaSemana;
        fim = ultimoDiaSemana;
      } else if (filtroTipo === 'mes') {
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      } else {
        if (!dataInicio || !dataFim) {
          toast.error('Defina as datas de início e fim');
          return;
        }
        inicio = new Date(dataInicio);
        fim = new Date(dataFim);
      }

      // Filtrar dados por período
      const pagamentosFiltrados = pagamentos.filter(p => {
        const dataPag = p.data_conclusao ? new Date(p.data_conclusao) : new Date();
        return dataPag >= inicio && dataPag <= fim;
      });

      const servicosFiltrados = servicos.filter(s => {
        const dataServ = s.data_conclusao ? new Date(s.data_conclusao) : new Date(s.data_programada ? new Date(s.data_programada) : new Date());
        return dataServ >= inicio && dataServ <= fim;
      });

      // Buscar dados de clientes se solicitado
      let clientesMap = {};
      if (incluirClientes) {
        const clientes = await base44.entities.Cliente.list();
        clientesMap = Object.fromEntries(clientes.map(c => [c.nome, c]));
      }

      // Calcular totais financeiros
      const totalGanho = servicosFiltrados.reduce((sum, s) => sum + (s.valor || 0), 0);
      const totalRecebido = pagamentosFiltrados.reduce((sum, p) => sum + (p.valor_pago || 0), 0);
      const totalDebito = pagamentosFiltrados.reduce((sum, p) => sum + Math.max(0, (p.valor_total || 0) - (p.valor_pago || 0)), 0);

      // Gerar PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 10;

      // Período em texto
      const periodoTexto = filtroTipo === 'semana' ? `Semana de ${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`
        : filtroTipo === 'mes' ? `${inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
        : `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`;

      // Resumo Financeiro
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('📊 RESUMO FINANCEIRO', 10, yPos);
      yPos += 10;

      const summaryData = [
        ['Período', periodoTexto],
        ['💰 Total Ganho', formatCurrency(totalGanho)],
        ['✅ Total Recebido', formatCurrency(totalRecebido)],
        ['⏳ Total Débito Pendente', formatCurrency(totalDebito)],
        ['📈 Taxa de Recebimento', `${totalGanho > 0 ? ((totalRecebido / totalGanho) * 100).toFixed(1) : 0}%`]
      ];

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      summaryData.forEach(([label, value]) => {
        doc.text(`${label}:`, 10, yPos);
        doc.setFont(undefined, 'bold');
        doc.text(value, pageWidth - 50, yPos, { align: 'right' });
        doc.setFont(undefined, 'normal');
        yPos += 7;
      });

      yPos += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(10, yPos, pageWidth - 10, yPos);
      yPos += 8;

      const drawTable = (data, headers, startY) => {
        const colWidths = [45, 35, 30, 30, 35];
        const rowHeight = 6;
        let y = startY;
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(30, 58, 138);
        headers.forEach((h, i) => doc.text(h, 10 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2, y + 4, { maxWidth: colWidths[i] - 4 }));
        y += rowHeight + 1;
        doc.setTextColor(0, 0, 0);
        data.forEach((row, idx) => {
          if (y > pageHeight - 20) { doc.addPage(); y = 10; }
          if (idx % 2 === 0) {
            doc.setFillColor(255, 255, 255);
          } else {
            doc.setFillColor(245, 245, 245);
          }
          doc.rect(10, y - rowHeight + 1, pageWidth - 20, rowHeight, 'F');
          row.forEach((cell, i) => doc.text(String(cell), 10 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + 2, y + 1, { maxWidth: colWidths[i] - 4 }));
          y += rowHeight;
        });
        return y;
      };



      // Tabela de Serviços
      if (servicosFiltrados.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 10;
        }
        doc.setFontSize(11);
        doc.text('🔧 SERVIÇOS REALIZADOS', 10, yPos);
        yPos += 7;

        const servicosData = servicosFiltrados.map(s => [
          (s.cliente_nome || '').substring(0, 15),
          formatTipoServicoCompact(s.tipo_servico).substring(0, 12),
          new Date(s.data_conclusao || s.data_programada).toLocaleDateString('pt-BR'),
          formatCurrency(s.valor || 0),
          (s.equipe_nome || '').substring(0, 15)
        ]);

        yPos = drawTable(servicosData, ['Cliente', 'Tipo', 'Data', 'Valor', 'Equipe'], yPos);
        yPos += 5;
      }

      // Tabela de Pagamentos
      if (pagamentosFiltrados.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 10;
        }
        doc.setFontSize(11);
        doc.text('💰 REGISTRO DE PAGAMENTOS', 10, yPos);
        yPos += 7;

        const pagamentosData = pagamentosFiltrados.map(p => [
          (p.cliente_nome || '').substring(0, 15),
          formatTipoServicoCompact(p.tipo_servico).substring(0, 12),
          formatCurrency(p.valor_total || 0),
          formatCurrency(p.valor_pago || 0),
          formatCurrency(Math.max(0, (p.valor_total || 0) - (p.valor_pago || 0)))
        ]);

        yPos = drawTable(pagamentosData, ['Cliente', 'Serviço', 'Total', 'Pago', 'Débito'], yPos);
        yPos += 5;
      }

      // Dados de Clientes (opcional)
      if (incluirClientes && Object.keys(clientesMap).length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 10;
        }
        doc.setFontSize(11);
        doc.text('👥 DADOS DE CLIENTES', 10, yPos);
        yPos += 7;

        const clientesUnicos = [...new Set([...servicosFiltrados.map(s => s.cliente_nome), ...pagamentosFiltrados.map(p => p.cliente_nome)])];
        const clientesData = clientesUnicos
          .filter(nome => clientesMap[nome])
          .map(nome => {
            const cliente = clientesMap[nome];
            return [
              (cliente.nome || '').substring(0, 20),
              (cliente.telefone || '').substring(0, 15),
              (cliente.endereco || '').substring(0, 25),
              cliente.segmentacao || 'Regular'
            ];
          });

        if (clientesData.length > 0) {
          yPos = drawTable(clientesData, ['Nome', 'Telefone', 'Endereço', 'Segmentação'], yPos);
        }
      }

      // Salvar PDF
      const nomeArquivo = `relatorio_pagamentos_${inicio.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      doc.save(nomeArquivo);
      toast.success('Relatório gerado com sucesso!');
      onClose();
    } catch (error) {
      toast.error('Erro ao gerar relatório: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📄 Gerar Relatório PDF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-2 block">Período</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semana">Esta Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtroTipo === 'personalizado' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Checkbox
              checked={incluirClientes}
              onCheckedChange={setIncluirClientes}
              id="incluirClientes"
            />
            <Label htmlFor="incluirClientes" className="text-sm cursor-pointer">
              Incluir dados de clientes
            </Label>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-2">📋 O relatório incluirá:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Resumo financeiro do período</li>
              <li>Tabela de serviços realizados</li>
              <li>Tabela de pagamentos registrados</li>
              {incluirClientes && <li>Dados de contato dos clientes</li>}
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleGerarRelatorio} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700">
              {loading ? 'Gerando...' : '✓ Gerar PDF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}