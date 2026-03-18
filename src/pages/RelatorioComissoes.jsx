import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, DollarSign, TrendingUp, Calendar, Filter } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';
import { calcularTotalComissoes, agruparPorPeriodo } from '@/lib/utils/calculations';
import { TableSkeleton, CardSkeleton } from '@/components/LoadingSkeleton';
import { usePermissions } from '@/components/auth/PermissionGuard';
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';

export default function RelatorioComissoes() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dataInicio, setDataInicio] = useState('');
  
  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        if (u?.role !== 'admin') {
          navigate('/Dashboard');
        }
      } catch {
        navigate('/Dashboard');
      }
    };
    checkAdmin();
  }, [navigate]);
  const [dataFim, setDataFim] = useState('');
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ['lancamentos-financeiros'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list('-data_geracao'),
  });

  const { data: tecnicos = [] } = useQuery({
    queryKey: ['tecnicos-financeiro'],
    queryFn: () => base44.entities.TecnicoFinanceiro.list(),
  });

  // Filtragem
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(lanc => {
      const dataLanc = new Date(lanc.data_geracao);
      const matchData = (!dataInicio || dataLanc >= new Date(dataInicio)) &&
                       (!dataFim || dataLanc <= new Date(dataFim));
      const matchTecnico = !tecnicoFiltro || lanc.tecnico_id === tecnicoFiltro;
      return matchData && matchTecnico;
    });
  }, [lancamentos, dataInicio, dataFim, tecnicoFiltro]);

  // Totalizadores
  const totais = useMemo(() => calcularTotalComissoes(lancamentosFiltrados), [lancamentosFiltrados]);

  // Agrupamento por mês
  const porMes = useMemo(() => agruparPorPeriodo(lancamentosFiltrados), [lancamentosFiltrados]);

  // Exportar CSV
  const exportarCSV = () => {
    const csv = [
      ['Data', 'Técnico', 'Cliente', 'Tipo Serviço', 'Valor Total', 'Comissão', 'Status'].join(';'),
      ...lancamentosFiltrados.map(l => [
        formatDate(l.data_geracao),
        l.tecnico_nome,
        l.cliente_nome,
        l.tipo_servico,
        l.valor_total_servico,
        l.valor_comissao_tecnico,
        l.status
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comissoes_${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };
  
  if (!user) {
    return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  }
  
  if (user.role !== 'admin') return <NoPermission />;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={3} />
        <TableSkeleton rows={10} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">💰 Relatório de Comissões</h1>
          <p className="text-gray-500 mt-1">Extrato detalhado de comissões por período</p>
        </div>
        <Button onClick={exportarCSV} className="bg-green-600 hover:bg-green-700 gap-2">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Gerado</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.total)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendente</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totais.pendente)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pago</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.pago)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border-gray-200"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border-gray-200"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Técnico</label>
              <select
                value={tecnicoFiltro}
                onChange={(e) => setTecnicoFiltro(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-md"
              >
                <option value="">Todos</option>
                {tecnicos.map(t => (
                  <option key={t.tecnico_id} value={t.tecnico_id}>
                    {t.tecnico_nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo por mês */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="w-5 h-5" />
            Resumo Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(porMes).map(([mes, items]) => {
              const total = calcularTotalComissoes(items);
              return (
                <div key={mes} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">{mes}</p>
                    <p className="text-sm text-gray-500">{items.length} lançamentos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-blue-600">{formatCurrency(total.total)}</p>
                    <p className="text-xs text-gray-500">
                      Pendente: {formatCurrency(total.pendente)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle>Lançamentos Detalhados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: '#1e3a8a' }}>
                <TableHead className="text-white">Data</TableHead>
                <TableHead className="text-white">Técnico</TableHead>
                <TableHead className="text-white">Cliente</TableHead>
                <TableHead className="text-white">Serviço</TableHead>
                <TableHead className="text-white">Valor Total</TableHead>
                <TableHead className="text-white">Comissão</TableHead>
                <TableHead className="text-white">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                    Nenhum lançamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                lancamentosFiltrados.map((lanc) => (
                  <TableRow key={lanc.id} className="hover:bg-gray-50">
                    <TableCell>{formatDate(lanc.data_geracao)}</TableCell>
                    <TableCell className="font-medium">{lanc.tecnico_nome}</TableCell>
                    <TableCell>{lanc.cliente_nome}</TableCell>
                    <TableCell className="text-sm">{lanc.tipo_servico}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(lanc.valor_total_servico)}</TableCell>
                    <TableCell className="font-bold text-green-600">
                      {formatCurrency(lanc.valor_comissao_tecnico)}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        lanc.status === 'pago' ? 'bg-green-100 text-green-700' :
                        lanc.status === 'creditado' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>
                        {lanc.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}