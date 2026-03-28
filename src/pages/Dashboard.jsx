import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GanhosSemanaDashboard from '@/components/dashboard/GanhosSemanaDashboard';
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
  Tag,
  Bell,
  DollarSign
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth, isWithinInterval, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLocalDate, getStartOfWeek, getEndOfWeek, toLocalDate } from '@/lib/dateUtils';

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
  const { user: currentUser } = useAuth();
  
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

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: tecnicosFinanceiro = [] } = useQuery({
    queryKey: ['tecnicosFinanceiro'],
    queryFn: () => base44.entities.TecnicoFinanceiro.list(),
  });

  const { data: lancamentosFinanceiros = [] } = useQuery({
    queryKey: ['lancamentosFinanceiros'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list(),
  });

  const { data: pagamentosTecnicos = [] } = useQuery({
    queryKey: ['pagamentosTecnicos'],
    queryFn: () => base44.entities.PagamentoTecnico.list(),
  });

  const { data: pagamentosClientes = [] } = useQuery({
    queryKey: ['pagamentos-clientes-dash'],
    queryFn: () => base44.entities.PagamentoCliente.list('-data_conclusao'),
    enabled: currentUser?.role === 'admin',
  });

  // Cards de alerta para admin
  const TIPOS_IGNORADOS = ['Ver defeito', 'Verificar defeito', 'Outro tipo de serviço', 'Serviço avulso'];
  const semPrecificacao = pagamentosClientes.filter(p =>
    p.status !== 'pago' && (p.valor_total === 0 || p.valor_total === 1) && !TIPOS_IGNORADOS.includes(p.tipo_servico)
  );
  const cobrarHoje = pagamentosClientes.filter(p => {
    if (p.status === 'pago') return false;
    if (!p.data_pagamento_agendado) return false;
    const hoje = new Date();
    const agendado = new Date(p.data_pagamento_agendado + 'T12:00:00');
    return agendado.getDate() === hoje.getDate() &&
      agendado.getMonth() === hoje.getMonth() &&
      agendado.getFullYear() === hoje.getFullYear();
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

  // Filtrar serviços por período com timezone correto
  const servicosFiltrados = servicos.filter(s => {
    if (!s.data_programada) return false;
    const dataServico = toLocalDate(s.data_programada);
    if (!dataServico) return false;
    const hoje = getLocalDate();
    
    switch(filtroServicos) {
      case 'dia':
        return isToday(dataServico);
      case 'semana':
        return isWithinInterval(dataServico, {
          start: getStartOfWeek(),
          end: getEndOfWeek()
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
    const dataAtendimento = toLocalDate(a.data_atendimento);
    if (!dataAtendimento) return false;
    const hoje = getLocalDate();
    return isWithinInterval(dataAtendimento, {
      start: startOfMonth(hoje),
      end: endOfMonth(hoje)
    });
  });

  const atendimentosConcluidos = atendimentos.filter(a => a.status === 'Concluído').length;

  // Serviços de hoje por equipe
  const servicosHoje = servicos.filter(s => {
    if (!s.data_programada) return false;
    if (s.status === 'concluido') return false;
    const dataServico = toLocalDate(s.data_programada);
    if (!dataServico) return false;
    return isToday(dataServico);
  });

  // Buscar equipe do usuário atual
  const usuarioAtual = usuarios.find(u => u.email === currentUser?.email);
  const equipeDoUsuario = usuarioAtual?.equipe_id;

  // Filtrar apenas serviços da equipe do usuário (se não for admin)
  const servicosFiltradosPorEquipe = currentUser?.role === 'admin' 
    ? servicosHoje 
    : servicosHoje.filter(s => s.equipe_id === equipeDoUsuario);

  const servicosPorEquipe = equipes
    .map(equipe => ({
      equipe,
      servicos: servicosFiltradosPorEquipe.filter(s => s.equipe_id === equipe.id)
    }))
    .filter(e => e.servicos.length > 0);

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
            {format(getLocalDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <Link to={createPageUrl('Servicos')}>
          <Button className="text-sm px-5 h-10 font-bold rounded-xl" style={{ backgroundColor: '#f59e0b', color: '#1e1e1e' }}>
            <Plus className="w-4 h-4 mr-1" />
            + Novo Serviço
          </Button>
        </Link>
      </div>

      {/* Cards de Alerta Admin: Precificação e Cobranças do Dia */}
      {currentUser?.role === 'admin' && (semPrecificacao.length > 0 || cobrarHoje.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card: Serviços sem preço */}
          {semPrecificacao.length > 0 && (
            <Link to={createPageUrl('PagamentosClientes')}>
              <div className="rounded-2xl p-4 border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 transition-all cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-amber-800 text-sm">Serviços sem precificação</p>
                      <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{semPrecificacao.length}</span>
                    </div>
                    <p className="text-xs text-amber-700 mt-1">Clientes aguardando definição de preço</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {semPrecificacao.slice(0, 3).map(p => (
                        <span key={p.id} className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium truncate max-w-[120px]">{p.cliente_nome}</span>
                      ))}
                      {semPrecificacao.length > 3 && <span className="text-xs text-amber-600 font-semibold">+{semPrecificacao.length - 3} mais</span>}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-1" />
                </div>
              </div>
            </Link>
          )}

          {/* Card: Cobrar hoje */}
          {cobrarHoje.length > 0 && (
            <Link to={createPageUrl('PagamentosClientes')}>
              <div className="rounded-2xl p-4 border-2 border-orange-400 bg-orange-50 hover:bg-orange-100 transition-all cursor-pointer animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-orange-800 text-sm">🔔 Cobrar hoje!</p>
                      <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{cobrarHoje.length}</span>
                    </div>
                    <p className="text-xs text-orange-700 mt-1">Pagamentos agendados para hoje</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cobrarHoje.slice(0, 3).map(p => (
                        <span key={p.id} className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-medium truncate max-w-[120px]">{p.cliente_nome}</span>
                      ))}
                      {cobrarHoje.length > 3 && <span className="text-xs text-orange-600 font-semibold">+{cobrarHoje.length - 3} mais</span>}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-orange-600 flex-shrink-0 mt-1" />
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Serviços Diários por Equipe */}
      {servicosPorEquipe.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {currentUser?.role === 'admin' ? 'Serviços de Hoje por Equipe' : 'Meus Serviços de Hoje'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {servicosPorEquipe.map(({ equipe, servicos }) => (
              <div key={equipe.id} className="space-y-2">
                {/* Header da equipe */}
                <div className="flex items-center gap-2 px-1">
                  <div 
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow"
                    style={{ backgroundColor: equipe.cor || '#3b82f6' }}
                  >
                    {equipe.nome.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{equipe.nome}</p>
                  <span className="text-xs text-gray-500">({servicos.length})</span>
                </div>

                {/* Mini cards dos serviços */}
                <div className="space-y-1.5">
                  {servicos.map(servico => {
                    const statusColors = {
                      'aberto': 'bg-gray-50 border-gray-200',
                      'andamento': 'bg-blue-50 border-blue-200',
                      'agendado': 'bg-amber-50 border-amber-200',
                      'reagendado': 'bg-purple-50 border-purple-200'
                    };
                    const statusDot = {
                      'aberto': 'bg-gray-500',
                      'andamento': 'bg-blue-500',
                      'agendado': 'bg-amber-500',
                      'reagendado': 'bg-purple-500'
                    };
                    const statusClass = statusColors[servico.status] || statusColors.aberto;
                    const dotClass = statusDot[servico.status] || statusDot.aberto;
                    
                    return (
                      <Link key={servico.id} to={createPageUrl('Servicos')}>
                        <div className={`p-2.5 rounded-lg border ${statusClass} hover:shadow-sm transition-all cursor-pointer`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full ${dotClass} mt-1.5 flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-800 truncate">{servico.cliente_nome}</p>
                              <p className="text-xs text-gray-600 truncate">{servico.tipo_servico}</p>
                              {servico.horario && (
                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {servico.horario}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ganhos dos Técnicos - Apenas para Admin */}
      {currentUser?.role === 'admin' && tecnicosFinanceiro.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl col-span-full">
          <CardHeader className="pb-3 px-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-100">
                <Users className="w-4 h-4 text-green-600" />
              </div>
              <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
                Ganhos dos Técnicos (Semana Atual)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {tecnicosFinanceiro.map(tecnico => {
                const inicioSemana = getStartOfWeek();
                const fimSemana = getEndOfWeek();
                
                // Calcular comissões ganhas na semana
                const comissoesSemana = lancamentosFinanceiros.filter(l => {
                  if (l.tecnico_id !== tecnico.tecnico_id) return false;
                  if (!l.data_geracao) return false;
                  const dataGeracao = toLocalDate(l.data_geracao);
                  return dataGeracao && dataGeracao >= inicioSemana && dataGeracao <= fimSemana;
                });

                const totalComissoes = comissoesSemana.reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

                // Calcular pagamentos feitos na semana
                const pagamentosSemana = pagamentosTecnicos.filter(p => {
                  if (p.tecnico_id !== tecnico.tecnico_id) return false;
                  if (p.status !== 'Confirmado') return false;
                  if (!p.created_date) return false;
                  const dataPagamento = toLocalDate(p.created_date);
                  return dataPagamento && dataPagamento >= inicioSemana && dataPagamento <= fimSemana;
                });

                const totalPago = pagamentosSemana.reduce((sum, p) => sum + (p.valor_pago || 0), 0);
                const creditoPendente = Math.max(0, totalComissoes - totalPago);

                return (
                  <div key={tecnico.id} className="rounded-xl p-4 border border-gray-100 bg-gradient-to-br from-green-50 to-emerald-50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold text-sm">
                        {tecnico.tecnico_nome?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-600 font-medium">{tecnico.tecnico_nome}</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditoPendente)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Pendente</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - Com card de ganhos para técnicos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {currentUser?.role !== 'admin' && <GanhosSemanaDashboard />}
        <StatCard
          title="Clientes"
          value={totalClientes}
          icon={Users}
          color="bg-blue-500"
          subtitle={`${totalClientes} cadastrados`}
          href={createPageUrl('Clientes')}
        />
        <StatCard
          title="Atendimentos"
          value={atendimentosDoMes.length}
          icon={ClipboardList}
          color="bg-amber-400"
          subtitle="Este mês"
          href={createPageUrl('Atendimentos')}
        />
        <StatCard
          title="Preventivas Futuras"
          value={manutencoesPendentes.length}
          icon={AlertTriangle}
          color="bg-emerald-500"
          subtitle={`${manutencoesPendentes.length} agendadas`}
          href={createPageUrl('PreventivasFuturas')}
        />
        <StatCard
          title="Concluídos"
          value={atendimentosConcluidos}
          icon={CheckCircle2}
          color="bg-emerald-500"
          subtitle="Total histórico"
          href={createPageUrl('Atendimentos')}
        />
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Manutenções Pendentes */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
              Manutenções Pendentes
            </CardTitle>
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {manutencoesPendentes.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-gray-400 text-sm">Nenhuma manutenção pendente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {manutencoesPendentes.slice(0, 5).map((cliente) => {
                  const daysUntil = differenceInDays(new Date(cliente.proxima_manutencao), new Date());
                  const isOverdue = daysUntil < 0;
                  return (
                    <Link key={cliente.id} to={createPageUrl('PreventivasFuturas')} className="block">
                      <div className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
                      }`}>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isOverdue ? 'bg-red-100' : 'bg-amber-100'}`}>
                            <Snowflake className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{cliente.nome}</p>
                            <p className="text-xs text-gray-400">{cliente.tipo_equipamento || 'N/A'}</p>
                          </div>
                        </div>
                        <div className={`text-right ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
                          <p className="text-xs font-medium">
                            {isOverdue ? `${Math.abs(daysUntil)}d atrasado` : `em ${daysUntil}d`}
                          </p>
                          <p className="text-xs text-gray-400">{format(new Date(cliente.proxima_manutencao), "dd/MM/yy")}</p>
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
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
            <CardTitle className="text-base sm:text-lg font-semibold text-gray-800">
              Últimos Clientes
            </CardTitle>
            <Link to={createPageUrl('Clientes')}>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm">
                Ver todos <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {clientes.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-gray-400 text-sm">Nenhum cliente cadastrado</p>
                <Link to={createPageUrl('Clientes')}>
                  <Button variant="outline" className="mt-3 text-sm">
                    Cadastrar primeiro cliente
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {clientes.slice(0, 5).map((cliente) => (
                  <Link key={cliente.id} to={createPageUrl('Clientes')} className="block">
                    <div className="flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group border border-gray-100 hover:border-blue-200 hover:bg-blue-50">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
                          {cliente.nome?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm group-hover:text-blue-600 transition-colors">{cliente.nome}</p>
                          <p className="text-xs text-gray-400">{cliente.cidade || 'Sem cidade'}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">{format(new Date(cliente.created_date), "dd/MM/yy")}</p>
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