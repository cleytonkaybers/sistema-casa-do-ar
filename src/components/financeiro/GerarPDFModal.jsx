import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Download, Loader2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatTipoServicoCompact } from '@/utils';

export default function GerarPDFModal({ open, onClose, equipes, tecnicos, lancamentos, pagamentos }) {
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'equipe' | 'tecnico'
  const [equipeId, setEquipeId] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [periodo, setPeriodo] = useState('atual'); // 'atual' | 'passada' | 'personalizado'
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [gerando, setGerando] = useState(false);

  const agora = new Date();
  const inicioSemanaAtual = startOfWeek(agora, { weekStartsOn: 1 });
  const fimSemanaAtual = endOfWeek(agora, { weekStartsOn: 1 });
  const inicioSemanaPassada = new Date(inicioSemanaAtual);
  inicioSemanaPassada.setDate(inicioSemanaPassada.getDate() - 7);
  const fimSemanaPassada = new Date(fimSemanaAtual);
  fimSemanaPassada.setDate(fimSemanaPassada.getDate() - 7);

  const getIntervalo = () => {
    if (periodo === 'atual') return { inicio: inicioSemanaAtual, fim: fimSemanaAtual };
    if (periodo === 'passada') return { inicio: inicioSemanaPassada, fim: fimSemanaPassada };
    if (periodo === 'personalizado' && dataInicio && dataFim) {
      return { inicio: new Date(dataInicio + 'T00:00:00'), fim: new Date(dataFim + 'T23:59:59') };
    }
    return null;
  };

  const tecnicosDaEquipe = equipeId
    ? tecnicos.filter(t => t.equipe_id === equipeId)
    : tecnicos;

  const gerarPDF = async () => {
    const intervalo = getIntervalo();
    if (!intervalo) {
      toast.error('Selecione um período válido');
      return;
    }

    setGerando(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { addBannerToDoc, getBannerUrl } = await import('@/lib/pdfBanner');
      const bannerUrl = await getBannerUrl();
      const doc = new jsPDF();

      // Determinar quais técnicos incluir
      let tecnicosAlvo = tecnicos;
      if (filtroTipo === 'equipe' && equipeId) {
        tecnicosAlvo = tecnicos.filter(t => t.equipe_id === equipeId);
      } else if (filtroTipo === 'tecnico' && tecnicoId) {
        tecnicosAlvo = tecnicos.filter(t => t.tecnico_id === tecnicoId);
      }

      const tecnicosIds = new Set(tecnicosAlvo.map(t => t.tecnico_id));

      // Filtrar lançamentos pelo período e técnicos
      const lancsFiltrados = lancamentos.filter(l => {
        if (!l.data_geracao) return false;
        const d = new Date(l.data_geracao);
        return d >= intervalo.inicio && d <= intervalo.fim && tecnicosIds.has(l.tecnico_id);
      });

      // Filtrar pagamentos pelo período e técnicos
      const pagsFiltrados = pagamentos.filter(p => {
        if (!p.created_date) return false;
        const d = new Date(p.created_date);
        return d >= intervalo.inicio && d <= intervalo.fim && tecnicosIds.has(p.tecnico_id);
      });

      // Título
      const nomeEquipe = equipeId ? equipes.find(e => e.id === equipeId)?.nome : null;
      const nomeTecnico = tecnicoId ? tecnicos.find(t => t.tecnico_id === tecnicoId)?.tecnico_nome : null;

      // Banner da empresa
      let y = await addBannerToDoc(doc, bannerUrl);
      if (!bannerUrl) {
        doc.setFontSize(16); doc.setTextColor(30, 58, 138);
        doc.text('Relatório Financeiro - Casa do Ar', 20, 20);
        y = 28;
      }
      doc.setTextColor(0); doc.setFontSize(9);
      doc.text(`Gerado em: ${format(agora, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, y);
      y += 6;
      doc.text(`Período: ${format(intervalo.inicio, 'dd/MM/yyyy')} a ${format(intervalo.fim, 'dd/MM/yyyy')}`, 20, y);
      y += 6;
      if (nomeEquipe) { doc.text(`Equipe: ${nomeEquipe}`, 20, y); y += 6; }
      if (nomeTecnico) { doc.text(`Técnico: ${nomeTecnico}`, 20, y); y += 6; }
      y += 4;

      // ─── RESUMO POR TÉCNICO ───────────────────────────────────────────
      doc.setFillColor(30, 58, 138);
      doc.rect(20, y, 170, 7, 'F');
      doc.setFontSize(10);
      doc.setTextColor(255);
      doc.text('RESUMO POR TÉCNICO', 22, y + 5);
      doc.setTextColor(0);
      y += 12;

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text('Técnico', 20, y);
      doc.text('Equipe', 75, y);
      doc.text('Total Ganho', 125, y);
      doc.text('Pago', 155, y);
      doc.text('Pendente', 180, y);
      y += 4;
      doc.setDrawColor(200);
      doc.line(20, y, 190, y);
      y += 4;

      doc.setTextColor(0);
      for (const tec of tecnicosAlvo) {
        if (y > 270) { doc.addPage(); y = 20; }
        const lancsT = lancsFiltrados.filter(l => l.tecnico_id === tec.tecnico_id);
        const pagsT = pagsFiltrados.filter(p => p.tecnico_id === tec.tecnico_id && p.status === 'Confirmado');
        const totalGanho = lancsT.reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);
        const totalPago = pagsT.reduce((s, p) => s + (p.valor_pago || 0), 0);
        const pendente = Math.max(0, totalGanho - totalPago);

        doc.setFontSize(8);
        doc.text((tec.tecnico_nome || '').substring(0, 25), 20, y);
        doc.text((tec.equipe_nome || '').substring(0, 20), 75, y);
        doc.text(`R$ ${totalGanho.toFixed(2)}`, 125, y);
        doc.text(`R$ ${totalPago.toFixed(2)}`, 155, y);
        if (pendente > 0) doc.setTextColor(200, 0, 0);
        doc.text(`R$ ${pendente.toFixed(2)}`, 180, y);
        doc.setTextColor(0);
        y += 6;
      }

      y += 6;

      // ─── SERVIÇOS REALIZADOS ──────────────────────────────────────────
      if (lancsFiltrados.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFillColor(245, 158, 11);
        doc.rect(20, y, 170, 7, 'F');
        doc.setFontSize(10);
        doc.setTextColor(255);
        doc.text('SERVIÇOS REALIZADOS', 22, y + 5);
        doc.setTextColor(0);
        y += 12;

        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('Data', 20, y);
        doc.text('Técnico', 42, y);
        doc.text('Cliente', 82, y);
        doc.text('Tipo de Serviço', 122, y);
        doc.text('Valor Ganho', 172, y);
        y += 4;
        doc.setDrawColor(200);
        doc.line(20, y, 190, y);
        y += 4;

        doc.setTextColor(0);
        let totalServicos = 0;
        let totalComissoes = 0;
        for (const l of lancsFiltrados) {
          if (y > 270) { doc.addPage(); y = 20; }
          const dataStr = l.data_geracao ? format(new Date(l.data_geracao), 'dd/MM/yy') : '-';
          doc.setFontSize(7.5);
          doc.text(dataStr, 20, y);
          doc.text((l.tecnico_nome || '').substring(0, 18), 42, y);
          doc.text((l.cliente_nome || '').substring(0, 18), 82, y);
          doc.text(formatTipoServicoCompact(l.tipo_servico).substring(0, 22), 122, y);
          doc.setTextColor(0, 140, 0);
          doc.text(`R$ ${(l.valor_comissao_tecnico || 0).toFixed(2)}`, 172, y);
          doc.setTextColor(0);
          totalServicos += l.valor_total_servico || 0;
          totalComissoes += l.valor_comissao_tecnico || 0;
          y += 5.5;
        }

        // Total serviços
        y += 2;
        doc.setDrawColor(150);
        doc.line(122, y, 190, y);
        y += 4;
        doc.setFontSize(8.5);
        doc.setFont(undefined, 'bold');
        doc.text('Total', 122, y);
        doc.setTextColor(0, 140, 0);
        doc.text(`R$ ${totalComissoes.toFixed(2)}`, 172, y);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        y += 10;
      }

      // ─── PAGAMENTOS ───────────────────────────────────────────────────
      if (pagsFiltrados.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFillColor(16, 185, 129);
        doc.rect(20, y, 170, 7, 'F');
        doc.setFontSize(10);
        doc.setTextColor(255);
        doc.text('PAGAMENTOS REALIZADOS', 22, y + 5);
        doc.setTextColor(0);
        y += 12;

        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('Data', 20, y);
        doc.text('Hora', 38, y);
        doc.text('Técnico', 52, y);
        doc.text('Valor Pago', 100, y);
        doc.text('Método', 132, y);
        doc.text('Status', 164, y);
        y += 4;
        doc.setDrawColor(200);
        doc.line(20, y, 190, y);
        y += 4;

        doc.setTextColor(0);
        let totalPagoGeral = 0;
        for (const p of pagsFiltrados) {
          const temObs = p.observacao && p.observacao.trim().length > 0;
          const alturaLinha = temObs ? 11 : 6;
          if (y + alturaLinha > 270) { doc.addPage(); y = 20; }
          const dataStr = p.created_date ? format(new Date(p.created_date), 'dd/MM/yy') : '-';
          const horaStr = p.created_date ? format(new Date(p.created_date), 'HH:mm') : '-';
          doc.setFontSize(7.5);
          doc.text(dataStr, 20, y);
          doc.text(horaStr, 38, y);
          doc.text((p.tecnico_nome || '').substring(0, 22), 52, y);
          doc.setTextColor(0, 120, 200);
          doc.text(`R$ ${(p.valor_pago || 0).toFixed(2)}`, 100, y);
          doc.setTextColor(0);
          doc.text((p.metodo_pagamento || '-').substring(0, 16), 132, y);
          if (p.status === 'Estornado') doc.setTextColor(200, 0, 0);
          doc.text(p.status || '-', 164, y);
          doc.setTextColor(0);
          if (temObs) {
            doc.setFontSize(6.5);
            doc.setTextColor(120, 120, 120);
            const obsTexto = doc.splitTextToSize(`OBS: ${p.observacao}`, 140);
            doc.text(obsTexto[0], 52, y + 5);
            doc.setTextColor(0);
          }
          totalPagoGeral += p.valor_pago || 0;
          y += alturaLinha;
        }

        // Total pagamentos
        y += 2;
        doc.setDrawColor(150);
        doc.line(130, y, 190, y);
        y += 4;
        doc.setFontSize(8.5);
        doc.setFont(undefined, 'bold');
        doc.text('Total Pago', 130, y);
        doc.setTextColor(0, 120, 200);
        doc.text(`R$ ${totalPagoGeral.toFixed(2)}`, 165, y);
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
      }

      const nomeArquivo = `financeiro_${format(intervalo.inicio, 'dd-MM-yyyy')}_${format(intervalo.fim, 'dd-MM-yyyy')}.pdf`;
      doc.save(nomeArquivo);
      toast.success('PDF gerado com sucesso!');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGerando(false);
    }
  };

  const tecnicosParaSelecionar = filtroTipo === 'equipe' && equipeId
    ? tecnicos.filter(t => t.equipe_id === equipeId)
    : tecnicos;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Gerar Relatório PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Tipo de filtro */}
          <div className="space-y-2">
            <Label>Gerar relatório para</Label>
            <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); setEquipeId(''); setTecnicoId(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os membros</SelectItem>
                <SelectItem value="equipe">Por equipe</SelectItem>
                <SelectItem value="tecnico">Por membro individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de Equipe */}
          {filtroTipo === 'equipe' && (
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select value={equipeId} onValueChange={setEquipeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a equipe..." />
                </SelectTrigger>
                <SelectContent>
                  {equipes.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>{eq.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seleção de Técnico Individual */}
          {filtroTipo === 'tecnico' && (
            <div className="space-y-2">
              <Label>Membro da equipe</Label>
              <Select value={tecnicoId} onValueChange={setTecnicoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o membro..." />
                </SelectTrigger>
                <SelectContent>
                  {tecnicos.map(t => (
                    <SelectItem key={t.id} value={t.tecnico_id}>
                      {t.tecnico_nome} {t.equipe_nome ? `(${t.equipe_nome})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atual">Semana Atual</SelectItem>
                <SelectItem value="passada">Semana Passada</SelectItem>
                <SelectItem value="personalizado">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Datas personalizadas */}
          {periodo === 'personalizado' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
          )}

          {/* Preview do período */}
          {getIntervalo() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
              📅 Período: <strong>{format(getIntervalo().inicio, 'dd/MM/yyyy')}</strong> a <strong>{format(getIntervalo().fim, 'dd/MM/yyyy')}</strong>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 gap-2"
              style={{ background: 'linear-gradient(135deg, #1e40af, #f59e0b)' }}
              onClick={gerarPDF}
              disabled={gerando || (filtroTipo === 'equipe' && !equipeId) || (filtroTipo === 'tecnico' && !tecnicoId) || (periodo === 'personalizado' && (!dataInicio || !dataFim))}
            >
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {gerando ? 'Gerando...' : 'Gerar PDF'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}