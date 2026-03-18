import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, TrendingUp, AlertCircle, Check, X, FileText, Download, Calendar, Edit2, Trash2, Save, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RegistrarPagamentoModal from '@/components/financeiro/RegistrarPagamentoModal';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function FinanceiroAdmin() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [filtroSemana, setFiltroSemana] = useState('atual');
  const [showModalPagamento, setShowModalPagamento] = useState(false);
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState(null);
  const [loadingPagamento, setLoadingPagamento] = useState(false);
  const [pagamentoForm, setPagamentoForm] = useState({
    valor_pago: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    metodo_pagamento: 'PIX',
    nota: '',
    lancamentos_relacionados: []
  });
  const [editandoLancamento, setEditandoLancamento] = useState(null);
  const [editValor, setEditValor] = useState('');
  const [confirmCancelPagamento, setConfirmCancelPagamento] = useState(null);
  const [estornando, setEstornando] = useState(false);
  
  const { data: lancamentos = [], refetch: refetchLancamentos } = useQuery({
    queryKey: ['lancamentos'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list()
  });

  const { data: tecnicos = [], refetch: refetchTecnicos } = useQuery({
    queryKey: ['tecnicos'],
    queryFn: () => base44.entities.TecnicoFinanceiro.list()
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list()
  });

  const { data: pagamentos = [], refetch: refetchPagamentos } = useQuery({
    queryKey: ['pagamentos'],
    queryFn: () => base44.entities.PagamentoTecnico.list()
  });

  const updateLancamento = async (id, novoValor) => {
    try {
      // 1. Buscar lançamento atual
      const lancamentosAtuais = await base44.entities.LancamentoFinanceiro.filter({ id });
      const lancAtual = lancamentosAtuais[0];
      if (!lancAtual) throw new Error('Lançamento não encontrado');

      const valorAntigo = lancAtual.valor_comissao_tecnico;
      const valorNovo = parseFloat(novoValor) * 0.15;
      const diferenca = valorNovo - valorAntigo;

      // 2. Atualizar lançamento
      await base44.entities.LancamentoFinanceiro.update(id, {
        valor_total_servico: parseFloat(novoValor),
        valor_comissao_equipe: parseFloat(novoValor) * 0.30,
        valor_comissao_tecnico: valorNovo
      });

      // 3. Atualizar ganhos do técnico
      const tecnicosFinanceiros = await base44.entities.TecnicoFinanceiro.filter({ 
        tecnico_id: lancAtual.tecnico_id 
      });
      
      if (tecnicosFinanceiros.length > 0) {
        const tecFin = tecnicosFinanceiros[0];
        await base44.entities.TecnicoFinanceiro.update(tecFin.id, {
          credito_pendente: (tecFin.credito_pendente || 0) + diferenca,
          total_ganho: (tecFin.total_ganho || 0) + diferenca
        });
      }

      toast.success('Lançamento e ganhos atualizados');
      setEditandoLancamento(null);
    } catch (error) {
      toast.error('Erro ao atualizar lançamento');
    }
  };

  const [confirmDeleteLanc, setConfirmDeleteLanc] = useState(null);

  const handleCancelarPagamento = async (pagamento) => {
    setEstornando(true);
    try {
      const response = await base44.functions.invoke('estornarPagamentoTecnico', {
        pagamento_id: pagamento.id
      });

      if (response.data.success) {
        toast.success('Pagamento cancelado e crédito estornado com sucesso');
        await refetchLancamentos();
        await refetchPagamentos();
        await refetchTecnicos();
      } else {
        throw new Error(response.data.error || 'Erro ao cancelar pagamento');
      }
    } catch (error) {
      toast.error(error.message || 'Erro ao cancelar pagamento');
    } finally {
      setEstornando(false);
      setConfirmCancelPagamento(null);
    }
  };

  const deleteLancamento = async (id) => {
    try {
      // 1. Buscar lançamento antes de excluir
      const lancamentosAtuais = await base44.entities.LancamentoFinanceiro.filter({ id });
      const lancAtual = lancamentosAtuais[0];
      if (!lancAtual) throw new Error('Lançamento não encontrado');

      const valorRemover = lancAtual.valor_comissao_tecnico;

      // 2. Excluir lançamento
      await base44.entities.LancamentoFinanceiro.delete(id);

      // 3. Atualizar ganhos do técnico
      const tecnicosFinanceiros = await base44.entities.TecnicoFinanceiro.filter({ 
        tecnico_id: lancAtual.tecnico_id 
      });
      
      if (tecnicosFinanceiros.length > 0) {
        const tecFin = tecnicosFinanceiros[0];
        await base44.entities.TecnicoFinanceiro.update(tecFin.id, {
          credito_pendente: Math.max(0, (tecFin.credito_pendente || 0) - valorRemover),
          total_ganho: Math.max(0, (tecFin.total_ganho || 0) - valorRemover)
        });
      }

      toast.success('Lançamento excluído e ganhos atualizados');
    } catch (error) {
      toast.error('Erro ao excluir lançamento');
    }
    setConfirmDeleteLanc(null);
  };

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
          navigate('/Dashboard');
          return;
        }
        setIsAdmin(true);
      } catch {
        navigate('/Dashboard');
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, [navigate]);

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  if (!isAdmin) return null;

  // Filtrar técnicos e recalcular seus valores baseado apenas na semana atual
  const filteredTecnicos = tecnicos
    .filter(t => {
      const matchEquipe = !filtroEquipe || t.equipe_id === filtroEquipe;
      const matchTecnico = !filtroTecnico || t.tecnico_id.includes(filtroTecnico);
      return matchEquipe && matchTecnico;
    })
    .map(t => {
      // Filtrar lançamentos da semana atual para este técnico
      const agora = new Date();
      const inicioSemana = startOfWeek(agora, { weekStartsOn: 1 }); // 1 = Segunda-feira
      const fimSemana = endOfWeek(agora, { weekStartsOn: 1 });

      const lancamentosSemana = lancamentos.filter(l => {
        const dataGeracao = new Date(l.data_geracao);
        return (
          l.tecnico_id === t.tecnico_id &&
          dataGeracao >= inicioSemana &&
          dataGeracao <= fimSemana
        );
      });

      const creditoPendenteSemana = lancamentosSemana
        .filter(l => l.status === 'pendente')
        .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

      const creditoPagoSemana = lancamentosSemana
        .filter(l => l.status === 'pago')
        .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

      return {
        ...t,
        credito_pendente: creditoPendenteSemana,
        credito_pago: creditoPagoSemana,
        total_ganho: creditoPendenteSemana + creditoPagoSemana
      };
    });

  const lancamentosParaTecnico = (tecnico_id) => {
    return lancamentos.filter(l => l.tecnico_id === tecnico_id && l.status === 'pendente');
  };

  const handleRegistrarPagamento = async () => {
    if (!tecnicoSelecionado || !pagamentoForm.valor_pago) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoadingPagamento(true);
    try {
      // Buscar todos os lançamentos pendentes do técnico
      const lancamentosPendentes = lancamentos.filter(l => 
        l.tecnico_id === tecnicoSelecionado.tecnico_id && l.status === 'pendente'
      );

      const response = await base44.functions.invoke('registrarPagamentoTecnico', {
        tecnico_id: tecnicoSelecionado.tecnico_id,
        valor_pago: parseFloat(pagamentoForm.valor_pago),
        data_pagamento: pagamentoForm.data_pagamento,
        metodo_pagamento: pagamentoForm.metodo_pagamento,
        lancamentos_relacionados: lancamentosPendentes.map(l => l.id),
        nota: pagamentoForm.nota
      });

      if (response.data.success) {
        toast.success('Pagamento registrado com sucesso');
        await refetchLancamentos();
        await refetchTecnicos();
        await refetchPagamentos();
        setShowModalPagamento(false);
        setPagamentoForm({
          valor_pago: '',
          data_pagamento: new Date().toISOString().split('T')[0],
          metodo_pagamento: 'PIX',
          nota: '',
          lancamentos_relacionados: []
        });
        setTecnicoSelecionado(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao registrar pagamento');
    } finally {
      setLoadingPagamento(false);
    }
  };

  // Filtrar por semana (segunda 00:00 até domingo 23:59)
  const agora = new Date();
  const inicioSemanaAtual = startOfWeek(agora, { weekStartsOn: 1 }); // 1 = Segunda-feira
  const fimSemanaAtual = endOfWeek(agora, { weekStartsOn: 1 });
  const inicioSemanaPassada = new Date(inicioSemanaAtual);
  inicioSemanaPassada.setDate(inicioSemanaPassada.getDate() - 7);
  const fimSemanaPassada = new Date(fimSemanaAtual);
  fimSemanaPassada.setDate(fimSemanaPassada.getDate() - 7);

  const lancamentosFiltrados = lancamentos.filter(l => {
    const dataLancamento = new Date(l.data_geracao);
    if (filtroSemana === 'atual') {
      return dataLancamento >= inicioSemanaAtual && dataLancamento <= fimSemanaAtual;
    } else if (filtroSemana === 'passada') {
      return dataLancamento >= inicioSemanaPassada && dataLancamento <= fimSemanaPassada;
    }
    return true;
  });

  const pagamentosAtrasados = lancamentos.filter(l => {
    const dataLancamento = new Date(l.data_geracao);
    const diasPassados = Math.floor((agora - dataLancamento) / (1000 * 60 * 60 * 24));
    return l.status === 'pendente' && diasPassados > 7;
  });

  // Totais baseados nos valores recalculados da semana
  const totalPendente = filteredTecnicos.reduce((sum, t) => sum + (t.credito_pendente || 0), 0);
  const totalPago = filteredTecnicos.reduce((sum, t) => sum + (t.credito_pago || 0), 0);

  const gerarPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text('Relatório Financeiro - Casa do Ar', 20, 20);
      
      doc.setFontSize(10);
      doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 20, 30);
      doc.text(`Período: ${format(filtroSemana === 'atual' ? inicioSemanaAtual : inicioSemanaPassada, 'dd/MM/yyyy')} a ${format(filtroSemana === 'atual' ? fimSemanaAtual : fimSemanaPassada, 'dd/MM/yyyy')}`, 20, 37);
      
      let y = 50;
      
      // Seção de Créditos
      doc.setFontSize(12);
      doc.text('GESTÃO DE CRÉDITOS', 20, y);
      y += 8;
      doc.setFontSize(10);
      doc.text(`Total Pendente: R$ ${totalPendente.toFixed(2)}`, 20, y);
      y += 7;
      doc.text(`Total Pago: R$ ${totalPago.toFixed(2)}`, 20, y);
      y += 12;
      
      // Tabela de Técnicos
      doc.setFontSize(11);
      doc.text('Créditos por Técnico:', 20, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('Técnico', 20, y);
      doc.text('Equipe', 70, y);
      doc.text('Pendente', 110, y);
      doc.text('Pago', 150, y);
      doc.text('Total', 180, y);
      y += 5;
      
      doc.setTextColor(0);
      filteredTecnicos.forEach(tech => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(8);
        doc.text(tech.tecnico_nome.substring(0, 20), 20, y);
        doc.text(tech.equipe_nome.substring(0, 20), 70, y);
        doc.text(`R$ ${(tech.credito_pendente || 0).toFixed(2)}`, 110, y);
        doc.text(`R$ ${(tech.credito_pago || 0).toFixed(2)}`, 150, y);
        doc.text(`R$ ${(tech.total_ganho || 0).toFixed(2)}`, 180, y);
        y += 5;
      });

      y += 8;
      doc.setFontSize(11);
      doc.text('Comissões por Serviço:', 20, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('Equipe', 20, y);
      doc.text('Técnico', 50, y);
      doc.text('Cliente', 90, y);
      doc.text('Serviço', 130, y);
      doc.text('Valor', 170, y);
      doc.text('%', 190, y);
      y += 5;

      doc.setTextColor(0);
      lancamentosFiltrados.forEach(lanc => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const percentual = lanc.valor_total_servico > 0 ? ((lanc.valor_comissao_tecnico / lanc.valor_total_servico) * 100).toFixed(1) : 0;
        doc.setFontSize(8);
        doc.text(lanc.equipe_nome.substring(0, 15), 20, y);
        doc.text(lanc.tecnico_nome.substring(0, 15), 50, y);
        doc.text(lanc.cliente_nome.substring(0, 18), 90, y);
        doc.text(lanc.tipo_servico.substring(0, 18), 130, y);
        doc.text(`R$ ${lanc.valor_comissao_tecnico.toFixed(2)}`, 170, y);
        doc.text(`${percentual}%`, 190, y);
        y += 5;
      });

      if (pagamentosAtrasados.length > 0) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        y += 8;
        doc.setTextColor(255, 0, 0);
        doc.setFontSize(11);
        doc.text('⚠️ PAGAMENTOS EM ATRASO', 20, y);
        y += 7;
        doc.setTextColor(0);
        doc.setFontSize(9);
        pagamentosAtrasados.forEach(pag => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const diasAtraso = Math.floor((agora - new Date(pag.data_geracao)) / (1000 * 60 * 60 * 24));
          doc.text(`${pag.tecnico_nome} - R$ ${pag.valor_comissao_tecnico.toFixed(2)} (${diasAtraso} dias)`, 20, y);
          y += 5;
        });
      }
      
      doc.save(`relatorio_financeiro_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar PDF');
    }
  };

  return (
    <>
      <RegistrarPagamentoModal 
        open={showModalPagamento} 
        onClose={() => setShowModalPagamento(false)}
        onSuccess={() => {
          refetchPagamentos();
          refetchTecnicos();
        }}
      />
      <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Crédito Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalPendente.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Total a pagar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Crédito Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalPago.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Total já pago</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Técnicos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTecnicos.length}</div>
            <p className="text-xs text-gray-500 mt-1">Total na plataforma</p>
          </CardContent>
        </Card>
      </div>

      <Card>
         <CardHeader className="flex items-center justify-between">
           <CardTitle>Gestão de Créditos</CardTitle>
           <Button onClick={gerarPDF} size="sm" className="gap-2">
             <Download className="w-4 h-4" />
             Gerar PDF
           </Button>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-2">
               <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Período</Label>
               <Select value={filtroSemana} onValueChange={setFiltroSemana}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="atual">Semana Atual</SelectItem>
                   <SelectItem value="passada">Semana Passada</SelectItem>
                 </SelectContent>
               </Select>
             </div>
            <div className="space-y-2">
              <Label>Filtrar por Equipe</Label>
              <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas as equipes</SelectItem>
                  {equipes.map(eq => (
                    <SelectItem key={eq.id} value={eq.id}>{eq.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buscar Técnico</Label>
              <Input
                placeholder="Nome ou email..."
                value={filtroTecnico}
                onChange={(e) => setFiltroTecnico(e.target.value)}
              />
            </div>
            </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Crédito Pendente</TableHead>
                  <TableHead>Crédito Pago</TableHead>
                  <TableHead>Total Ganho</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTecnicos.map(tecnico => (
                  <TableRow key={tecnico.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tecnico.tecnico_nome}</p>
                        <p className="text-xs text-gray-500">{tecnico.tecnico_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{tecnico.equipe_nome}</TableCell>
                    <TableCell>
                      <Badge variant={tecnico.credito_pendente > 0 ? 'default' : 'secondary'}>
                        R$ {(tecnico.credito_pendente || 0).toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        R$ {(tecnico.credito_pago || 0).toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">
                      R$ {(tecnico.total_ganho || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => {
                          setTecnicoSelecionado(tecnico);
                          setShowModalPagamento(true);
                        }}
                        disabled={tecnico.credito_pendente <= 0}
                      >
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {pagamentosAtrasados.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700"><AlertCircle className="w-5 h-5" /> Pagamentos em Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pagamentosAtrasados.map(pag => {
                const diasAtraso = Math.floor((agora - new Date(pag.data_geracao)) / (1000 * 60 * 60 * 24));
                return (
                  <div key={pag.id} className="flex justify-between items-center p-3 bg-white rounded border border-red-200">
                    <div>
                      <p className="font-medium">{pag.tecnico_nome}</p>
                      <p className="text-sm text-gray-600">{pag.cliente_nome} - {pag.tipo_servico}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">R$ {pag.valor_comissao_tecnico.toFixed(2)}</p>
                      <p className="text-xs text-red-500">{diasAtraso} dias em atraso</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Relatório de Comissões por Serviço</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="overflow-x-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Equipe</TableHead>
                   <TableHead>Técnico</TableHead>
                   <TableHead>Cliente</TableHead>
                   <TableHead>Serviço</TableHead>
                   <TableHead>Valor Serviço</TableHead>
                   <TableHead>Comissão Técnico</TableHead>
                   <TableHead>% Ganha</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Ações</TableHead>
                   </TableRow>
                   </TableHeader>
               <TableBody>
                 {lancamentosFiltrados.map(lanc => {
                   const percentualGanho = lanc.valor_total_servico > 0
                     ? ((lanc.valor_comissao_tecnico / lanc.valor_total_servico) * 100).toFixed(1)
                     : 0;
                   return (
                     <TableRow key={lanc.id}>
                       <TableCell className="font-medium">{lanc.equipe_nome}</TableCell>
                       <TableCell className="text-sm">{lanc.tecnico_nome}</TableCell>
                       <TableCell className="text-sm">{lanc.cliente_nome}</TableCell>
                       <TableCell className="text-sm">{lanc.tipo_servico}</TableCell>
                       <TableCell className="font-semibold">
                         {editandoLancamento === lanc.id ? (
                           <Input
                             type="number"
                             step="0.01"
                             value={editValor}
                             onChange={(e) => setEditValor(e.target.value)}
                             className="w-24"
                             autoFocus
                           />
                         ) : (
                           `R$ ${lanc.valor_total_servico.toFixed(2)}`
                         )}
                       </TableCell>
                       <TableCell className="font-bold text-green-600">R$ {lanc.valor_comissao_tecnico.toFixed(2)}</TableCell>
                       <TableCell className="font-semibold text-blue-600">{percentualGanho}%</TableCell>
                       <TableCell>
                         <Badge variant={lanc.status === 'pendente' ? 'destructive' : lanc.status === 'pago' ? 'default' : 'secondary'}>
                           {lanc.status === 'pendente' ? 'Pendente' : lanc.status === 'pago' ? 'Pago' : 'Creditado'}
                         </Badge>
                       </TableCell>
                       <TableCell className="space-x-1">
                         {editandoLancamento === lanc.id ? (
                           <>
                             <Button
                               size="sm"
                               variant="ghost"
                               onClick={() => updateLancamento(lanc.id, editValor)}
                             >
                               <Save className="w-4 h-4 text-green-600" />
                             </Button>
                             <Button
                               size="sm"
                               variant="ghost"
                               onClick={() => setEditandoLancamento(null)}
                             >
                               <X className="w-4 h-4 text-red-600" />
                             </Button>
                           </>
                         ) : (
                           <>
                             <Button
                               size="sm"
                               variant="ghost"
                               onClick={() => {
                                 setEditandoLancamento(lanc.id);
                                 setEditValor(lanc.valor_total_servico.toString());
                               }}
                             >
                               <Edit2 className="w-4 h-4 text-blue-600" />
                             </Button>
                             <Button
                               size="sm"
                               variant="ghost"
                               onClick={() => setConfirmDeleteLanc(lanc)}
                             >
                               <Trash2 className="w-4 h-4 text-red-600" />
                             </Button>
                           </>
                         )}
                       </TableCell>
                     </TableRow>
                   );
                 })}
               </TableBody>
             </Table>
           </div>
         </CardContent>
       </Card>

      <Card>
         <CardHeader>
           <CardTitle>Histórico de Pagamentos</CardTitle>
         </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map(pag => (
                  <TableRow key={pag.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pag.tecnico_nome}</p>
                        <p className="text-xs text-gray-500">{pag.metodo_pagamento}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">R$ {pag.valor_pago.toFixed(2)}</TableCell>
                    <TableCell>{format(parseISO(pag.created_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>{pag.metodo_pagamento}</TableCell>
                    <TableCell>
                      <Badge variant={pag.status === 'Confirmado' ? 'default' : 'destructive'}>
                        {pag.status === 'Confirmado' ? 'Confirmado' : pag.status === 'Estornado' ? 'Estornado' : 'Cancelado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pag.status === 'Confirmado' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmCancelPagamento(pag)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      )}
                      {pag.status === 'Estornado' && pag.motivo_estorno && (
                        <p className="text-xs text-gray-500">{pag.motivo_estorno}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showModalPagamento} onOpenChange={setShowModalPagamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento - {tecnicoSelecionado?.tecnico_nome}</DialogTitle>
          </DialogHeader>

          {tecnicoSelecionado && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  Crédito Pendente: <strong>R$ {(tecnicoSelecionado.credito_pendente || 0).toFixed(2)}</strong>
                </p>
              </div>

              <div className="space-y-2">
                 <Label>Valor a Pagar *</Label>
                 <div className="flex gap-2 mb-2">
                   <Button
                     type="button"
                     size="sm"
                     variant="outline"
                     onClick={() => setPagamentoForm({ ...pagamentoForm, valor_pago: tecnicoSelecionado.credito_pendente.toString() })}
                     className="flex-1"
                   >
                     Quitar Tudo (R$ {tecnicoSelecionado.credito_pendente.toFixed(2)})
                   </Button>
                 </div>
                 <Input
                   type="number"
                   step="0.01"
                   value={pagamentoForm.valor_pago}
                   onChange={(e) => setPagamentoForm({ ...pagamentoForm, valor_pago: e.target.value })}
                   placeholder="0.00"
                 />
                 {pagamentoForm.valor_pago && parseFloat(pagamentoForm.valor_pago) < tecnicoSelecionado.credito_pendente && (
                   <p className="text-xs text-amber-600 mt-1">⚠️ Valor parcial: faltam R$ {(tecnicoSelecionado.credito_pendente - parseFloat(pagamentoForm.valor_pago)).toFixed(2)}</p>
                 )}
               </div>

              <div className="space-y-2">
                <Label>Data do Pagamento *</Label>
                <Input
                  type="date"
                  value={pagamentoForm.data_pagamento}
                  onChange={(e) => setPagamentoForm({ ...pagamentoForm, data_pagamento: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Método de Pagamento *</Label>
                <Select
                  value={pagamentoForm.metodo_pagamento}
                  onValueChange={(value) => setPagamentoForm({ ...pagamentoForm, metodo_pagamento: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nota (Opcional)</Label>
                <Textarea
                  value={pagamentoForm.nota}
                  onChange={(e) => setPagamentoForm({ ...pagamentoForm, nota: e.target.value })}
                  placeholder="Observações sobre o pagamento..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalPagamento(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarPagamento}
              disabled={loadingPagamento}
            >
              {loadingPagamento ? 'Registrando...' : 'Registrar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteLanc}
        onClose={() => setConfirmDeleteLanc(null)}
        onConfirm={() => deleteLancamento(confirmDeleteLanc.id)}
        title="Excluir Lançamento Financeiro"
        description={`Tem certeza que deseja excluir o lançamento de R$ ${confirmDeleteLanc?.valor_comissao_tecnico?.toFixed(2)} para ${confirmDeleteLanc?.tecnico_nome}? Esta ação irá recalcular automaticamente os créditos do técnico.`}
        confirmText="Excluir Lançamento"
        variant="destructive"
      />

      <ConfirmDialog
        open={!!confirmCancelPagamento}
        onClose={() => setConfirmCancelPagamento(null)}
        onConfirm={() => handleCancelarPagamento(confirmCancelPagamento)}
        title="Cancelar Pagamento"
        description={`Tem certeza que deseja cancelar o pagamento de R$ ${confirmCancelPagamento?.valor_pago?.toFixed(2)} para ${confirmCancelPagamento?.tecnico_nome}? O crédito será devolvido como pendente.`}
        confirmText={estornando ? "Cancelando..." : "Sim, Cancelar Pagamento"}
        variant="destructive"
        disabled={estornando}
      />
      </div>
      </>
      );
      }