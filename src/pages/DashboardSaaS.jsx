import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Users, FileText, Clock, AlertCircle, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { useSaaSAuth } from '@/components/saas/SaaSAuthGuard';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatTipoServicoCompact } from '@/utils';

export default function DashboardSaaS() {
  const { user, empresa, loading } = useSaaSAuth();
  const [daysLeft, setDaysLeft] = useState(0);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-saas', empresa?.company_id],
    queryFn: () => base44.entities.ClienteSaaS.filter({ company_id: empresa?.company_id }) || [],
    enabled: !!empresa?.company_id
  });

  const { data: ordensServico = [] } = useQuery({
    queryKey: ['ordens-saas', empresa?.company_id],
    queryFn: () => base44.entities.OrdemServicoSaaS.filter({ company_id: empresa?.company_id }) || [],
    enabled: !!empresa?.company_id
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-empresa', empresa?.company_id],
    queryFn: () => base44.entities.UsuarioEmpresa.filter({ company_id: empresa?.company_id }) || [],
    enabled: !!empresa?.company_id
  });

  useEffect(() => {
    if (empresa?.status_assinatura === 'trial') {
      const now = new Date();
      const fim = new Date(empresa.data_fim_trial);
      const days = Math.ceil((fim - now) / (1000 * 60 * 60 * 24));
      setDaysLeft(Math.max(0, days));
    }
  }, [empresa]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const ordensAberta = ordensServico.filter(o => o.status === 'pendente').length;
  const ordensAndamento = ordensServico.filter(o => o.status === 'andamento').length;
  const totalFaturamento = ordensServico
    .filter(o => o.status === 'concluida')
    .reduce((sum, o) => sum + (o.valor_servico || 0), 0);

  const manutencoesProgramadas = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const data = new Date(c.proxima_manutencao);
    const agora = new Date();
    return data > agora;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Bem-vindo, {user?.full_name}</p>
      </div>

      {/* Status Trial */}
      {empresa?.status_assinatura === 'trial' && daysLeft > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">Período de Teste</p>
                <p className="text-sm text-blue-700">{daysLeft} dias restantes - Escolha um plano para continuar</p>
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Escolher Plano
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{clientes.length}</p>
            <p className="text-xs text-gray-500 mt-1">Clientes cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Ordens Pendentes</CardTitle>
            <FileText className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{ordensAberta}</p>
            <p className="text-xs text-gray-500 mt-1">Aguardando confirmação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{ordensAndamento}</p>
            <p className="text-xs text-gray-500 mt-1">Serviços em progresso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">R$ {totalFaturamento.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-gray-500 mt-1">Serviços concluídos</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Ações Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Manutenções Programadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Manutenções Próximas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{manutencoesProgramadas}</p>
            <p className="text-sm text-gray-600 mt-2">Equipamentos que precisam de manutenção</p>
            <Button variant="outline" className="w-full mt-4">
              Ver Agenda
            </Button>
          </CardContent>
        </Card>

        {/* Equipe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Sua Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">{usuarios.length}</p>
            <p className="text-sm text-gray-600 mt-2">Usuários na empresa</p>
            <Button variant="outline" className="w-full mt-4">
              Gerenciar Equipe
            </Button>
          </CardContent>
        </Card>

        {/* Info Plano */}
        <Card className="bg-gradient-to-br from-slate-50 to-gray-50">
          <CardHeader>
            <CardTitle className="text-lg">Seu Plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Plano Atual</p>
              <p className="text-2xl font-bold capitalize text-blue-600">{empresa?.plano || 'Carregando...'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-sm font-semibold">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                  empresa?.status_assinatura === 'trial' ? 'bg-blue-100 text-blue-700' :
                  empresa?.status_assinatura === 'ativa' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {empresa?.status_assinatura?.toUpperCase()}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimas Ordens */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Ordens de Serviço</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ordensServico.slice(0, 5).map((ordem) => (
              <div key={ordem.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-semibold">{ordem.cliente_nome}</p>
                  <p className="text-sm text-gray-600">{formatTipoServicoCompact(ordem.tipo_servico)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">R$ {ordem.valor_servico?.toLocaleString('pt-BR') || '0'}</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    ordem.status === 'concluida' ? 'bg-green-100 text-green-700' :
                    ordem.status === 'andamento' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {ordem.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}