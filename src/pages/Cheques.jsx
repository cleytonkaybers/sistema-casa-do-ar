import React, { useState, useEffect } from 'react';
import EmprestimosTable from '@/components/cheques/EmprestimosTable';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isToday, isPast, differenceInDays, isTomorrow, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, CheckCircle, XCircle, Bell, AlertTriangle, Clock, DollarSign } from 'lucide-react';

function calcDebitoEmprestimo(e) {
  if (!e.valor_principal || !e.percentual_mes || !e.data_emprestimo) return e.valor_principal || 0;
  const inicio = parseISO(e.data_emprestimo);
  if (!isValid(inicio)) return e.valor_principal;
  const dias = differenceInDays(new Date(), inicio);
  const taxaDiaria = e.percentual_mes / 100 / 30;
  return Math.max(0, e.valor_principal * Math.pow(1 + taxaDiaria, dias) - (e.total_abatido || 0));
}
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  compensado: { label: 'Compensado', color: 'bg-green-100 text-green-700 border-green-200' },
  devolvido: { label: 'Devolvido', color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function Cheques() {
  const [cheques, setCheques] = useState([]);
  const [emprestimos, setEmprestimos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: '', quem_passou: '', data_compensacao: '', valor: '', banco: '', observacoes: '' });
  const [saving, setSaving] = useState(false);
  const [alertas, setAlertas] = useState([]);

  const loadCheques = async () => {
    setLoading(true);
    const data = await base44.entities.Cheque.list('-data_compensacao');
    setCheques(data);
    verificarAlertas(data);
    setLoading(false);
  };

  const verificarAlertas = (data) => {
    const pendentes = data.filter(c => c.status === 'pendente');
    const novosAlertas = [];

    pendentes.forEach(c => {
      const data_comp = parseISO(c.data_compensacao);
      if (isToday(data_comp)) {
        novosAlertas.push({ cheque: c, tipo: 'hoje', msg: `HOJE — Levar cheque de ${c.nome} ao banco! R$ ${c.valor?.toFixed(2)}` });
      } else if (isTomorrow(data_comp)) {
        novosAlertas.push({ cheque: c, tipo: 'amanha', msg: `AMANHÃ — Cheque de ${c.nome} vence amanhã! R$ ${c.valor?.toFixed(2)}` });
      } else if (isPast(data_comp)) {
        novosAlertas.push({ cheque: c, tipo: 'vencido', msg: `VENCIDO — Cheque de ${c.nome} passou da data! R$ ${c.valor?.toFixed(2)}` });
      }
    });

    setAlertas(novosAlertas);

    // Toast para cheques do dia
    novosAlertas.filter(a => a.tipo === 'hoje').forEach(a => {
      toast.warning(a.msg, { duration: 8000 });
    });
  };

  useEffect(() => {
    loadCheques();
    base44.entities.Emprestimo.list().then(setEmprestimos).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.nome || !form.data_compensacao || !form.valor) {
      toast.error('Preencha nome, data e valor');
      return;
    }
    setSaving(true);
    await base44.entities.Cheque.create({ ...form, valor: parseFloat(form.valor), status: 'pendente' });
    toast.success('Cheque cadastrado!');
    setForm({ nome: '', quem_passou: '', data_compensacao: '', valor: '', banco: '', observacoes: '' });
    setShowForm(false);
    setSaving(false);
    loadCheques();
  };

  const handleStatus = async (cheque, novoStatus) => {
    await base44.entities.Cheque.update(cheque.id, { status: novoStatus });
    toast.success(`Cheque marcado como ${STATUS_CONFIG[novoStatus].label}`);
    loadCheques();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este cheque?')) return;
    await base44.entities.Cheque.delete(id);
    toast.success('Cheque removido');
    loadCheques();
  };

  const getDataAlert = (data_comp, status) => {
    if (status !== 'pendente') return null;
    const d = parseISO(data_comp);
    const diff = differenceInDays(d, new Date());
    if (isPast(d) && !isToday(d)) return { label: 'Vencido', color: 'text-red-600', icon: XCircle };
    if (isToday(d)) return { label: 'HOJE', color: 'text-red-600 font-bold', icon: AlertTriangle };
    if (isTomorrow(d)) return { label: 'Amanhã', color: 'text-orange-500 font-bold', icon: Bell };
    if (diff <= 3) return { label: `${diff}d`, color: 'text-orange-400', icon: Clock };
    return null;
  };

  const pendentes = cheques.filter(c => c.status === 'pendente');
  const outros = cheques.filter(c => c.status !== 'pendente');
  const totalPendente = pendentes.reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalEmprestimosAtivos = emprestimos
    .filter(e => e.status === 'ativo')
    .reduce((acc, e) => acc + calcDebitoEmprestimo(e), 0);
  const totalAplicado = totalPendente + totalEmprestimosAtivos;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Banner Total Aplicado */}
      <div className="rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #6d28d9 100%)' }}>
        <div>
          <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Total em Circulação</p>
          <p className="text-white text-3xl font-bold mt-0.5">R$ {totalAplicado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex gap-4 text-center">
          <div className="bg-white/10 rounded-lg px-4 py-2">
            <p className="text-blue-200 text-xs">Cheques Pendentes</p>
            <p className="text-white font-bold">R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-4 py-2">
            <p className="text-purple-200 text-xs">Empréstimos Ativos</p>
            <p className="text-white font-bold">R$ {totalEmprestimosAtivos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cheques Pré-datados</h1>
          <p className="text-sm text-gray-500">Controle de cheques para compensação</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="w-4 h-4" />
          Novo Cheque
        </Button>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium border ${
              a.tipo === 'vencido' ? 'bg-red-50 border-red-300 text-red-700' :
              a.tipo === 'hoje' ? 'bg-orange-50 border-orange-300 text-orange-700 animate-pulse' :
              'bg-yellow-50 border-yellow-300 text-yellow-700'
            }`}>
              <Bell className="w-4 h-4 flex-shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Pendentes</p>
          <p className="text-xl font-bold text-yellow-600">{pendentes.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Total Pendente</p>
          <p className="text-xl font-bold text-blue-600">R$ {totalPendente.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-xl font-bold text-gray-700">{cheques.length}</p>
        </div>
      </div>

      {/* Tabela Pendentes */}
      {pendentes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-yellow-50 border-b border-yellow-100">
            <span className="text-sm font-semibold text-yellow-800">⏳ Cheques Pendentes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Emitente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Quem Passou</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Banco</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Obs</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map(c => {
                  const alerta = getDataAlert(c.data_compensacao, c.status);
                  const AlertIcon = alerta?.icon;
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{c.nome}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.quem_passou || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-700">{format(parseISO(c.data_compensacao), 'dd/MM/yyyy')}</span>
                          {alerta && (
                            <span className={`flex items-center gap-0.5 text-xs ${alerta.color}`}>
                              <AlertIcon className="w-3 h-3" />
                              {alerta.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-green-700">R$ {c.valor?.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{c.banco || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[120px] truncate">{c.observacoes || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => handleStatus(c, 'compensado')} title="Compensado" className="p-1.5 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleStatus(c, 'devolvido')} title="Devolvido" className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors">
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} title="Excluir" className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela Histórico */}
      {outros.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-600">📁 Histórico</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Emitente</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Quem Passou</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {outros.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors opacity-70">
                    <td className="px-4 py-2 text-gray-700">{c.nome}</td>
                    <td className="px-4 py-2 text-gray-500">{c.quem_passou || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{format(parseISO(c.data_compensacao), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-2 text-right text-gray-600">R$ {c.valor?.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <Badge className={`${STATUS_CONFIG[c.status]?.color} border text-xs`}>
                        {STATUS_CONFIG[c.status]?.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && cheques.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum cheque cadastrado</p>
          <p className="text-sm">Clique em "Novo Cheque" para começar</p>
        </div>
      )}

      {/* Empréstimos com Juros */}
      <div className="border-t border-gray-200 pt-6">
        <EmprestimosTable />
      </div>

      {/* Modal Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cheque Pré-datado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Nome do Emitente (dono da folha) *</label>
              <Input placeholder="Ex: Paulo" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Quem Passou o Cheque</label>
              <Input placeholder="Ex: João" value={form.quem_passou} onChange={e => setForm({...form, quem_passou: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Data de Compensação *</label>
                <Input type="date" value={form.data_compensacao} onChange={e => setForm({...form, data_compensacao: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Valor (R$) *</label>
                <Input type="number" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Banco</label>
              <Input placeholder="Ex: Bradesco, Itaú..." value={form.banco} onChange={e => setForm({...form, banco: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Observações</label>
              <Input placeholder="Observações opcionais" value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}