import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, DollarSign, TrendingUp, Calendar, Filter, Trophy, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { calcularTotalComissoes, agruparPorPeriodo } from '@/lib/utils/calculations';
import { TableSkeleton, CardSkeleton } from '@/components/LoadingSkeleton';
import { usePermissions } from '@/components/auth/PermissionGuard';
import NoPermission from '@/components/NoPermission';
import { useNavigate } from 'react-router-dom';
import { getStartOfWeek, getEndOfWeek, getLocalDate, toLocalDate, formatDate } from '@/lib/dateUtils';
import { subWeeks, format, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const inputDark = 'bg-[#1e2d3d] border-[#2d3f55] text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500/20 h-10 px-3 rounded-md border w-full text-sm';
const selectDark = 'bg-[#1e2d3d] border border-[#2d3f55] text-gray-100 h-10 px-3 rounded-md w-full text-sm focus:outline-none focus:border-blue-500';

const NUM_SEMANAS = 10;

export default function RelatorioComissoes() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');

  React.useEffect(() => {
    const checkAdmin = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        if (u?.role !== 'admin') navigate('/Dashboard');
      } catch {
        navigate('/Dashboard');
      }
    };
    checkAdmin();
  }, [navigate]);

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ['lancamentos-financeiros'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list('-data_geracao'),
  });

  const { data: tecnicos = [] } = useQuery({
    queryKey: ['tecnicos-financeiro'],
    queryFn: () => base44.entities.TecnicoFinanceiro.list(),
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ['equipes'],
    queryFn: () => base44.entities.Equipe.list(),
  });

  // Filtragem geral
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter(lanc => {
      const dataLanc = new Date(lanc.data_geracao);
      const matchData = (!dataInicio || dataLanc >= new Date(dataInicio)) &&
                        (!dataFim   || dataLanc <= new Date(dataFim));
      const matchTecnico = !tecnicoFiltro || lanc.tecnico_id === tecnicoFiltro;
      return matchData && matchTecnico;
    });
  }, [lancamentos, dataInicio, dataFim, tecnicoFiltro]);

  const totais = useMemo(() => calcularTotalComissoes(lancamentosFiltrados), [lancamentosFiltrados]);
  const porMes = useMemo(() => agruparPorPeriodo(lancamentosFiltrados), [lancamentosFiltrados]);

  // ---------- Ganhos semanais por equipe ----------
  const { semanas, equipesNomes } = useMemo(() => {
    const hoje = getLocalDate();

    // Monta lista das últimas NUM_SEMANAS semanas (mais recente primeiro)
    const sems = Array.from({ length: NUM_SEMANAS }, (_, i) => {
      const ref = subWeeks(hoje, i);
      const inicio = getStartOfWeek(ref);
      const fim    = getEndOfWeek(ref);
      const label  = `${format(inicio, 'dd/MM', { locale: ptBR })} – ${format(fim, 'dd/MM', { locale: ptBR })}`;
      return { inicio, fim, label };
    });

    // Nomes únicos de equipes que aparecem nos lancamentos (preserva ordem da entity)
    const nomesSet = new Set(lancamentos.map(l => l.equipe_nome).filter(Boolean));
    // Ordena pela lista de equipes cadastradas, depois appends extras
    const ordered = equipes.map(e => e.nome).filter(n => nomesSet.has(n));
    nomesSet.forEach(n => { if (!ordered.includes(n)) ordered.push(n); });

    return { semanas: sems, equipesNomes: ordered };
  }, [lancamentos, equipes]);

  const ganhosSemanais = useMemo(() => {
    return semanas.map(({ inicio, fim, label }) => {
      const lancsSemana = lancamentos.filter(l => {
        if (!l.data_geracao) return false;
        try {
          const dt = toLocalDate(new Date(l.data_geracao));
          if (!dt) return false;
          return isWithinInterval(dt, { start: inicio, end: fim });
        } catch { return false; }
      });

      const porEquipe = {};
      let totalSemana = 0;
      equipesNomes.forEach(nome => { porEquipe[nome] = 0; });

      lancsSemana.forEach(l => {
        const nome = l.equipe_nome;
        if (!nome) return;
        // usa valor_comissao_tecnico (sempre preenchido); cai em valor_comissao_equipe se existir
        const val = (l.valor_comissao_tecnico || 0) + (l.valor_comissao_equipe || 0);
        porEquipe[nome] = (porEquipe[nome] || 0) + val;
        totalSemana += val;
      });

      return { label, porEquipe, total: totalSemana };
    });
  }, [semanas, lancamentos, equipesNomes]);

  // Totais por equipe (rodapé da tabela semanal)
  const totaisPorEquipe = useMemo(() => {
    const t = {};
    equipesNomes.forEach(n => { t[n] = 0; });
    let grand = 0;
    ganhosSemanais.forEach(s => {
      equipesNomes.forEach(n => { t[n] = (t[n] || 0) + s.porEquipe[n]; });
      grand += s.total;
    });
    return { porEquipe: t, total: grand };
  }, [ganhosSemanais, equipesNomes]);

  // Exportar CSV
  const exportarCSV = () => {
    const csv = [
      ['Data', 'Técnico', 'Equipe', 'Cliente', 'Tipo Serviço', 'Valor Total', 'Comissão Técnico', 'Comissão Equipe', 'Status'].join(';'),
      ...lancamentosFiltrados.map(l => [
        formatDate(l.data_geracao),
        l.tecnico_nome,
        l.equipe_nome,
        l.cliente_nome,
        l.tipo_servico,
        l.valor_total_servico,
        l.valor_comissao_tecnico,
        l.valor_comissao_equipe,
        l.status
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comissoes_${format(getLocalDate(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d1826]">
        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100">Relatório de Comissões</h1>
          <p className="text-gray-400 mt-1 text-sm">Extrato detalhado de comissões por período</p>
        </div>
        <Button onClick={exportarCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 self-start sm:self-auto">
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Gerado</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(totais.total)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Pendente</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{formatCurrency(totais.pendente)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Pago</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totais.pago)}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl">
        <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
          <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wider">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={inputDark}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wider">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={inputDark}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1.5 block uppercase tracking-wider">Técnico</label>
              <select
                value={tecnicoFiltro}
                onChange={(e) => setTecnicoFiltro(e.target.value)}
                className={selectDark}
              >
                <option value="">Todos</option>
                {tecnicos.map(t => (
                  <option key={t.tecnico_id} value={t.tecnico_id}>{t.tecnico_nome}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ganhos Semanais por Equipe */}
      {equipesNomes.length > 0 && (
        <Card className="bg-[#152236] border-white/5 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
            <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Ganhos Semanais por Equipe
              <span className="text-[10px] font-normal text-gray-500 ml-1">(últimas {NUM_SEMANAS} semanas · comissão equipe)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5 bg-[#0d1826]/50">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-36">Semana</th>
                  {equipesNomes.map(nome => (
                    <th key={nome} className="text-right px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      {nome}
                    </th>
                  ))}
                  <th className="text-right px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ganhosSemanais.map((sem, idx) => {
                  const melhorEquipe = equipesNomes.reduce((best, n) =>
                    sem.porEquipe[n] > (sem.porEquipe[best] || 0) ? n : best, equipesNomes[0]);
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-gray-300 text-xs font-medium whitespace-nowrap">{sem.label}</td>
                      {equipesNomes.map(nome => {
                        const val = sem.porEquipe[nome] || 0;
                        const isBest = val > 0 && nome === melhorEquipe && equipesNomes.length > 1;
                        return (
                          <td key={nome} className="px-4 py-3 text-right">
                            <span className={`text-xs font-bold ${val === 0 ? 'text-gray-600' : isBest ? 'text-emerald-400' : 'text-gray-300'}`}>
                              {val === 0 ? '—' : formatCurrency(val)}
                            </span>
                            {isBest && val > 0 && (
                              <span className="ml-1.5 text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">↑</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs font-bold ${sem.total === 0 ? 'text-gray-600' : 'text-blue-400'}`}>
                          {sem.total === 0 ? '—' : formatCurrency(sem.total)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Rodapé com totais */}
              <tfoot>
                <tr className="border-t border-white/10 bg-[#0d1826]/70">
                  <td className="px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total período</td>
                  {equipesNomes.map(nome => (
                    <td key={nome} className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-amber-400">{formatCurrency(totaisPorEquipe.porEquipe[nome] || 0)}</span>
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-bold text-blue-400">{formatCurrency(totaisPorEquipe.total)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Resumo Mensal */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl">
        <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
          <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            Resumo Mensal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-white/5">
          {Object.keys(porMes).length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">Nenhum lançamento encontrado</p>
          ) : (
            Object.entries(porMes).map(([mes, items]) => {
              const total = calcularTotalComissoes(items);
              return (
                <div key={mes} className="flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
                  <div>
                    <p className="font-semibold text-gray-200 text-sm">{mes}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{items.length} lançamentos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base text-blue-400">{formatCurrency(total.total)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pendente: {formatCurrency(total.pendente)}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card className="bg-[#152236] border-white/5 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
          <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Lançamentos Detalhados
            <span className="ml-auto text-xs font-normal text-gray-500">{lancamentosFiltrados.length} registros</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/5 bg-[#0d1826]/50">
                {['Data', 'Técnico', 'Equipe', 'Cliente', 'Serviço', 'Valor', 'Comissão', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lancamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500 text-sm">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              ) : (
                lancamentosFiltrados.map((lanc) => (
                  <tr key={lanc.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(lanc.data_geracao)}</td>
                    <td className="px-4 py-3 text-gray-200 font-medium text-xs">{lanc.tecnico_nome}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{lanc.equipe_nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{lanc.cliente_nome}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{lanc.tipo_servico}</td>
                    <td className="px-4 py-3 text-gray-200 font-medium text-xs whitespace-nowrap">{formatCurrency(lanc.valor_total_servico)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400 text-xs whitespace-nowrap">{formatCurrency(lanc.valor_comissao_tecnico)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        lanc.status === 'pago'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : lanc.status === 'creditado'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {lanc.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}
