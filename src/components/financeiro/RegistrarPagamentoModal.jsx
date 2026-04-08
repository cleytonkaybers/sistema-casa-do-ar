import React, { useState } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

export default function RegistrarPagamentoModal({ open, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState(null);
  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');
  const [observacao, setObservacao] = useState('');

  const { data: tecnicosRaw = [] } = useQuery({
    queryKey: ['tecnicos-financeiro'],
    queryFn: () => base44.entities.TecnicoFinanceiro.list()
  });

  const { data: todosLancamentos = [] } = useQuery({
    queryKey: ['lancamentos-financeiro-modal'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list()
  });

  const { data: todosPagamentos = [] } = useQuery({
    queryKey: ['pagamentos-financeiro-modal'],
    queryFn: () => base44.entities.PagamentoTecnico.list()
  });

  // Filtrar pela semana atual (igual à tela de Gestão de Créditos)
  const agora = new Date();
  const inicioSemana = startOfWeek(agora, { weekStartsOn: 1 });
  const fimSemana = endOfWeek(agora, { weekStartsOn: 1 });

  // Recalcular credito_pendente dinamicamente pela semana atual
  const tecnicos = tecnicosRaw.map(t => {
    const totalComissoesSemana = todosLancamentos
      .filter(l => {
        if (l.tecnico_id !== t.tecnico_id) return false;
        if (!l.data_geracao) return false;
        const d = new Date(l.data_geracao);
        return d >= inicioSemana && d <= fimSemana;
      })
      .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

    const totalPagoSemana = todosPagamentos
      .filter(p => {
        if (p.tecnico_id !== t.tecnico_id || p.status !== 'Confirmado') return false;
        if (!p.created_date) return false;
        const d = new Date(p.created_date);
        return d >= inicioSemana && d <= fimSemana;
      })
      .reduce((sum, p) => sum + (p.valor_pago || 0), 0);

    return {
      ...t,
      credito_pendente: Math.max(0, totalComissoesSemana - totalPagoSemana),
      credito_pago: totalPagoSemana,
      total_ganho: totalComissoesSemana
    };
  });

  const handleRegistrarPagamento = async () => {
    if (!tecnicoSelecionado || !valorPago || parseFloat(valorPago) <= 0) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    if (parseFloat(valorPago) > tecnicoSelecionado.credito_pendente) {
      toast.warning(`Valor superior ao crédito pendente (R$ ${tecnicoSelecionado.credito_pendente.toFixed(2)})`);
    }

    setLoading(true);
    try {
      const response = await base44.functions.invoke('registrarPagamentoTecnico', {
        tecnico_id: tecnicoSelecionado.tecnico_id,
        valor_pago: parseFloat(valorPago),
        data_pagamento: dataPagamento,
        metodo_pagamento: metodoPagamento,
        observacao
      });

      toast.success(response.data.mensagem);
      onSuccess?.();
      onClose();
      
      // Reset form
      setTecnicoSelecionado(null);
      setValorPago('');
      setObservacao('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao registrar pagamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento ao Técnico</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de Técnico */}
          <div className="space-y-2">
            <Label>Técnico *</Label>
            <Select value={tecnicoSelecionado?.id || ''} onValueChange={(id) => {
              const tecnico = tecnicos.find(t => t.id === id);
              setTecnicoSelecionado(tecnico);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar técnico..." />
              </SelectTrigger>
              <SelectContent>
                {tecnicos.map(tecnico => (
                  <SelectItem key={tecnico.id} value={tecnico.id}>
                    {tecnico.tecnico_nome} - Crédito Pendente: R$ {tecnico.credito_pendente.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tecnicoSelecionado && (
            <>
              {/* Resumo do Técnico */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Crédito Pendente</p>
                      <p className="font-bold text-lg">R$ {tecnicoSelecionado.credito_pendente.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Pago</p>
                      <p className="font-bold text-lg text-green-600">R$ {tecnicoSelecionado.credito_pago.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Ganho</p>
                      <p className="font-bold text-lg">R$ {tecnicoSelecionado.total_ganho.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados do Pagamento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Pago (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                    placeholder="0.00"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data do Pagamento *</Label>
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Método de Pagamento *</Label>
                <Select value={metodoPagamento} onValueChange={setMetodoPagamento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Transferência Bancária">Transferência Bancária</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: Referência do pagamento, descrição..."
                  rows={2}
                />
              </div>

              {/* Aviso de Confirmação */}
              {valorPago && (
                <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    Confirmar pagamento de <span className="font-bold">R$ {parseFloat(valorPago).toFixed(2)}</span> ao técnico <span className="font-bold">{tecnicoSelecionado.tecnico_nome}</span>? Este valor será subtraído do crédito pendente.
                  </p>
                </div>
              )}

              {/* Botões */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleRegistrarPagamento}
                  disabled={loading || !valorPago || parseFloat(valorPago) <= 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</> : 'Confirmar Pagamento'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}