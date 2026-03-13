import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Calendar, CheckCircle, Clock, Award } from 'lucide-react';
import { format, startOfWeek, endOfWeek, parseISO, getWeek, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MeusGanhos() {
  const [user, setUser] = useState(null);
  const [filtroSemana, setFiltroSemana] = useState('atual');

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: ganhos = [], isLoading } = useQuery({
    queryKey: ['ganhos-tecnicos'],
    queryFn: () => base44.entities.GanhoTecnico.list(),
    enabled: !!user,
  });

  const meuEmail = user?.email;

  // Filtrar ganhos do técnico logado
  const meusGanhos = useMemo(() => {
    if (!meuEmail) return [];
    return ganhos.filter(g => g.tecnico_email === meuEmail);
  }, [ganhos, meuEmail]);

  // Calcular semana atual
  const hoje = new Date();
  const semanaAtual = `${getYear(hoje)}-W${String(getWeek(hoje, { locale: ptBR })).padStart(2, '0')}`;

  // Filtrar por semana
  const ganhosFiltrados = useMemo(() => {
    if (filtroSemana === 'todos') return meusGanhos;
    if (filtroSemana === 'atual') {
      return meusGanhos.filter(g => g.semana === semanaAtual);
    }
    return meusGanhos.filter(g => g.semana === filtroSemana);
  }, [meusGanhos, filtroSemana, semanaAtual]);

  // Obter semanas únicas
  const semanasUnicas = useMemo(() => {
    const semanas = [...new Set(meusGanhos.map(g => g.semana))].filter(Boolean);
    return semanas.sort().reverse();
  }, [meusGanhos]);

  // Calcular totais
  const totalGanhos = ganhosFiltrados.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  const totalPago = ganhosFiltrados.filter(g => g.pago).reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  const totalPendente = ganhosFiltrados.filter(g => !g.pago).reduce((sum, g) => sum + (g.valor_comissao || 0), 0);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meus Ganhos</h1>
          <p className="text-gray-600 mt-1">Acompanhe suas comissões semanais</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <Select value={filtroSemana} onValueChange={setFiltroSemana}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="atual">Semana Atual</SelectItem>
              <SelectItem value="todos">Todas as Semanas</SelectItem>
              {semanasUnicas.map(sem => (
                <SelectItem key={sem} value={sem}>
                  Semana {sem}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Total de Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700">
              R$ {totalGanhos.toFixed(2)}
            </p>
            <p className="text-xs text-green-600 mt-1">{ganhosFiltrados.length} serviços</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Já Recebido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700">
              R$ {totalPago.toFixed(2)}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {ganhosFiltrados.filter(g => g.pago).length} pagamentos
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              A Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700">
              R$ {totalPendente.toFixed(2)}
            </p>
            <p className="text-xs text-orange-600 mt-1">
              {ganhosFiltrados.filter(g => !g.pago).length} pendentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de serviços */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Detalhamento dos Serviços
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ganhosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum ganho registrado neste período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ganhosFiltrados
                .sort((a, b) => new Date(b.data_conclusao) - new Date(a.data_conclusao))
                .map((ganho) => (
                  <div
                    key={ganho.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      ganho.pago
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{ganho.cliente_nome}</p>
                        <p className="text-sm text-gray-600 mt-1">{ganho.tipo_servico}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(parseISO(ganho.data_conclusao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Valor do Serviço</p>
                        <p className="text-sm font-medium text-gray-700">
                          R$ {(ganho.valor_servico || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Comissão: {ganho.comissao_percentual || 0}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Seu Ganho</p>
                        <p className="text-2xl font-bold text-green-600">
                          R$ {(ganho.valor_comissao || 0).toFixed(2)}
                        </p>
                        {ganho.pago ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full mt-1">
                            <CheckCircle className="w-3 h-3" />
                            Pago
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full mt-1">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}