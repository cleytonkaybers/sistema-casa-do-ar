import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, CheckCircle2, Clock, FileText } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, subWeeks, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/lib/AuthContext';

function formatMoney(v) {
  return `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;
}

function parseDateSafe(str) {
  if (!str) return null;
  try {
    const d = parseISO(str);
    return isValid(d) ? d : null;
  } catch { return null; }
}

export default function MeuFinanceiro() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [periodoFiltro, setPeriodoFiltro] = useState('atual');

  const hoje = new Date();
  const getRange = (periodo) => {
    if (periodo === 'atual') {
      return {
        inicio: format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        fim: format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    } else if (periodo === 'anterior') {
      const sem = subWeeks(hoje, 1);
      return {
        inicio: format(startOfWeek(sem, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        fim: format(endOfWeek(sem, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    }
    return { inicio: null, fim: null };
  };

  const { inicio, fim } = getRange(periodoFiltro);

  const { data: minhasComissoes = [], isLoading: loadingComissoes } = useQuery({
    queryKey: ['minhasComissoes', user?.email],
    queryFn: () => base44.entities.LancamentoFinanceiro.filter({ tecnico_id: user.email }),
    enabled: !!user?.email,
  });

  const { data: meusPagamentos = [], isLoading: loadingPagamentos } = useQuery({
    queryKey: ['meusPagamentos', user?.email],
    queryFn: () => base44.entities.PagamentoTecnico.filter({ tecnico_id: user.email, status: 'Confirmado' }),
    enabled: !!user?.email,
  });

  if (!user) return <div className="text-center py-8">Carregando...</div>;

  // Filtrar por período
  const comissoesPeriodo = minhasComissoes.filter(c => {
    if (!inicio || !fim) return true;
    const d = parseDateSafe(c.data_geracao);
    if (!d) return false;
    const ds = format(d, 'yyyy-MM-dd');
    return ds >= inicio && ds <= fim;
  });

  const pagamentosPeriodo = meusPagamentos.filter(p => {
    if (!inicio || !fim) return true;
    const d = parseDateSafe(p.data_pagamento) || parseDateSafe(p.created_date);
    if (!d) return false;
    const ds = format(d, 'yyyy-MM-dd');
    return ds >= inicio && ds <= fim;
  });

  const totalPendente = comissoesPeriodo
    .filter(c => c.status === 'pendente')
    .reduce((s, c) => s + (c.valor_comissao_tecnico || 0), 0);

  const totalPago = pagamentosPeriodo.reduce((s, p) => s + (p.valor_pago || 0), 0);

  const totalGanho = comissoesPeriodo.reduce((s, c) => s + (c.valor_comissao_tecnico || 0), 0);

  const statusBadge = (status) => {
    if (status === 'pago') return <Badge className="bg-green-100 text-green-700">Pago</Badge>;
    if (status === 'creditado') return <Badge className="bg-blue-100 text-blue-700">Creditado</Badge>;
    return <Badge className="bg-orange-100 text-orange-700">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Meu Financeiro</h1>
        <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="atual">Semana Atual</SelectItem>
            <SelectItem value="anterior">Semana Anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Comissões Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatMoney(totalPendente)}</div>
            <p className="text-xs text-gray-500 mt-1">{comissoesPeriodo.filter(c => c.status === 'pendente').length} serviço(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Pagamentos Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatMoney(totalPago)}</div>
            <p className="text-xs text-gray-500 mt-1">{pagamentosPeriodo.length} pagamento(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Total Ganho no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatMoney(totalGanho)}</div>
            <p className="text-xs text-gray-500 mt-1">{comissoesPeriodo.length} serviço(s) concluído(s)</p>
          </CardContent>
        </Card>
      </div>

      {/* Comissões por Serviço */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Comissões por Serviço
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingComissoes ? (
            <p className="text-center text-gray-500 py-4">Carregando...</p>
          ) : comissoesPeriodo.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-4">Nenhuma comissão neste período</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Valor do Serviço</TableHead>
                    <TableHead>Sua Comissão</TableHead>
                    <TableHead>% Ganha</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comissoesPeriodo.map(c => {
                    const percentual = c.valor_total_servico > 0
                      ? ((c.valor_comissao_tecnico / c.valor_total_servico) * 100).toFixed(1)
                      : (c.percentual_tecnico || 15);
                    const data = parseDateSafe(c.data_geracao);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm text-gray-500">
                          {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                        <TableCell className="text-sm">{c.tipo_servico}</TableCell>
                        <TableCell className="text-sm">{c.equipe_nome || '-'}</TableCell>
                        <TableCell className="font-semibold">{formatMoney(c.valor_total_servico)}</TableCell>
                        <TableCell className="font-bold text-green-600">{formatMoney(c.valor_comissao_tecnico)}</TableCell>
                        <TableCell className="font-semibold text-blue-600">{percentual}%</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagamentos Recebidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Pagamentos Recebidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPagamentos ? (
            <p className="text-center text-gray-500 py-4">Carregando...</p>
          ) : meusPagamentos.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-4">Nenhum pagamento registrado ainda</p>
          ) : pagamentosPeriodo.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-4">Nenhum pagamento neste período</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentosPeriodo.map(p => {
                    const data = parseDateSafe(p.data_pagamento) || parseDateSafe(p.created_date);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">
                          {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell className="font-bold text-green-600">{formatMoney(p.valor_pago)}</TableCell>
                        <TableCell className="text-sm">{p.metodo_pagamento || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-500">{p.observacao || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}