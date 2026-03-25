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
import { DollarSign, Users, TrendingUp, AlertCircle, Check, X, FileText, Download, Calendar, Edit2, Trash2, Save, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import RegistrarPagamentoModal from '@/components/financeiro/RegistrarPagamentoModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import GerarPDFModal from '@/components/financeiro/GerarPDFModal';

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
  const [editandoLancamento, setEditandoLancamento] = useState(null);
  const [editValor, setEditValor] = useState('');
  const [confirmCancelPagamento, setConfirmCancelPagamento] = useState(null);
  const [estornando, setEstornando] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  
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
      const matchEquipe = !filtroEquipe || t.equipe_id === filtroEquipe;
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

      const creditoPendenteSemana = Math.max(0, totalComissoesSemana - totalPagoSemana);

      return {
        ...t,
        credito_pendente: creditoPendenteSemana,
        credito_pago: totalPagoSemana,
        total_ganho: totalComissoesSemana
      };
    });



  const lancamentosFiltrados = lancamentos.filter(l => {
    const dataLancamento = new Date(l.data_geracao);
    if (filtroSemana === 'atual') {
      return dataLancamento >= inicioSemanaAtual && dataLancamento <= fimSemanaAtual;
    } else if (filtroSemana === 'passada') {
      return dataLancamento >= inicioSemanaPassada && dataLancamento <= fimSemanaPassada;
    }
    return true;
  });

  // Débitos de semanas anteriores por técnico
  const tecnicosComDebitoAnterior = tecnicos
    .filter(t => !filtroEquipe || t.equipe_id === filtroEquipe)
    .map(t => {
      const comissoesAnteriores = lancamentos
        .filter(l => l.tecnico_id === t.tecnico_id && l.data_geracao && new Date(l.data_geracao) < inicioSemanaAtual)
        .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

      const pagamentosAnteriores = pagamentos
        .filter(p => p.tecnico_id === t.tecnico_id && p.status === 'Confirmado' && p.created_date && new Date(p.created_date) < inicioSemanaAtual)
        .reduce((sum, p) => sum + (p.valor_pago || 0), 0);

      const debito = Math.max(0, comissoesAnteriores - pagamentosAnteriores);
      return { ...t, debito_anterior: debito };
    })
    .filter(t => t.debito_anterior > 0.01);

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
           <Button onClick={() => setShowPDFModal(true)} size="sm" className="gap-2">
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

      {tecnicosComDebitoAnterior.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700"><AlertCircle className="w-5 h-5" /> Débitos de Semanas Anteriores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-600 mb-3">Técnicos com saldo não quitado de semanas anteriores:</p>
            <div className="space-y-2">
              {tecnicosComDebitoAnterior.map(tec => (
                <div key={tec.id} className="flex justify-between items-center p-3 bg-white rounded border border-orange-200">
                  <div>
                    <p className="font-medium">{tec.tecnico_nome}</p>
                    <p className="text-xs text-gray-500">{tec.equipe_nome}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-orange-600">R$ {tec.debito_anterior.toFixed(2)}</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setTecnicoSelecionado({ ...tec, credito_pendente: tec.debito_anterior });
                        setShowModalPagamento(true);
                      }}
                    >
                      Pagar
                    </Button>
                  </div>
                </div>
              ))}
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
                {pagamentos.filter(pag => {
                  if (!pag.created_date) return false;
                  const dataPag = new Date(pag.created_date);
                  return dataPag >= inicioSemanaAtual && dataPag <= fimSemanaAtual;
                }).map(pag => (
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
                      {pag.status === 'Estornado' && (
                        <div className="space-y-1">
                          {pag.motivo_estorno && (
                            <p className="text-xs text-gray-500">{pag.motivo_estorno}</p>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>



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