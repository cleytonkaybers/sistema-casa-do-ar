import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, MinusCircle, TrendingUp, ChevronDown, ChevronRight, Clock, CheckCircle2, Pencil, PlusCircle } from 'lucide-react';
import { differenceInDays, parseISO, isValid, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Juros SIMPLES: % ao mes proporcional aos dias decorridos. Atualizado diariamente.
// Ex.: R$ 1.000 a 10% a.m. apos 15 dias = R$ 1.000 + (1.000 * 0,1/30 * 15) = R$ 1.050.
function calcularDebitoAtual(emprestimo) {
  const { valor_principal, percentual_mes, data_emprestimo, total_abatido } = emprestimo;
  if (!valor_principal || !percentual_mes || !data_emprestimo) return valor_principal || 0;
  const inicio = parseISO(data_emprestimo);
  if (!isValid(inicio)) return valor_principal;
  const dias = Math.max(0, differenceInDays(new Date(), inicio));
  const taxaDiaria = percentual_mes / 100 / 30;
  const juros = valor_principal * taxaDiaria * dias;
  return Math.max(0, valor_principal + juros - (total_abatido || 0));
}

function calcularJurosAcumulados(emprestimo) {
  const { valor_principal, percentual_mes, data_emprestimo } = emprestimo;
  if (!valor_principal || !percentual_mes || !data_emprestimo) return 0;
  const inicio = parseISO(data_emprestimo);
  if (!isValid(inicio)) return 0;
  const dias = Math.max(0, differenceInDays(new Date(), inicio));
  const taxaDiaria = percentual_mes / 100 / 30;
  const juros = valor_principal * taxaDiaria * dias;
  return Math.max(0, juros);
}

function formatMoney(v) {
  return `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '-';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

function formatDateTime(d) {
  if (!d) return '-';
  try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return d; }
}

const emptyForm = {
  cliente_nome: '',
  valor_principal: '',
  data_emprestimo: '',
  percentual_mes: '',
  data_estimada_recebimento: '',
  observacoes: '',
};

export default function EmprestimosTable() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingEmprestimo, setEditingEmprestimo] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [abatimentoModal, setAbatimentoModal] = useState(null);
  const [valorAbatimento, setValorAbatimento] = useState('');
  const [obsAbatimento, setObsAbatimento] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [aporteModal, setAporteModal] = useState(null);
  const [valorAporte, setValorAporte] = useState('');
  const [obsAporte, setObsAporte] = useState('');

  const { data: emprestimos = [], isLoading } = useQuery({
    queryKey: ['emprestimos'],
    queryFn: () => base44.entities.Emprestimo.list('-data_emprestimo'),
    refetchInterval: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Emprestimo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      setShowForm(false);
      setForm(emptyForm);
      toast.success('Empréstimo lançado!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Emprestimo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      setShowForm(false);
      setEditingEmprestimo(null);
      setForm(emptyForm);
      toast.success('Empréstimo atualizado!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Emprestimo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      toast.success('Removido!');
    },
  });

  const abatirMutation = useMutation({
    mutationFn: ({ id, novoTotal, historico }) =>
      base44.entities.Emprestimo.update(id, { total_abatido: novoTotal, historico_pagamentos: historico }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      setAbatimentoModal(null);
      setValorAbatimento('');
      setObsAbatimento('');
      toast.success('Abatimento registrado!');
    },
  });

  const quitarMutation = useMutation({
    mutationFn: ({ id, historico }) =>
      base44.entities.Emprestimo.update(id, { status: 'quitado', historico_pagamentos: historico }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      toast.success('Empréstimo quitado!');
    },
  });

  const reativarMutation = useMutation({
    mutationFn: ({ id, historico }) =>
      base44.entities.Emprestimo.update(id, { status: 'ativo', historico_pagamentos: historico }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      toast.success('Empréstimo reativado!');
    },
  });

  const aporteMutation = useMutation({
    mutationFn: ({ id, novoValor, historico }) =>
      base44.entities.Emprestimo.update(id, { valor_principal: novoValor, historico_pagamentos: historico }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      setAporteModal(null);
      setValorAporte('');
      setObsAporte('');
      toast.success('Aporte registrado!');
    },
  });

  const handleAporte = () => {
    const val = parseFloat(valorAporte);
    if (!val || val <= 0) { toast.error('Informe um valor válido'); return; }
    const debitoAtual = calcularDebitoAtual(aporteModal);
    const novoValor = (aporteModal.valor_principal || 0) + val;
    const historico = [
      ...(aporteModal.historico_pagamentos || []),
      {
        data: new Date().toISOString(),
        tipo: 'aporte',
        valor: val,
        debito_antes: debitoAtual,
        debito_depois: debitoAtual + val,
        observacao: obsAporte || '',
      }
    ];
    aporteMutation.mutate({ id: aporteModal.id, novoValor, historico });
  };

  const handleReativar = (e) => {
    const historico = [
      ...(e.historico_pagamentos || []),
      {
        data: new Date().toISOString(),
        tipo: 'criacao',
        valor: 0,
        debito_antes: 0,
        debito_depois: 0,
        observacao: 'Empréstimo reativado (quitado por engano)',
      }
    ];
    reativarMutation.mutate({ id: e.id, historico });
  };

  const openEdit = (e) => {
    setEditingEmprestimo(e);
    setForm({
      cliente_nome: e.cliente_nome || '',
      valor_principal: String(e.valor_principal || ''),
      data_emprestimo: e.data_emprestimo || '',
      percentual_mes: String(e.percentual_mes || ''),
      data_estimada_recebimento: e.data_estimada_recebimento || '',
      observacoes: e.observacoes || '',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.cliente_nome || !form.valor_principal || !form.data_emprestimo || !form.percentual_mes) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    const baseData = {
      cliente_nome: form.cliente_nome,
      valor_principal: parseFloat(form.valor_principal),
      percentual_mes: parseFloat(form.percentual_mes),
      data_emprestimo: form.data_emprestimo,
      observacoes: form.observacoes,
      ...(form.data_estimada_recebimento ? { data_estimada_recebimento: form.data_estimada_recebimento } : {}),
    };
    if (editingEmprestimo) {
      updateMutation.mutate({ id: editingEmprestimo.id, data: baseData });
      return;
    }
    const agora = new Date().toISOString();
    createMutation.mutate({
      ...baseData,
      total_abatido: 0,
      status: 'ativo',
      historico_pagamentos: [{
        data: agora,
        tipo: 'criacao',
        valor: parseFloat(form.valor_principal),
        debito_antes: 0,
        debito_depois: parseFloat(form.valor_principal),
        observacao: `Empréstimo criado. Juros: ${form.percentual_mes}% a.m.`,
      }],
    });
  };

  const handleAbater = () => {
    const val = parseFloat(valorAbatimento);
    if (!val || val <= 0) { toast.error('Informe um valor válido'); return; }
    const debitoAtual = calcularDebitoAtual(abatimentoModal);
    const novoTotal = (abatimentoModal.total_abatido || 0) + val;
    const historico = [
      ...(abatimentoModal.historico_pagamentos || []),
      {
        data: new Date().toISOString(),
        tipo: 'abatimento',
        valor: val,
        debito_antes: debitoAtual,
        debito_depois: Math.max(0, debitoAtual - val),
        observacao: obsAbatimento || '',
      }
    ];
    abatirMutation.mutate({ id: abatimentoModal.id, novoTotal, historico });
  };

  const handleQuitar = (e) => {
    const debitoAtual = calcularDebitoAtual(e);
    const historico = [
      ...(e.historico_pagamentos || []),
      {
        data: new Date().toISOString(),
        tipo: 'quitacao',
        valor: debitoAtual,
        debito_antes: debitoAtual,
        debito_depois: 0,
        observacao: 'Empréstimo quitado',
      }
    ];
    quitarMutation.mutate({ id: e.id, historico });
  };

  const ativos = emprestimos.filter(e => e.status === 'ativo');
  const quitados = emprestimos.filter(e => e.status === 'quitado');

  const TIPO_CONFIG = {
    criacao:    { label: 'Criação',      color: 'bg-blue-100 text-blue-700' },
    abatimento: { label: 'Pagamento',    color: 'bg-green-100 text-green-700' },
    quitacao:   { label: 'Quitação',     color: 'bg-purple-100 text-purple-700' },
    aporte:     { label: 'Novo Aporte',  color: 'bg-orange-100 text-orange-700' },
  };

  const renderCard = (e, isQuitado = false) => {
    const debitoAtual = calcularDebitoAtual(e);
    const juros = calcularJurosAcumulados(e);
    const isExpanded = expandedId === e.id;
    const historico = e.historico_pagamentos || [];
    const diasDecorridos = e.data_emprestimo && isValid(parseISO(e.data_emprestimo))
      ? differenceInDays(new Date(), parseISO(e.data_emprestimo)) : 0;
    const ganho = (e.total_abatido || 0) - e.valor_principal;

    return (
      <div key={e.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isQuitado ? 'opacity-70 border-gray-200' : 'border-purple-100'}`}>
        {/* Cabeçalho do card */}
        <button
          onClick={() => setExpandedId(isExpanded ? null : e.id)}
          className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 transition-colors ${isQuitado ? 'bg-gray-50 hover:bg-gray-100' : 'bg-purple-50 hover:bg-purple-100'}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-purple-500 flex-shrink-0" />
              : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <span className="font-bold text-gray-800 truncate">{e.cliente_nome}</span>
            <Badge className="bg-purple-100 text-purple-700 text-xs flex-shrink-0">{e.percentual_mes}% a.m.</Badge>
            {isQuitado && <Badge className="bg-green-100 text-green-700 text-xs flex-shrink-0">Quitado</Badge>}
          </div>
          <span className="font-bold text-red-600 text-sm flex-shrink-0">{formatMoney(debitoAtual)}</span>
        </button>

        {/* Resumo sempre visível */}
        <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Emprestado</p>
            <p className="font-semibold text-gray-700 text-sm">{formatMoney(e.valor_principal)}</p>
          </div>
          <div>
            <p className="text-xs text-orange-400">Juros acumulados</p>
            <p className="font-semibold text-orange-600 text-sm">{formatMoney(juros)}</p>
          </div>
          <div>
            <p className="text-xs text-green-500">Total abatido</p>
            <p className="font-semibold text-green-600 text-sm">{formatMoney(e.total_abatido || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Data / Dias</p>
            <p className="font-semibold text-gray-600 text-sm">{formatDate(e.data_emprestimo)}</p>
            <p className="text-xs text-gray-400">{diasDecorridos} dias</p>
          </div>
        </div>

        {/* Ações */}
        {!isQuitado && (
          <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50">
            <Button size="sm" variant="outline"
              onClick={() => { setAbatimentoModal(e); setValorAbatimento(''); setObsAbatimento(''); }}
              className="text-green-600 border-green-200 hover:bg-green-50 gap-1 text-xs">
              <MinusCircle className="w-3.5 h-3.5" /> Registrar Pagamento
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => { setAporteModal(e); setValorAporte(''); setObsAporte(''); }}
              className="text-orange-500 border-orange-200 hover:bg-orange-50 gap-1 text-xs">
              <PlusCircle className="w-3.5 h-3.5" /> Adicionar Crédito
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => handleQuitar(e)}
              className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
              Quitar
            </Button>
            <Button size="sm" variant="ghost"
              onClick={() => openEdit(e)}
              className="text-gray-500 hover:text-gray-700 gap-1 text-xs">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
            <Button size="sm" variant="ghost"
              onClick={() => { if (confirm('Excluir este empréstimo?')) deleteMutation.mutate(e.id); }}
              className="text-red-400 hover:text-red-600 gap-1 text-xs ml-auto">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        {isQuitado && (
          <div className="px-4 py-2 flex items-center gap-3 bg-gray-50 border-b border-gray-100">
            {ganho > 0 && <span className="text-xs font-semibold text-emerald-600">💰 Lucro: {formatMoney(ganho)}</span>}
            <span className="text-xs text-gray-400">Encerrado em {formatDate(e.data_estimada_recebimento)}</span>
            <button onClick={() => handleReativar(e)} className="ml-auto text-xs text-orange-500 hover:text-orange-700 underline">Reativar</button>
          </div>
        )}

        {/* Histórico expandido */}
        {isExpanded && (
          <div className="px-4 py-4 space-y-3 bg-gray-50">
            {e.observacoes && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-sm text-yellow-800">
                📝 {e.observacoes}
              </div>
            )}
            <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Histórico de eventos
            </h4>
            {historico.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Nenhum evento registrado.</p>
            ) : (
              <div className="space-y-2">
                {[...historico].reverse().map((h, i) => {
                  const cfg = TIPO_CONFIG[h.tipo] || { label: h.tipo, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={i} className="flex items-start gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-sm">
                      <div className="mt-0.5 flex-shrink-0">
                        {h.tipo === 'quitacao'
                          ? <CheckCircle2 className="w-4 h-4 text-purple-500" />
                          : h.tipo === 'abatimento'
                          ? <MinusCircle className="w-4 h-4 text-green-500" />
                          : h.tipo === 'aporte'
                          ? <PlusCircle className="w-4 h-4 text-orange-500" />
                          : <Plus className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                          <span className="text-xs text-gray-400">{formatDateTime(h.data)}</span>
                          {h.valor > 0 && (
                            <span className={`text-xs font-semibold ${
                              h.tipo === 'criacao' ? 'text-blue-600'
                              : h.tipo === 'aporte' ? 'text-orange-600'
                              : h.tipo === 'abatimento' || h.tipo === 'quitacao' ? 'text-green-700'
                              : 'text-gray-700'
                            }`}>
                              {h.tipo === 'abatimento' || h.tipo === 'quitacao' ? '−' : '+'}{formatMoney(h.valor)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          {h.debito_antes > 0 && <span>Antes: <strong>{formatMoney(h.debito_antes)}</strong></span>}
                          {h.debito_depois !== undefined && h.tipo !== 'criacao' && <span>Depois: <strong>{formatMoney(h.debito_depois)}</strong></span>}
                          {h.observacao && <span className="text-gray-600 italic">"{h.observacao}"</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const Plus2 = ({ className }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-800">Empréstimos com Juros</h2>
          {ativos.length > 0 && <Badge className="bg-purple-100 text-purple-700">{ativos.length} ativo{ativos.length > 1 ? 's' : ''}</Badge>}
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Novo Empréstimo
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500 py-4">Carregando...</p>
      ) : ativos.length === 0 ? (
        <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          Nenhum empréstimo ativo
        </div>
      ) : (
        <div className="space-y-3">
          {ativos.map(e => renderCard(e, false))}
        </div>
      )}

      {quitados.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 select-none">Ver quitados ({quitados.length})</summary>
          <div className="mt-2 space-y-3">
            {quitados.map(e => renderCard(e, true))}
          </div>
        </details>
      )}

      {/* Modal Novo Empréstimo */}
      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditingEmprestimo(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmprestimo ? 'Editar Empréstimo' : 'Novo Empréstimo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Nome do Cliente *</label>
              <Input value={form.cliente_nome} onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))} placeholder="Nome do cliente" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Valor Emprestado *</label>
                <Input type="number" value={form.valor_principal} onChange={e => setForm(f => ({ ...f, valor_principal: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Juros % a.m. *</label>
                <Input type="number" value={form.percentual_mes} onChange={e => setForm(f => ({ ...f, percentual_mes: e.target.value }))} placeholder="ex: 10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Data do Empréstimo *</label>
                <Input type="date" value={form.data_emprestimo} onChange={e => setForm(f => ({ ...f, data_emprestimo: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Vencimento Estimado</label>
                <Input type="date" value={form.data_estimada_recebimento} onChange={e => setForm(f => ({ ...f, data_estimada_recebimento: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Observações</label>
              <Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Observações" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-purple-600 hover:bg-purple-700">
                {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Aporte */}
      <Dialog open={!!aporteModal} onOpenChange={() => setAporteModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Crédito — {aporteModal?.cliente_nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Débito atual</p>
              <p className="text-lg font-bold text-orange-600">{aporteModal ? formatMoney(calcularDebitoAtual(aporteModal)) : '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Valor adicional emprestado *</label>
              <Input type="number" value={valorAporte} onChange={e => setValorAporte(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Observação</label>
              <Input value={obsAporte} onChange={e => setObsAporte(e.target.value)} placeholder="Ex: cliente pediu mais R$500" />
            </div>
            {valorAporte && parseFloat(valorAporte) > 0 && aporteModal && (
              <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-sm">
                <p className="text-gray-500 text-xs">Novo débito após aporte</p>
                <p className="font-bold text-orange-700">{formatMoney(calcularDebitoAtual(aporteModal) + parseFloat(valorAporte))}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAporteModal(null)} className="flex-1">Cancelar</Button>
              <Button onClick={handleAporte} disabled={aporteMutation.isPending} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                {aporteMutation.isPending ? 'Salvando...' : 'Confirmar Aporte'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Abatimento */}
      <Dialog open={!!abatimentoModal} onOpenChange={() => setAbatimentoModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento — {abatimentoModal?.cliente_nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500">Débito atual</p>
              <p className="text-lg font-bold text-red-600">{abatimentoModal ? formatMoney(calcularDebitoAtual(abatimentoModal)) : '-'}</p>
              <p className="text-xs text-orange-500">↑ {abatimentoModal ? formatMoney(calcularJurosAcumulados(abatimentoModal)) : '-'} em juros</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Valor pago *</label>
              <Input type="number" value={valorAbatimento} onChange={e => setValorAbatimento(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Observação</label>
              <Input value={obsAbatimento} onChange={e => setObsAbatimento(e.target.value)} placeholder="Ex: pagou parte do juros, PIX..." />
            </div>
            {valorAbatimento && parseFloat(valorAbatimento) > 0 && abatimentoModal && (
              <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm">
                <p className="text-gray-500 text-xs">Débito após pagamento</p>
                <p className="font-bold text-green-700">{formatMoney(Math.max(0, calcularDebitoAtual(abatimentoModal) - parseFloat(valorAbatimento)))}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAbatimentoModal(null)} className="flex-1">Cancelar</Button>
              <Button onClick={handleAbater} disabled={abatirMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                {abatirMutation.isPending ? 'Salvando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}