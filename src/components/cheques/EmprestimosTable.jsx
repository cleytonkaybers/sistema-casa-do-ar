import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, MinusCircle, TrendingUp, ChevronDown, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { differenceInDays, parseISO, isValid, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function calcularDebitoAtual(emprestimo) {
  const { valor_principal, percentual_mes, data_emprestimo, total_abatido } = emprestimo;
  if (!valor_principal || !percentual_mes || !data_emprestimo) return valor_principal || 0;
  const inicio = parseISO(data_emprestimo);
  if (!isValid(inicio)) return valor_principal;
  const dias = differenceInDays(new Date(), inicio);
  const taxaDiaria = percentual_mes / 100 / 30;
  const debito = valor_principal * Math.pow(1 + taxaDiaria, dias);
  return Math.max(0, debito - (total_abatido || 0));
}

function calcularJurosAcumulados(emprestimo) {
  const { valor_principal, percentual_mes, data_emprestimo, total_abatido } = emprestimo;
  if (!valor_principal || !percentual_mes || !data_emprestimo) return 0;
  const inicio = parseISO(data_emprestimo);
  if (!isValid(inicio)) return 0;
  const dias = differenceInDays(new Date(), inicio);
  const taxaDiaria = percentual_mes / 100 / 30;
  const totalComJuros = valor_principal * Math.pow(1 + taxaDiaria, dias);
  return Math.max(0, totalComJuros - valor_principal);
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
  const [form, setForm] = useState(emptyForm);
  const [abatimentoModal, setAbatimentoModal] = useState(null);
  const [valorAbatimento, setValorAbatimento] = useState('');
  const [obsAbatimento, setObsAbatimento] = useState('');
  const [expandedId, setExpandedId] = useState(null);

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

  const handleSave = () => {
    if (!form.cliente_nome || !form.valor_principal || !form.data_emprestimo || !form.percentual_mes) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    const agora = new Date().toISOString();
    createMutation.mutate({
      ...form,
      valor_principal: parseFloat(form.valor_principal),
      percentual_mes: parseFloat(form.percentual_mes),
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
    criacao:    { label: 'Criação',    color: 'bg-blue-100 text-blue-700' },
    abatimento: { label: 'Pagamento',  color: 'bg-green-100 text-green-700' },
    quitacao:   { label: 'Quitação',   color: 'bg-purple-100 text-purple-700' },
  };

  const renderRow = (e, isQuitado = false) => {
    const debitoAtual = calcularDebitoAtual(e);
    const juros = calcularJurosAcumulados(e);
    const isExpanded = expandedId === e.id;
    const historico = e.historico_pagamentos || [];
    const diasDecorridos = e.data_emprestimo && isValid(parseISO(e.data_emprestimo))
      ? differenceInDays(new Date(), parseISO(e.data_emprestimo)) : 0;

    return (
      <React.Fragment key={e.id}>
        {/* Linha principal */}
        <tr className={`border-b border-gray-100 transition-colors ${isQuitado ? 'opacity-60' : 'hover:bg-purple-50'}`}>
          <td className="px-3 py-3">
            <button
              onClick={() => setExpandedId(isExpanded ? null : e.id)}
              className="flex items-center gap-1.5 font-semibold text-gray-800 hover:text-purple-700 transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-purple-500 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              {e.cliente_nome}
            </button>
          </td>
          <td className="px-3 py-3">
            {(() => {
              const ganho = (e.total_abatido || 0) - e.valor_principal;
              return ganho > 0
                ? <span className="font-bold text-emerald-600">{formatMoney(ganho)}</span>
                : <span className="text-xs text-gray-400">—</span>;
            })()}
          </td>
          <td className="px-3 py-3 text-gray-600">{formatMoney(e.valor_principal)}</td>
          <td className="px-3 py-3 text-sm text-gray-500">{formatDate(e.data_emprestimo)}</td>
          <td className="px-3 py-3">
            <Badge className="bg-purple-100 text-purple-700 font-medium">{e.percentual_mes}% a.m.</Badge>
          </td>
          <td className="px-3 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-red-600 text-sm">{formatMoney(debitoAtual)}</span>
              <span className="text-xs text-orange-500 font-medium">↑ {formatMoney(juros)} em juros</span>
            </div>
          </td>
          <td className="px-3 py-3 text-green-600 font-medium text-sm">{formatMoney(e.total_abatido || 0)}</td>
          <td className="px-3 py-3 text-sm text-gray-400">{e.data_estimada_recebimento ? formatDate(e.data_estimada_recebimento) : '—'}</td>
          {!isQuitado && (
            <td className="px-3 py-3">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" title="Registrar pagamento/abatimento"
                  onClick={() => { setAbatimentoModal(e); setValorAbatimento(''); setObsAbatimento(''); }}
                  className="text-green-600 hover:text-green-800 hover:bg-green-50">
                  <MinusCircle className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm"
                  onClick={() => handleQuitar(e)}
                  className="text-blue-600 hover:text-blue-800 text-xs px-2">
                  Quitar
                </Button>
                <Button variant="ghost" size="icon"
                  onClick={() => { if (confirm('Excluir este empréstimo?')) deleteMutation.mutate(e.id); }}
                  className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </td>
          )}
          {isQuitado && (
            <td className="px-3 py-3">
              <Badge className="bg-green-100 text-green-700">Quitado</Badge>
            </td>
          )}
        </tr>

        {/* Linha expandida - detalhes */}
        {isExpanded && (
          <tr>
            <td colSpan={9} className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className="space-y-4">
                {/* Resumo do empréstimo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">Principal emprestado</p>
                    <p className="font-bold text-gray-800">{formatMoney(e.valor_principal)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">Juros acumulados</p>
                    <p className="font-bold text-orange-600">{formatMoney(juros)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">Total abatido</p>
                    <p className="font-bold text-green-600">{formatMoney(e.total_abatido || 0)}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">Dias decorridos</p>
                    <p className="font-bold text-purple-700">{diasDecorridos} dias</p>
                  </div>
                </div>

                {e.observacoes && (
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-sm text-yellow-800">
                    📝 {e.observacoes}
                  </div>
                )}

                {/* Histórico de eventos */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
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
                                : <Plus className="w-4 h-4 text-blue-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                                <span className="text-xs text-gray-400">{formatDateTime(h.data)}</span>
                                {h.valor > 0 && (
                                  <span className={`text-xs font-semibold ${h.tipo === 'criacao' ? 'text-blue-600' : 'text-green-700'}`}>
                                    {h.tipo === 'abatimento' || h.tipo === 'quitacao' ? '−' : '+'}{formatMoney(h.valor)}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                {h.debito_antes > 0 && <span>Débito antes: <strong>{formatMoney(h.debito_antes)}</strong></span>}
                                {h.debito_depois !== undefined && h.tipo !== 'criacao' && <span>Débito depois: <strong>{formatMoney(h.debito_depois)}</strong></span>}
                                {h.observacao && <span className="text-gray-600 italic">"{h.observacao}"</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
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
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#6d28d9' }}>
                {['Cliente', 'Total Ganho', 'Valor Emprestado', 'Data', '% a.m.', 'Débito Atual + Juros', 'Total Abatido', 'Venc. Estimado', 'Ações'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-white text-xs font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ativos.map(e => renderRow(e, false))}
            </tbody>
          </table>
        </div>
      )}

      {quitados.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 select-none">Ver quitados ({quitados.length})</summary>
          <div className="overflow-x-auto mt-2 rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  {['Cliente', 'Total Ganho', 'Valor Emprestado', 'Data', '% a.m.', 'Débito Final', 'Total Pago', 'Venc. Estimado', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-gray-500 text-xs font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
              <tbody>
                {quitados.map(e => renderRow(e, true))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Modal Novo Empréstimo */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
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
              <Button onClick={handleSave} disabled={createMutation.isPending} className="flex-1 bg-purple-600 hover:bg-purple-700">
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
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