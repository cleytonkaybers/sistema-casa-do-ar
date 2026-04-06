import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, MinusCircle, TrendingUp } from 'lucide-react';
import { differenceInDays, parseISO, isValid } from 'date-fns';

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

function formatMoney(v) {
  return `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;
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
    mutationFn: ({ id, novoTotal }) => base44.entities.Emprestimo.update(id, { total_abatido: novoTotal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      setAbatimentoModal(null);
      setValorAbatimento('');
      toast.success('Abatimento registrado!');
    },
  });

  const quitarMutation = useMutation({
    mutationFn: (id) => base44.entities.Emprestimo.update(id, { status: 'quitado' }),
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
    createMutation.mutate({
      ...form,
      valor_principal: parseFloat(form.valor_principal),
      percentual_mes: parseFloat(form.percentual_mes),
      total_abatido: 0,
      status: 'ativo',
    });
  };

  const handleAbater = () => {
    const val = parseFloat(valorAbatimento);
    if (!val || val <= 0) { toast.error('Informe um valor válido'); return; }
    const novoTotal = (abatimentoModal.total_abatido || 0) + val;
    abatirMutation.mutate({ id: abatimentoModal.id, novoTotal });
  };

  const ativos = emprestimos.filter(e => e.status === 'ativo');
  const quitados = emprestimos.filter(e => e.status === 'quitado');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-800">Empréstimos com Juros</h2>
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
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: '#6d28d9' }}>
                <TableHead className="text-white">Cliente</TableHead>
                <TableHead className="text-white">Valor Emprestado</TableHead>
                <TableHead className="text-white">Data</TableHead>
                <TableHead className="text-white">% a.m.</TableHead>
                <TableHead className="text-white">Débito Atual</TableHead>
                <TableHead className="text-white">Juros Acumulados</TableHead>
                <TableHead className="text-white">Total Abatido</TableHead>
                <TableHead className="text-white">Venc. Estimado</TableHead>
                <TableHead className="text-white">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ativos.map((e) => {
                const debitoAtual = calcularDebitoAtual(e);
                const juros = debitoAtual - (e.valor_principal - (e.total_abatido || 0));
                return (
                  <TableRow key={e.id} className="hover:bg-purple-50">
                    <TableCell className="font-medium">{e.cliente_nome}</TableCell>
                    <TableCell>{formatMoney(e.valor_principal)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{e.data_emprestimo || '-'}</TableCell>
                    <TableCell>
                      <Badge className="bg-purple-100 text-purple-700">{e.percentual_mes}% a.m.</Badge>
                    </TableCell>
                    <TableCell className="font-bold text-red-600">{formatMoney(debitoAtual)}</TableCell>
                    <TableCell className="text-orange-600 font-medium">{formatMoney(Math.max(0, juros))}</TableCell>
                    <TableCell className="text-green-600 font-medium">{formatMoney(e.total_abatido || 0)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{e.data_estimada_recebimento || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Abater valor" onClick={() => { setAbatimentoModal(e); setValorAbatimento(''); }} className="text-green-600 hover:text-green-800">
                          <MinusCircle className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => quitarMutation.mutate(e.id)} className="text-blue-600 hover:text-blue-800 text-xs px-2">
                          Quitar
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(e.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {quitados.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">Ver quitados ({quitados.length})</summary>
          <div className="overflow-x-auto mt-2 rounded-xl border border-gray-200 bg-white shadow-sm opacity-70">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quitados.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.cliente_nome}</TableCell>
                    <TableCell>{formatMoney(e.valor_principal)}</TableCell>
                    <TableCell>{e.data_emprestimo}</TableCell>
                    <TableCell><Badge className="bg-green-100 text-green-700">Quitado</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <DialogTitle>Abater Valor — {abatimentoModal?.cliente_nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Débito atual: <strong className="text-red-600">{abatimentoModal ? formatMoney(calcularDebitoAtual(abatimentoModal)) : '-'}</strong></p>
            <div>
              <label className="text-sm font-medium text-gray-700">Valor a abater</label>
              <Input type="number" value={valorAbatimento} onChange={e => setValorAbatimento(e.target.value)} placeholder="0,00" />
            </div>
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