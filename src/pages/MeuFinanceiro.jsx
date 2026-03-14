import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MeuFinanceiro() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const { data: meuFinanceiro = null } = useQuery({
    queryKey: ['meuFinanceiro', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const result = await base44.entities.TecnicoFinanceiro.filter({
        tecnico_id: user.email
      });
      return result[0] || null;
    },
    enabled: !!user?.email
  });

  const { data: minhasComissoes = [] } = useQuery({
    queryKey: ['minhasComissoes', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.LancamentoFinanceiro.filter({
        tecnico_id: user.email
      });
    },
    enabled: !!user?.email
  });

  const { data: meusPagamentos = [] } = useQuery({
    queryKey: ['meusPagamentos', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.PagamentoTecnico.filter({
        tecnico_id: user.email
      });
    },
    enabled: !!user?.email
  });

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  const comissoesPendentes = minhasComissoes.filter(c => c.status === 'pendente');
  const comissoesPagas = minhasComissoes.filter(c => c.status === 'pago');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" /> Crédito Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(meuFinanceiro?.credito_pendente || 0).toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">{comissoesPendentes.length} serviço(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Crédito Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(meuFinanceiro?.credito_pago || 0).toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">{meusPagamentos.length} pagamento(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total Ganho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {(meuFinanceiro?.total_ganho || 0).toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Histórico completo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Minhas Comissões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Valor da Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Geração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {minhasComissoes.map(comissao => (
                  <TableRow key={comissao.id}>
                    <TableCell className="font-medium">{comissao.cliente_nome}</TableCell>
                    <TableCell className="text-sm">{comissao.tipo_servico}</TableCell>
                    <TableCell className="font-bold">R$ {comissao.valor_comissao_tecnico.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={comissao.status === 'pendente' ? 'default' : 'secondary'}>
                        {comissao.status === 'pendente' ? 'Pendente' : 'Pago'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {format(parseISO(comissao.created_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {meusPagamentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meusPagamentos.map(pagamento => (
                    <TableRow key={pagamento.id}>
                      <TableCell className="font-bold text-green-600">R$ {pagamento.valor_pago.toFixed(2)}</TableCell>
                      <TableCell>{format(parseISO(pagamento.created_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>{pagamento.metodo_pagamento}</TableCell>
                      <TableCell className="text-sm text-gray-500">{pagamento.nota}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}