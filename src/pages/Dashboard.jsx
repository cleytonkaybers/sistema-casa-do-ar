import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Users, 
  ClipboardList, 
  Calendar,
  AlertTriangle,
  ArrowRight,
  Snowflake,
  Clock,
  CheckCircle2,
  Plus,
  Filter,
  DollarSign,
  TrendingUp,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, isToday, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

export default function Dashboard() {
  const [filtroServicos, setFiltroServicos] = useState('mes');
  
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date'),
  });

  const { data: atendimentos = [] } = useQuery({
    queryKey: ['atendimentos'],
    queryFn: () => base44.entities.Atendimento.list('-created_date'),
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-created_date'),
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: ganhos = [] } = useQuery({
    queryKey: ['ganhos-tecnicos'],
    queryFn: () => base44.entities.GanhoTecnico.list(),
    enabled: !!currentUser,
  });

  // Filtrar ganhos apenas do usuário atual
  const meuEmail = currentUser?.email;
  const meusGanhos = ganhos.filter(g => g.tecnico_email === meuEmail);

  // Estatísticas
  const totalClientes = clientes.length;
  const clientesAtivos = clientes.filter(c => c.status === 'Ativo').length;
  
  // Manutenções atrasadas e do dia
  const hojePuro = new Date();
  hojePuro.setHours(0, 0, 0, 0);
  
  const manutencoesAtrasadas = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const proximaData = new Date(c.proxima_manutencao);
    proximaData.setHours(0, 0, 0, 0);
    return proximaData < hojePuro;
  });

  const manutencoesDoDia = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const proximaData = new Date(c.proxima_manutencao);
    proximaData.setHours(0, 0, 0, 0);
    return proximaData.getTime() === hojePuro.getTime();
  });

  const manutencoesPendentes = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const daysUntil = differenceInDays(new Date(c.proxima_manutencao), new Date());
    return daysUntil <= 30;
  });

  const manutencoesVencidas = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const daysUntil = differenceInDays(new Date(c.proxima_manutencao), new Date());
    return daysUntil < 0;
  }).sort((a, b) => {
    const daysA = differenceInDays(new Date(a.proxima_manutencao), new Date());
    const daysB = differenceInDays(new Date(b.proxima_manutencao), new Date());
    return daysA - daysB;
  });

  // Filtrar serviços por período
  const servicosFiltrados = servicos.filter(s => {
    if (!s.data_programada) return false;
    const dataServico = new Date(s.data_programada);
    const hoje = new Date();
    
    switch(filtroServicos) {
      case 'dia':
        return isToday(dataServico);
      case 'semana':
        return isWithinInterval(dataServico, {
          start: startOfWeek(hoje, { locale: ptBR }),
          end: endOfWeek(hoje, { locale: ptBR })
        });
      case 'mes':
        return isWithinInterval(dataServico, {
          start: startOfMonth(hoje),
          end: endOfMonth(hoje)
        });
      default:
        return false;
    }
  });

  const servicosConcluidos = servicosFiltrados.filter(s => s.status === 'concluido').length;
  const servicosAbertos = servicosFiltrados.filter(s => s.status === 'aberto').length;
  const servicosAndamento = servicosFiltrados.filter(s => s.status === 'andamento').length;
  const servicosAgendados = servicosFiltrados.filter(s => s.status === 'agendado' || s.status === 'reagendado').length;

  const atendimentosDoMes = atendimentos.filter(a => {
    const dataAtendimento = new Date(a.data_atendimento);
    return isWithinInterval(dataAtendimento, {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date())
    });
  });

  const atendimentosConcluidos = atendimentos.filter(a => a.status === 'Concluído').length;

  // Buscar equipe do usuário atual (prioriza equipe_id direto do auth.me)
  const equipeDoUsuario = currentUser?.equipe_id || usuarios.find(u => u.email === currentUser?.email)?.equipe_id;

  // Calcular ganhos da equipe do técnico (semana atual)
  const hoje = new Date();
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 });
  const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 });
  
  const ganhosEquipeSemana = meusGanhos.filter(g => {
    const dataGanho = new Date(g.data_conclusao);
    const naSemanaAtual = isWithinInterval(dataGanho, { start: inicioSemana, end: fimSemana });
    return naSemanaAtual;
  });

  const totalGanhosEquipe = ganhosEquipeSemana.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  const ganhosEquipePagos = ganhosEquipeSemana.filter(g => g.pago).reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
  const ganhosEquipePendentes = totalGanhosEquipe - ganhosEquipePagos;

  // Calcular ganhos semanais das últimas 4 semanas por equipe
  const dadosGraficoPorSemana = React.useMemo(() => {
    const semanas = [];
    
    for (let i = 3; i >= 0; i--) {
      const inicioSemanaAtual = startOfWeek(subWeeks(hoje, i), { weekStartsOn: 1 });
      const fimSemanaAtual = endOfWeek(subWeeks(hoje, i), { weekStartsOn: 1 });
      
      const semanaData = {
        semana: i === 0 ? 'Atual' : `S-${i}`,
        dataCompleta: format(inicioSemanaAtual, 'dd/MM', { locale: ptBR })
      };

      equipes.forEach(equipe => {
        const ganhosEquipeSemana = ganhos.filter(g => {
          const dataGanho = new Date(g.data_conclusao);
          const pertenceEquipe = g.equipe_id === equipe.id;
          const naSemana = isWithinInterval(dataGanho, { start: inicioSemanaAtual, end: fimSemanaAtual });
          return pertenceEquipe && naSemana;
        });

        const totalSemana = ganhosEquipeSemana.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
        semanaData[equipe.nome] = totalSemana;
      });

      semanas.push(semanaData);
    }

    return semanas;
  }, [ganhos, equipes]);

  // Serviços de hoje por equipe
  const servicosHoje = servicos.filter(s => {
    if (!s.data_programada) return false;
    if (s.status === 'concluido') return false;
    return isToday(new Date(s.data_programada));
  });

  // Serviços atrasados (data programada passou e não foi concluído)
  const servicosAtrasados = servicos.filter(s => {
    if (!s.data_programada || s.status === 'concluido') return false;
    const dataServico = new Date(s.data_programada);
    dataServico.setHours(0, 0, 0, 0);
    return dataServico < hojePuro;
  });

  // Filtrar apenas serviços da equipe do usuário (se não for admin)
  const servicosFiltradosPorEquipe = currentUser?.role === 'admin' 
    ? servicosHoje 
    : servicosHoje.filter(s => s.equipe_id === equipeDoUsuario);

  const servicosAtrasadosFiltrados = currentUser?.role === 'admin'
    ? servicosAtrasados
    : servicosAtrasados.filter(s => s.equipe_id === equipeDoUsuario);

  const servicosPorEquipe = equipes
    .map(equipe => ({
      equipe,
      servicos: servicosFiltradosPorEquipe.filter(s => s.equipe_id === equipe.id)
    }))
    .filter(e => e.servicos.length > 0);

  const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, href }) => {
    const content = (
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-3xl sm:text-4xl font-bold text-gray-800">{value}</p>
          <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-lg ${color}`}>
            <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
        </div>
      </CardContent>
    );

    if (href) {
      return (
        <Link to={href}>
          <Card className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02] group rounded-2xl">
            {content}
          </Card>
        </Link>
      );
    }

    return (
      <Card
        className={`bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl ${onClick ? 'cursor-pointer hover:scale-[1.02] group' : ''}`}
        onClick={onClick}
      >
        {content}
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ backgroundColor: '#1e3a8a' }}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-blue-200/80 mt-1 flex items-center gap-2 text-xs sm:text-sm">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Link to={createPageUrl('Servicos')}>
          <Button className="text-sm px-5 h-10 font-bold rounded-xl" style={{ backgroundColor: '#f59e0b', color: '#1e1e1e' }}>
            <Plus className="w-4 h-4 mr-1" />
            + Novo Serviço
          </Button>
        </Link>
      </div>



      {/* Card Ganhos Pessoais - Destacado para Técnicos */}
      {currentUser?.role !== 'admin' && (
        <Link to={createPageUrl('MeusGanhos')}>
          <Card className="overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
            style={{background: 'linear-gradient(135deg, #10b981, #059669, #047857)'}}>
            <CardContent className="p-6 relative">
              {/* Efeito de brilho */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles className="w-7 h-7 text-yellow-300" />
                    </div>
                    <div>
                      <p className="text-white/90 text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Meus Ganhos
                      </p>
                      <p className="text-white/70 text-xs mt-0.5">Semana Atual (Seg-Dom)</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/60 group-hover:translate-x-1 transition-transform" />
                </div>

                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <div className="flex items-baseline gap-2 mb-3">
                    <DollarSign className="w-8 h-8 text-yellow-300" />
                    <p className="text-5xl font-black text-white tracking-tight">
                      {totalGanhosEquipe.toFixed(2).replace('.', ',')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/10 rounded-xl p-3 border border-white/20">
                      <p className="text-white/70 text-xs mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Recebido
                      </p>
                      <p className="text-white font-bold text-lg">R$ {ganhosEquipePagos.toFixed(2)}</p>
                    </div>
                    <div className="bg-yellow-400/20 rounded-xl p-3 border border-yellow-300/30">
                      <p className="text-yellow-100 text-xs mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        A Receber
                      </p>
                      <p className="text-yellow-50 font-bold text-lg">R$ {ganhosEquipePendentes.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <p className="text-white/80 text-xs text-center mt-4 font-medium">
                  🎉 Continue assim! Cada serviço conta!
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Clientes"
          value={totalClientes}
          icon={Users}
          color="bg-blue-500"
          href={createPageUrl('Clientes')}
        />
        <StatCard
          title="Atendimentos"
          value={atendimentosDoMes.length}
          icon={ClipboardList}
          color="bg-amber-400"
          href={createPageUrl('Atendimentos')}
        />
        <StatCard
          title="Pendentes"
          value={manutencoesPendentes.length}
          icon={AlertTriangle}
          color="bg-emerald-500"
          href={createPageUrl('PreventivasFuturas')}
        />
        <StatCard
          title="Concluídos"
          value={atendimentosConcluidos}
          icon={CheckCircle2}
          color="bg-emerald-500"
          href={createPageUrl('Atendimentos')}
        />
      </div>

      {/* Ganhos por Equipe para Admin - Versão Compacta */}
      {currentUser?.role === 'admin' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            Ganhos por Equipe - Semana Atual
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipes.map(equipe => {
              const ganhosEquipe = ganhos.filter(g => {
                const pertenceEquipe = g.equipe_id === equipe.id;
                const dataGanho = new Date(g.data_conclusao);
                const naSemanaAtual = isWithinInterval(dataGanho, { start: inicioSemana, end: fimSemana });
                return pertenceEquipe && naSemanaAtual;
              });

              const totalEquipe = ganhosEquipe.reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
              const pagosEquipe = ganhosEquipe.filter(g => g.pago).reduce((sum, g) => sum + (g.valor_comissao || 0), 0);
              const pendentesEquipe = totalEquipe - pagosEquipe;

              return (
                <Card key={equipe.id} className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="h-2 w-full" style={{ backgroundColor: equipe.cor || '#3b82f6' }} />
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow" style={{ backgroundColor: equipe.cor || '#3b82f6' }}>
                        {equipe.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{equipe.nome}</p>
                        <p className="text-xs text-gray-500">{ganhosEquipe.length} serviço{ganhosEquipe.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
                        <p className="text-xs font-medium text-green-700 mb-1">Total Semana</p>
                        <p className="text-2xl font-bold text-green-600">R$ {totalEquipe.toFixed(2)}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-50 rounded-lg p-2 text-center border border-green-100">
                          <p className="text-xs text-green-700 mb-0.5">Pago</p>
                          <p className="font-bold text-green-700 text-sm">R$ {pagosEquipe.toFixed(2)}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-100">
                          <p className="text-xs text-amber-700 mb-0.5">Pendente</p>
                          <p className="font-bold text-amber-700 text-sm">R$ {pendentesEquipe.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Gráfico de Ganhos Semanais - Últimas 4 Semanas */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
            <CardHeader className="pb-3 px-4 pt-4">
              <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Evolução Semanal por Equipe
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">Ganhos das últimas 4 semanas</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosGraficoPorSemana}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="semana" 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value) => [`R$ ${value.toFixed(2)}`, '']}
                    labelFormatter={(label, payload) => {
                      if (payload && payload.length > 0) {
                        return `${label} (${payload[0].payload.dataCompleta})`;
                      }
                      return label;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  {equipes.map((equipe, index) => (
                    <Bar 
                      key={equipe.id}
                      dataKey={equipe.nome} 
                      fill={equipe.cor || (index === 0 ? '#10b981' : '#3b82f6')}
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Grid - Manutenções e Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Manutenções e Serviços Pendentes */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
              Pendências
            </CardTitle>
            <div className="flex gap-1 flex-wrap justify-end">
              {servicosAtrasadosFiltrados.length > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                  {servicosAtrasadosFiltrados.length} serv. atrasados
                </span>
              )}
              {servicosFiltradosPorEquipe.length > 0 && (
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  {servicosFiltradosPorEquipe.length} hoje
                </span>
              )}
              {manutencoesAtrasadas.length > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                  {manutencoesAtrasadas.length} manut.
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Serviços Atrasados */}
              {servicosAtrasadosFiltrados.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Serviços Atrasados
                  </h4>
                  <div className="space-y-1">
                    {servicosAtrasadosFiltrados.slice(0, 3).map(servico => (
                      <Link key={servico.id} to={createPageUrl('Servicos')}>
                        <div className="p-2 rounded-lg border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 truncate">{servico.cliente_nome}</p>
                              <p className="text-xs text-gray-600 truncate">{servico.tipo_servico}</p>
                            </div>
                            <p className="text-xs text-red-600 font-medium whitespace-nowrap">
                              {Math.abs(differenceInDays(new Date(servico.data_programada), new Date()))}d atraso
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {servicosAtrasadosFiltrados.length > 3 && (
                      <Link to={createPageUrl('Servicos')}>
                        <p className="text-xs text-blue-600 hover:text-blue-700 text-center py-1">
                          +{servicosAtrasadosFiltrados.length - 3} mais
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Serviços de Hoje */}
              {servicosFiltradosPorEquipe.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Serviços Hoje
                  </h4>
                  <div className="space-y-1">
                    {servicosFiltradosPorEquipe.slice(0, 3).map(servico => {
                      const statusColors = {
                        'aberto': 'bg-gray-50 border-gray-200',
                        'andamento': 'bg-blue-50 border-blue-200',
                        'agendado': 'bg-amber-50 border-amber-200',
                        'reagendado': 'bg-purple-50 border-purple-200'
                      };
                      const statusClass = statusColors[servico.status] || statusColors.aberto;
                      
                      return (
                        <Link key={servico.id} to={createPageUrl('Servicos')}>
                          <div className={`p-2 rounded-lg border ${statusClass} hover:shadow-sm transition-all`}>
                            <p className="font-medium text-sm text-gray-800 truncate">{servico.cliente_nome}</p>
                            <p className="text-xs text-gray-600 truncate">{servico.tipo_servico}</p>
                            {servico.horario && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {servico.horario}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                    {servicosFiltradosPorEquipe.length > 3 && (
                      <Link to={createPageUrl('Servicos')}>
                        <p className="text-xs text-blue-600 hover:text-blue-700 text-center py-1">
                          +{servicosFiltradosPorEquipe.length - 3} mais
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Manutenções Atrasadas */}
              {manutencoesAtrasadas.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-orange-700 mb-2">⚠️ Manutenções Atrasadas</h4>
                  <div className="space-y-1">
                    {manutencoesAtrasadas.slice(0, 3).map(c => (
                      <Link key={c.id} to={createPageUrl('PreventivasFuturas')} className="block">
                        <div className="p-2 bg-orange-50 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors">
                          <p className="font-medium text-gray-800 text-sm">{c.nome}</p>
                          <p className="text-xs text-orange-600">{Math.abs(differenceInDays(new Date(c.proxima_manutencao), new Date()))}d atrasado</p>
                        </div>
                      </Link>
                    ))}
                    {manutencoesAtrasadas.length > 3 && (
                      <Link to={createPageUrl('PreventivasFuturas')}>
                        <p className="text-xs text-blue-600 hover:text-blue-700 text-center py-1">
                          +{manutencoesAtrasadas.length - 3} mais
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Manutenções do Dia */}
              {manutencoesDoDia.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-700 mb-2">📅 Manutenções Hoje</h4>
                  <div className="space-y-1">
                    {manutencoesDoDia.slice(0, 3).map(c => (
                      <Link key={c.id} to={createPageUrl('PreventivasFuturas')} className="block">
                        <div className="p-2 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
                          <p className="font-medium text-gray-800 text-sm">{c.nome}</p>
                          <p className="text-xs text-green-600">Vence hoje</p>
                        </div>
                      </Link>
                    ))}
                    {manutencoesDoDia.length > 3 && (
                      <Link to={createPageUrl('PreventivasFuturas')}>
                        <p className="text-xs text-blue-600 hover:text-blue-700 text-center py-1">
                          +{manutencoesDoDia.length - 3} mais
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Vazio */}
              {servicosAtrasadosFiltrados.length === 0 && 
               servicosFiltradosPorEquipe.length === 0 && 
               manutencoesAtrasadas.length === 0 && 
               manutencoesDoDia.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-gray-400 text-sm">Nenhuma pendência no momento</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Próximas Manutenções */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
              Próximas Manutenções
            </CardTitle>
            <Link to={createPageUrl('PreventivasFuturas')}>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm">
                Ver todas <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {(() => {
              const proximasManutencoes = clientes
                .filter(c => c.proxima_manutencao)
                .map(c => ({
                  ...c,
                  diasRestantes: differenceInDays(new Date(c.proxima_manutencao), new Date())
                }))
                .filter(c => c.diasRestantes >= 0)
                .sort((a, b) => a.diasRestantes - b.diasRestantes)
                .slice(0, 5);

              if (proximasManutencoes.length === 0) {
                return (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    </div>
                    <p className="text-gray-400 text-sm">Nenhuma manutenção programada</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {proximasManutencoes.map((cliente) => (
                    <Link key={cliente.id} to={createPageUrl('PreventivasFuturas')} className="block">
                      <div className="flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group border border-gray-100 hover:border-green-200 hover:bg-green-50">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-100">
                            <Snowflake className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm group-hover:text-green-600 transition-colors">{cliente.nome}</p>
                            <p className="text-xs text-gray-400">{format(new Date(cliente.proxima_manutencao), "dd/MM/yy")}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-semibold ${
                            cliente.diasRestantes <= 7 ? 'text-orange-600' : 
                            cliente.diasRestantes <= 15 ? 'text-amber-600' : 
                            'text-green-600'
                          }`}>
                            {cliente.diasRestantes === 0 ? 'Hoje' : `${cliente.diasRestantes}d`}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Filtro de Serviços */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardHeader className="pb-3 px-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-100">
                <Filter className="w-4 h-4 text-blue-600" />
              </div>
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
                Serviços
              </CardTitle>
            </div>
            <Select value={filtroServicos} onValueChange={setFiltroServicos}>
              <SelectTrigger className="w-full sm:w-44 border-gray-200 text-gray-700 text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Hoje</SelectItem>
                <SelectItem value="semana">Esta Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 border border-gray-100 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Concluídos</span>
              </div>
              <p className="text-xl font-bold text-green-700">{servicosConcluidos}</p>
            </div>
            <div className="rounded-xl p-3 border border-gray-100 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Andamento</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{servicosAndamento}</p>
            </div>
            <div className="rounded-xl p-3 border border-gray-100 bg-amber-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Agendados</span>
              </div>
              <p className="text-xl font-bold text-amber-700">{servicosAgendados}</p>
            </div>
            <div className="rounded-xl p-3 border border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Abertos</span>
              </div>
              <p className="text-xl font-bold text-gray-700">{servicosAbertos}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Total de <span className="text-gray-700 font-semibold">{servicosFiltrados.length}</span> serviços no período selecionado
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manutenções Vencidas - Alerta Destaque */}
      {manutencoesVencidas.length > 0 && (
        <Card className="border-0 shadow-2xl shadow-red-500/30" style={{background: 'linear-gradient(135deg, #dc2626, #ea580c)'}}>
          <CardHeader className="pb-2 px-4 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-xl font-bold text-white">
                    Manutenções Vencidas
                  </CardTitle>
                  <p className="text-white/90 text-xs sm:text-sm">
                    {manutencoesVencidas.length} {manutencoesVencidas.length === 1 ? 'cliente precisa' : 'clientes precisam'} de atenção
                  </p>
                </div>
              </div>
              <Link to={createPageUrl('PreventivasFuturas')}>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white text-xs sm:text-sm">
                  Ver <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {manutencoesVencidas.slice(0, 5).map((cliente) => {
                const daysOverdue = Math.abs(differenceInDays(new Date(cliente.proxima_manutencao), new Date()));
                return (
                  <Link key={cliente.id} to={createPageUrl('PreventivasFuturas')} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/95 hover:bg-white transition-all cursor-pointer">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-9 h-9 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
                          <Snowflake className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm sm:text-base">{cliente.nome}</p>
                          <p className="text-xs text-gray-600">{cliente.telefone && formatPhone(cliente.telefone)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{daysOverdue}d atrasado</p>
                        <p className="text-xs text-gray-500">{format(new Date(cliente.proxima_manutencao), "dd/MM/yy")}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}


    </div>
  );
}