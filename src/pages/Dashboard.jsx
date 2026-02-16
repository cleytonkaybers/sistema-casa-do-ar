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
  Filter
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-created_date'),
  });

  // Estatísticas
  const totalClientes = clientes.length;
  const clientesAtivos = clientes.filter(c => c.status === 'Ativo').length;
  
  const manutencoesPendentes = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const daysUntil = differenceInDays(new Date(c.proxima_manutencao), new Date());
    return daysUntil <= 30;
  });

  // Manutenções vencidas (180 dias ou mais vencidas)
  const manutencoesVencidas = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const daysUntil = differenceInDays(new Date(c.proxima_manutencao), new Date());
    return daysUntil < 0;
  }).sort((a, b) => {
    const daysA = differenceInDays(new Date(a.proxima_manutencao), new Date());
    const daysB = differenceInDays(new Date(b.proxima_manutencao), new Date());
    return daysA - daysB; // Mais atrasadas primeiro
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

  const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, href }) => {
    const content = (
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <p className="text-3xl font-bold mt-2 text-white">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shadow-xl`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        {(onClick || href) && (
          <div className="mt-4 pt-4 border-t border-purple-700/30">
            <div className="flex items-center text-sm font-medium text-cyan-400 group-hover:text-cyan-300">
              Ver detalhes <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </div>
        )}
      </CardContent>
    );

    if (href) {
      return (
        <Link to={href}>
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer hover:scale-105 group">
            {content}
          </Card>
        </Link>
      );
    }

    return (
      <Card 
        className={`bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-105 group' : ''}`}
        onClick={onClick}
      >
        {content}
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-purple-300/70 mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Visão geral - {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Link to={createPageUrl('Servicos')}>
             <Button className="bg-gradient-to-r from-pink-500 via-purple-500 to-violet-600 hover:from-pink-600 hover:via-purple-600 hover:to-violet-700 shadow-xl shadow-purple-500/50">
               <Plus className="w-4 h-4 mr-2" />
               Novo Serviço
             </Button>
           </Link>
           <Link to={createPageUrl('Clientes')}>
             <Button className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 shadow-xl shadow-blue-500/50">
               <Users className="w-4 h-4 mr-2" />
               Ver Clientes
             </Button>
           </Link>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total de Clientes"
          value={totalClientes}
          icon={Users}
          color="bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600"
          subtitle={`${clientesAtivos} ativos`}
          href={createPageUrl('Clientes')}
        />
        <StatCard
          title="Atendimentos do Mês"
          value={atendimentosDoMes.length}
          icon={ClipboardList}
          color="bg-gradient-to-br from-blue-500 to-cyan-500"
          subtitle={format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          href={createPageUrl('Atendimentos')}
        />
        <StatCard
          title="Manutenções Pendentes"
          value={manutencoesPendentes.length}
          icon={AlertTriangle}
          color={manutencoesPendentes.length > 0 ? "bg-gradient-to-br from-orange-500 to-red-500" : "bg-gradient-to-br from-emerald-500 to-teal-600"}
          subtitle="Próximos 30 dias"
          href={createPageUrl('PreventivasFuturas')}
        />
        <StatCard
          title="Serviços Concluídos"
          value={atendimentosConcluidos}
          icon={CheckCircle2}
          color="bg-gradient-to-br from-emerald-500 to-teal-600"
          subtitle="Total histórico"
          href={createPageUrl('Atendimentos')}
        />
      </div>

      {/* Filtro de Serviços */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/30 rounded-xl flex items-center justify-center">
                <Filter className="w-5 h-5 text-purple-400" />
              </div>
              <CardTitle className="text-lg font-semibold text-white">
                Serviços Realizados
              </CardTitle>
            </div>
            <Select value={filtroServicos} onValueChange={setFiltroServicos}>
              <SelectTrigger className="w-full sm:w-48 bg-purple-900/40 border-purple-700/50 text-white">
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
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-purple-900/40 border border-purple-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm text-gray-400">Concluídos</span>
              </div>
              <p className="text-2xl font-bold text-white">{servicosConcluidos}</p>
            </div>
            <div className="bg-purple-900/40 border border-purple-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm text-gray-400">Em Andamento</span>
              </div>
              <p className="text-2xl font-bold text-white">{servicosAndamento}</p>
            </div>
            <div className="bg-purple-900/40 border border-purple-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-sm text-gray-400">Agendados</span>
              </div>
              <p className="text-2xl font-bold text-white">{servicosAgendados}</p>
            </div>
            <div className="bg-purple-900/40 border border-purple-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gray-500/20 rounded-lg flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-sm text-gray-400">Abertos</span>
              </div>
              <p className="text-2xl font-bold text-white">{servicosAbertos}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-purple-700/30">
            <p className="text-sm text-gray-400 text-center">
              Total de <span className="text-white font-semibold">{servicosFiltrados.length}</span> serviços no período selecionado
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manutenções Vencidas - Alerta Destaque */}
      {manutencoesVencidas.length > 0 && (
        <Card className="bg-gradient-to-r from-red-600 via-orange-500 to-red-600 border-0 shadow-2xl shadow-red-500/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">
                    Manutenções Vencidas
                  </CardTitle>
                  <p className="text-white/90 text-sm mt-1">
                    {manutencoesVencidas.length} {manutencoesVencidas.length === 1 ? 'cliente precisa' : 'clientes precisam'} de atenção urgente
                  </p>
                </div>
              </div>
              <Link to={createPageUrl('PreventivasFuturas')}>
                <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white">
                  Ver todas <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {manutencoesVencidas.slice(0, 5).map((cliente) => {
                const daysOverdue = Math.abs(differenceInDays(new Date(cliente.proxima_manutencao), new Date()));

                return (
                  <Link 
                    key={cliente.id} 
                    to={createPageUrl('PreventivasFuturas')}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-lg bg-white/95 hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Snowflake className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 group-hover:text-red-600 transition-colors">{cliente.nome}</p>
                          <p className="text-sm text-gray-600">
                            {cliente.telefone && formatPhone(cliente.telefone)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-red-600">
                          {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} atrasado
                        </p>
                        <p className="text-xs text-gray-500">
                          Desde {format(new Date(cliente.proxima_manutencao), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manutenções Pendentes */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-white">
              Manutenções Pendentes
            </CardTitle>
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </CardHeader>
          <CardContent>
            {manutencoesPendentes.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-500">Nenhuma manutenção pendente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {manutencoesPendentes.slice(0, 5).map((cliente) => {
                  const daysUntil = differenceInDays(new Date(cliente.proxima_manutencao), new Date());
                  const isOverdue = daysUntil < 0;
                  
                  return (
                    <Link 
                      key={cliente.id}
                      to={createPageUrl('PreventivasFuturas')}
                      className="block"
                    >
                      <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:shadow-md transition-all group ${
                        isOverdue ? 'bg-red-50 border border-red-100 hover:bg-red-100' : 'bg-amber-50 border border-amber-100 hover:bg-amber-100'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                            isOverdue ? 'bg-red-100' : 'bg-amber-100'
                          }`}>
                            <Snowflake className={`w-5 h-5 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-black">{cliente.nome}</p>
                            <p className="text-xs text-gray-600">{cliente.tipo_equipamento || 'Não especificado'}</p>
                          </div>
                        </div>
                        <div className={`text-right ${isOverdue ? 'text-red-400' : 'text-orange-400'}`}>
                          <p className="text-sm font-medium">
                            {isOverdue ? `${Math.abs(daysUntil)} dias atrasado` : `em ${daysUntil} dias`}
                          </p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(cliente.proxima_manutencao), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos Clientes */}
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-700/30 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-white">
              Últimos Clientes
            </CardTitle>
            <Link to={createPageUrl('Clientes')}>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                Ver todos <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {clientes.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500">Nenhum cliente cadastrado</p>
                <Link to={createPageUrl('Clientes')}>
                  <Button variant="outline" className="mt-4">
                    Cadastrar primeiro cliente
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {clientes.slice(0, 5).map((cliente) => (
                  <Link 
                    key={cliente.id}
                    to={createPageUrl('Clientes')}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-900/40 hover:bg-purple-800/50 hover:shadow-md hover:shadow-purple-500/20 transition-all cursor-pointer group border border-purple-700/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold group-hover:scale-110 transition-transform shadow-md">
                          {cliente.nome?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white group-hover:text-cyan-400 transition-colors">{cliente.nome}</p>
                          <p className="text-xs text-gray-400">{cliente.cidade || 'Sem cidade'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {format(new Date(cliente.created_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
          </Card>
          </div>
          </div>
          );
          }