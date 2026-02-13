import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Users, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DateRangeSelector from '../components/reporting/DateRangeSelector';
import ServiceTrendsChart from '../components/reporting/ServiceTrendsChart';
import ClientDemographicsChart from '../components/reporting/ClientDemographicsChart';
import ExportButtons from '../components/reporting/ExportButtons';

export default function RelatóriosPage() {
  const today = new Date();
  const [startDate, setStartDate] = useState(startOfMonth(today));
  const [endDate, setEndDate] = useState(endOfMonth(today));
  const [filteredStartDate, setFilteredStartDate] = useState(startOfMonth(today));
  const [filteredEndDate, setFilteredEndDate] = useState(endOfMonth(today));

  // Buscar dados
  const { data: servicos = [], isLoading: servLoading } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-data_programada')
  });

  const { data: clientes = [], isLoading: clientLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date')
  });

  const { data: atendimentos = [], isLoading: atendLoading } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-data_atendimento')
  });

  const isLoading = servLoading || clientLoading || atendLoading;

  // Filtrar dados pelo período
  const filteredData = useMemo(() => {
    const servicosFiltrados = servicos.filter(s => {
      if (!s.data_programada) return false;
      const date = new Date(s.data_programada);
      return isWithinInterval(date, { start: filteredStartDate, end: filteredEndDate });
    });

    const atendimentosFiltrados = atendimentos.filter(a => {
      if (!a.data_atendimento) return false;
      const date = new Date(a.data_atendimento);
      return isWithinInterval(date, { start: filteredStartDate, end: filteredEndDate });
    });

    return { servicosFiltrados, atendimentosFiltrados };
  }, [servicos, atendimentos, filteredStartDate, filteredEndDate]);

  // Preparar dados para gráfico de tendências
  const trendsData = useMemo(() => {
    const days = eachDayOfInterval({ start: filteredStartDate, end: filteredEndDate });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const total = filteredData.servicosFiltrados.filter(
        s => format(new Date(s.data_programada), 'yyyy-MM-dd') === dayStr
      ).length;
      
      const concluidos = filteredData.atendimentosFiltrados.filter(
        a => format(new Date(a.data_atendimento), 'yyyy-MM-dd') === dayStr && a.status === 'Concluído'
      ).length;
      
      const pendentes = total - concluidos;

      return {
        date: format(day, 'dd/MM'),
        total,
        concluidos,
        pendentes
      };
    });
  }, [filteredData, filteredStartDate, filteredEndDate]);

  // Preparar dados para gráfico de clientes por tipo de serviço
  const demographicsData = useMemo(() => {
    const tiposMap = {};
    
    filteredData.servicosFiltrados.forEach(s => {
      const tipo = s.tipo_servico || 'Outros';
      tiposMap[tipo] = (tiposMap[tipo] || 0) + 1;
    });

    return Object.entries(tiposMap).map(([name, quantidade]) => ({
      name: name.length > 20 ? name.substring(0, 20) + '...' : name,
      quantidade
    }));
  }, [filteredData.servicosFiltrados]);

  // Calcular métricas
  const metrics = useMemo(() => {
    const totalServicos = filteredData.servicosFiltrados.length;
    const totalAtendimentos = filteredData.atendimentosFiltrados.length;
    const totalValor = filteredData.servicosFiltrados.reduce((sum, s) => sum + (s.valor || 0), 0);

    return { totalServicos, totalAtendimentos, totalValor };
  }, [filteredData]);

  const reportData = {
    services: filteredData.servicosFiltrados,
    clients: clientes,
    attendances: filteredData.atendimentosFiltrados
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          Relatórios
        </h1>
        <p className="text-gray-400 mt-1">Análise detalhada de serviços, clientes e performance</p>
      </div>

      {/* Date Range Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <DateRangeSelector
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
            onApply={() => {
              setFilteredStartDate(startDate);
              setFilteredEndDate(endDate);
            }}
          />
        </div>

        {/* Métricas */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total de Serviços</p>
                  <p className="text-3xl font-bold text-cyan-400">{metrics.totalServicos}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-cyan-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total de Atendimentos</p>
                  <p className="text-3xl font-bold text-green-400">{metrics.totalAtendimentos}</p>
                </div>
                <Users className="w-10 h-10 text-green-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Valor Total</p>
                  <p className="text-2xl font-bold text-purple-400">
                    R$ {metrics.totalValor.toLocaleString('pt-BR')}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-purple-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-col items-end gap-2">
          <ExportButtons
            reportData={reportData}
            dateRange={{
              start: format(filteredStartDate, 'dd/MM/yyyy'),
              end: format(filteredEndDate, 'dd/MM/yyyy')
            }}
          />
        </div>
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      ) : (
        <div id="report-container" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ServiceTrendsChart data={trendsData} />
            <ClientDemographicsChart data={demographicsData} />
          </div>

          {/* Tabela de Serviços */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30">
            <CardHeader>
              <CardTitle className="text-white">📋 Detalhes de Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-300">
                  <thead className="border-b border-purple-700/30 text-gray-400">
                    <tr>
                      <th className="text-left py-3 px-2">Cliente</th>
                      <th className="text-left py-3 px-2">Tipo</th>
                      <th className="text-left py-3 px-2">Data</th>
                      <th className="text-left py-3 px-2">Status</th>
                      <th className="text-left py-3 px-2">Usuário</th>
                      <th className="text-right py-3 px-2">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.servicosFiltrados.slice(0, 10).map(s => (
                      <tr key={s.id} className="border-b border-purple-700/10 hover:bg-purple-900/20">
                        <td className="py-2 px-2">{s.cliente_nome}</td>
                        <td className="py-2 px-2 text-xs text-purple-300">{s.tipo_servico?.substring(0, 15)}...</td>
                        <td className="py-2 px-2">{format(new Date(s.data_programada), 'dd/MM/yyyy')}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            s.status === 'concluido' ? 'bg-green-900/40 text-green-300' :
                            s.status === 'andamento' ? 'bg-blue-900/40 text-blue-300' :
                            'bg-yellow-900/40 text-yellow-300'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-400">{s.usuario_atualizacao_status || '-'}</td>
                        <td className="py-2 px-2 text-right font-semibold">R$ {s.valor?.toLocaleString('pt-BR') || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.servicosFiltrados.length === 0 && (
                  <p className="text-center py-6 text-gray-400">Nenhum serviço neste período</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}