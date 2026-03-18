import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { DollarSign, TrendingUp, CheckCircle2, Clock, FileText } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function MeuFinanceiro() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodoFiltro, setPeriodoFiltro] = useState('atual'); // atual, anterior, customizado
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);


  React.useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
      // Definir período padrão como semana atual (segunda-feira a domingo)
      const hoje = new Date();
      const inicio = startOfWeek(hoje, { weekStartsOn: 1 }); // 1 = Segunda-feira
      const fim = endOfWeek(hoje, { weekStartsOn: 1 });
      setDataInicio(format(inicio, 'yyyy-MM-dd'));
      setDataFim(format(fim, 'yyyy-MM-dd'));
    });
  }, []);

  const handleChangePeriodo = (periodo) => {
    setPeriodoFiltro(periodo);
    const hoje = new Date();
    let inicio, fim;

    if (periodo === 'atual') {
      inicio = startOfWeek(hoje, { weekStartsOn: 1 }); // 1 = Segunda-feira
      fim = endOfWeek(hoje, { weekStartsOn: 1 });
    } else if (periodo === 'anterior') {
      const semanaAnterior = subWeeks(hoje, 1);
      inicio = startOfWeek(semanaAnterior, { weekStartsOn: 1 }); // 1 = Segunda-feira
      fim = endOfWeek(semanaAnterior, { weekStartsOn: 1 });
    }
    
    setDataInicio(format(inicio, 'yyyy-MM-dd'));
    setDataFim(format(fim, 'yyyy-MM-dd'));
  };

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

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Servico.list();
    },
    enabled: !!user?.email
  });

  const { data: meusPagamentosRegistrados = [] } = useQuery({
    queryKey: ['pagamentosTecnico', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.PagamentoTecnico.filter({
        tecnico_id: user.email,
        status: 'Confirmado'
      });
    },
    enabled: !!user?.email
  });

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  // Filtrar comissões por período
  const comissoesFiltradas = minhasComissoes.filter(c => {
    if (!dataInicio || !dataFim) return c.status === 'pendente';
    const dataReferencia = format(parseISO(c.data_geracao), 'yyyy-MM-dd');
    return dataReferencia >= dataInicio && dataReferencia <= dataFim && c.status === 'pendente';
  });

  // Totais semanais
  const totalPendente = comissoesPendentes.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);



  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" /> Crédito Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">R$ {totalPendente.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">{comissoesFiltradas.length} serviço(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Crédito Pago (Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">R$ 0,00</div>
            <p className="text-xs text-gray-500 mt-1">Zerado semanalmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total Ganho (Semana)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">R$ {totalPendente.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Apenas pendentes da semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Relatório de Comissões por Serviço */}
      <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> Relatório de Comissões por Serviço</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="mb-4">
             <Select value={periodoFiltro} onValueChange={handleChangePeriodo}>
               <SelectTrigger className="w-48">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="atual">Semana Atual</SelectItem>
                 <SelectItem value="anterior">Semana Anterior</SelectItem>
               </SelectContent>
             </Select>
           </div>
           <div className="overflow-x-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Cliente</TableHead>
                   <TableHead>Serviço</TableHead>
                   <TableHead>Equipe</TableHead>
                   <TableHead>Valor Serviço</TableHead>
                   <TableHead>Sua Comissão</TableHead>
                   <TableHead>% Ganha</TableHead>
                   <TableHead>Status</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {comissoesFiltradas.map(comissao => {
                   const percentualGanho = comissao.valor_total_servico > 0 
                     ? ((comissao.valor_comissao_tecnico / comissao.valor_total_servico) * 100).toFixed(1)
                     : 0;
                   return (
                     <TableRow key={comissao.id}>
                       <TableCell className="font-medium">{comissao.cliente_nome}</TableCell>
                       <TableCell className="text-sm">{comissao.tipo_servico}</TableCell>
                       <TableCell className="text-sm">{comissao.equipe_nome}</TableCell>
                       <TableCell className="font-semibold">R$ {comissao.valor_total_servico.toFixed(2)}</TableCell>
                       <TableCell className="font-bold text-green-600">R$ {comissao.valor_comissao_tecnico.toFixed(2)}</TableCell>
                       <TableCell className="font-semibold text-blue-600">{percentualGanho}%</TableCell>
                       <TableCell>
                         <Badge variant="destructive">Pendente</Badge>
                       </TableCell>
                       </TableRow>
                       );
                       })}
                       </TableBody>
                       </Table>
                       </div>
                       {comissoesFiltradas.length === 0 && (
                       <p className="text-center text-gray-500 text-sm py-4">Nenhuma comissão neste período</p>
                       )}
                       </CardContent>
                       </Card>

      {/* Histórico de Pagamentos */}
      {meusPagamentosRegistrados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meusPagamentosRegistrados.map(pag => (
                    <TableRow key={pag.id}>
                      <TableCell className="text-sm">{format(parseISO(pag.data_pagamento), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="font-bold text-green-600">R$ {pag.valor_pago.toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{pag.metodo_pagamento}</TableCell>
                      <TableCell className="text-sm text-gray-500">{pag.observacao || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Comissões por Dia */}


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