import { useState, useMemo, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import TechnicianAccessBlock from '@/components/TechnicianAccessBlock';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RelatorioClientesPagamentoModal from '@/components/financeiro/RelatorioClientesPagamentoModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CompromissoClientePDF from '@/components/financeiro/CompromissoClientePDF';
import {
  Search, DollarSign, CheckCircle2, AlertCircle, Calendar,
  MessageCircle, Filter, X, Pencil, Tag,
  Clock, History, Trash2, Eye, Check
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
const TIPOS_IGNORADOS = ['Ver defeito', 'Verificar defeito', 'Outro tipo de serviço', 'Serviço avulso'];
const calcularSaldo = (total, pago) => (total || 0) - (pago || 0);

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
      groups[key] = { ...p, _records: p._records || [p] };
    } else {
      const novoRecords = p._records || [p];
      groups[key]._records = [...(groups[key]._records || [groups[key]]), ...novoRecords];
      groups[key].valor_total = (groups[key].valor_total || 0) + (p.valor_total || 0);
      groups[key].valor_pago = (groups[key].valor_pago || 0) + (p.valor_pago || 0);
    }
  });
  return Object.values(groups).map(g => {
    const saldo = (g.valor_total || 0) - (g.valor_pago || 0);
    const status = saldo <= 0.01 ? 'pago' : (g.valor_pago || 0) > 0 ? 'parcial' : 'pendente';
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
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
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
  const [dataPagamentoAgendado, setDataPagamentoAgendado] = useState('');
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

  const isValidDate = (dateStr) => {
    try {
      const date = new Date(dateStr + 'T12:00:00');
      return !isNaN(date.getTime());
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    if (!todosPrecosDefinidos) return toast.error('Preços não definidos. Use o botão 🏷️ Preços primeiro.');
    if (dataPagamentoAgendado && !isValidDate(dataPagamentoAgendado)) return toast.error('Data inválida');
    const v = parseFloat((valorRegistrar || '').replace(',', '.'));
    if (!v || v <= 0) return toast.error('Informe um valor válido');
    if (v > saldo + 0.01) return toast.error(`Valor maior que o saldo (${formatCurrency(saldo)})`);
    setLoading(true);
    const obsCompleta = [metodoPagamento, obs].filter(Boolean).join(' | ');
    await onSave(pagamento, v, obsCompleta, parcelas, precosGrupo, dataPagamentoAgendado);
    setLoading(false);
    setValorRegistrar('');
    setObs('');
    setParcelas([]);
    setDataPagamentoAgendado('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
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
            <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">📅 Data de Agendamento (opcional)</label>
            <Input type="date" value={dataPagamentoAgendado} onChange={e => setDataPagamentoAgendado(e.target.value)} className="h-10 text-sm" />
            {dataPagamentoAgendado && <p className="text-xs text-gray-400 mt-1">Será notificado em {format(new Date(dataPagamentoAgendado + 'T12:00:00'), 'dd/MM/yyyy')}</p>}
          </div>

          <div>
           <label className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 block">Valor a registrar (R$)</label>
           <Input placeholder="0,00" value={valorRegistrar} onChange={e => setValorRegistrar(e.target.value)} className="h-11 sm:h-12 text-base sm:text-lg font-semibold" autoFocus />
           {saldo > 0.01 && (
             <button onClick={() => setValorRegistrar(saldo.toFixed(2).replace('.', ','))} className="text-xs text-blue-600 mt-2 underline">
               Preencher total ({formatCurrency(Math.max(0, saldo))})
             </button>
           )}
          </div>

          <div>
           <label className="text-xs sm:text-sm font-medium text-gray-700 mb-2 block">Método de pagamento</label>
           <div className="grid grid-cols-2 gap-1.5">
             {['PIX', 'Dinheiro', 'Crédito', 'Débito', 'Máquina', 'Transferência'].map(m => {
               const mapLabel = { 'Crédito': 'Cartão de Crédito', 'Débito': 'Cartão de Débito', 'Máquina': 'Máquina de Cartão' };
               const fullLabel = mapLabel[m] || m;
               return (
                 <button key={m} type="button" onClick={() => setMetodoPagamento(prev => prev === fullLabel ? '' : fullLabel)}
                   className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                     metodoPagamento === fullLabel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                   }`}>
                   <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${metodoPagamento === fullLabel ? 'border-white bg-white' : 'border-gray-300'}`}>
                     {metodoPagamento === fullLabel && <span className="w-2 h-2 rounded-sm bg-blue-600 block" />}
                   </span>
                   {m}
                 </button>
               );
             })}
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

function AgendarDataModal({ open, onClose, pagamento, onSave }) {
  const [data, setData] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && pagamento) {
      setData(pagamento.data_pagamento_agendado || '');
    }
  }, [open, pagamento]);

  const handleSave = async () => {
    if (!data) return toast.error('Informe a data');
    setLoading(true);
    await onSave(pagamento, data);
    setLoading(false);
    setData('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader><DialogTitle>Agendar Data de Pagamento</DialogTitle></DialogHeader>
        <div className="py-3 space-y-3">
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <span className="font-semibold">{pagamento?.cliente_nome}</span>
            <br />
            <span className="text-xs text-gray-500">{pagamento?.tipo_servico}</span>
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">📅 Data que o cliente vai pagar</label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-11" autoFocus />
            {data && <p className="text-xs text-blue-600 mt-2">Você será notificado em {format(new Date(data + 'T12:00:00'), 'dd/MM/yyyy')}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Agendando...' : '✓ Agendar'}
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
      <DialogContent className="max-w-sm w-[95vw] max-h-[90vh] overflow-y-auto">
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
      <DialogContent className="max-w-lg w-[95vw] max-h-[85vh] overflow-y-auto">
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
      <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
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

// Card compacto estilo tabela com expansão
function LinhaTabela({ pag, onPagar, onEditarValor, onHistorico, onDelete, onDetalhes, onDefinirPreco, onAgendarData }) {
  const [expandido, setExpandido] = useState(false);
  const records = pag._records || [pag];
  const saldo = calcularSaldo(pag.valor_total, pag.valor_pago);
  const isPago = pag.status === 'pago';
  const isParcial = pag.status === 'parcial';
  const pct = pag.valor_total > 0 ? Math.min(100, Math.round(((pag.valor_pago || 0) / pag.valor_total) * 100)) : 0;
  const temPrecoDefinido = pag.valor_total > 0;
  
  // Verifica se chegou a data de agendamento
  const dataAgendada = pag.data_pagamento_agendado ? parseISO(pag.data_pagamento_agendado) : null;
  const hoje = new Date();
  const chegoDataAgendada = dataAgendada && isAfter(hoje, dataAgendada) && !isPago;

  return (
    <div className={`border rounded-lg transition-all ${
      chegoDataAgendada 
        ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-200' 
        : expandido 
        ? 'border-blue-300 bg-blue-50/30' 
        : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Linha principal compacta */}
      <div onClick={() => setExpandido(!expandido)} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${expandido ? 'bg-white border-b border-blue-200' : 'hover:bg-gray-50/50'}`}>
        {/* Avatar + Cliente - mobile stacked */}
        <div className="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
          {chegoDataAgendada && <span className="text-lg flex-shrink-0 animate-pulse" title="Data de agendamento chegou!">🔔</span>}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
            chegoDataAgendada ? 'bg-orange-500' : isPago ? 'bg-green-500' : isParcial ? 'bg-amber-500' : 'bg-blue-500'
          }`}>
            {pag.cliente_nome?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-gray-800">{pag.cliente_nome}</p>
              {pag.data_pagamento_agendado && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-semibold flex-shrink-0">
                  {format(new Date(pag.data_pagamento_agendado + 'T12:00:00'), 'dd/MM')}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate">{pag._tipoResumido || pag.tipo_servico}</p>
          </div>
        </div>

        {/* Info row mobile */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          {/* Valor */}
          <div className="text-left flex-shrink-0">
            <p className="text-xs text-gray-400">Valor</p>
            <p className={`font-semibold text-sm ${pag.valor_total === 0 ? 'text-amber-500' : 'text-gray-800'}`}>
              {pag.valor_total === 0 ? 'A def.' : formatCurrency(pag.valor_total).replace('R$', '').trim()}
            </p>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            {isPago
              ? <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs">✓ Pago</Badge>
              : isParcial
              ? <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">Parcial</Badge>
              : pag.data_pagamento_agendado
              ? <Badge className="bg-purple-100 text-purple-700 border border-purple-200 text-xs">📅 Agendado</Badge>
              : temPrecoDefinido ? <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs">Pendente</Badge> : <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs">Sem preço</Badge>
            }
          </div>
        </div>

        {/* Progress row mobile */}
        <div className="w-full sm:w-16 flex-shrink-0">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${isPago ? 'bg-green-500' : isParcial ? 'bg-amber-500' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 text-right mt-0.5">{pct}%</p>
        </div>

        {/* Botões ação - scrollable no mobile */}
         <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
           <button onClick={() => onDetalhes(pag)} className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 flex-shrink-0" title="Detalhes">
             <Eye className="w-4 h-4" />
           </button>
           <button onClick={() => onHistorico(pag)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 flex-shrink-0" title="Histórico">
             <History className="w-4 h-4" />
           </button>
           {!isPago && (
             <>
               <button onClick={() => onDefinirPreco(pag)} className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold whitespace-nowrap">
                 Preço
               </button>
               {pag.telefone && (
                 <a href={getWhatsApp(pag.telefone)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-xs flex items-center gap-1.5 flex-shrink-0 shadow-md hover:shadow-lg transition-all flex-shrink-0" title="WhatsApp" rel="noopener noreferrer">
                   <MessageCircle className="w-4 h-4" />
                   <span className="hidden sm:inline">WhatsApp</span>
                 </a>
               )}
               <button onClick={() => onAgendarData(pag)} className="px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold whitespace-nowrap flex items-center gap-1">
                 <Calendar className="w-3 h-3" /> Agendar
               </button>
               <button onClick={() => onPagar(pag)} className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-semibold whitespace-nowrap">
                 Pagar
               </button>
             </>
           )}
           <button onClick={() => onDelete(pag.id)} className="p-1.5 rounded text-red-500 hover:bg-red-50 flex-shrink-0" title="Excluir">
             <Trash2 className="w-4 h-4" />
           </button>
         </div>
      </div>

      {/* Painel expandível com detalhes - mobile otimizado */}
      {expandido && (
        <div className="px-4 py-3 bg-white border-t border-blue-200 space-y-2 text-sm">
          {/* Detalhes do cliente */}
          {pag.telefone && (
           <div className="flex items-center justify-between flex-wrap gap-2">
             <span className="text-gray-600">Contato:</span>
             <a href={getWhatsApp(pag.telefone)} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
               <MessageCircle className="w-3.5 h-3.5" />
               {formatPhone(pag.telefone)}
             </a>
           </div>
          )}
          {pag.equipe_nome && (
           <div className="flex items-center justify-between flex-wrap gap-2">
             <span className="text-gray-600">Equipe:</span>
             <span className="text-gray-800 font-medium">👷 {pag.equipe_nome}</span>
           </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-2">
           <span className="text-gray-600">Data:</span>
           <span className="text-gray-800 font-medium text-xs">
             {pag.data_conclusao ? format(parseISO(pag.data_conclusao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
           </span>
          </div>
          {pag._records && pag._records.length > 1 && (
            <div className="text-xs text-gray-600">
              <span className="font-medium">Serviços: {pag._records.length} registros</span>
            </div>
          )}
          {chegoDataAgendada && (
            <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-100 border border-orange-300 rounded px-3 py-2 font-semibold">
              <span>🔔 COBRAR HOJE! ({format(dataAgendada, 'dd/MM/yyyy')})</span>
            </div>
          )}
          {pag.data_pagamento_agendado && !chegoDataAgendada && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Agendado para: {format(dataAgendada, 'dd/MM/yyyy')}</span>
            </div>
          )}
          {!isPago && temPrecoDefinido && (
            <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded px-3 py-2">
              <span className="text-red-700 font-semibold text-xs">Saldo devido:</span>
              <span className="text-red-700 font-bold">{formatCurrency(saldo)}</span>
            </div>
          )}
          {pag._records?.some(r => r.valor_total === 0) && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Defina o preço para registrar pagamento</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
      }

      function TabelaPagamentos({ lista, onPagar, onEditarValor, onHistorico, onDelete, onDetalhes, onDefinirPreco, onAgendarData, emptyMsg }) {
        return (
        <div className="space-y-2">
          {lista.length === 0 ? (
            <div className="text-center py-14 text-gray-400 bg-white rounded-lg border border-gray-200">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{emptyMsg}</p>
            </div>
          ) : lista.map(p => (
            <LinhaTabela key={p.id} pag={p} onPagar={onPagar} onEditarValor={onEditarValor} onHistorico={onHistorico} onDelete={onDelete} onDetalhes={onDetalhes} onDefinirPreco={onDefinirPreco} onAgendarData={onAgendarData} />
          ))}
        </div>
      );
}

export default function PagamentosClientes() {
  return (
    <TechnicianAccessBlock>
      <PagamentosClientesContent />
    </TechnicianAccessBlock>
  );
}

function PagamentosClientesContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Bloquear acesso para não-admins
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
          <p className="text-gray-500">Esta página é restrita a administradores.</p>
        </div>
      </div>
    );
  }

  const criandoIds = useRef(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [pagarModal, setPagarModal] = useState(null);
  const [precosModal, setPrecosModal] = useState(null);
  const [editarModal, setEditarModal] = useState(null);
  const [historicoModal, setHistoricoModal] = useState(null);
  const [detalhesModal, setDetalhesModal] = useState(null);
  const [agendarDataModal, setAgendarDataModal] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('semana');
  const [precosSyncKey, setPrecosSyncKey] = useState(0);
  const [abrirRelatorio, setAbrirRelatorio] = useState(false);
  const [compartilharModal, setCompartilharModal] = useState(null);

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
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 }); // segunda-feira
  const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 }); // domingo

  // Sincronizar apenas ATENDIMENTOS DA SEMANA ATUAL — 1 registro por atendimento
  useEffect(() => {
    if (isLoading || !atendimentos.length) return;
    const idsRegistrados = new Set(pagamentos.map(p => p.atendimento_id).filter(Boolean));

    // TIPOS_IGNORADOS moved to top-level const

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
      
      // Procurar débitos atrasados do mesmo cliente (fora da semana atual)
      const nomeNormalizado = (a.cliente_nome || '').trim().toLowerCase();
      const telefoneLimpo = (a.telefone || '').replace(/\D/g, '');
      
      const debitosAtrasados = pagamentos.filter(p => {
        const pNomeNormalizado = (p.cliente_nome || '').trim().toLowerCase();
        const pTelefoneLimpo = (p.telefone || '').replace(/\D/g, '');
        const debitoPendente = calcularSaldo(p.valor_total, p.valor_pago);
        
        // Verificar se é mesmo cliente e tem débito pendente
        if (pNomeNormalizado !== nomeNormalizado) return false;
        if (telefoneLimpo && pTelefoneLimpo && telefoneLimpo !== pTelefoneLimpo) return false;
        if (debitoPendente <= 0.01) return false;
        
        // Ignorar serviços da semana atual
        if (p.data_conclusao) {
          try {
            if (isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana })) return false;
          } catch {}
        }
        return true;
      });
      
      const debitoTotal = debitosAtrasados.reduce((sum, p) => sum + ((p.valor_total || 0) - (p.valor_pago || 0)), 0);

      // Novo cliente sempre inicia com R$ 1.00 e status pendente para ADM editar
      createMutation.mutate({
        atendimento_id: a.id,
        servico_id: a.servico_id || '',
        cliente_nome: a.cliente_nome || '',
        telefone: a.telefone || '',
        tipo_servico: a.tipo_servico || '',
        data_conclusao: a.data_conclusao || a.created_date,
        valor_total: debitoTotal > 0 ? debitoTotal : 1.0,
        valor_pago: 0,
        status: 'pendente',
        equipe_nome: a.equipe_nome || '',
        historico_pagamentos: debitoTotal > 0 ? [{
          valor: debitoTotal,
          data: format(new Date(), 'dd/MM/yyyy HH:mm'),
          observacao: '🔗 Débitos anteriores consolidados',
          consolidado: true
        }] : [],
      });
    });
  }, [atendimentos, pagamentos, isLoading]);

  const handleSalvarPrecos = async (pag, precosGrupo) => {
    const records = pag._records?.length > 1 ? pag._records : [pag];
    for (const rec of records) {
      const tipos = (rec.tipo_servico || '').split('+').map(s => s.trim()).filter(Boolean);
      const novoPreco = tipos.reduce((sum, t) => sum + (parseFloat((precosGrupo[t] || '').replace(',', '.')) || 0), 0);
      if (novoPreco > 0 && novoPreco !== rec.valor_total) {
        // Quando define preço, retorna para pendente se não tiver nada agendado
        const novoStatus = rec.data_pagamento_agendado ? 'agendado' : 'pendente';
        await updateMutation.mutateAsync({ id: rec.id, data: { valor_total: novoPreco, status: novoStatus } });
      }
    }
    toast.success('💾 Preços salvos com sucesso!');
    setPrecosSyncKey(k => k + 1);
  };

  const handleRegistrarPagamento = async (pag, valor, obs, parcelas = [], precosGrupo = {}, dataPagamentoAgendado = '') => {
    const records = pag._records?.length > 1 ? pag._records : [pag];
    let remaining = valor;
    const dataStr = format(new Date(), "dd/MM/yyyy HH:mm");
    // Se registrou pagamento sem agendar data, manter como pendente até quitar
    const novoStatus = (novoPago) => {
      const isQuitado = novoPago >= (rec.valor_total || 0) - 0.01;
      if (isQuitado) return 'pago';
      return dataPagamentoAgendado ? 'agendado' : 'parcial';
    };

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
      const recSaldo = calcularSaldo(rec.valor_total, rec.valor_pago);
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
      const statusFinal = isQuitado ? 'pago' : (dataPagamentoAgendado ? 'agendado' : 'parcial');
      await updateMutation.mutateAsync({
        id: rec.id, data: {
          valor_pago: novoPago,
          status: statusFinal,
          historico_pagamentos: novoHistorico,
          data_pagamento_completo: isQuitado ? new Date().toISOString() : undefined,
          data_pagamento_agendado: dataPagamentoAgendado || undefined,
        },
      });
    }
    toast.success('✅ Pagamento registrado!');
    setCompartilharModal(pag);
  };

  const handleEditarValor = async (pag, novoValor) => {
    await updateMutation.mutateAsync({ id: pag.id, data: { valor_total: novoValor, status: 'pendente' } });
    toast.success('Valor atualizado! Status retornado para pendente.');
  };

  const handleAgendarData = async (pag, novaData) => {
    const records = pag._records?.length > 1 ? pag._records : [pag];
    for (const rec of records) {
      // Apenas agende se não estiver pago
      const saldo = calcularSaldo(rec.valor_total, rec.valor_pago);
      if (saldo > 0.01) {
        await updateMutation.mutateAsync({ id: rec.id, data: { data_pagamento_agendado: novaData, status: 'agendado' } });
      }
    }
    toast.success('📅 Data de pagamento agendada!');
  };

  // TIPOS_SEM_COBRANCA is now consolidated with TIPOS_IGNORADOS at top

  const pagsFiltrados = useMemo(() =>
    pagamentos.filter(p =>
      (!searchTerm || p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      !TIPOS_IGNORADOS.includes(p.tipo_servico)
    )
  , [pagamentos, searchTerm]);

  // 1. TODOS os serviços da semana (APENAS DA SEMANA ATUAL: seg-dom)
  const pagsSemana = useMemo(() => {
    const statusOrder = { 'pendente': 0, 'agendado': 1, 'parcial': 2, 'pago': 3 };
    const filtrados = pagsFiltrados
      .filter(p => {
        if (!p.data_conclusao) return false;
        // Mostrar APENAS serviços que foram concluídos NESTA semana (seg-dom)
        try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana }); }
        catch { return false; }
      });
    const agrupados = groupPagamentos(filtrados);
    return agrupados.sort((a, b) => (statusOrder[a.status] || 4) - (statusOrder[b.status] || 4));
  }, [pagsFiltrados, inicioSemana, fimSemana]);

  // 2. Serviços SEM preço ou que ficaram de uma semana para outra (atrasados)
  const pagsSemPreco = useMemo(() => {
    const filtrados = pagsFiltrados
      .filter(p => {
        if (p.status === 'pago' || p.status === 'agendado') return false; // Excluir agendados daqui
        // Incluir: sem preço OU (tem preço mas é atrasado)
        const temPreco = p.valor_total > 0;
        const isAtrasado = p.data_conclusao ? !isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana }) : false;
        const naoAgendado = !p.data_pagamento_agendado;
        return !temPreco || (isAtrasado && naoAgendado);
      })
      .sort((a, b) => {
        const da = a.data_conclusao ? new Date(a.data_conclusao) : new Date(0);
        const db = b.data_conclusao ? new Date(b.data_conclusao) : new Date(0);
        return db - da;
      });
    return groupPagamentos(filtrados);
  }, [pagsFiltrados, inicioSemana, fimSemana]);

  // 3. Pagamentos AGENDADOS e ATRASADOS (incluindo pendentes/agendados de semanas anteriores)
  const pagsAgendadosAtrasados = useMemo(() => {
    const filtrados = pagsFiltrados
      .filter(p => {
        if (p.status === 'pago') return false;
        
        // Incluir: status agendado OU serviços antigos (pendentes/agendados fora da semana atual) que não foram pagos
        if (p.status === 'agendado') return true;
        
        // Incluir serviços de semanas anteriores que estão pendentes/agendados (nunca pagos)
        if (p.status !== 'pendente') return false;
        
        if (!p.data_conclusao) return false;
        try {
          const estaForaSemanaBuscada = !isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana });
          const temSaldoPendente = (p.valor_total || 0) - (p.valor_pago || 0) > 0.01;
          return estaForaSemanaBuscada && temSaldoPendente;
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        // Ordenar: por data de agendamento (se houver), depois por data de conclusão
        const da = a.data_pagamento_agendado ? new Date(a.data_pagamento_agendado) : (a.data_conclusao ? new Date(a.data_conclusao) : new Date(0));
        const db = b.data_pagamento_agendado ? new Date(b.data_pagamento_agendado) : (b.data_conclusao ? new Date(b.data_conclusao) : new Date(0));
        return da - db;
      });
    return groupPagamentos(filtrados);
  }, [pagsFiltrados, inicioSemana, fimSemana]);

  // 4. Serviços pagos da semana atual
  const pagsPagos = useMemo(() => {
    const filtrados = pagsFiltrados
      .filter(p => {
        if (p.status !== 'pago') return false;
        if (!p.data_conclusao) return false;
        try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana }); }
        catch { return false; }
      })
      .sort((a, b) => {
        const da = a.data_conclusao ? new Date(a.data_conclusao) : new Date(0);
        const db = b.data_conclusao ? new Date(b.data_conclusao) : new Date(0);
        return db - da;
      });
    return groupPagamentos(filtrados);
  }, [pagsFiltrados, inicioSemana, fimSemana]);



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
  const totalSemPreco = pagsSemPreco.reduce((s, p) => s + ((p.valor_total || 0) - (p.valor_pago || 0)), 0);
  const totalAgendadosAtrasados = pagsAgendadosAtrasados.reduce((s, p) => s + ((p.valor_total || 0) - (p.valor_pago || 0)), 0);

  // Recebido na semana: todos os pagamentos (incluindo já pagos) dentro da semana
  const todosPagsSemana = useMemo(() => pagamentos.filter(p => {
    if (!p.data_conclusao) return false;
    try { return isWithinInterval(parseISO(p.data_conclusao), { start: inicioSemana, end: fimSemana }); }
    catch { return false; }
  }), [pagamentos, inicioSemana, fimSemana]);
  const totalPagoSemana = todosPagsSemana.reduce((s, p) => s + (p.valor_pago || 0), 0);


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
      <div className="rounded-2xl p-4 sm:p-5" style={{ backgroundColor: '#1e3a8a' }}>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white">Pagamentos dos Clientes</h1>
            <p className="text-blue-200/80 text-xs sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>Semana: {format(inicioSemana, "dd/MM", { locale: ptBR })} – {format(fimSemana, "dd/MM/yyyy", { locale: ptBR })}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white/10 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-white font-bold text-sm sm:text-lg">{formatCurrency(totalMes).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Faturado Mês</p>
            </div>
            <div className="bg-green-500/20 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-green-300 font-bold text-sm sm:text-lg">{formatCurrency(totalPagoMes).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Recebido Mês</p>
            </div>
            <div className="bg-white/10 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-white font-bold text-sm sm:text-lg">{formatCurrency(totalSemana).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Faturado Sem.</p>
            </div>
            <div className="bg-green-500/20 rounded-lg px-2 sm:px-3 py-2 text-center">
              <p className="text-green-300 font-bold text-sm sm:text-lg">{formatCurrency(totalPagoSemana).replace('R$', '').trim()}</p>
              <p className="text-blue-200 text-xs">Recebido Sem.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Busca + Abas */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-10 bg-white border-gray-200 w-full" />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        <Button onClick={() => setAbrirRelatorio(true)} variant="outline" className="gap-2 w-full sm:w-auto">
          📄 Gerar PDF
        </Button>
        <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          {abas.map(a => (
            <button key={a.key} onClick={() => setAbaAtiva(a.key)}
              className={`flex-1 px-2 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-colors ${abaAtiva === a.key ? 'text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              style={abaAtiva === a.key ? { backgroundColor: '#1e3a8a' } : {}}>
              <span className="truncate">{a.label}</span>
              {a.count !== null && (
                <span className={`text-xs px-1 sm:px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${abaAtiva === a.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
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
          {/* SEÇÃO 1: TODOS os serviços da semana */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600" />
                Serviços da Semana
              </h2>
              <span className="text-sm font-semibold text-blue-600">{pagsSemana.length} serviços</span>
            </div>
            <TabelaPagamentos
              lista={pagsSemana}
              onPagar={setPagarModal}
              onDefinirPreco={setPrecosModal}
              onEditarValor={setEditarModal}
              onHistorico={setHistoricoModal}
              onDetalhes={setDetalhesModal}
              onAgendarData={setAgendarDataModal}
              onDelete={(id) => deleteMutation.mutate(id)}
              emptyMsg="Nenhum serviço nesta semana"
            />
          </div>

          {/* SEÇÃO 2: Sem preço ou atrasados */}
          {pagsSemPreco.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  Sem Preço ou Atrasados
                </h2>
                <span className="text-sm font-semibold text-amber-600">{pagsSemPreco.length} itens</span>
              </div>
              <TabelaPagamentos
                lista={pagsSemPreco}
                onPagar={setPagarModal}
                onDefinirPreco={setPrecosModal}
                onEditarValor={setEditarModal}
                onHistorico={setHistoricoModal}
                onDetalhes={setDetalhesModal}
                onAgendarData={setAgendarDataModal}
                onDelete={(id) => deleteMutation.mutate(id)}
                emptyMsg="Nenhum serviço sem preço"
              />
            </div>
          )}

          {/* SEÇÃO 3: Pagamentos agendados e atrasados */}
          {pagsAgendadosAtrasados.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Agendados e Atrasados
                </h2>
                <span className="text-sm font-semibold text-purple-600">{pagsAgendadosAtrasados.length} itens</span>
              </div>
              <TabelaPagamentos
                lista={pagsAgendadosAtrasados}
                onPagar={setPagarModal}
                onDefinirPreco={setPrecosModal}
                onEditarValor={setEditarModal}
                onHistorico={setHistoricoModal}
                onDetalhes={setDetalhesModal}
                onAgendarData={setAgendarDataModal}
                onDelete={(id) => deleteMutation.mutate(id)}
                emptyMsg="Nenhum pagamento agendado"
              />
            </div>
          )}

          {/* SEÇÃO 4: Serviços pagos não aparecem aqui - apenas no histórico/relatório */}
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
            <div className="flex flex-col gap-3">
              <Select value={relFiltro} onValueChange={setRelFiltro}>
                <SelectTrigger className="h-10 bg-white w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana Atual</SelectItem>
                  <SelectItem value="mes">Mês Atual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Filtrar cliente..." value={relCliente} onChange={e => setRelCliente(e.target.value)} className="pl-9 h-10 bg-white w-full" />
              </div>
            </div>
            {relFiltro === 'personalizado' && (
              <div className="flex flex-col gap-3 mt-3">
                <div><label className="text-xs text-gray-500 mb-1 block">Data início</label><Input type="date" value={relDataInicio} onChange={e => setRelDataInicio(e.target.value)} className="h-10 w-full" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Data fim</label><Input type="date" value={relDataFim} onChange={e => setRelDataFim(e.target.value)} className="h-10 w-full" /></div>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Faturado', value: totalRel, color: 'border-gray-200 bg-white text-gray-800' },
              { label: 'Recebido', value: totalPagoRel, color: 'border-green-200 bg-green-50 text-green-700' },
              { label: 'Débito', value: totalRel - totalPagoRel, color: 'border-red-200 bg-red-50 text-red-700' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg border p-3 text-center ${item.color}`}>
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className="font-bold text-sm">{formatCurrency(item.value)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pagsRelatorio.length} reg</p>
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
            onAgendarData={setAgendarDataModal}
            onDelete={(id) => deleteMutation.mutate(id)}
            emptyMsg="Nenhum registro no período selecionado"
          />
        </div>
      )}

      <DefinirPrecoModal open={!!precosModal} onClose={() => setPrecosModal(null)} pagamento={precosModal} pagamentosAtuais={pagamentos} onSave={handleSalvarPrecos} />
      <PagamentoModal open={!!pagarModal} onClose={() => setPagarModal(null)} pagamento={pagarModal} onSave={handleRegistrarPagamento} pagamentosAtuais={pagamentos} syncKey={precosSyncKey} />
      <AgendarDataModal open={!!agendarDataModal} onClose={() => setAgendarDataModal(null)} pagamento={agendarDataModal} onSave={handleAgendarData} />
      <EditarValorModal open={!!editarModal} onClose={() => setEditarModal(null)} pagamento={editarModal} onSave={handleEditarValor} />
      <HistoricoModal open={!!historicoModal} onClose={() => setHistoricoModal(null)} pagamento={historicoModal} />
      <DetalhesClienteModal open={!!detalhesModal} onClose={() => setDetalhesModal(null)} pagamento={detalhesModal} />
      <RelatorioClientesPagamentoModal isOpen={abrirRelatorio} onClose={() => setAbrirRelatorio(false)} pagamentos={pagamentos} servicos={servicosConcluidos} />
      <CompromissoClientePDF isOpen={!!compartilharModal} onClose={() => setCompartilharModal(null)} pagamento={compartilharModal} />
    </div>
  );
}