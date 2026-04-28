import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, DollarSign, History, Pencil, Trash2, CheckCircle, HandCoins, Search } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import TechnicianAccessBlock from '@/components/TechnicianAccessBlock';

const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const parseBRL = (str) => {
  if (str === '' || str === null || str === undefined) return 0;
  const clean = String(str).replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

const calcularSaldo = (emp) => Math.max(0, (emp.valor_emprestado || 0) - (emp.valor_pago || 0));

export default function DinheiroEmprestadoPage() {
  return (
    <TechnicianAccessBlock>
      <DinheiroEmprestadoContent />
    </TechnicianAccessBlock>
  );
}

function DinheiroEmprestadoContent() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [emprestimoEditando, setEmprestimoEditando] = useState(null);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [emprestimoPagando, setEmprestimoPagando] = useState(null);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [emprestimoHistorico, setEmprestimoHistorico] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: emprestimos = [], isLoading } = useQuery({
    queryKey: ['dinheiroEmprestados'],
    queryFn: () => base44.entities.DinheiroEmprestado.list('-data_emprestimo'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DinheiroEmprestado.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dinheiroEmprestados'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DinheiroEmprestado.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dinheiroEmprestados'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DinheiroEmprestado.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dinheiroEmprestados'] }),
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return emprestimos;
    return emprestimos.filter(e => (e.pessoa_nome || '').toLowerCase().includes(termo));
  }, [emprestimos, busca]);

  const totais = useMemo(() => {
    const ativos = emprestimos.filter(e => e.status !== 'quitado');
    return {
      totalEmprestado: emprestimos.reduce((s, e) => s + (e.valor_emprestado || 0), 0),
      totalPago: emprestimos.reduce((s, e) => s + (e.valor_pago || 0), 0),
      saldoAReceber: ativos.reduce((s, e) => s + calcularSaldo(e), 0),
      qtdAtivos: ativos.length,
    };
  }, [emprestimos]);

  const handleSalvarEmprestimo = async (form) => {
    if (!form.pessoa_nome.trim()) return toast.error('Informe o nome da pessoa');
    const valor = parseBRL(form.valor_emprestado);
    if (!valor || valor <= 0) return toast.error('Informe um valor valido');
    if (!form.data_emprestimo) return toast.error('Informe a data do emprestimo');

    const dados = {
      pessoa_nome: form.pessoa_nome.trim(),
      valor_emprestado: valor,
      data_emprestimo: form.data_emprestimo,
      observacoes: form.observacoes || '',
    };

    try {
      if (emprestimoEditando) {
        await updateMutation.mutateAsync({ id: emprestimoEditando.id, data: dados });
        toast.success('Emprestimo atualizado!');
      } else {
        await createMutation.mutateAsync({
          ...dados,
          valor_pago: 0,
          status: 'ativo',
          historico_pagamentos: [{
            data: format(new Date(), 'dd/MM/yyyy HH:mm'),
            valor: valor,
            tipo: 'emprestimo',
            saldo_antes: 0,
            saldo_depois: valor,
            observacao: 'Emprestimo registrado',
          }],
        });
        toast.success('Emprestimo registrado!');
      }
      setShowFormModal(false);
      setEmprestimoEditando(null);
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err?.message || 'tente novamente'));
    }
  };

  const handleRegistrarPagamento = async (emprestimo, valorPago, obs) => {
    const v = parseBRL(valorPago);
    if (!v || v <= 0) return toast.error('Informe um valor valido');
    const saldoAtual = calcularSaldo(emprestimo);
    if (v > saldoAtual + 0.01) return toast.error(`Valor maior que o saldo (${formatBRL(saldoAtual)})`);

    const novoValorPago = (emprestimo.valor_pago || 0) + v;
    const novoSaldo = (emprestimo.valor_emprestado || 0) - novoValorPago;
    const quitou = novoSaldo <= 0.01;

    const novaEntrada = {
      data: format(new Date(), 'dd/MM/yyyy HH:mm'),
      valor: v,
      tipo: 'pagamento',
      saldo_antes: saldoAtual,
      saldo_depois: Math.max(0, novoSaldo),
      observacao: obs || '',
    };

    try {
      await updateMutation.mutateAsync({
        id: emprestimo.id,
        data: {
          valor_pago: novoValorPago,
          status: quitou ? 'quitado' : 'ativo',
          historico_pagamentos: [...(emprestimo.historico_pagamentos || []), novaEntrada],
        },
      });
      toast.success(quitou ? '✅ Emprestimo quitado!' : '💰 Pagamento registrado!');
      setShowPagamentoModal(false);
      setEmprestimoPagando(null);
    } catch (err) {
      toast.error('Erro ao registrar pagamento');
    }
  };

  const handleExcluir = async (emprestimo) => {
    try {
      await deleteMutation.mutateAsync(emprestimo.id);
      toast.success('Emprestimo excluido');
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-amber-500" /> Dinheiro Emprestado
          </h1>
          <p className="text-sm text-gray-500 mt-1">Controle simples de emprestimos pessoais (sem juros).</p>
        </div>
        <Button
          onClick={() => { setEmprestimoEditando(null); setShowFormModal(true); }}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> Novo Emprestimo
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-gray-500">Total Emprestado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-gray-800">{formatBRL(totais.totalEmprestado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-gray-500">Total Recebido</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-emerald-600">{formatBRL(totais.totalPago)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-gray-500">Saldo a Receber</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-red-600">{formatBRL(totais.saldoAReceber)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-gray-500">Emprestimos Ativos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-blue-600">{totais.qtdAtivos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar pelo nome da pessoa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de Emprestimos ({filtrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {busca ? 'Nenhum emprestimo encontrado.' : 'Nenhum emprestimo registrado ainda. Clique em "Novo Emprestimo".'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(emp => {
                    const saldo = calcularSaldo(emp);
                    const quitado = emp.status === 'quitado' || saldo <= 0.01;
                    return (
                      <TableRow key={emp.id} className={quitado ? 'opacity-60' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{emp.pessoa_nome}</p>
                            {emp.observacoes && (
                              <p className="text-[11px] text-gray-500 max-w-xs truncate" title={emp.observacoes}>{emp.observacoes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {emp.data_emprestimo ? format(parseISO(emp.data_emprestimo), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatBRL(emp.valor_emprestado)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium">{formatBRL(emp.valor_pago)}</TableCell>
                        <TableCell className={`text-right font-bold ${quitado ? 'text-gray-400' : 'text-red-600'}`}>
                          {formatBRL(saldo)}
                        </TableCell>
                        <TableCell>
                          {quitado ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300 gap-1">
                              <CheckCircle className="w-3 h-3" /> Quitado
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border border-amber-300">Ativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {!quitado && (
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Registrar pagamento"
                                onClick={() => { setEmprestimoPagando(emp); setShowPagamentoModal(true); }}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Ver historico"
                              onClick={() => { setEmprestimoHistorico(emp); setShowHistoricoModal(true); }}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Editar"
                              onClick={() => { setEmprestimoEditando(emp); setShowFormModal(true); }}
                              className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Excluir"
                              onClick={() => setConfirmDelete(emp)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
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
        </CardContent>
      </Card>

      {/* Modal: Novo/Editar */}
      <FormModal
        open={showFormModal}
        onClose={() => { setShowFormModal(false); setEmprestimoEditando(null); }}
        emprestimo={emprestimoEditando}
        onSave={handleSalvarEmprestimo}
      />

      {/* Modal: Registrar pagamento */}
      <PagamentoModal
        open={showPagamentoModal}
        onClose={() => { setShowPagamentoModal(false); setEmprestimoPagando(null); }}
        emprestimo={emprestimoPagando}
        onSave={handleRegistrarPagamento}
      />

      {/* Modal: Historico */}
      <HistoricoModal
        open={showHistoricoModal}
        onClose={() => { setShowHistoricoModal(false); setEmprestimoHistorico(null); }}
        emprestimo={emprestimoHistorico}
      />

      {/* Confirm: Excluir */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleExcluir(confirmDelete)}
        title="Excluir Emprestimo"
        description={`Tem certeza que deseja excluir o emprestimo de ${confirmDelete?.pessoa_nome} (${formatBRL(confirmDelete?.valor_emprestado)})? Todo o historico sera perdido.`}
        confirmText="Excluir"
        variant="destructive"
      />
    </div>
  );
}

function FormModal({ open, onClose, emprestimo, onSave }) {
  const [form, setForm] = useState({ pessoa_nome: '', valor_emprestado: '', data_emprestimo: '', observacoes: '' });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (emprestimo) {
      setForm({
        pessoa_nome: emprestimo.pessoa_nome || '',
        valor_emprestado: emprestimo.valor_emprestado ? String(emprestimo.valor_emprestado).replace('.', ',') : '',
        data_emprestimo: emprestimo.data_emprestimo || '',
        observacoes: emprestimo.observacoes || '',
      });
    } else {
      setForm({
        pessoa_nome: '',
        valor_emprestado: '',
        data_emprestimo: format(new Date(), 'yyyy-MM-dd'),
        observacoes: '',
      });
    }
  }, [open, emprestimo]);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{emprestimo ? 'Editar Emprestimo' : 'Novo Emprestimo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome da pessoa</Label>
            <Input
              placeholder="Ex: Gabriel"
              value={form.pessoa_nome}
              onChange={e => setForm({ ...form, pessoa_nome: e.target.value })}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={form.valor_emprestado}
                onChange={e => setForm({ ...form, valor_emprestado: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do emprestimo</Label>
              <Input
                type="date"
                value={form.data_emprestimo}
                onChange={e => setForm({ ...form, data_emprestimo: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observacoes (opcional)</Label>
            <Input
              placeholder="Ex: combinou pagar 100 por semana"
              value={form.observacoes}
              onChange={e => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? 'Salvando...' : (emprestimo ? 'Salvar alteracoes' : 'Registrar emprestimo')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagamentoModal({ open, onClose, emprestimo, onSave }) {
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) { setValor(''); setObs(''); }
  }, [open]);

  if (!emprestimo) return null;
  const saldo = calcularSaldo(emprestimo);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(emprestimo, valor, obs);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="font-bold text-gray-800 text-base mb-2">{emprestimo.pessoa_nome}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-gray-400">Original</p><p className="font-bold text-gray-800 text-sm">{formatBRL(emprestimo.valor_emprestado)}</p></div>
              <div><p className="text-xs text-gray-400">Pago</p><p className="font-bold text-emerald-600 text-sm">{formatBRL(emprestimo.valor_pago)}</p></div>
              <div><p className="text-xs text-gray-400">Saldo</p><p className="font-bold text-red-600 text-sm">{formatBRL(saldo)}</p></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Valor pago (R$)</Label>
            <Input
              placeholder="0,00"
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="h-11 text-base font-semibold"
              autoFocus
            />
            <button onClick={() => setValor(saldo.toFixed(2).replace('.', ','))} className="text-xs text-blue-600 underline">
              Quitar total ({formatBRL(saldo)})
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Observacao (opcional)</Label>
            <Input
              placeholder="Ex: pagou em dinheiro, PIX, etc."
              value={obs}
              onChange={e => setObs(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !parseBRL(valor)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? 'Salvando...' : '✓ Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoModal({ open, onClose, emprestimo }) {
  if (!emprestimo) return null;
  const historico = emprestimo.historico_pagamentos || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historico — {emprestimo.pessoa_nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div><p className="text-xs text-gray-400">Original</p><p className="font-bold text-sm">{formatBRL(emprestimo.valor_emprestado)}</p></div>
            <div><p className="text-xs text-gray-400">Pago</p><p className="font-bold text-emerald-600 text-sm">{formatBRL(emprestimo.valor_pago)}</p></div>
            <div><p className="text-xs text-gray-400">Saldo</p><p className="font-bold text-red-600 text-sm">{formatBRL(calcularSaldo(emprestimo))}</p></div>
          </div>

          {historico.length === 0 ? (
            <p className="text-center text-gray-500 py-6 text-sm">Nenhuma movimentacao registrada.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo Apos</TableHead>
                    <TableHead>Observacao</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...historico].reverse().map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm whitespace-nowrap">{h.data || '-'}</TableCell>
                      <TableCell>
                        {h.tipo === 'emprestimo' ? (
                          <Badge className="bg-amber-100 text-amber-700 border border-amber-300">Emprestimo</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300">Pagamento</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${h.tipo === 'pagamento' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {h.tipo === 'pagamento' ? '-' : '+'}{formatBRL(h.valor)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-600">{formatBRL(h.saldo_depois)}</TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs">{h.observacao || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
