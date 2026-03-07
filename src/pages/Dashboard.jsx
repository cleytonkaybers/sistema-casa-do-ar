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

  const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, href }) => {
    const content = (
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 text-gray-800">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-lg ${color}`}>
            <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
        </div>
        {(onClick || href) && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
            <div className="flex items-center text-xs sm:text-sm font-medium text-blue-600 group-hover:text-blue-700">
              Ver detalhes <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
            </div>
          </div>
        )}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total de Clientes"
          value={totalClientes}
          icon={Users}
          color="bg-blue-700"
          subtitle={`${clientesAtivos} ativos`}
          href={createPageUrl('Clientes')}
        />
        <StatCard
          title="Atendimentos do Mês"
          value={atendimentosDoMes.length}
          icon={ClipboardList}
          color="bg-yellow-500"
          subtitle={format(new Date(), "MMMM", { locale: ptBR })}
          href={createPageUrl('Atendimentos')}
        />
        <StatCard
          title="Manutenções Pendentes"
          value={manutencoesPendentes.length}
          icon={AlertTriangle}
          color={manutencoesPendentes.length > 0 ? "bg-orange-500" : "bg-emerald-600"}
          subtitle="Próximos 30 dias"
          href={createPageUrl('PreventivasFuturas')}
        />
        <StatCard
          title="Serviços Concluídos"
          value={atendimentosConcluidos}
          icon={CheckCircle2}
          color="bg-emerald-600"
          subtitle="Total histórico"
          href={createPageUrl('Atendimentos')}
        />
      </div>

      {/* Filtro de Serviços */}
      <Card className="border border-blue-800/40 shadow-xl" style={{backgroundColor: '#243447'}}>
        <CardHeader className="pb-3 px-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{backgroundColor: 'rgba(245,158,11,0.2)'}}>
                <Filter className="w-4 h-4 text-yellow-400" />
              </div>
              <CardTitle className="text-base sm:text-lg font-semibold text-white">
                Serviços Realizados
              </CardTitle>
            </div>
            <Select value={filtroServicos} onValueChange={setFiltroServicos}>
              <SelectTrigger className="w-full sm:w-40 border-blue-800/50 text-white text-sm" style={{backgroundColor: 'rgba(30,64,175,0.2)'}}>
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
            <div className="border border-blue-800/40 rounded-xl p-3" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs text-blue-300/70">Concluídos</span>
              </div>
              <p className="text-xl font-bold text-white">{servicosConcluidos}</p>
            </div>
            <div className="border border-blue-800/40 rounded-xl p-3" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-blue-300/70">Andamento</span>
              </div>
              <p className="text-xl font-bold text-white">{servicosAndamento}</p>
            </div>
            <div className="border border-blue-800/40 rounded-xl p-3" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-xs text-blue-300/70">Agendados</span>
              </div>
              <p className="text-xl font-bold text-white">{servicosAgendados}</p>
            </div>
            <div className="border border-blue-800/40 rounded-xl p-3" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-gray-500/20 rounded-lg flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                </div>
                <span className="text-xs text-blue-300/70">Abertos</span>
              </div>
              <p className="text-xl font-bold text-white">{servicosAbertos}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-800/40">
            <p className="text-xs text-blue-300/60 text-center">
              Total de <span className="text-white font-semibold">{servicosFiltrados.length}</span> serviços no período selecionado
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Manutenções Pendentes */}
        <Card className="border border-blue-800/40 shadow-xl" style={{backgroundColor: '#243447'}}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-white">
              Manutenções Pendentes
            </CardTitle>
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {manutencoesPendentes.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-blue-300/60 text-sm">Nenhuma manutenção pendente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {manutencoesPendentes.slice(0, 5).map((cliente) => {
                  const daysUntil = differenceInDays(new Date(cliente.proxima_manutencao), new Date());
                  const isOverdue = daysUntil < 0;
                  return (
                    <Link key={cliente.id} to={createPageUrl('PreventivasFuturas')} className="block">
                      <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                        isOverdue ? 'bg-red-900/30 border border-red-700/40' : 'bg-yellow-900/20 border border-yellow-700/30'
                      }`}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isOverdue ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                            <Snowflake className={`w-4 h-4 ${isOverdue ? 'text-red-400' : 'text-yellow-400'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">{cliente.nome}</p>
                            <p className="text-xs text-blue-300/60">{cliente.tipo_equipamento || 'N/A'}</p>
                          </div>
                        </div>
                        <div className={`text-right ${isOverdue ? 'text-red-400' : 'text-yellow-400'}`}>
                          <p className="text-xs font-medium">
                            {isOverdue ? `${Math.abs(daysUntil)}d atrasado` : `em ${daysUntil}d`}
                          </p>
                          <p className="text-xs text-blue-300/50">{format(new Date(cliente.proxima_manutencao), "dd/MM/yy")}</p>
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
        <Card className="border border-blue-800/40 shadow-xl" style={{backgroundColor: '#243447'}}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-white">
              Últimos Clientes
            </CardTitle>
            <Link to={createPageUrl('Clientes')}>
              <Button variant="ghost" size="sm" className="text-yellow-400 hover:text-yellow-300 text-xs sm:text-sm">
                Ver todos <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {clientes.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-blue-800/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-blue-300/60 text-sm">Nenhum cliente cadastrado</p>
                <Link to={createPageUrl('Clientes')}>
                  <Button variant="outline" className="mt-3 text-sm border-blue-700 text-blue-300">
                    Cadastrar primeiro cliente
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {clientes.slice(0, 5).map((cliente) => (
                  <Link key={cliente.id} to={createPageUrl('Clientes')} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer group border border-blue-800/30 hover:border-yellow-600/40" style={{backgroundColor: 'rgba(30,64,175,0.12)'}}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md" style={{background: 'linear-gradient(135deg, #1e40af, #f59e0b)'}}>
                          {cliente.nome?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm group-hover:text-yellow-400 transition-colors">{cliente.nome}</p>
                          <p className="text-xs text-blue-300/50">{cliente.cidade || 'Sem cidade'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-300/50">{format(new Date(cliente.created_date), "dd/MM/yy")}</p>
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