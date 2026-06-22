import React, { useState } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Data de hoje no fuso LOCAL (não UTC). new Date().toISOString() devolve UTC,
// e à noite no Brasil (UTC-3) isso já aponta para o dia seguinte — o que jogava
// o pagamento para a semana seguinte em telas que filtram por data_pagamento
// (MeuFinanceiro, Dashboard), fazendo o valor "não contabilizar" na semana atual.
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RegistrarPagamentoModal({ open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState(null);
  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState(hojeLocal());
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');
  const [observacao, setObservacao] = useState('');

  const { data: tecnicosRaw = [] } = useQuery({
    queryKey: ['tecnicos-financeiro'],
    queryFn: () => listAll('TecnicoFinanceiro')
  });

  const { data: todosLancamentos = [] } = useQuery({
    queryKey: ['lancamentos-financeiro-modal'],
    queryFn: () => listAll('LancamentoFinanceiro')
  });

  const { data: todosPagamentos = [] } = useQuery({
    queryKey: ['pagamentos-financeiro-modal'],
    queryFn: () => listAll('PagamentoTecnico')
  });

  // Filtrar pela semana atual (igual à tela de Gestão de Créditos)
  const agora = new Date();
  const inicioSemana = startOfWeek(agora, { weekStartsOn: 1 });
  const fimSemana = endOfWeek(agora, { weekStartsOn: 1 });

  // Recalcular credito_pendente com a MESMA lógica da tela Financeiro (Gestão de
  // Créditos): saldo acumulado de TODAS as semanas anteriores (desde SALDO_INICIO)
  // somado à semana atual. Antes o modal só olhava a semana corrente, então na
  // virada de semana um técnico que ainda tinha crédito a receber aparecia com
  // R$ 0,00 pendente — o campo auto-preenchia 0,00 e parecia que "não aceitava"
  // o pagamento.
  const SALDO_INICIO = new Date('2026-04-13T00:00:00');
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

    // Saldo acumulado das semanas anteriores ao período atual.
    // Positivo = empresa deve ao técnico (crédito carregado) |
    // Negativo = técnico recebeu a mais (adiantamento).
    let saldo_anterior = 0;
    if (inicioSemana > SALDO_INICIO) {
      const comissoesAnteriores = todosLancamentos
        .filter(l => l.tecnico_id === t.tecnico_id && l.data_geracao &&
                     new Date(l.data_geracao) >= SALDO_INICIO &&
                     new Date(l.data_geracao) < inicioSemana)
        .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

      const pagamentosAnteriores = todosPagamentos
        .filter(p => p.tecnico_id === t.tecnico_id && p.status === 'Confirmado' && p.created_date &&
                     new Date(p.created_date) >= SALDO_INICIO &&
                     new Date(p.created_date) < inicioSemana)
        .reduce((sum, p) => sum + (p.valor_pago || 0), 0);

      saldo_anterior = comissoesAnteriores - pagamentosAnteriores;
    }

    const saldo_total = saldo_anterior + totalComissoesSemana - totalPagoSemana;
    const creditoPendenteLiquido = Math.max(0, saldo_total);

    return {
      ...t,
      credito_pendente: creditoPendenteLiquido,
      credito_pago: totalPagoSemana,
      total_ganho: totalComissoesSemana,
      saldo_anterior,
      // Crédito carregado de semanas anteriores (positivo) e adiantamento
      // (técnico recebeu a mais — valor positivo quando saldo_anterior < 0).
      credito_anterior: Math.max(0, saldo_anterior),
      adiantamento_anterior: Math.max(0, -saldo_anterior),
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

      // Invalida o cache PRÓPRIO do modal (queries com chaves separadas da
      // página). Sem isto, ao reabrir o modal os totais continuavam defasados,
      // dando a impressão de que o pagamento "não contabilizou".
      await queryClient.invalidateQueries({ queryKey: ['tecnicos-financeiro'] });
      await queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiro-modal'] });
      await queryClient.invalidateQueries({ queryKey: ['pagamentos-financeiro-modal'] });

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
              if (tecnico) setValorPago(tecnico.credito_pendente.toFixed(2));
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
                <CardContent className="pt-4 space-y-3">
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
                  {(tecnicoSelecionado.credito_anterior || 0) > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm">
                      <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-blue-700">Crédito de semanas anteriores: </span>
                        <span className="font-bold text-blue-700">R$ {tecnicoSelecionado.credito_anterior.toFixed(2)}</span>
                        <p className="text-xs text-blue-600 mt-0.5">Valor ainda não pago de semanas anteriores. Já somado ao crédito pendente acima.</p>
                      </div>
                    </div>
                  )}
                  {(tecnicoSelecionado.adiantamento_anterior || 0) > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md text-sm">
                      <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-orange-700">Adiantamento de semanas anteriores: </span>
                        <span className="font-bold text-orange-700">R$ {tecnicoSelecionado.adiantamento_anterior.toFixed(2)}</span>
                        <p className="text-xs text-orange-600 mt-0.5">Valor já adiantado além do que foi ganho. Descontado do crédito pendente acima.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Dados do Pagamento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Pago (R$) *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={valorPago}
                      onChange={(e) => setValorPago(e.target.value)}
                      placeholder="0.00"
                      min="0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="whitespace-nowrap text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => setValorPago(tecnicoSelecionado.credito_pendente.toFixed(2))}
                      title="Usar valor total pendente"
                    >
                      R$ {tecnicoSelecionado.credito_pendente.toFixed(2)}
                    </Button>
                  </div>
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