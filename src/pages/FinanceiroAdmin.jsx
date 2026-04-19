import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, TrendingUp, TrendingDown, AlertCircle, Check, X, FileText, Download, Calendar, Edit2, Trash2, Save, XCircle, Eye, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RegistrarPagamentoModal from '@/components/financeiro/RegistrarPagamentoModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import GerarPDFModal from '@/components/financeiro/GerarPDFModal';
import { formatTipoServicoCompact } from '@/utils';

export default function FinanceiroAdmin() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtroEquipe, setFiltroEquipe] = useState('todas');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [filtroSemana, setFiltroSemana] = useState('atual');
  const [showModalPagamento, setShowModalPagamento] = useState(false);
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState(null);
  const [loadingPagamento, setLoadingPagamento] = useState(false);
  const [editandoLancamento, setEditandoLancamento] = useState(null);
  const [editValor, setEditValor] = useState('');
  const [editPercentual, setEditPercentual] = useState('');
  const [confirmCancelPagamento, setConfirmCancelPagamento] = useState(null);
  const [estornando, setEstornando] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [filtroTecnicoRelatorio, setFiltroTecnicoRelatorio] = useState('all');
  const [pagamentoDetalhes, setPagamentoDetalhes] = useState(null);
  
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

  const updateLancamento = async (id, novoValor, novoPercentual) => {
    try {
      const lancamentosAtuais = await base44.entities.LancamentoFinanceiro.filter({ id });
      const lancAtual = lancamentosAtuais[0];
      if (!lancAtual) throw new Error('Lançamento não encontrado');

      const pct = parseFloat(novoPercentual) / 100;
      const valorAntigo = lancAtual.valor_comissao_tecnico;
      const valorServico = parseFloat(novoValor);
      const valorNovo = valorServico * pct;
      const diferenca = valorNovo - valorAntigo;

      await base44.entities.LancamentoFinanceiro.update(id, {
        valor_total_servico: valorServico,
        percentual_tecnico: parseFloat(novoPercentual),
        valor_comissao_equipe: valorServico * 0.30,
        valor_comissao_tecnico: valorNovo
      });

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

  // Filtrar por semana (segunda 00:00 até domingo 23:59) - DECLARAR PRIMEIRO
  const agora = new Date();
  const inicioSemanaAtual = startOfWeek(agora, { weekStartsOn: 1 }); // 1 = Segunda-feira
  const fimSemanaAtual = endOfWeek(agora, { weekStartsOn: 1 });
  const inicioSemanaPassada = new Date(inicioSemanaAtual);
  inicioSemanaPassada.setDate(inicioSemanaPassada.getDate() - 7);
  const fimSemanaPassada = new Date(fimSemanaAtual);
  fimSemanaPassada.setDate(fimSemanaPassada.getDate() - 7);

  // Filtrar técnicos e recalcular seus valores baseado apenas na semana selecionada
  const filteredTecnicos = tecnicos
    .filter(t => {
      const matchEquipe = filtroEquipe === 'todas' || !filtroEquipe || t.equipe_id === filtroEquipe;
      const matchTecnico = !filtroTecnico || t.tecnico_id.includes(filtroTecnico);
      return matchEquipe && matchTecnico;
    })
    .map(t => {
      // Definir intervalo da semana com base no filtro
      let inicioSemana, fimSemana;
      
      if (filtroSemana === 'atual') {
        inicioSemana = inicioSemanaAtual;
        fimSemana = fimSemanaAtual;
      } else if (filtroSemana === 'passada') {
        inicioSemana = inicioSemanaPassada;
        fimSemana = fimSemanaPassada;
      } else {
        // Sem filtro de semana, usar tudo
        inicioSemana = new Date(0);
        fimSemana = new Date();
      }

      // Calcular comissões ganhas na semana
      const lancamentosSemana = lancamentos.filter(l => {
        if (l.tecnico_id !== t.tecnico_id) return false;
        if (!l.data_geracao) return false;
        const dataGeracao = new Date(l.data_geracao);
        return dataGeracao >= inicioSemana && dataGeracao <= fimSemana;
      });

      const totalComissoesSemana = lancamentosSemana
        .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

      // Calcular pagamentos feitos ao técnico na semana
      const pagamentosSemana = pagamentos.filter(p => {
        if (p.tecnico_id !== t.tecnico_id) return false;
        if (p.status !== 'Confirmado') return false;
        if (!p.created_date) return false;
        const dataPagamento = new Date(p.created_date);
        return dataPagamento >= inicioSemana && dataPagamento <= fimSemana;
      });

      const totalPagoSemana = pagamentosSemana
        .reduce((sum, p) => sum + (p.valor_pago || 0), 0);

      // Saldo acumulado de todas as semanas anteriores ao período selecionado
      // Positivo = empresa deve ao técnico | Negativo = técnico recebeu a mais (deve devolver)
      const SALDO_INICIO = new Date('2026-04-20T00:00:00');
      let saldo_anterior = 0;
      if (inicioSemana > SALDO_INICIO) {
        const comissoesAnteriores = lancamentos
          .filter(l => l.tecnico_id === t.tecnico_id && l.data_geracao &&
                       new Date(l.data_geracao) >= SALDO_INICIO &&
                       new Date(l.data_geracao) < inicioSemana)
          .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

        const pagamentosAnteriores = pagamentos
          .filter(p => p.tecnico_id === t.tecnico_id && p.status === 'Confirmado' && p.created_date &&
                       new Date(p.created_date) >= SALDO_INICIO &&
                       new Date(p.created_date) < inicioSemana)
          .reduce((sum, p) => sum + (p.valor_pago || 0), 0);

        saldo_anterior = comissoesAnteriores - pagamentosAnteriores;
        // +: técnico tem crédito a receber de semanas anteriores
        // -: técnico foi pago a mais, esse excesso desconta desta semana
      }

      // Crédito líquido = ganhou esta semana + saldo anterior - já recebeu esta semana
      const creditoPendenteLiquido = Math.max(0, totalComissoesSemana + saldo_anterior - totalPagoSemana);

      return {
        ...t,
        credito_pendente: creditoPendenteLiquido,
        credito_pago: totalPagoSemana,
        total_ganho: totalComissoesSemana,
        saldo_anterior,
      };
    });



  const lancamentosFiltrados = lancamentos.filter(l => {
    const dataLancamento = new Date(l.data_geracao);
    const matchSemana = filtroSemana === 'atual'
      ? dataLancamento >= inicioSemanaAtual && dataLancamento <= fimSemanaAtual
      : filtroSemana === 'passada'
      ? dataLancamento >= inicioSemanaPassada && dataLancamento <= fimSemanaPassada
      : true;
    const matchTecnico = !filtroTecnicoRelatorio || filtroTecnicoRelatorio === 'all' || l.tecnico_id === filtroTecnicoRelatorio;
    return matchSemana && matchTecnico;
  });

  // Técnicos com saldo não-zero (crédito ou débito de semanas anteriores)
  const tecnicosComSaldoAnterior = filteredTecnicos.filter(t => Math.abs(t.saldo_anterior || 0) > 0.01);

  // Totais baseados nos valores recalculados da semana
  const totalPendente = filteredTecnicos.reduce((sum, t) => sum + (t.credito_pendente || 0), 0);
  const totalPago = filteredTecnicos.reduce((sum, t) => sum + (t.credito_pago || 0), 0);

  return (
    <>
      <GerarPDFModal
        open={showPDFModal}
        onClose={() => setShowPDFModal(false)}
        equipes={equipes}
        tecnicos={tecnicos}
        lancamentos={lancamentos}
        pagamentos={pagamentos}
      />
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
           <div className="flex gap-2">
             <Button
               onClick={() => setShowModalPagamento(true)}
               size="sm"
               className="gap-2 bg-green-600 hover:bg-green-700"
             >
               <DollarSign className="w-4 h-4" />
               Pagar
             </Button>
             <Button
               onClick={() => setShowPDFModal(true)}
               size="sm"
               className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
             >
               <Download className="w-4 h-4" />
               Gerar PDF
             </Button>
           </div>
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
                  <SelectItem value="todas">Todas as equipes</SelectItem>
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
                  <TableHead>
                    <div className="flex flex-col">
                      <span>Saldo Sem. Anterior</span>
                      <span className="text-[10px] font-normal text-gray-400 normal-case">+ = a receber / - = a devolver</span>
                    </div>
                  </TableHead>
                  <TableHead>Crédito Pendente</TableHead>
                  <TableHead>Crédito Pago</TableHead>
                  <TableHead>Total Ganho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTecnicos.map(tecnico => {
                  const saldo = tecnico.saldo_anterior || 0;
                  return (
                  <TableRow key={tecnico.id} className={Math.abs(saldo) > 0.01 ? (saldo > 0 ? 'bg-emerald-50' : 'bg-red-50') : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tecnico.tecnico_nome}</p>
                        <p className="text-xs text-gray-500">{tecnico.tecnico_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>{tecnico.equipe_nome}</TableCell>
                    <TableCell>
                      {Math.abs(saldo) > 0.01 ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge className={saldo > 0
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-red-100 text-red-700 border border-red-300'
                          }>
                            {saldo > 0 ? '+' : ''}R$ {saldo.toFixed(2)}
                          </Badge>
                          <span className={`text-[10px] font-semibold ${saldo > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {saldo > 0 ? '▲ crédito a receber' : '▼ recebeu a mais'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>
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
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {tecnicosComSaldoAnterior.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Créditos a pagar (técnico tem saldo positivo de semanas anteriores) */}
          {tecnicosComSaldoAnterior.filter(t => t.saldo_anterior > 0).length > 0 && (
            <Card className="border-emerald-300 bg-emerald-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-emerald-700 text-sm">
                  <TrendingUp className="w-5 h-5" />
                  Créditos de Semanas Anteriores
                </CardTitle>
                <p className="text-xs text-emerald-600">Técnicos que têm valor a receber de semanas passadas</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tecnicosComSaldoAnterior.filter(t => t.saldo_anterior > 0).map(tec => (
                    <div key={tec.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-emerald-200">
                      <div>
                        <p className="font-semibold text-gray-800">{tec.tecnico_nome}</p>
                        <p className="text-xs text-gray-500">{tec.equipe_nome}</p>
                        <p className="text-[11px] text-emerald-600 font-medium mt-0.5">✓ Saldo positivo acumulado</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 text-lg">+R$ {tec.saldo_anterior.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400">já incluso no crédito pendente</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Débitos (técnico recebeu mais do que fez) */}
          {tecnicosComSaldoAnterior.filter(t => t.saldo_anterior < 0).length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-700 text-sm">
                  <TrendingDown className="w-5 h-5" />
                  Débitos de Semanas Anteriores
                </CardTitle>
                <p className="text-xs text-red-600">Técnicos que receberam mais do que produziram — já descontado do crédito pendente</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tecnicosComSaldoAnterior.filter(t => t.saldo_anterior < 0).map(tec => (
                    <div key={tec.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-red-200">
                      <div>
                        <p className="font-semibold text-gray-800">{tec.tecnico_nome}</p>
                        <p className="text-xs text-gray-500">{tec.equipe_nome}</p>
                        <p className="text-[11px] text-red-600 font-medium mt-0.5">⚠ Recebeu além do produzido</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600 text-lg">-R$ {Math.abs(tec.saldo_anterior).toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400">já descontado do crédito pendente</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Relatório de Comissões por Serviço</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="mb-4 flex items-center gap-3">
             <Label className="text-sm whitespace-nowrap">Filtrar por Técnico:</Label>
             <Select value={filtroTecnicoRelatorio} onValueChange={setFiltroTecnicoRelatorio}>
               <SelectTrigger className="w-64">
                 <SelectValue placeholder="Todos os técnicos" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos os técnicos</SelectItem>
                 {tecnicos.map(t => (
                   <SelectItem key={t.tecnico_id} value={t.tecnico_id}>{t.tecnico_nome}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
           <div className="overflow-x-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Data/Hora Conclusão</TableHead>
                   <TableHead>Equipe</TableHead>
                   <TableHead>Técnico</TableHead>
                   <TableHead>Cliente</TableHead>
                   <TableHead>Serviço</TableHead>
                   <TableHead>Valor Serviço</TableHead>
                   <TableHead>Comissão Técnico</TableHead>
                   <TableHead>% Ganha</TableHead>
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
                       <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                         {lanc.data_geracao ? (
                           <>
                             <div>{format(parseISO(lanc.data_geracao), 'dd/MM/yyyy', { locale: ptBR })}</div>
                             <div className="text-xs text-gray-400">{format(parseISO(lanc.data_geracao), 'HH:mm', { locale: ptBR })}</div>
                           </>
                         ) : '-'}
                       </TableCell>
                       <TableCell className="font-medium">{lanc.equipe_nome}</TableCell>
                       <TableCell className="text-sm">{lanc.tecnico_nome}</TableCell>
                       <TableCell className="text-sm">{lanc.cliente_nome}</TableCell>
                       <TableCell className="text-sm">{formatTipoServicoCompact(lanc.tipo_servico)}</TableCell>
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
                       <TableCell className="font-semibold text-blue-600">
                         {editandoLancamento === lanc.id ? (
                           <div className="flex items-center gap-1">
                             <Input
                               type="number"
                               step="0.1"
                               min="0"
                               max="100"
                               value={editPercentual}
                               onChange={(e) => setEditPercentual(e.target.value)}
                               className="w-16"
                             />
                             <span className="text-xs">%</span>
                           </div>
                         ) : (
                           `${percentualGanho}%`
                         )}
                       </TableCell>
                       <TableCell className="space-x-1">
                         {editandoLancamento === lanc.id ? (
                           <>
                             <Button
                               size="sm"
                               variant="ghost"
                               onClick={() => updateLancamento(lanc.id, editValor, editPercentual)}
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
                                 setEditPercentual((lanc.percentual_tecnico ?? parseFloat(percentualGanho)).toString());
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
                {pagamentos.filter(pag => {
                  if (!pag.created_date) return false;
                  const dataPag = new Date(pag.created_date);
                  return dataPag >= inicioSemanaAtual && dataPag <= fimSemanaAtual;
                }).map(pag => (
                  <TableRow key={pag.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setPagamentoDetalhes(pag)}>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); setPagamentoDetalhes(pag); }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {pag.status === 'Confirmado' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setConfirmCancelPagamento(pag); }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancelar
                          </Button>
                        )}
                        {pag.status === 'Estornado' && (
                          <div className="space-y-1">
                            {pag.motivo_estorno && (
                              <p className="text-xs text-gray-500">{pag.motivo_estorno}</p>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm('Tem certeza que deseja remover este pagamento estornado da lista?')) {
                                  try {
                                    await base44.entities.PagamentoTecnico.delete(pag.id);
                                    toast.success('Pagamento removido da lista');
                                    refetchPagamentos();
                                  } catch (error) {
                                    toast.error('Erro ao remover pagamento');
                                  }
                                }
                              }}
                              className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remover
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>



      {/* Modal Detalhes do Pagamento */}
      <Dialog open={!!pagamentoDetalhes} onOpenChange={() => setPagamentoDetalhes(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
          </DialogHeader>
          {pagamentoDetalhes && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                <p className="text-white/80 text-xs mb-1">Técnico</p>
                <h3 className="font-bold text-xl">{pagamentoDetalhes.tecnico_nome}</h3>
                <p className="text-2xl font-bold mt-2">R$ {pagamentoDetalhes.valor_pago?.toFixed(2)}</p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-500">Data</span>
                  <span className="font-medium">
                    {pagamentoDetalhes.created_date
                      ? format(new Date(pagamentoDetalhes.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : pagamentoDetalhes.data_pagamento || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-500">Método</span>
                  <span className="font-medium">{pagamentoDetalhes.metodo_pagamento || '-'}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={pagamentoDetalhes.status === 'Confirmado' ? 'default' : 'destructive'}>
                    {pagamentoDetalhes.status === 'Confirmado' ? 'Confirmado' : pagamentoDetalhes.status === 'Estornado' ? 'Estornado' : 'Cancelado'}
                  </Badge>
                </div>

                {/* OBS */}
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    OBS
                  </div>
                  {pagamentoDetalhes.observacao
                    ? <p className="text-gray-700">{pagamentoDetalhes.observacao}</p>
                    : <p className="text-gray-400 italic">Sem observações</p>
                  }
                </div>

                {pagamentoDetalhes.motivo_estorno && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-xs text-red-500 mb-1">Motivo do Estorno</p>
                    <p className="text-red-700 text-sm">{pagamentoDetalhes.motivo_estorno}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteLanc}
        onClose={() => setConfirmDeleteLanc(null)}
        onConfirm={() => confirmDeleteLanc && deleteLancamento(confirmDeleteLanc.id)}
        title="Excluir Lançamento Financeiro"
        description={`Tem certeza que deseja excluir o lançamento de R$ ${confirmDeleteLanc?.valor_comissao_tecnico?.toFixed(2)} para ${confirmDeleteLanc?.tecnico_nome}? Esta ação irá recalcular automaticamente os créditos do técnico.`}
        confirmText="Excluir Lançamento"
        variant="destructive"
      />

      <ConfirmDialog
        open={!!confirmCancelPagamento}
        onClose={() => setConfirmCancelPagamento(null)}
        onConfirm={() => confirmCancelPagamento && handleCancelarPagamento(confirmCancelPagamento)}
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