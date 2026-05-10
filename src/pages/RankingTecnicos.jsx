import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, TrendingUp, Clock, Users, Award, Star, Crown, Calendar, RotateCcw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useAuth } from '@/lib/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';

const RANKING_RESET_KEY = 'ranking_tecnicos_reset_em';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function parseDateSafe(str) {
  if (!str) return null;
  try {
    const d = parseISO(str);
    return isValid(d) ? d : null;
  } catch { return null; }
}

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];
const MEDAL_CLASSES = [
  'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  'text-gray-300 border-gray-300/30 bg-gray-300/10',
  'text-amber-600 border-amber-600/30 bg-amber-600/10',
];

// Bloco vertical com Semana / Mes / Ano usado nos cards do podium
function PodiumValores({ t, cor = 'text-blue-400' }) {
  return (
    <div className="w-full flex flex-col items-center gap-1 text-center">
      <div>
        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Semana</p>
        <p className={`text-sm font-bold ${cor}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.ganho_semana || 0)}</p>
      </div>
      <div>
        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Mês</p>
        <p className={`text-sm font-bold ${cor}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.ganho_mes || 0)}</p>
      </div>
      <div>
        <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Ano</p>
        <p className={`text-sm font-bold ${cor}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.ganho_ano || 0)}</p>
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{t.servicos_mes || 0} serv. no mês</p>
    </div>
  );
}

export default function RankingTecnicos() {
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const isTecnico = !isAdmin;
  const [periodo, setPeriodo] = useState('mes');
  // Le do localStorage SINCRONAMENTE no estado inicial — evita flash de
  // dados desfiltrados no primeiro render apos refresh.
  const [resetEm, setResetEm] = useState(() => {
    try { return localStorage.getItem(RANKING_RESET_KEY) || null; } catch { return null; }
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLimpar, setConfirmLimpar] = useState(false);

  const aplicarReset = () => {
    const agora = new Date().toISOString();
    try { localStorage.setItem(RANKING_RESET_KEY, agora); } catch {}
    setResetEm(agora);
    setConfirmReset(false);
    toast.success('Ranking resetado! Contagem reiniciada agora.');
  };

  const limparReset = () => {
    try { localStorage.removeItem(RANKING_RESET_KEY); } catch {}
    setResetEm(null);
    setConfirmLimpar(false);
    toast.success('Reset removido — voltou a contar todo o histórico.');
  };

  const hoje = new Date();

  const getRange = (p) => {
    switch (p) {
      case 'semana':
        return {
          inicio: format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          fim: format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      case 'semana_ant': {
        const s = subWeeks(hoje, 1);
        return {
          inicio: format(startOfWeek(s, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          fim: format(endOfWeek(s, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      }
      case 'mes':
        return {
          inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'),
          fim: format(endOfMonth(hoje), 'yyyy-MM-dd'),
        };
      case 'mes_ant': {
        const m = subMonths(hoje, 1);
        return {
          inicio: format(startOfMonth(m), 'yyyy-MM-dd'),
          fim: format(endOfMonth(m), 'yyyy-MM-dd'),
        };
      }
      default:
        return { inicio: null, fim: null };
    }
  };

  const { inicio, fim } = getRange(isTecnico ? 'mes' : periodo);

  // Ranges fixos para os 3 totais sempre exibidos (semana/mes/ano corrente)
  const inicioSem = format(startOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const fimSem = format(endOfWeek(hoje, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd');
  const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd');
  const inicioAno = format(startOfYear(hoje), 'yyyy-MM-dd');
  const fimAno = format(endOfYear(hoje), 'yyyy-MM-dd');

  const { data: lancamentos = [], isLoading: loadLanc } = useQuery({
    queryKey: ['lancamentos-ranking'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list(),
  });

  const { data: pagamentos = [], isLoading: loadPag } = useQuery({
    queryKey: ['pagamentos-tec-ranking'],
    queryFn: () => base44.entities.PagamentoTecnico.list(),
  });

  const isLoading = loadLanc || loadPag;

  const dentro = (dataStr, ini, fim) => {
    const d = parseDateSafe(dataStr);
    if (!d) return false;
    const ds = format(d, 'yyyy-MM-dd');
    return ds >= ini && ds <= fim;
  };

  // Cutoff do reset manual: lancamentos com data ANTERIOR ao reset sao ignorados
  // em todos os calculos do ranking (semana/mes/ano/periodo). Nao apaga dados.
  const aposReset = (dataStr) => {
    if (!resetEm) return true;
    const d = parseDateSafe(dataStr);
    if (!d) return true; // sem data → assume que entra
    return d.getTime() >= new Date(resetEm).getTime();
  };

  // --- Filtros para o periodo selecionado (header dropdown) ---
  const lancPeriodo = lancamentos.filter((l) => {
    if (!aposReset(l.data_geracao)) return false;
    return (!inicio || !fim) ? true : dentro(l.data_geracao, inicio, fim);
  });
  const pagPeriodo = pagamentos.filter((p) => {
    if (p.status !== 'Confirmado') return false;
    // respeita o cutoff de reset: pagamentos anteriores ao reset tambem somem
    const dataRefPag = p.data_pagamento || p.created_date;
    if (!aposReset(dataRefPag)) return false;
    if (!inicio || !fim) return true;
    return dentro(p.data_pagamento, inicio, fim) || dentro(p.created_date, inicio, fim);
  });

  // --- Agrupar por tecnico (periodo selecionado + sempre semana/mes/ano corrente) ---
  const tecnicoMap = {};
  const ensure = (id, nome, equipe_nome) => {
    if (!tecnicoMap[id]) {
      tecnicoMap[id] = {
        id,
        nome: nome || id,
        equipe_nome: equipe_nome || '',
        servicos: 0,
        total_ganho: 0,
        total_pago: 0,
        ganho_semana: 0,
        ganho_mes: 0,
        ganho_ano: 0,
        servicos_semana: 0,
        servicos_mes: 0,
        servicos_ano: 0,
      };
    } else {
      // Atualiza nome/equipe se vier valor mais recente preenchido
      if (nome && tecnicoMap[id].nome === id) tecnicoMap[id].nome = nome;
      if (equipe_nome && !tecnicoMap[id].equipe_nome) tecnicoMap[id].equipe_nome = equipe_nome;
    }
    return tecnicoMap[id];
  };

  // Periodo selecionado (filtro do header)
  lancPeriodo.forEach((l) => {
    if (!l.tecnico_id) return;
    const t = ensure(l.tecnico_id, l.tecnico_nome, l.equipe_nome);
    t.servicos += 1;
    t.total_ganho += l.valor_comissao_tecnico || 0;
  });
  pagPeriodo.forEach((p) => {
    if (!p.tecnico_id) return;
    const t = ensure(p.tecnico_id, p.tecnico_nome, p.equipe_nome);
    t.total_pago += p.valor_pago || 0;
  });

  // Sempre calcular semana / mes / ano corrente (independente do filtro do header)
  // Mas respeita o cutoff de reset manual: lancamentos anteriores ao reset = ignorados
  lancamentos.forEach((l) => {
    if (!l.tecnico_id) return;
    if (!aposReset(l.data_geracao)) return;
    const t = ensure(l.tecnico_id, l.tecnico_nome, l.equipe_nome);
    const valor = l.valor_comissao_tecnico || 0;
    if (dentro(l.data_geracao, inicioSem, fimSem)) { t.ganho_semana += valor; t.servicos_semana += 1; }
    if (dentro(l.data_geracao, inicioMes, fimMes)) { t.ganho_mes += valor; t.servicos_mes += 1; }
    if (dentro(l.data_geracao, inicioAno, fimAno)) { t.ganho_ano += valor; t.servicos_ano += 1; }
  });

  // Ordena pelo ganho do periodo selecionado (mantém comportamento do filtro do header)
  const ranking = Object.values(tecnicoMap)
    .map((t) => ({
      ...t,
      pendente: Math.max(0, t.total_ganho - t.total_pago),
      media_servico: t.servicos > 0 ? t.total_ganho / t.servicos : 0,
    }))
    .sort((a, b) => b.total_ganho - a.total_ganho);

  // --- Posicoes com empate APENAS na mesma equipe ---
  // Se 2 tecnicos consecutivos no ranking tem mesmo total_ganho E mesma equipe, recebem mesma posicao.
  ranking.forEach((tec, i) => {
    if (i === 0) {
      tec.posicao = 1;
    } else {
      const prev = ranking[i - 1];
      const empate = Math.abs(tec.total_ganho - prev.total_ganho) < 0.01 && tec.equipe_nome && tec.equipe_nome === prev.equipe_nome;
      tec.posicao = empate ? prev.posicao : i + 1;
    }
  });

  // --- Lider do MES e do ANO (independente do filtro selecionado) ---
  const liderMes = [...Object.values(tecnicoMap)].sort((a, b) => b.ganho_mes - a.ganho_mes)[0];
  const liderAno = [...Object.values(tecnicoMap)].sort((a, b) => b.ganho_ano - a.ganho_ano)[0];

  const totalGeral = ranking.reduce((s, t) => s + t.total_ganho, 0);
  const totalServicos = ranking.reduce((s, t) => s + t.servicos, 0);
  const totalPendente = ranking.reduce((s, t) => s + t.pendente, 0);
  const lider = ranking[0];

  const periodoLabel = {
    semana: 'Semana Atual',
    semana_ant: 'Semana Anterior',
    mes: 'Mês Atual',
    mes_ant: 'Mês Anterior',
    tudo: 'Todo o período',
  }[periodo];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 tracking-tight flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            Ranking de Técnicos
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Desempenho e comissões — {periodoLabel}
            {resetEm && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
                · 🏁 contando desde {format(new Date(resetEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </p>
        </div>
        {!isTecnico && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmReset(true)}
              className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              title="Reinicia a contagem do ranking a partir de agora (não apaga dados financeiros)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Resetar Ranking
            </Button>
            {resetEm && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmLimpar(true)}
                className="text-xs text-gray-400 hover:text-gray-200"
                title="Volta a contar todo o histórico (remove o reset)"
              >
                Limpar reset
              </Button>
            )}
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-52 bg-[#152236] border-white/10 text-gray-200 focus:ring-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#152236] border-white/10 text-gray-200">
                <SelectItem value="semana">Semana Atual</SelectItem>
                <SelectItem value="semana_ant">Semana Anterior</SelectItem>
                <SelectItem value="mes">Mês Atual</SelectItem>
                <SelectItem value="mes_ant">Mês Anterior</SelectItem>
                <SelectItem value="tudo">Todo o período</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Summary cards — somente admin */}
      {!isTecnico && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-[#152236] border-white/5 rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Técnicos ativos</p>
                <p className="text-2xl font-bold text-gray-100">{ranking.length}</p>
                <p className="text-xs text-gray-500">{totalServicos} serviços no período</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#152236] border-white/5 rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Total comissões</p>
                <p className="text-2xl font-bold text-emerald-400">{fmt(totalGeral)}</p>
                {lider && <p className="text-xs text-gray-500">Líder: {lider.nome}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#152236] border-white/5 rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">A pagar (geral)</p>
                <p className="text-2xl font-bold text-amber-400">{fmt(totalPendente)}</p>
                <p className="text-xs text-gray-500">pendente acumulado</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards de destaque: Tecnico do Mes / Tecnico do Ano (so admin) */}
      {!isTecnico && (liderMes?.ganho_mes > 0 || liderAno?.ganho_ano > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border-yellow-400/30 rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                <Crown className="w-6 h-6 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-yellow-500/80 font-bold uppercase tracking-wider">🏆 Técnico do Mês</p>
                {liderMes?.ganho_mes > 0 ? (
                  <>
                    <p className="text-lg font-bold text-yellow-200 truncate">{liderMes.nome}</p>
                    <p className="text-xs text-gray-400">{liderMes.equipe_nome} · {liderMes.servicos_mes} serv. · {fmt(liderMes.ganho_mes)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Sem dados ainda este mês</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-400/30 rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-400/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-purple-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-purple-300/80 font-bold uppercase tracking-wider">⭐ Técnico do Ano {format(hoje, 'yyyy')}</p>
                {liderAno?.ganho_ano > 0 ? (
                  <>
                    <p className="text-lg font-bold text-purple-200 truncate">{liderAno.nome}</p>
                    <p className="text-xs text-gray-400">{liderAno.equipe_nome} · {liderAno.servicos_ano} serv. · {fmt(liderAno.ganho_ano)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Sem dados ainda este ano</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Podium top 3 — exibe SEMANA / MES / ANO (ganho em servicos) */}
      {ranking.length >= 2 && (
        <div className="grid grid-cols-3 gap-3">
          {/* 2nd */}
          {ranking[1] && (
            <div className="flex flex-col items-center justify-end gap-2 pt-6">
              <span className="text-3xl">{ranking[1].posicao === 1 ? '🥇' : '🥈'}</span>
              <div className="text-center">
                <p className="font-bold text-gray-200 text-sm truncate max-w-[120px]">{ranking[1].nome}</p>
                <p className="text-xs text-gray-500">{ranking[1].equipe_nome}</p>
              </div>
              <div className="w-full bg-gray-300/20 rounded-t-xl pt-4 pb-3 px-2 flex flex-col items-center gap-1 border border-gray-300/20">
                <PodiumValores t={ranking[1]} cor="text-blue-400" />
              </div>
            </div>
          )}
          {/* 1st */}
          {ranking[0] && (
            <div className="flex flex-col items-center justify-end gap-2">
              <Star className="w-5 h-5 text-yellow-400 animate-pulse" />
              <span className="text-4xl">🥇</span>
              <div className="text-center">
                <p className="font-bold text-yellow-300 text-sm truncate max-w-[120px]">{ranking[0].nome}</p>
                <p className="text-xs text-gray-500">{ranking[0].equipe_nome}</p>
              </div>
              <div className="w-full bg-yellow-400/10 rounded-t-xl pt-5 pb-3 px-2 flex flex-col items-center gap-1 border border-yellow-400/20">
                <PodiumValores t={ranking[0]} cor="text-yellow-400" />
              </div>
            </div>
          )}
          {/* 3rd */}
          {ranking[2] && (
            <div className="flex flex-col items-center justify-end gap-2 pt-10">
              <span className="text-3xl">{ranking[2].posicao === 1 ? '🥇' : ranking[2].posicao === 2 ? '🥈' : '🥉'}</span>
              <div className="text-center">
                <p className="font-bold text-gray-200 text-sm truncate max-w-[120px]">{ranking[2].nome}</p>
                <p className="text-xs text-gray-500">{ranking[2].equipe_nome}</p>
              </div>
              <div className="w-full bg-amber-600/20 rounded-t-xl pt-3 pb-3 px-2 flex flex-col items-center gap-1 border border-amber-600/20">
                <PodiumValores t={ranking[2]} cor="text-blue-400" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full ranking list */}
      {isLoading ? (
        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="py-12 text-center text-gray-500">Carregando ranking...</CardContent>
        </Card>
      ) : ranking.length === 0 ? (
        <Card className="bg-[#152236] border-white/5 rounded-2xl">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Nenhuma comissão registrada no período</p>
            <p className="text-gray-600 text-sm mt-1">Selecione outro período ou verifique os lançamentos</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#152236] border-white/5 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 py-3 px-5">
            <CardTitle className="text-sm font-bold text-gray-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-400" />
              Classificação completa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              {ranking.map((tec, idx) => {
                const pct = lider?.total_ganho > 0 ? (tec.total_ganho / lider.total_ganho) * 100 : 0;
                const pos = tec.posicao || idx + 1;
                const medalIdx = pos - 1;
                return (
                  <div
                    key={tec.id}
                    className={`px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 hover:bg-white/5 transition-colors ${pos === 1 ? 'bg-yellow-400/5' : ''}`}
                  >
                    {/* Position badge — usa posicao (com empate same-team) */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border flex-shrink-0 ${
                      medalIdx < 3 ? MEDAL_CLASSES[medalIdx] : 'text-gray-500 border-white/10 bg-white/5'
                    }`}>
                      {medalIdx < 3 ? MEDAL_EMOJIS[medalIdx] : pos}
                    </div>

                    {/* Info + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-200 text-sm">{tec.nome}</p>
                        {tec.equipe_nome && (
                          <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/20 px-1.5">
                            {tec.equipe_nome}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-white/10 rounded-full h-1.5 max-w-[200px]">
                          <div
                            className={`h-1.5 rounded-full transition-all ${pos === 1 ? 'bg-yellow-400' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">{tec.servicos} serv. · média {fmt(tec.media_servico)}</span>
                      </div>
                    </div>

                    {/* Metrics: SEMANA / MES / ANO (ganho em servicos) */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 text-right">
                      <div>
                        <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Semana</p>
                        <p className="text-xs sm:text-sm font-bold text-sky-400">{fmt(tec.ganho_semana)}</p>
                        <p className="text-[9px] text-gray-600">{tec.servicos_semana} serv.</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Mês</p>
                        <p className="text-xs sm:text-sm font-bold text-emerald-400">{fmt(tec.ganho_mes)}</p>
                        <p className="text-[9px] text-gray-600">{tec.servicos_mes} serv.</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Ano</p>
                        <p className="text-sm font-bold text-purple-400">{fmt(tec.ganho_ano)}</p>
                        <p className="text-[9px] text-gray-600">{tec.servicos_ano} serv.</p>
                      </div>
                      {!isTecnico && (
                        <div className="hidden md:block border-l border-white/5 pl-3">
                          <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Pendente</p>
                          <p className={`text-sm font-bold ${tec.pendente > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                            {fmt(tec.pendente)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={aplicarReset}
        title="Resetar ranking dos técnicos?"
        description="A contagem do ranking (semana/mês/ano) vai começar do zero a partir de agora. Comissões anteriores deixam de aparecer no ranking. ATENÇÃO: nenhum dado financeiro é apagado — Pagamentos, Lançamentos e relatórios continuam intactos. Você pode reverter clicando em 'Limpar reset'."
        confirmText="Resetar agora"
        variant="default"
      />
      <ConfirmDialog
        open={confirmLimpar}
        onClose={() => setConfirmLimpar(false)}
        onConfirm={limparReset}
        title="Remover o reset do ranking?"
        description="O ranking voltará a contar todo o histórico de comissões."
        confirmText="Remover reset"
      />
    </div>
  );
}
