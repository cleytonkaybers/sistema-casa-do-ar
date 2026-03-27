import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RelatorioClientesPagamentoModal from '@/components/financeiro/RelatorioClientesPagamentoModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, DollarSign, CheckCircle2, AlertCircle, Calendar,
  MessageCircle, Filter, X, Pencil, Tag,
  Clock, History, Trash2, Eye
} from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatPhone = (p) => {
  if (!p) return '';
  const c = p.replace(/\D/g, '');
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`;
  return p;
};
const getWhatsApp = (phone) => {
  if (!phone) return '#';
  const n = phone.replace(/\D/g, '');
  return `https://wa.me/55${n}`;
};

// Conta ocorrências de cada serviço e retorna string com multiplicadores
function resumirServicos(records) {
  const counts = {};
  records.forEach(r => {
    const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
    tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  });
  return Object.entries(counts)
    .map(([tipo, qtd]) => qtd > 1 ? `${tipo} x${qtd}` : tipo)
    .join(' + ');
}

// Agrupa pagamentos do mesmo cliente (toda a semana = uma linha)
function groupPagamentos(lista) {
  const groups = {};
  lista.forEach(p => {
    const key = (p.cliente_nome || '').trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = { ...p, _records: [p] };
    } else {
      groups[key]._records.push(p);
      groups[key].valor_total = (groups[key].valor_total || 0) + (p.valor_total || 0);
      groups[key].valor_pago = (groups[key].valor_pago || 0) + (p.valor_pago || 0);
    }
  });
  return Object.values(groups).map(g => {
    const saldo = (g.valor_total || 0) - (g.valor_pago || 0);
    let status = 'pendente';
    if (saldo <= 0.01) status = 'pago';
    else if ((g.valor_pago || 0) > 0) status = 'parcial';
    return { ...g, status, _tipoResumido: resumirServicos(g._records) };
  });
}

// Modal exclusivo para DEFINIR PREÇOS
function DefinirPrecoModal({ open, onClose, pagamento, pagamentosAtuais = [], onSave }) {
  const [precosGrupo, setPrecosGrupo] = useState({});
  const [loading, setLoading] = useState(false);

  const servicosGrupos = useMemo(() => {
    const records = pagamento?._records || (pagamento ? [pagamento] : []);
    const counts = {};
    records.forEach(r => {
      const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).map(([tipo, qtd]) => ({ tipo, qtd }));
  }, [pagamento]);

  useEffect(() => {
    if (!open || !pagamento) return;
    const records = pagamento._records || [pagamento];
    // Busca records mais frescos
    const idsAtend = new Set(records.map(r => r.atendimento_id || r.id).filter(Boolean));
    const frescos = pagamentosAtuais.filter(p => idsAtend.has(p.atendimento_id) || idsAtend.has(p.id));
    const fonte = frescos.length > 0 ? frescos : records;

    const inicial = {};
    servicosGrupos.forEach(({ tipo }) => {
      const rec = fonte.find(r => {
        const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
        return tipos.length === 1 && tipos[0] === tipo && (r.valor_total || 0) > 0;
      });
      inicial[tipo] = rec ? Number(rec.valor_total).toFixed(2).replace('.', ',') : '';
    });
    setPrecosGrupo(inicial);
  }, [open, pagamento, pagamentosAtuais]);

  const handleSave = async () => {
    if (Object.values(precosGrupo).every(v => !parseFloat((v || '').replace(',', '.')))) {
      return toast.error('Defina ao menos um preço');
    }
    setLoading(true);
    await onSave(pagamento, precosGrupo);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600" /> Definir Preços — {pagamento?.cliente_nome}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Preço unitário por serviço</p>
          {servicosGrupos.map(g => {
            const preco = precosGrupo[g.tipo] || '';
            const precoNum = parseFloat(preco.replace(',', '.')) || 0;
            const totalLinha = precoNum * g.qtd;
            return (
              <div key={g.tipo} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{g.qtd}</span>
                  <span className="flex-1 text-sm text-gray-700 font-medium">{g.tipo}</span>
                  <span className="text-xs text-gray-400">R$</span>
                  <Input
                    placeholder="0,00"
                    value={preco}
                    onChange={e => setPrecosGrupo(prev => ({ ...prev, [g.tipo]: e.target.value }))}
                    className={`w-28 h-9 text-sm text-right font-semibold ${precoNum === 0 ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'}`}
                    autoFocus={g === servicosGrupos[0]}
                  />
                </div>
                {g.qtd > 1 && (
                  <div className="flex justify-end text-xs text-gray-500">
                    {g.qtd} × {formatCurrency(precoNum)} = <span className="font-semibold text-gray-700 ml-1">{formatCurrency(totalLinha)}</span>
                  </div>
                )}
              </div>
            );
          })}
          {servicosGrupos.length > 0 && (() => {
            const totalGeral = servicosGrupos.reduce((s, g) => {
              const p = parseFloat((precosGrupo[g.tipo] || '').replace(',', '.')) || 0;
              return s + p * g.qtd;
            }, 0);
            return (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mt-1">
                <span className="text-sm font-bold text-blue-800">Total Geral</span>
                <span className={`text-base font-bold ${totalGeral > 0 ? 'text-blue-700' : 'text-amber-500'}`}>
                  {totalGeral > 0 ? formatCurrency(totalGeral) : 'A definir'}
                </span>
              </div>
            );
          })()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Salvando...' : '💾 Salvar Preços'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Modal exclusivo para REGISTRAR PAGAMENTO
function PagamentoModal({ open, onClose, pagamento, onSave, pagamentosAtuais = [], syncKey = 0 }) {
  const [obs, setObs] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [loading, setLoading] = useState(false);
  const [parcelas, setParcelas] = useState([]);
  const [novaData, setNovaData] = useState('');
  const [novoValorParcela, setNovoValorParcela] = useState('');
  const [valorRegistrar, setValorRegistrar] = useState('');
  // Preços salvos (somente leitura neste modal)
  const [precosGrupo, setPrecosGrupo] = useState({});

  const servicosGrupos = useMemo(() => {
    const records = pagamento?._records || (pagamento ? [pagamento] : []);
    const counts = {};
    records.forEach(r => {
      const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts).map(([tipo, qtd]) => ({ tipo, qtd }));
  }, [pagamento]);

  useEffect(() => {
    if (!open) return;
    setObs('');
    setMetodoPagamento('');
    setParcelas([]);
    setNovaData('');
    setNovoValorParcela('');
    setValorRegistrar('');

    // Busca preços dos records mais frescos
    const records = pagamento?._records || (pagamento ? [pagamento] : []);
    const idsAtend = new Set(records.map(r => r.atendimento_id || r.id).filter(Boolean));
    const frescos = pagamentosAtuais.filter(p => idsAtend.has(p.atendimento_id) || idsAtend.has(p.id));
    const fonte = frescos.length > 0 ? frescos : records;

    const inicial = {};
    const counts = {};
    records.forEach(r => {
      const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      tipos.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    Object.keys(counts).forEach(tipo => {
      // Tenta buscar um record com esse tipo que tenha valor_total > 0
      const rec = fonte.find(r => {
        const tipos = (r.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
        return tipos.includes(tipo) && (r.valor_total || 0) > 0;
      });
      if (rec) {
        // Se encontrou, calcula o valor individual dividindo pelo número de tipos nesse record
        const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
        const valorIndividual = rec.valor_total / tipos.length;
        inicial[tipo] = Number(valorIndividual).toFixed(2).replace('.', ',');
      } else {
        inicial[tipo] = '';
      }
    });
    setPrecosGrupo(inicial);
  }, [open, pagamento, pagamentosAtuais, syncKey]);

  const totalDefinido = servicosGrupos.reduce((s, g) => {
    const preco = parseFloat((precosGrupo[g.tipo] || '').replace(',', '.')) || 0;
    return s + preco * g.qtd;
  }, 0);

  const totalPago = (pagamento?._records || (pagamento ? [pagamento] : [])).reduce((s, r) => s + (r.valor_pago || 0), 0);
  const saldo = totalDefinido - totalPago;
  const totalAgendado = parcelas.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
  const valorAtualNum = parseFloat((valorRegistrar || '').replace(',', '.')) || 0;
  const saldoRestante = saldo - valorAtualNum - totalAgendado;
  const todosPrecosDefinidos = servicosGrupos.every(g => parseFloat((precosGrupo[g.tipo] || '').replace(',', '.')) > 0);

  const adicionarParcela = () => {
    if (!novaData) return toast.error('Informe a data da parcela');
    const v = parseFloat(novoValorParcela.replace(',', '.'));
    if (!v || v <= 0) return toast.error('Informe o valor da parcela');
    setParcelas(prev => [...prev, { data: novaData, valor: v }]);
    setNovaData('');
    setNovoValorParcela('');
  };

  const removerParcela = (idx) => setParcelas(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!todosPrecosDefinidos) return toast.error('Preços não definidos. Use o botão 🏷️ Preços primeiro.');
    const v = parseFloat((valorRegistrar || '').replace(',', '.'));
    if (!v || v <= 0) return toast.error('Informe um valor válido');
    if (v > saldo + 0.01) return toast.error(`Valor maior que o saldo (${formatCurrency(saldo)})`);
    setLoading(true);
    const obsCompleta = [metodoPagamento, obs].filter(Boolean).join(' | ');
    await onSave(pagamento, v, obsCompleta, parcelas, precosGrupo);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {/* Resumo do cliente */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="font-bold text-gray-800 text-base mb-3">{pagamento?.cliente_nome}</p>
            {!todosPrecosDefinidos && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5" /> Defina os preços usando o botão 🏷️ Preços antes de pagar
              </div>
            )}
            <div className="space-y-2 pt-3 border-t border-gray-200">
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-600 font-semibold mb-0.5">💰 Débito Total</p>
                <p className="font-bold text-red-700 text-base">{totalDefinido > 0 ? formatCurrency(saldo) : <span className="text-amber-500">A definir</span>}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-gray-400">Total</p><p className="font-bold text-gray-800 text-sm">{totalDefinido > 0 ? formatCurrency(totalDefinido) : <span className="text-amber-500 text-xs">A definir</span>}</p></div>
                <div><p className="text-xs text-gray-400">Pago</p><p className="font-bold text-green-600 text-sm">{formatCurrency(totalPago)}</p></div>
                <div><p className="text-xs text-gray-400">Saldo</p><p className="font-bold text-red-600 text-sm">{formatCurrency(Math.max(0, saldo))}</p></div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Valor a registrar agora (R$)</label>
            <Input placeholder="0,00" value={valorRegistrar} onChange={e => setValorRegistrar(e.target.value)} className="h-12 text-lg font-semibold" autoFocus />
            {saldo > 0.01 && (
              <button onClick={() => setValorRegistrar(saldo.toFixed(2).replace('.', ','))} className="text-xs text-blue-600 mt-1.5 underline">
                Preencher valor total restante ({formatCurrency(Math.max(0, saldo))})
              </button>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Método de pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              {['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Máquina de Cartão', 'Transferência'].map(m => (
                <button key={m} type="button" onClick={() => setMetodoPagamento(prev => prev === m ? '' : m)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    metodoPagamento === m ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}>
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${metodoPagamento === m ? 'border-white bg-white' : 'border-gray-300'}`}>
                    {metodoPagamento === m && <span className="w-2 h-2 rounded-sm bg-blue-600 block" />}
                  </span>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Observação (opcional)</label>
            <Input placeholder="Ex: referência, número do comprovante..." value={obs} onChange={e => setObs(e.target.value)} />
          </div>

          <div className="border border-blue-100 rounded-xl p-3 bg-blue-50/40 space-y-3">
            <p className="text-sm font-semibold text-blue-800">📅 Parcelas Futuras (agendadas)</p>
            {parcelas.length > 0 && (
              <div className="space-y-1.5">
                {parcelas.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-white border border-blue-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-sm text-gray-700 font-medium">{format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                      <span className="text-xs text-gray-400">—</span>
                      <span className="text-sm font-semibold text-blue-700">{formatCurrency(p.valor)}</span>
                    </div>
                    <button onClick={() => removerParcela(i)} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold px-1 pt-1">
                  <span className="text-gray-500">Saldo após todas as parcelas:</span>
                  <span className={saldoRestante < -0.01 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(saldoRestante)}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-gray-500 mb-1 block">Data da parcela</label><Input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className="h-9 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Valor (R$)</label><Input placeholder="0,00" value={novoValorParcela} onChange={e => setNovoValorParcela(e.target.value)} className="h-9 text-sm" /></div>
            </div>
            <Button variant="outline" size="sm" onClick={adicionarParcela} className="w-full text-blue-700 border-blue-200 hover:bg-blue-100">+ Adicionar parcela futura</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || !parseFloat((valorRegistrar || '').replace(',', '.')) || saldo <= 0 || !metodoPagamento || !todosPrecosDefinidos} className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
            {loading ? 'Salvando...' : '✓ Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditarValorModal({ open, onClose, pagamento, onSave }) {
  const [valor, setValor] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open && pagamento) setValor(String(pagamento.valor_total || '').replace('.', ',')); }, [open, pagamento]);

  const handleSave = async () => {
    const v = parseFloat(valor.replace(',', '.'));
    if (!v || v <= 0) return toast.error('Valor inválido');
    setLoading(true);
    await onSave(pagamento, v);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editar Valor do Serviço</DialogTitle></DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">{pagamento?.cliente_nome} — {pagamento?.tipo_servico}</p>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Novo valor (R$)</label>
            <Input value={valor} onChange={e => setValor(e.target.value)} className="h-12 text-lg font-semibold" autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalhesClienteModal({ open, onClose, pagamento }) {
  const records = pagamento?._records || (pagamento ? [pagamento] : []);

  // Agrupar serviços por tipo
  const servicosAgrupados = useMemo(() => {
    const groups = {};
    records.forEach(r => {
      const tipo = r.tipo_servico || 'Sem tipo';
      if (!groups[tipo]) groups[tipo] = { tipo, qtd: 0, valorTotal: 0, registros: [] };
      groups[tipo].qtd += 1;
      groups[tipo].valorTotal += r.valor_total || 0;
      groups[tipo].registros.push(r);
    });
    return Object.values(groups).sort((a, b) => b.qtd - a.qtd);
  }, [records]);

  const totalGeral = records.reduce((s, r) => s + (r.valor_total || 0), 0);
  const totalPago = records.reduce((s, r) => s + (r.valor_pago || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Detalhes — {pagamento?.cliente_nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Resumo financeiro */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Total serviços</p>
              <p className="font-bold text-gray-800 text-lg">{records.length}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <p className="text-xs text-gray-400 mb-0.5">Faturado</p>
              <p className="font-bold text-blue-700 text-sm">{formatCurrency(totalGeral)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
              <p className="text-xs text-gray-400 mb-0.5">Em débito</p>
              <p className="font-bold text-red-600 text-sm">{formatCurrency(totalGeral - totalPago)}</p>
            </div>
          </div>

          {/* Serviços agrupados por tipo */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Serviços por Tipo</p>
            <div className="space-y-2">
              {servicosAgrupados.map((g) => (
                <div key={g.tipo} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {g.qtd}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{g.tipo}</span>
                    </div>
                    <span className="font-bold text-gray-800 text-sm">{formatCurrency(g.valorTotal)}</span>
                  </div>
                  {/* Datas de cada execução */}
                  <div className="divide-y divide-gray-50">
                    {g.registros.map((r, i) => (
                      <div key={r.id || i} className="flex items-center justify-between px-4 py-2 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">└</span>
                          <span>{r.data_conclusao ? format(parseISO(r.data_conclusao), "dd/MM/yyyy", { locale: ptBR }) : '—'}</span>
                          {r.equipe_nome && <span className="text-blue-500">· {r.equipe_nome}</span>}
                        </div>
                        <span className="font-medium text-gray-600">{formatCurrency(r.valor_total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoModal({ open, onClose, pagamento }) {
  const records = pagamento?._records || (pagamento ? [pagamento] : []);
  // Merge historico de todos os records
  const todosPagamentos = records.flatMap(r => (r.historico_pagamentos || []).map(h => ({ ...h, _equipe: r.equipe_nome }))).sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Histórico — {pagamento?.cliente_nome}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500">{pagamento?.tipo_servico}</p>

          {/* Serviços realizados */}
          {records.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Serviços Realizados ({records.length})</p>
              <div className="space-y-1.5">
                {records.map((r, i) => (
                  <div key={r.id || i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        {r.data_conclusao ? format(parseISO(r.data_conclusao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                      </p>
                      {r.equipe_nome && <p className="text-xs text-blue-600">👷 {r.equipe_nome}</p>}
                    </div>
                    <span className="font-semibold text-gray-700 text-sm">{formatCurrency(r.valor_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de pagamentos */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pagamentos Registrados</p>
            {!todosPagamentos.length ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum pagamento registrado</p>
            ) : (
              <div className="space-y-2">
                {todosPagamentos.map((h, i) => (
                  <div key={i} className={`flex items-center justify-between border rounded-lg px-4 py-2.5 ${h.agendada ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div>
                      <div className="flex items-center gap-1.5">
                        {h.agendada && <Calendar className="w-3 h-3 text-blue-500" />}
                        <p className="text-xs font-medium text-gray-700">{h.data}</p>
                        {h.agendada && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded font-medium">Agendado</span>}
                      </div>
                      {h.observacao && !h.agendada && <p className="text-xs text-gray-400">{h.observacao}</p>}
                    </div>
                    <span className={`font-bold ${h.agendada ? 'text-blue-600' : 'text-green-600'}`}>{formatCurrency(h.valor)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-sm px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <span>Total pago</span>
                  <span className="text-green-700">{formatCurrency(pagamento?.valor_pago)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Linha da tabela
function LinhaTabela({ pag, onPagar, onEditarValor, onHistorico, onDelete, onDetalhes, onDefinirPreco }) {
  const saldo = (pag.valor_total || 0) - (pag.valor_pago || 0);
  const isPago = pag.status === 'pago';
  const isParcial = pag.status === 'parcial';
  const pct = pag.valor_total > 0 ? Math.min(100, Math.round(((pag.valor_pago || 0) / pag.valor_total) * 100)) : 0;

  return (
    <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isPago ? 'bg-green-50/40' : ''}`}>
      {/* Cliente */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${isPago ? 'bg-green-500' : isParcial ? 'bg-amber-500' : 'bg-blue-500'}`}>
            {pag.cliente_nome?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm leading-tight">{pag.cliente_nome}</p>
            {pag.equipe_nome && <p className="text-xs text-blue-600">👷 {pag.equipe_nome}</p>}
          </div>
        </div>
      </td>

      {/* Serviço */}
      <td className="px-4 py-3">
        {pag._records?.some(r => r.valor_total === 0) && (
          <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Defina o preço do cliente
          </div>
        )}
        <p className="text-sm text-gray-700 leading-tight">{pag._tipoResumido || pag.tipo_servico}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {pag.data_conclusao ? format(parseISO(pag.data_conclusao), "dd/MM/yy HH:mm", { locale: ptBR }) : '-'}
        </p>
      </td>

      {/* WhatsApp */}
      <td className="px-4 py-3">
        {pag.telefone ? (
          <a href={getWhatsApp(pag.telefone)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{formatPhone(pag.telefone)}</span>
            <span className="xl:hidden">WhatsApp</span>
          </a>
        ) : <span className="text-xs text-gray-400">—</span>}
      </td>

      {/* Valor total */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold text-sm ${pag.valor_total === 0 ? 'text-amber-500' : 'text-gray-800'}`}>
            {pag.valor_total === 0 ? 'A definir' : formatCurrency(pag.valor_total)}
          </span>
          {!isPago && (
            <button onClick={() => onEditarValor(pag)} className={`transition-colors ${pag.valor_total === 0 ? 'text-amber-400 hover:text-amber-600' : 'text-gray-300 hover:text-blue-500'}`} title="Definir preço">
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>

      {/* Status / Progresso */}
      <td className="px-4 py-3">
        <div className="space-y-1.5 min-w-[110px]">
          <div className="flex items-center justify-between">
            {isPago
              ? <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs px-2">✓ Pago</Badge>
              : isParcial
              ? <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs px-2">Parcial</Badge>
              : <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs px-2">Pendente</Badge>
            }
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${isPago ? 'bg-green-500' : isParcial ? 'bg-amber-500' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }} />
          </div>
          {!isPago && <p className="text-xs text-red-600 font-semibold">Deve: {formatCurrency(saldo)}</p>}
        </div>
      </td>

      {/* Ações */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onDetalhes(pag)} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Ver detalhes">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => onHistorico(pag)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Histórico">
            <History className="w-4 h-4" />
          </button>
          {!isPago && (
            <>
              <button onClick={() => onDefinirPreco(pag)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-semibold rounded-lg transition-colors border border-amber-300" title="Definir preços">
                <Tag className="w-3.5 h-3.5" />
                Preços
              </button>
              <button onClick={() => onPagar(pag)}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                <DollarSign className="w-3.5 h-3.5" />
                Pagar
              </button>
            </>
          )}
          <button onClick={() => onDelete(pag.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TabelaPagamentos({ lista, onPagar, onEditarValor, onHistorico, onDelete, onDetalhes, onDefinirPreco, emptyMsg }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#1e3a8a' }}>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Serviço / Data</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Contato</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Valor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-14 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{emptyMsg}</p>
              </td></tr>
            ) : lista.map(p => (
              <LinhaTabela key={p.id} pag={p} onPagar={onPagar} onEditarValor={onEditarValor} onHistorico={onHistorico} onDelete={onDelete} onDetalhes={onDetalhes} onDefinirPreco={onDefinirPreco} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {lista.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{emptyMsg}</p>
          </div>
        ) : lista.map(p => {
          const saldo = (p.valor_total || 0) - (p.valor_pago || 0);
          const isPago = p.status === 'pago';
          const isParcial = p.status === 'parcial';
          const pct = p.valor_total > 0 ? Math.min(100, Math.round(((p.valor_pago || 0) / p.valor_total) * 100)) : 0;
          return (
            <div key={p.id} className={`p-4 ${isPago ? 'bg-green-50/30' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-gray-800">{p.cliente_nome}</p>
                  <p className="text-xs text-gray-500">{p._tipoResumido || p.tipo_servico}</p>
                  {p._records?.some(r => r.valor_total === 0) && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold mt-0.5">
                      <AlertCircle className="w-3 h-3" /> Defina o preço
                    </div>
                  )}
                  {p.equipe_nome && <p className="text-xs text-blue-600">👷 {p.equipe_nome}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-800">{formatCurrency(p.valor_total)}</p>
                  {!isPago && <p className="text-xs text-red-600 font-semibold">Deve: {formatCurrency(saldo)}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${isPago ? 'bg-green-500' : isParcial ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                </div>
                {isPago
                  ? <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">✓ Pago</Badge>
                  : isParcial
                  ? <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">Parcial</Badge>
                  : <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs">Pendente</Badge>
                }
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {p.telefone && (
                  <a href={getWhatsApp(p.telefone)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 h-9 bg-green-600 text-white text-xs font-medium rounded-lg">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => onDetalhes(p)} className="p-2 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 border border-gray-200" title="Ver detalhes">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => onHistorico(p)} className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-gray-200">
                  <History className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(p.id)} className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 border border-gray-200">
                  <Trash2 className="w-4 h-4" />
                </button>
                {!isPago && (
                  <>
                    <button onClick={() => onDefinirPreco(p)} className="p-2 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 border border-amber-200" title="Definir preços">
                      <Tag className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPagar(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg">
                      <DollarSign className="w-3.5 h-3.5" /> Registrar Pagamento
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PagamentosClientes() {
  const queryClient = useQueryClient();

  const criandoIds = React.useRef(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [pagarModal, setPagarModal] = useState(null);
  const [precosModal, setPrecosModal] = useState(null);
  const [editarModal, setEditarModal] = useState(null);
  const [historicoModal, setHistoricoModal] = useState(null);
  const [detalhesModal, setDetalhesModal] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('semana');
  const [precosSyncKey, setPrecosSyncKey] = useState(0);
  const [abrirRelatorio, setAbrirRelatorio] = useState(false);

  // Relatórios
  const [relFiltro, setRelFiltro] = useState('semana');
  const [relDataInicio, setRelDataInicio] = useState('');
  const [relDataFim, setRelDataFim] = useState('');
  const [relCliente, setRelCliente] = useState('');

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos-pag'],
    queryFn: () => base44.entities.Atendimento.list('-data_conclusao'),
  });

  const { data: servicosConcluidos = [] } = useQuery({
    queryKey: ['servicos-concluidos-pag'],
    queryFn: () => base44.entities.Servico.filter({ status: 'concluido' }, '-data_conclusao'),
  });

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ['pagamentos-clientes'],
    queryFn: () => base44.entities.PagamentoCliente.list('-data_conclusao'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PagamentoCliente.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PagamentoCliente.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PagamentoCliente.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos-clientes'] });
      toast.success('Registro removido!');
    },
  });

  const hoje = new Date();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 0 });
  const fimSemana = endOfWeek(hoje, { weekStartsOn: 0 });

  // Sincronizar apenas ATENDIMENTOS DA SEMANA ATUAL — 1 registro por atendimento
  useEffect(() => {
    if (isLoading || !atendimentos.length) return;
    const idsRegistrados = new Set(pagamentos.map(p => p.atendimento_id).filter(Boolean));

    const TIPOS_IGNORADOS = ['Ver defeito', 'Verificar defeito', 'Outro tipo de serviço'];

    const novos = atendimentos.filter(a => {
      if (idsRegistrados.has(a.id)) return false;
      if (criandoIds.current.has(a.id)) return false;
      if (TIPOS_IGNORADOS.includes(a.tipo_servico)) return false; // ignorar tipos sem cobrança
      const dataRef = a.data_conclusao || a.created_date;
      if (!dataRef) return false;
      try {
        const data = parseISO(dataRef);
        return isWithinInterval(data, { start: inicioSemana, end: fimSemana });
      } catch { return false; }
    });

    novos.forEach(a => {
      criandoIds.current.add(a.id); // marca como em criação
      createMutation.mutate({
        atendimento_id: a.id,
        servico_id: a.servico_id || '',
        cliente_nome: a.cliente_nome || '',
        telefone: a.telefone || '',
        tipo_servico: a.tipo_servico || '',
        data_conclusao: a.data_conclusao || a.created_date,
        valor_total: 0, // preço isolado — admin deve definir manualmente
        valor_pago: 0,
        status: 'pendente',
        equipe_nome: a.equipe_nome || '',
        historico_pagamentos: [],
      });
    });
  }, [atendimentos, pagamentos, isLoading]);

  const handleSalvarPrecos = async (pag, precosGrupo) => {
    const records = pag._records?.length > 1 ? pag._records : [pag];
    for (const rec of records) {
      const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      const novoPreco = tipos.reduce((sum, t) => sum + (parseFloat((precosGrupo[t] || '').replace(',', '.')) || 0), 0);
      if (novoPreco > 0 && novoPreco !== rec.valor_total) {
        await updateMutation.mutateAsync({ id: rec.id, data: { valor_total: novoPreco } });
      }
    }
    toast.success('💾 Preços salvos com sucesso!');
    setPrecosSyncKey(k => k + 1);
  };

  const handleRegistrarPagamento = async (pag, valor, obs, parcelas = [], precosGrupo = {}) => {
    const records = pag._records?.length > 1 ? pag._records : [pag];
    let remaining = valor;
    const dataStr = format(new Date(), "dd/MM/yyyy HH:mm");

    const calcularValorRecord = (rec) => {
      const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      const total = tipos.reduce((sum, t) => {
        const preco = parseFloat((precosGrupo[t] || '').replace(',', '.')) || 0;
        return sum + preco;
      }, 0);
      return total > 0 ? total : rec.valor_total;
    };

    const recordsAtualizados = records.map(rec => {
      const novoPreco = calcularValorRecord(rec);
      return { ...rec, valor_total: novoPreco > 0 ? novoPreco : rec.valor_total };
    });

    for (const rec of recordsAtualizados) {
      if (remaining <= 0.01) break;
      const recSaldo = (rec.valor_total || 0) - (rec.valor_pago || 0);
      if (recSaldo <= 0.01) continue;
      const toPay = Math.min(remaining, recSaldo);
      remaining -= toPay;
      const novoPago = (rec.valor_pago || 0) + toPay;
      const parcelasAgendadas = parcelas.map(p => ({
        valor: p.valor,
        data: format(new Date(p.data + 'T12:00:00'), 'dd/MM/yyyy'),
        observacao: '📅 Parcela agendada',
        agendada: true,
      }));
      const novoHistorico = [
        ...(rec.historico_pagamentos || []),
        { valor: toPay, data: dataStr, observacao: obs },
        ...parcelasAgendadas,
      ];
      const isQuitado = novoPago >= (rec.valor_total || 0) - 0.01;
      await updateMutation.mutateAsync({
        id: rec.id, data: {
          valor_pago: novoPago,
          status: isQuitado ? 'pago' : 'parcial',
          historico_pagamentos: novoHistorico,
          data_pagamento_completo: isQuitado ? new Date().toISOString() : undefined,
        },
      });
    }
    toast.success('✅ Pagamento registrado!');
  };

  const handleEditarValor = async (pag, novoValor) => {
    await updateMutation.mutateAsync({ id: pag.id, data: { valor_total: novoValor } });
    toast.success('Valor atualizado!');
  };

  const TIPOS_SEM_COBRANCA = ['Ver defeito', 'Outro tipo de serviço'];

  const pagsFiltrados = useMemo(() =>
    pagamentos.filter(p =>
      (!searchTerm || p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      !TIPOS_SEM_COBRANCA.includes(p.tipo_servico)
    )
  , [pagamentos, searchTerm]);

  // Semana atual SEM pagos (saem do card principal)
  const pagsSemana = useMemo(() => {
    const filtrados = pagsFiltrados.filter(p => {
      if (p.status === 'pago') return false;
      if (!p.data_conclusao) return false;
      try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana }); }
      catch { return false; }
    });
    return groupPagamentos(filtrados);
  }, [pagsFiltrados, inicioSemana, fimSemana]);

  // Todos os pendentes/parciais, ordenados por data mais próxima primeiro
  const dataCorte = new Date('2026-03-23T00:00:00');

  const pagsDebito = useMemo(() => {
    const filtrados = pagsFiltrados
      .filter(p => {
        if (p.status === 'pago') return false;
        if (p.data_conclusao) {
          try { if (parseISO(p.data_conclusao) < dataCorte) return false; }
          catch {}
        } else {
          return false; // sem data, ignorar
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.data_conclusao ? new Date(a.data_conclusao) : new Date(0);
        const db = b.data_conclusao ? new Date(b.data_conclusao) : new Date(0);
        return db - da;
      });
    return groupPagamentos(filtrados);
  }, [pagsFiltrados, dataCorte]);

  const pagsRelatorio = useMemo(() => {
    let inicio, fim;
    if (relFiltro === 'semana') { inicio = inicioSemana; fim = fimSemana; }
    else if (relFiltro === 'mes') { inicio = startOfMonth(hoje); fim = endOfMonth(hoje); }
    else if (relFiltro === 'personalizado' && relDataInicio && relDataFim) {
      inicio = new Date(relDataInicio); fim = new Date(relDataFim + 'T23:59:59');
    }
    return pagamentos.filter(p => {
      const matchCliente = !relCliente || p.cliente_nome?.toLowerCase().includes(relCliente.toLowerCase());
      let matchData = true;
      if (inicio && fim && p.data_conclusao) {
        try { matchData = isWithinInterval(parseISO(p.data_conclusao), { start: inicio, end: fim }); }
        catch { matchData = false; }
      }
      return matchCliente && matchData;
    });
  }, [pagamentos, relFiltro, relDataInicio, relDataFim, relCliente, inicioSemana, fimSemana]);

  const totalSemana = pagsSemana.reduce((s, p) => s + (p.valor_total || 0), 0);

  // Recebido na semana: todos os pagamentos (incluindo já pagos) dentro da semana
  const todosPagsSemana = useMemo(() => pagamentos.filter(p => {
    if (!p.data_conclusao) return false;
    try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana }); }
    catch { return false; }
  }), [pagamentos, inicioSemana, fimSemana]);
  const totalPagoSemana = todosPagsSemana.reduce((s, p) => s + (p.valor_pago || 0), 0);
  const totalDebitoGeral = pagsDebito.reduce((s, p) => s + ((p.valor_total || 0) - (p.valor_pago || 0)), 0);

  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);
  const pagsMes = useMemo(() => pagamentos.filter(p => {
    if (!p.data_conclusao) return false;
    try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioMes, end: fimMes }); }
    catch { return false; }
  }), [pagamentos, inicioMes, fimMes]);
  const totalMes = pagsMes.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPagoMes = pagsMes.reduce((s, p) => s + (p.valor_pago || 0), 0);
  const totalRel = pagsRelatorio.reduce((s, p) => s + (p.valor_total || 0), 0);
  const totalPagoRel = pagsRelatorio.reduce((s, p) => s + (p.valor_pago || 0), 0);

  const abas = [
    { key: 'semana', label: 'Semana Atual', count: pagsSemana.length },
    { key: 'relatorio', label: 'Histórico / Relatórios', count: null },
  ];

  return (
    <div className="space-y-5">
      {/* Header com resumo */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Pagamentos dos Clientes</h1>
            <p className="text-blue-200/80 text-sm mt-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Semana: {format(inicioSemana, "dd/MM", { locale: ptBR })} – {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
              <p className="text-white font-bold text-lg">{formatCurrency(totalMes).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Faturado no Mês</p>
            </div>
            <div className="bg-green-500/20 rounded-xl px-3 py-2.5 text-center">
              <p className="text-green-300 font-bold text-lg">{formatCurrency(totalPagoMes).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Recebido no Mês</p>
            </div>
            <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
              <p className="text-white font-bold text-lg">{formatCurrency(totalSemana).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Faturado na Semana</p>
            </div>
            <div className="bg-green-500/20 rounded-xl px-3 py-2.5 text-center">
              <p className="text-green-300 font-bold text-lg">{formatCurrency(totalPagoSemana).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Recebido na Semana</p>
            </div>
          </div>
        </div>
      </div>

      {/* Busca + Abas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 bg-white border-gray-200" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        <Button onClick={() => setAbrirRelatorio(true)} variant="outline" className="gap-2">
          📄 Gerar PDF
        </Button>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          {abas.map(a => (
            <button key={a.key} onClick={() => setAbaAtiva(a.key)}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${abaAtiva === a.key ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              style={abaAtiva === a.key ? { backgroundColor: '#1e3a8a' } : {}}>
              {a.label}
              {a.count !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${abaAtiva === a.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {a.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Aba: Semana Atual */}
      {abaAtiva === 'semana' && (
        <div className="space-y-5">
          {/* Serviços a receber esta semana */}
          <TabelaPagamentos
            lista={pagsSemana}
            onPagar={setPagarModal}
            onDefinirPreco={setPrecosModal}
            onEditarValor={setEditarModal}
            onHistorico={setHistoricoModal}
            onDetalhes={setDetalhesModal}
            onDelete={(id) => deleteMutation.mutate(id)}
            emptyMsg="Nenhum serviço pendente esta semana"
          />

          {/* Seção inferior: todos os pendentes ordenados por proximidade */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Pagamentos Pendentes (mais recentes primeiro)
              </h2>
              <span className="text-sm font-bold text-red-600">{formatCurrency(totalDebitoGeral)} em aberto</span>
            </div>
            <TabelaPagamentos
              lista={pagsDebito}
              onPagar={setPagarModal}
              onDefinirPreco={setPrecosModal}
              onEditarValor={setEditarModal}
              onHistorico={setHistoricoModal}
              onDetalhes={setDetalhesModal}
              onDelete={(id) => deleteMutation.mutate(id)}
              emptyMsg="Nenhum pagamento pendente!"
            />
          </div>
        </div>
      )}

      {/* Aba: Relatórios */}
      {abaAtiva === 'relatorio' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-gray-700 font-semibold mb-3">
              <Filter className="w-4 h-4 text-blue-600" /> Filtros
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={relFiltro} onValueChange={setRelFiltro}>
                <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana Atual</SelectItem>
                  <SelectItem value="mes">Mês Atual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Filtrar por cliente..." value={relCliente} onChange={e => setRelCliente(e.target.value)} className="pl-9 h-10 bg-white" />
              </div>
            </div>
            {relFiltro === 'personalizado' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><label className="text-xs text-gray-500 mb-1 block">Data início</label><Input type="date" value={relDataInicio} onChange={e => setRelDataInicio(e.target.value)} className="h-10" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Data fim</label><Input type="date" value={relDataFim} onChange={e => setRelDataFim(e.target.value)} className="h-10" /></div>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Faturado', value: totalRel, color: 'border-gray-200 bg-white text-gray-800' },
              { label: 'Total Recebido', value: totalPagoRel, color: 'border-green-200 bg-green-50 text-green-700' },
              { label: 'Total em Débito', value: totalRel - totalPagoRel, color: 'border-red-200 bg-red-50 text-red-700' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border p-4 text-center ${item.color}`}>
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="font-bold text-base">{formatCurrency(item.value)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pagsRelatorio.length} registros</p>
              </div>
            ))}
          </div>

          <TabelaPagamentos
            lista={pagsRelatorio}
            onPagar={setPagarModal}
            onDefinirPreco={setPrecosModal}
            onEditarValor={setEditarModal}
            onHistorico={setHistoricoModal}
            onDetalhes={setDetalhesModal}
            onDelete={(id) => deleteMutation.mutate(id)}
            emptyMsg="Nenhum registro no período selecionado"
          />
        </div>
      )}

      <DefinirPrecoModal open={!!precosModal} onClose={() => setPrecosModal(null)} pagamento={precosModal} pagamentosAtuais={pagamentos} onSave={handleSalvarPrecos} />
      <PagamentoModal open={!!pagarModal} onClose={() => setPagarModal(null)} pagamento={pagarModal} onSave={handleRegistrarPagamento} pagamentosAtuais={pagamentos} syncKey={precosSyncKey} />
      <EditarValorModal open={!!editarModal} onClose={() => setEditarModal(null)} pagamento={editarModal} onSave={handleEditarValor} />
      <HistoricoModal open={!!historicoModal} onClose={() => setHistoricoModal(null)} pagamento={historicoModal} />
      <DetalhesClienteModal open={!!detalhesModal} onClose={() => setDetalhesModal(null)} pagamento={detalhesModal} />
      <RelatorioClientesPagamentoModal isOpen={abrirRelatorio} onClose={() => setAbrirRelatorio(false)} pagamentos={pagamentos} servicos={servicosConcluidos} />
    </div>
  );
}