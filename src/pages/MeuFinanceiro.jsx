import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, CheckCircle2, Clock, Eye, Send } from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function MeuFinanceiro() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodoFiltro, setPeriodoFiltro] = useState('atual'); // atual, anterior, customizado
  const [dataInicio, setDataInicio] = useState(null);
  const [dataFim, setDataFim] = useState(null);
  const [detalhesServico, setDetalhesServico] = useState(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);

  React.useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
      // Definir período padrão como semana atual
      const hoje = new Date();
      const inicio = startOfWeek(hoje, { weekStartsOn: 0 });
      const fim = endOfWeek(hoje, { weekStartsOn: 0 });
      setDataInicio(format(inicio, 'yyyy-MM-dd'));
      setDataFim(format(fim, 'yyyy-MM-dd'));
    });
  }, []);

  const handleChangePeriodo = (periodo) => {
    setPeriodoFiltro(periodo);
    const hoje = new Date();
    let inicio, fim;

    if (periodo === 'atual') {
      inicio = startOfWeek(hoje, { weekStartsOn: 0 });
      fim = endOfWeek(hoje, { weekStartsOn: 0 });
    } else if (periodo === 'anterior') {
      const semanaAnterior = subWeeks(hoje, 1);
      inicio = startOfWeek(semanaAnterior, { weekStartsOn: 0 });
      fim = endOfWeek(semanaAnterior, { weekStartsOn: 0 });
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

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  // Filtrar comissões por período
  const comissoesFiltradas = minhasComissoes.filter(c => {
    if (!dataInicio || !dataFim) return true;
    const dataGeracao = format(parseISO(c.data_geracao), 'yyyy-MM-dd');
    return dataGeracao >= dataInicio && dataGeracao <= dataFim;
  });

  const comissoesPendentes = comissoesFiltradas.filter(c => c.status === 'pendente');
  const comissoesPagas = comissoesFiltradas.filter(c => c.status === 'pago');

  // Totais semanais
  const totalPendente = comissoesPendentes.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);
  const totalPago = comissoesPagas.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);

  // Agrupar por dia
  const comissoesPorDia = comissoesFiltradas.reduce((acc, comissao) => {
    const data = format(parseISO(comissao.data_geracao), 'dd/MM/yyyy', { locale: ptBR });
    if (!acc[data]) acc[data] = [];
    acc[data].push(comissao);
    return acc;
  }, {});

  const handleSolicitarPagamento = async (comissao) => {
    try {
      toast.success(`Solicitação de pagamento enviada para ${comissao.valor_comissao_tecnico.toFixed(2)}`);
      // Aqui seria feita a solicitação real ao backend
    } catch (error) {
      toast.error('Erro ao solicitar pagamento');
    }
  };

  const getServicoDetalhes = (servicoId) => {
    return servicos.find(s => s.id === servicoId);
  };

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
            <div className="text-2xl font-bold text-green-600">R$ {totalPago.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">{comissoesPagas.length} serviço(s)</p>
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

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Minhas Comissões</CardTitle>
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
        </CardHeader>
      </Card>

      {/* Tabela de Comissões por Dia */}
      {Object.keys(comissoesPorDia).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(comissoesPorDia).sort().map(([data, comissoes]) => {
            const totalDia = comissoes.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);
            const pendenteDia = comissoes.filter(c => c.status === 'pendente').reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);
            
            return (
              <Card key={data}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{data}</CardTitle>
                    <div className="text-right">
                      <p className="text-sm font-semibold">R$ {totalDia.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{pendenteDia > 0 ? `Pendente: R$ ${pendenteDia.toFixed(2)}` : 'Tudo pago'}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Serviço</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comissoes.map(comissao => (
                          <TableRow key={comissao.id}>
                            <TableCell className="font-medium">{comissao.cliente_nome}</TableCell>
                            <TableCell className="text-sm">{comissao.tipo_servico}</TableCell>
                            <TableCell className="font-bold">R$ {comissao.valor_comissao_tecnico.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={comissao.status === 'pendente' ? 'destructive' : 'default'}>
                                {comissao.status === 'pendente' ? 'Pendente' : 'Pago'}
                              </Badge>
                            </TableCell>
                            <TableCell className="space-x-2">
                              <Dialog open={showDetalhesModal && detalhesServico?.id === comissao.servico_id} onOpenChange={setShowDetalhesModal}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setDetalhesServico(getServicoDetalhes(comissao.servico_id));
                                      setShowDetalhesModal(true);
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Detalhes do Serviço</DialogTitle>
                                  </DialogHeader>
                                  {detalhesServico && (
                                    <div className="space-y-3 text-sm">
                                      <div>
                                        <p className="font-semibold text-gray-600">Cliente</p>
                                        <p>{detalhesServico.cliente_nome}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-gray-600">Tipo de Serviço</p>
                                        <p>{detalhesServico.tipo_servico}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-gray-600">Valor Total</p>
                                        <p className="text-lg font-bold">R$ {(detalhesServico.valor || 0).toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-gray-600">Data</p>
                                        <p>{format(parseISO(detalhesServico.data_programada), 'dd/MM/yyyy', { locale: ptBR })}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-gray-600">Sua Comissão</p>
                                        <p className="text-lg font-bold text-green-600">R$ {comissao.valor_comissao_tecnico.toFixed(2)}</p>
                                      </div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              {comissao.status === 'pendente' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleSolicitarPagamento(comissao)}
                                  className="text-blue-600 hover:bg-blue-50"
                                >
                                  <Send className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Nenhuma comissão neste período
          </CardContent>
        </Card>
      )}

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