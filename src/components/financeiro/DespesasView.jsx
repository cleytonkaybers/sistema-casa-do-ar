import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Receipt, TrendingDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ConfirmDialog from '@/components/ConfirmDialog';

const formatCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

const CATEGORIAS = [
  'Ferramentas',
  'Manutencao Carro',
  'Pecas Carro',
  'Combustivel',
  'Material Consumo',
  'Aluguel',
  'Energia',
  'Internet',
  'Telefone',
  'Outros',
];

const COR_CATEGORIA = {
  Ferramentas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'Manutencao Carro': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'Pecas Carro': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Combustivel: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'Material Consumo': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Aluguel: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  Energia: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Internet: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Telefone: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  Outros: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

export default function DespesasView() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filtroCat, setFiltroCat] = useState('todas');

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ['despesas'],
    queryFn: () => base44.entities.Despesa.list('-data').catch(() => []),
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Despesa.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      setShowForm(false);
      setEditingDespesa(null);
      toast.success('Despesa registrada!');
    },
    onError: (err) => toast.error('Erro ao registrar: ' + (err?.message || 'tente de novo')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Despesa.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      setShowForm(false);
      setEditingDespesa(null);
      toast.success('Despesa atualizada!');
    },
    onError: (err) => toast.error('Erro ao atualizar: ' + (err?.message || 'tente de novo')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Despesa.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
      setConfirmDelete(null);
      toast.success('Despesa excluida');
    },
    onError: (err) => toast.error('Erro ao excluir: ' + (err?.message || 'tente de novo')),
  });

  // Resumo: mes atual / mes anterior / esta semana
  const hoje = new Date();
  const totais = useMemo(() => {
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    const inicioMesAnt = startOfMonth(subMonths(hoje, 1));
    const fimMesAnt = endOfMonth(subMonths(hoje, 1));
    const inicioSem = startOfWeek(hoje, { weekStartsOn: 1 });
    const fimSem = endOfWeek(hoje, { weekStartsOn: 1 });

    const noIntervalo = (data, ini, fim) => {
      if (!data) return false;
      try { return isWithinInterval(parseISO(data), { start: ini, end: fim }); }
      catch { return false; }
    };

    const mes = despesas.filter(d => noIntervalo(d.data, inicioMes, fimMes));
    const mesAnt = despesas.filter(d => noIntervalo(d.data, inicioMesAnt, fimMesAnt));
    const sem = despesas.filter(d => noIntervalo(d.data, inicioSem, fimSem));

    return {
      mes: mes.reduce((s, d) => s + (d.valor || 0), 0),
      mesAnterior: mesAnt.reduce((s, d) => s + (d.valor || 0), 0),
      semana: sem.reduce((s, d) => s + (d.valor || 0), 0),
      qtdMes: mes.length,
      qtdSemana: sem.length,
    };
  }, [despesas, hoje]);

  // Filtro por categoria
  const despesasFiltradas = useMemo(() => {
    if (filtroCat === 'todas') return despesas;
    return despesas.filter(d => d.categoria === filtroCat);
  }, [despesas, filtroCat]);

  // Quebra por categoria (para chips clicaveis)
  const porCategoria = useMemo(() => {
    const map = {};
    despesas.forEach(d => {
      const c = d.categoria || 'Outros';
      if (!map[c]) map[c] = { qtd: 0, total: 0 };
      map[c].qtd++;
      map[c].total += d.valor || 0;
    });
    return Object.entries(map).map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.total - a.total);
  }, [despesas]);

  return (
    <div className="space-y-4">
      {/* Header com totais */}
      <div className="rounded-2xl p-4 sm:p-5" style={{ background: 'linear-gradient(135deg, #7f1d1d, #991b1b)' }}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                <Receipt className="w-6 h-6" />
                Despesas
              </h2>
              <p className="text-red-200/80 text-xs sm:text-sm mt-1">
                Gastos da empresa abatidos do lucro líquido
              </p>
            </div>
            <Button
              onClick={() => { setEditingDespesa(null); setShowForm(true); }}
              className="bg-white text-red-700 hover:bg-red-50 font-bold gap-2"
            >
              <Plus className="w-4 h-4" /> Nova Despesa
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
              <p className="text-white font-bold text-base sm:text-lg">{formatCurrency(totais.semana).replace('R$', '').trim()}</p>
              <p className="text-red-200 text-xs">Esta Semana</p>
            </div>
            <div className="bg-white/15 rounded-lg px-3 py-2 text-center border border-white/20">
              <p className="text-white font-bold text-base sm:text-lg">{formatCurrency(totais.mes).replace('R$', '').trim()}</p>
              <p className="text-red-200 text-xs">Este Mês ({totais.qtdMes})</p>
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2 text-center border border-white/10">
              <p className="text-red-100 font-bold text-base sm:text-lg">{formatCurrency(totais.mesAnterior).replace('R$', '').trim()}</p>
              <p className="text-red-200 text-xs">Mês Anterior</p>
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2 text-center border border-white/10">
              <p className="text-red-100 font-bold text-base sm:text-lg">{despesas.length}</p>
              <p className="text-red-200 text-xs">Total registros</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chips por categoria */}
      {porCategoria.length > 0 && (
        <Card className="bg-[#152236] border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-wider">Por categoria (todos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFiltroCat('todas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  filtroCat === 'todas'
                    ? 'bg-white text-gray-900 border-white'
                    : 'bg-[#0f1a2b] text-gray-300 border-white/10 hover:bg-white/5'
                }`}
              >
                Todas <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20">{despesas.length}</span>
              </button>
              {porCategoria.map(({ cat, qtd, total }) => (
                <button
                  key={cat}
                  onClick={() => setFiltroCat(filtroCat === cat ? 'todas' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    filtroCat === cat
                      ? COR_CATEGORIA[cat] + ' ring-2 ring-current'
                      : 'bg-[#0f1a2b] text-gray-300 border-white/10 hover:bg-white/5'
                  }`}
                >
                  {cat} <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20">{qtd}</span>
                  <span className="ml-2 opacity-80">{formatCurrency(total).replace('R$', '').trim()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de despesas */}
      <Card className="bg-[#152236] border-white/5">
        <CardHeader>
          <CardTitle className="text-base text-gray-200">
            {filtroCat === 'todas' ? `Todas as despesas (${despesasFiltradas.length})` : `${filtroCat} (${despesasFiltradas.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : despesasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma despesa registrada</p>
              <p className="text-sm">Clique em "Nova Despesa" para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-gray-400">Data</TableHead>
                    <TableHead className="text-gray-400">Descrição</TableHead>
                    <TableHead className="text-gray-400">Categoria</TableHead>
                    <TableHead className="text-gray-400">Fornecedor</TableHead>
                    <TableHead className="text-gray-400 text-right">Valor</TableHead>
                    <TableHead className="text-gray-400 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasFiltradas.map(d => (
                    <TableRow key={d.id} className="hover:bg-white/5">
                      <TableCell className="text-gray-300 text-sm whitespace-nowrap">
                        {d.data ? format(parseISO(d.data), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-gray-200 font-medium">{d.descricao}</div>
                        {d.observacoes && (
                          <div className="text-[11px] text-gray-500 truncate max-w-xs">{d.observacoes}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${COR_CATEGORIA[d.categoria] || COR_CATEGORIA.Outros} border text-xs font-semibold`}>
                          {d.categoria || 'Outros'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">{d.fornecedor || '-'}</TableCell>
                      <TableCell className="text-right text-red-400 font-bold">
                        −{formatCurrency(d.valor)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm" variant="ghost" title="Editar"
                            onClick={() => { setEditingDespesa(d); setShowForm(true); }}
                            className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" title="Excluir"
                            onClick={() => setConfirmDelete(d)}
                            className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal cadastro/edicao */}
      <DespesaFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingDespesa(null); }}
        despesa={editingDespesa}
        onSave={(data) => {
          if (editingDespesa) updateMutation.mutate({ id: editingDespesa.id, data });
          else createMutation.mutate(data);
        }}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
        title="Excluir despesa"
        description={`Excluir "${confirmDelete?.descricao}" (${formatCurrency(confirmDelete?.valor)})? Não pode ser desfeito.`}
        confirmText="Excluir"
        variant="destructive"
      />
    </div>
  );
}

function DespesaFormModal({ open, onClose, despesa, onSave, saving }) {
  const [form, setForm] = useState({
    descricao: '',
    categoria: 'Outros',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    metodo_pagamento: '',
    observacoes: '',
    fornecedor: '',
  });

  React.useEffect(() => {
    if (!open) return;
    if (despesa) {
      setForm({
        descricao: despesa.descricao || '',
        categoria: despesa.categoria || 'Outros',
        valor: despesa.valor != null ? String(despesa.valor).replace('.', ',') : '',
        data: despesa.data || format(new Date(), 'yyyy-MM-dd'),
        metodo_pagamento: despesa.metodo_pagamento || '',
        observacoes: despesa.observacoes || '',
        fornecedor: despesa.fornecedor || '',
      });
    } else {
      setForm({
        descricao: '',
        categoria: 'Outros',
        valor: '',
        data: format(new Date(), 'yyyy-MM-dd'),
        metodo_pagamento: '',
        observacoes: '',
        fornecedor: '',
      });
    }
  }, [open, despesa]);

  const handleSubmit = () => {
    if (!form.descricao.trim()) return toast.error('Descrição é obrigatória');
    const val = parseFloat(String(form.valor).replace(',', '.'));
    if (!val || val <= 0) return toast.error('Valor inválido');
    if (!form.data) return toast.error('Informe a data');
    onSave({
      descricao: form.descricao.trim(),
      categoria: form.categoria || 'Outros',
      valor: val,
      data: form.data,
      metodo_pagamento: form.metodo_pagamento || '',
      observacoes: form.observacoes || '',
      fornecedor: form.fornecedor || '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-500" />
            {despesa ? 'Editar Despesa' : 'Nova Despesa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input
              autoFocus
              placeholder="Ex: Gasolina posto BR"
              value={form.descricao}
              onChange={e => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$) *</Label>
              <Input
                placeholder="0,00"
                value={form.valor}
                onChange={e => setForm({ ...form, valor: e.target.value })}
                className="font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data *</Label>
              <Input
                type="date"
                value={form.data}
                onChange={e => setForm({ ...form, data: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor / Loja (opcional)</Label>
            <Input
              placeholder="Ex: Posto BR, Auto Center..."
              value={form.fornecedor}
              onChange={e => setForm({ ...form, fornecedor: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Método de pagamento (opcional)</Label>
            <Input
              placeholder="PIX, Dinheiro, Cartão..."
              value={form.metodo_pagamento}
              onChange={e => setForm({ ...form, metodo_pagamento: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações (opcional)</Label>
            <Input
              placeholder="Nota fiscal, detalhes..."
              value={form.observacoes}
              onChange={e => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving ? 'Salvando...' : (despesa ? 'Salvar alterações' : 'Registrar despesa')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
