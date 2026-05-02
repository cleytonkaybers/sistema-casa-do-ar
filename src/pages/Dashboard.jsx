import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useEmpresa } from '@/components/auth/EmpresaGuard';
import TipoServicoDisplay from '@/components/TipoServicoDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import GanhosSemanaDashboard from '@/components/dashboard/GanhosSemanaDashboard';
import ResumoMesAdminDashboard from '@/components/dashboard/ResumoMesAdminDashboard';
import GanhosTecnicosAdminDashboard from '@/components/dashboard/GanhosTecnicosAdminDashboard';
import CalendarioPlantao from '@/components/dashboard/CalendarioPlantao';
import Historico4SemanasDashboard from '@/components/dashboard/Historico4SemanasDashboard';
import { DashboardStatCardSkeleton, DashboardAdminSkeleton } from '@/components/LoadingSkeleton';
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
  Tag,
  Bell,
  Wrench,
  ShieldAlert
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth, isWithinInterval, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getLocalDate, getStartOfWeek, getEndOfWeek, toLocalDate, toLocalDateSafe, parseHistoricoData } from '@/lib/dateUtils';
import { formatPhone } from '@/lib/utils/formatters';
import { isApenasTiposIgnorados } from '@/lib/utils/tipoServico';

export default function Dashboard() {
  const [filtroServicos, setFiltroServicos] = useState('mes');
  const { user: currentUser } = useAuth();
  const { isAdminEmpresa, isSuperAdmin } = useEmpresa();
  const isAdmin = isAdminEmpresa() || isSuperAdmin();
  
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
    queryKey: ['pagamentos-clientes'],
    queryFn: () => base44.entities.PagamentoCliente.list('-data_conclusao'),
    enabled: isAdmin,
  });

  // Verificar último backup (admin) — entidade pode não existir em todos os ambientes
  const { data: ultimosBackups = [] } = useQuery({
    queryKey: ['ultimo-backup'],
    queryFn: async () => {
      try { return await base44.entities.BackupIncremental.list('-data_backup'); }
      catch { return []; }
    },
    enabled: isAdmin,
  });
  const ultimoBackup = Array.isArray(ultimosBackups) ? ultimosBackups[0] : undefined;
  const diasSemBackup = ultimoBackup?.data_backup
    ? Math.floor((Date.now() - new Date(ultimoBackup.data_backup).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const backupAtrasado = isAdmin && (diasSemBackup === null || diasSemBackup > 7);

  // Cards de alerta para admin
  const semPrecificacao = pagamentosClientes.filter(p =>
    p.status !== 'pago' && !p.arquivado && (p.valor_total === 0 || p.valor_total === 1) && !isApenasTiposIgnorados(p.tipo_servico)
  );
  const cobrarHoje = pagamentosClientes.filter(p => {
    if (p.status === 'pago') return false;
    if (p.arquivado) return false;
    if (!p.data_pagamento_agendado) return false;
    const hoje = new Date();
    const agendado = toLocalDateSafe(p.data_pagamento_agendado);
    if (!agendado) return false;
    return agendado.getDate() === hoje.getDate() &&
      agendado.getMonth() === hoje.getMonth() &&
      agendado.getFullYear() === hoje.getFullYear();
  });

  // Estatísticas
  const totalClientes = clientes.length;
  
  const manutencoesPendentes = clientes.filter(c => {
    if (!c.proxima_manutencao) return false;
    const daysUntil = differenceInDays(new Date(c.proxima_manutencao), new Date());
    return daysUntil <= 30 && daysUntil >= 0;
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

  // --- ADMIN STATS ---
  const adminResumoMes = useMemo(() => {
    if (!isAdmin) return { faturadoMes: 0, faturadoSemana: 0, recebidoMes: 0, recebidoSemana: 0, comissoes: 0 };
    const hoje = getLocalDate();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    const inicioSemana = getStartOfWeek();
    const fimSemana = getEndOfWeek();

    const parseDate = parseHistoricoData;

    // Faturado: valor dos serviços concluídos (bruto)
    const faturadoMes = servicos.filter(s => {
      if (s.status !== 'concluido') return false;
      const dt = parseDate(s.data_conclusao || s.data_programada);
      if (!dt) return false;
      return isWithinInterval(dt, { start: inicioMes, end: fimMes });
    }).reduce((sum, s) => sum + (parseFloat(s.valor) || 0), 0);

    const faturadoSemana = servicos.filter(s => {
      if (s.status !== 'concluido') return false;
      const dt = parseDate(s.data_conclusao || s.data_programada);
      if (!dt) return false;
      return isWithinInterval(dt, { start: inicioSemana, end: fimSemana });
    }).reduce((sum, s) => sum + (parseFloat(s.valor) || 0), 0);

    // Recebido: pagamentos efetivamente recebidos de clientes
    const recebidoMes = pagamentosClientes.reduce((sum, pag) => {
      const pgs = pag.historico_pagamentos || [];
      const pagoNoMes = pgs.filter(p => {
        if (!p.data || p.agendada) return false;
        const dt = parseDate(p.data);
        return dt && isWithinInterval(dt, { start: inicioMes, end: fimMes });
      }).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
      return sum + pagoNoMes;
    }, 0);

    const recebidoSemana = pagamentosClientes.reduce((sum, pag) => {
      const pgs = pag.historico_pagamentos || [];
      const pagoNaSemana = pgs.filter(p => {
        if (!p.data || p.agendada) return false;
        const dt = parseDate(p.data);
        return dt && isWithinInterval(dt, { start: inicioSemana, end: fimSemana });
      }).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
      return sum + pagoNaSemana;
    }, 0);

    // Comissões: pagamentos efetivamente realizados aos técnicos no mês
    const comissoes = pagamentosTecnicos.filter(p => {
      if (p.status !== 'Confirmado') return false;
      if (!p.created_date) return false;
      const dt = toLocalDate(new Date(p.created_date));
      if (!dt) return false;
      return isWithinInterval(dt, { start: inicioMes, end: fimMes });
    }).reduce((sum, p) => sum + (p.valor_pago || 0), 0);

    return { faturadoMes, faturadoSemana, recebidoMes, recebidoSemana, comissoes };
  }, [servicos, pagamentosClientes, pagamentosTecnicos, isAdmin]);

  const adminTecnicosSemana = useMemo(() => {
    if (!isAdmin) return [];
    const inicioSemanaAtual = getStartOfWeek();
    const fimSemanaAtual = getEndOfWeek();
    const SALDO_INICIO = new Date('2026-04-13T00:00:00');

    return tecnicosFinanceiro
      .map(t => {
        const lancamentosSemana = lancamentosFinanceiros.filter(l => {
          if (l.tecnico_id !== t.tecnico_id || !l.data_geracao) return false;
          const d = toLocalDate(new Date(l.data_geracao));
          return d && isWithinInterval(d, { start: inicioSemanaAtual, end: fimSemanaAtual });
        });
        const totalGanho = lancamentosSemana.reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

        const pagamentosSemana = pagamentosTecnicos.filter(p => {
          if (p.tecnico_id !== t.tecnico_id || p.status !== 'Confirmado' || !p.created_date) return false;
          const d = toLocalDate(new Date(p.created_date));
          return d && isWithinInterval(d, { start: inicioSemanaAtual, end: fimSemanaAtual });
        });
        const creditoPago = pagamentosSemana.reduce((sum, p) => sum + (p.valor_pago || 0), 0);

        // Saldo acumulado desde SALDO_INICIO até início desta semana
        let saldo_anterior = 0;
        if (inicioSemanaAtual > SALDO_INICIO) {
          const comissoesAnt = lancamentosFinanceiros
            .filter(l => {
              if (l.tecnico_id !== t.tecnico_id || !l.data_geracao) return false;
              const d = toLocalDate(new Date(l.data_geracao));
              return d && d >= SALDO_INICIO && d < inicioSemanaAtual;
            })
            .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);
          const pagamentosAnt = pagamentosTecnicos
            .filter(p => {
              if (p.tecnico_id !== t.tecnico_id || p.status !== 'Confirmado' || !p.created_date) return false;
              const d = toLocalDate(new Date(p.created_date));
              return d && d >= SALDO_INICIO && d < inicioSemanaAtual;
            })
            .reduce((sum, p) => sum + (p.valor_pago || 0), 0);
          saldo_anterior = comissoesAnt - pagamentosAnt;
        }

        const saldo_total = saldo_anterior + totalGanho - creditoPago;
        const credito_pendente = Math.max(0, saldo_total);

        return {
          ...t,
          credito_pendente,
          credito_pago: creditoPago,
          total_ganho: totalGanho,
          saldo_anterior,
          saldo_total,
        };
      })
      .filter(t => Math.abs(t.saldo_total) > 0.01 || t.total_ganho > 0);
  }, [tecnicosFinanceiro, lancamentosFinanceiros, pagamentosTecnicos, isAdmin]);

  const adminResumoTecnicos = useMemo(() => {
    if (!isAdmin) return { totalGanhoSemana: 0, totalPagoSemana: 0, totalPendente: 0 };
    return {
      totalGanhoSemana: adminTecnicosSemana.reduce((s, t) => s + (t.total_ganho || 0), 0),
      totalPagoSemana:  adminTecnicosSemana.reduce((s, t) => s + (t.credito_pago  || 0), 0),
      totalPendente:    adminTecnicosSemana.reduce((s, t) => s + (t.credito_pendente || 0), 0),
    };
  }, [adminTecnicosSemana, tecnicosFinanceiro, isAdmin]);

  // Serviços de hoje por equipe
  const servicosHoje = servicos.filter(s => {
    if (!s.data_programada) return false;
    if (s.status === 'concluido') return false;
    const dataServico = toLocalDate(s.data_programada);
    if (!dataServico) return false;
    return isToday(dataServico);
  });

  const usuarioAtual = usuarios.find(u => u.email === currentUser?.email);
  const equipeDoUsuario = usuarioAtual?.equipe_id;

  const servicosFiltradosPorEquipe = isAdmin
    ? servicosHoje 
    : servicosHoje.filter(s => s.equipe_id === equipeDoUsuario);

  const servicosPorEquipe = equipes
    .map(equipe => ({
      equipe,
      servicos: servicosFiltradosPorEquipe.filter(s => s.equipe_id === equipe.id)
    }))
    .filter(e => e.servicos.length > 0);

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle, onClick, href }) => {
    const content = (
      <CardContent className="p-3 sm:p-5 flex flex-col justify-between h-full">
        <div className="flex items-start justify-between mb-2 sm:mb-4">
          <div className="flex-1 pr-2">
            <p className="text-[10px] sm:text-[13px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">{title}</p>
            <p className="text-2xl sm:text-4xl font-bold mt-1 sm:mt-2 text-gray-100 tracking-tight">{value}</p>
          </div>
          <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 ${colorClass} shrink-0`}>
            <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-white/5 mt-auto">
          {subtitle && <p className="text-[11px] sm:text-sm text-gray-500">{subtitle}</p>}
          {(onClick || href) && (
            <div className={`flex items-center text-[10px] sm:text-xs font-semibold ${colorClass} group-hover:opacity-80 transition-opacity`}>
              <span className="hidden sm:inline">Ver Detalhes</span>
              <ArrowRight className="w-3 h-3 sm:ml-1.5 transition-transform group-hover:translate-x-1" />
            </div>
          )}
        </div>
      </CardContent>
    );

    const baseClass = "bg-[#152236] border-white/5 shadow-sm hover:border-white/10 transition-all duration-300 rounded-2xl h-full flex flex-col";

    if (href) {
      return (
        <Link to={href} className="block h-full outline-none">
          <Card className={`${baseClass} cursor-pointer group`}>{content}</Card>
        </Link>
      );
    }

    return (
      <Card className={`${baseClass} ${onClick ? 'cursor-pointer group' : ''}`} onClick={onClick}>
        {content}
      </Card>
    );
  };

  return (
    <div className="space-y-6 lg:space-y-8 max-w-full overflow-hidden">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight">Dashboard</h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-blue-400" />
            {format(getLocalDate(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Link to={createPageUrl('Servicos')}>
          <Button className="w-full sm:w-auto text-sm px-6 h-11 font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all duration-300 border-0">
            <Plus className="w-4 h-4 mr-2" />
            Novo Serviço
          </Button>
        </Link>
      </div>

      {/* Banner backup atrasado */}
      {backupAtrasado && (
        <Link to={createPageUrl('BackupRestaurer')} className="block outline-none">
          <div className="rounded-2xl p-4 border border-red-500/30 bg-red-500/8 hover:bg-red-500/12 transition-all cursor-pointer flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-red-300 font-semibold text-sm">Backup atrasado — </span>
              <span className="text-red-400/80 text-sm">
                {diasSemBackup === null
                  ? 'nenhum backup encontrado. Faça um backup agora para proteger seus dados.'
                  : `último backup há ${diasSemBackup} dias. Recomendado: a cada 7 dias.`}
              </span>
            </div>
            <span className="text-red-400 text-xs font-medium shrink-0">Fazer backup →</span>
          </div>
        </Link>
      )}

      {/* Alertas Admin Modernos (Glass Blocks) */}
      {isAdmin && (semPrecificacao.length > 0 || cobrarHoje.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {semPrecificacao.length > 0 && (
            <Link to={createPageUrl('PagamentosClientes') + '?highlight=sempreco'} className="outline-none">
              <div className="rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all cursor-pointer group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Tag className="w-24 h-24 text-amber-500" />
                </div>
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                    <Tag className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-400 text-base mb-1">Precificação Pendente</p>
                    <p className="text-sm text-amber-200/70 mb-3">{semPrecificacao.length} serviços aguardando preço base</p>
                    <div className="flex flex-wrap gap-2">
                       {semPrecificacao.slice(0, 2).map(p => (
                        <span key={p.id} className="text-[11px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md font-medium truncate max-w-[130px] border border-amber-500/20">{p.cliente_nome}</span>
                      ))}
                      {semPrecificacao.length > 2 && <span className="text-[11px] text-amber-400 font-semibold flex items-center">+{semPrecificacao.length - 2} mais</span>}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {cobrarHoje.length > 0 && (
            <Link to={createPageUrl('PagamentosClientes') + '?highlight=cobrar'} className="outline-none">
              <div className="rounded-2xl p-5 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30 transition-all cursor-pointer group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Bell className="w-24 h-24 text-red-500 animate-pulse" />
                </div>
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 border border-red-500/30">
                    <Bell className="w-6 h-6 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-red-400 text-base mb-1">Cobranças Agendadas para Hoje</p>
                    <p className="text-sm text-red-200/70 mb-3">{cobrarHoje.length} clientes a cobrar</p>
                    <div className="flex flex-wrap gap-2">
                      {cobrarHoje.slice(0, 2).map(p => (
                        <span key={p.id} className="text-[11px] bg-red-500/20 text-red-300 px-2.5 py-1 rounded-md font-medium truncate max-w-[130px] border border-red-500/20">{p.cliente_nome}</span>
                      ))}
                      {cobrarHoje.length > 2 && <span className="text-[11px] text-red-400 font-semibold flex items-center">+{cobrarHoje.length - 2} mais</span>}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Cards do Admin */}
      {isAdmin && (
        isLoading ? <DashboardAdminSkeleton /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Resumo aparece primeiro no mobile (order-first) e último no desktop */}
            <div className="md:col-span-1 flex flex-col order-first md:order-last">
              <ResumoMesAdminDashboard
                servicosConcluidos={atendimentosDoMes.length}
                faturadoMes={adminResumoMes.faturadoMes}
                faturadoSemana={adminResumoMes.faturadoSemana}
                recebidoMes={adminResumoMes.recebidoMes}
                recebidoSemana={adminResumoMes.recebidoSemana}
                comissoes={adminResumoMes.comissoes}
              />
            </div>
            <div className="md:col-span-2 flex flex-col">
              <GanhosTecnicosAdminDashboard
                tecnicos={adminTecnicosSemana}
                totalGanhoSemana={adminResumoTecnicos.totalGanhoSemana}
                totalPagoSemana={adminResumoTecnicos.totalPagoSemana}
                totalPendente={adminResumoTecnicos.totalPendente}
              />
            </div>
          </div>
        )
      )}

      {/* Calendario de Plantao de Sabado (visivel para tecnico e admin) */}
      <CalendarioPlantao equipes={equipes} />

      {/* Grid Principal (Bento Style) */}
      {isLoading ? (
        <DashboardStatCardSkeleton count={isAdmin ? 4 : 6} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
          {!isAdmin && (
            <>
              <div className="col-span-2 xl:col-span-2">
                <GanhosSemanaDashboard />
              </div>
              <div className="col-span-2 xl:col-span-2">
                <Historico4SemanasDashboard />
              </div>
            </>
          )}
        </div>
      )}

      {/* Grid Secundário Dividido */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Coluna Esquerda: Filtros e Estatísticas Radiação (Ocupa 2/3 no desktop) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          
          {/* Manutenções Vencidas Críticas */}
          {manutencoesVencidas.length > 0 && (
            <Card className="border border-red-500/20 bg-[#1e1515] shadow-lg rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              <CardHeader className="pb-2 pt-5 px-5 sm:px-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-red-400 border-none m-0 leading-none">
                      Ação Imediata Necessária
                    </CardTitle>
                    <p className="text-sm text-red-300/70 mt-1">{manutencoesVencidas.length} manutenções vencidas!</p>
                  </div>
                </div>
                <Link to={createPageUrl('PreventivasFuturas')}>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">Ver Detalhes</Button>
                </Link>
              </CardHeader>
              <CardContent className="px-5 sm:px-6 pb-5 pt-2">
                 <div className="space-y-2 mt-2">
                  {manutencoesVencidas.slice(0, 3).map((cliente) => {
                    const daysOverdue = Math.abs(differenceInDays(new Date(cliente.proxima_manutencao), new Date()));
                    return (
                      <Link key={cliente.id} to={createPageUrl('PreventivasFuturas')} className="block group">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-red-500/5 transition-all cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:flex w-10 h-10 bg-[#152236] border border-white/5 rounded-lg items-center justify-center">
                              <Snowflake className="w-5 h-5 text-gray-500 group-hover:text-red-400 transition-colors" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-200 text-sm">{cliente.nome}</p>
                              <p className="text-xs text-gray-500">{cliente.telefone && formatPhone(cliente.telefone)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">{daysOverdue} dias</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">atrasado</p>
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

        {/* Coluna Direita: Listas Menores e Equipes */}
        <div className="xl:col-span-1 flex flex-col gap-6">

          {/* Serviços por Equipe / Cards Verticais Elegantes */}
          {servicosPorEquipe.length > 0 && (
            <Card className="bg-[#152236] border border-white/5 shadow-sm rounded-2xl flex-1">
              <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
                 <CardTitle className="text-sm font-bold text-gray-200 tracking-wide uppercase flex items-center gap-2">
                   <Users className="w-4 h-4 text-blue-400" />
                   {isAdmin ? "Serviços das Equipes (Hoje)" : "Meus Serviços de Hoje"}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden divide-y divide-white/5">
                {servicosPorEquipe.map(({ equipe, servicos }) => (
                  <div key={equipe.id} className="p-4 sm:p-5 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                         <div 
                           className="w-2 h-2 rounded-full shadow"
                           style={{ backgroundColor: equipe.cor || '#3b82f6' }}
                         />
                         <p className="text-sm font-bold text-gray-200">{equipe.nome}</p>
                       </div>
                       <span className="text-[10px] font-bold text-gray-400 bg-[#0d1826] px-2 py-0.5 rounded-full border border-white/5">{servicos.length} Serviços</span>
                    </div>
                    <div className="space-y-2">
                      {servicos.slice(0, 3).map(servico => (
                        <div key={servico.id} className="flex gap-3 items-start bg-[#0d1826] rounded-xl p-3 border border-white/5">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs text-gray-200 truncate">{servico.cliente_nome}</p>
                            <TipoServicoDisplay value={servico.tipo_servico} className="mt-0.5 [&_span.text-sm]:text-[11px] [&_span.text-xs]:text-[10px]" />
                          </div>
                          {servico.horario && (
                             <span className="text-[10px] text-gray-400 flex items-center bg-[#152236] px-1.5 py-0.5 rounded-md border border-white/5 whitespace-nowrap">
                               <Clock className="w-3 h-3 mr-1 text-gray-500" />
                               {servico.horario}
                             </span>
                          )}
                        </div>
                      ))}
                      {servicos.length > 3 && (
                        <div className="text-center pt-1">
                          <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-medium">Ver mais {servicos.length - 3} serviços</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}