import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, TrendingUp, Clock, Users, Award, Star } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, parseISO, isValid } from 'date-fns';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useAuth } from '@/lib/AuthContext';

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

export default function RankingTecnicos() {
  const { isAdmin } = usePermissions();
  const { user } = useAuth();
  const isTecnico = !isAdmin;
  const [periodo, setPeriodo] = useState('mes');

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

  const { data: lancamentos = [], isLoading: loadLanc } = useQuery({
    queryKey: ['lancamentos-ranking'],
    queryFn: () => base44.entities.LancamentoFinanceiro.list(),
  });

  const { data: pagamentos = [], isLoading: loadPag } = useQuery({
    queryKey: ['pagamentos-tec-ranking'],
    queryFn: () => base44.entities.PagamentoTecnico.list(),
  });

  const isLoading = loadLanc || loadPag;

  // --- Filtrar por período ---
  const lancPeriodo = lancamentos.filter((l) => {
    if (!inicio || !fim) return true;
    const d = parseDateSafe(l.data_geracao);
    if (!d) return false;
    const ds = format(d, 'yyyy-MM-dd');
    return ds >= inicio && ds <= fim;
  });

  const pagPeriodo = pagamentos.filter((p) => {
    if (!inicio || !fim) return true;
    const d = parseDateSafe(p.data_pagamento) || parseDateSafe(p.created_date);
    if (!d) return false;
    const ds = format(d, 'yyyy-MM-dd');
    return ds >= inicio && ds <= fim && p.status === 'Confirmado';
  });

  // --- Agrupar por técnico ---
  const tecnicoMap = {};

  lancPeriodo.forEach((l) => {
    const id = l.tecnico_id;
    if (!id) return;
    if (!tecnicoMap[id]) {
      tecnicoMap[id] = {
        id,
        nome: l.tecnico_nome || id,
        equipe_nome: l.equipe_nome || '',
        servicos: 0,
        total_ganho: 0,
        total_pago: 0,
      };
    }
    tecnicoMap[id].servicos += 1;
    tecnicoMap[id].total_ganho += l.valor_comissao_tecnico || 0;
  });

  pagPeriodo.forEach((p) => {
    const id = p.tecnico_id;
    if (!id) return;
    if (!tecnicoMap[id]) {
      tecnicoMap[id] = { id, nome: id, equipe_nome: '', servicos: 0, total_ganho: 0, total_pago: 0 };
    }
    tecnicoMap[id].total_pago += p.valor_pago || 0;
  });

  const ranking = Object.values(tecnicoMap)
    .map((t) => ({
      ...t,
      pendente: Math.max(0, t.total_ganho - t.total_pago),
      media_servico: t.servicos > 0 ? t.total_pago / t.servicos : 0,
    }))
    .sort((a, b) => b.total_pago - a.total_pago);

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
          </p>
        </div>
        {!isTecnico && (
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

      {/* Podium top 3 */}
      {ranking.length >= 2 && (
        <div className="grid grid-cols-3 gap-3">
          {/* 2nd */}
          {ranking[1] && (
            <div className="flex flex-col items-center justify-end gap-2 pt-6">
              <span className="text-3xl">🥈</span>
              <div className="text-center">
                <p className="font-bold text-gray-200 text-sm truncate max-w-[100px]">{ranking[1].nome}</p>
                <p className="text-xs text-gray-500">{ranking[1].equipe_nome}</p>
              </div>
              <div className="w-full bg-gray-300/20 rounded-t-xl pt-6 pb-4 flex flex-col items-center gap-1 border border-gray-300/20">
                <p className="text-sm font-bold text-blue-400">{fmt(ranking[1].total_pago)}</p>
                <p className="text-xs text-gray-500">{ranking[1].servicos} serv.</p>
              </div>
            </div>
          )}
          {/* 1st */}
          {ranking[0] && (
            <div className="flex flex-col items-center justify-end gap-2">
              <Star className="w-5 h-5 text-yellow-400 animate-pulse" />
              <span className="text-4xl">🥇</span>
              <div className="text-center">
                <p className="font-bold text-yellow-300 text-sm truncate max-w-[100px]">{ranking[0].nome}</p>
                <p className="text-xs text-gray-500">{ranking[0].equipe_nome}</p>
              </div>
              <div className="w-full bg-yellow-400/10 rounded-t-xl pt-8 pb-4 flex flex-col items-center gap-1 border border-yellow-400/20">
                <p className="text-base font-bold text-yellow-400">{fmt(ranking[0].total_pago)}</p>
                <p className="text-xs text-gray-400">{ranking[0].servicos} serv.</p>
              </div>
            </div>
          )}
          {/* 3rd */}
          {ranking[2] && (
            <div className="flex flex-col items-center justify-end gap-2 pt-10">
              <span className="text-3xl">🥉</span>
              <div className="text-center">
                <p className="font-bold text-gray-200 text-sm truncate max-w-[100px]">{ranking[2].nome}</p>
                <p className="text-xs text-gray-500">{ranking[2].equipe_nome}</p>
              </div>
              <div className="w-full bg-amber-600/20 rounded-t-xl pt-4 pb-4 flex flex-col items-center gap-1 border border-amber-600/20">
                <p className="text-sm font-bold text-blue-400">{fmt(ranking[2].total_pago)}</p>
                <p className="text-xs text-gray-500">{ranking[2].servicos} serv.</p>
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
                const pct = lider?.total_pago > 0 ? (tec.total_pago / lider.total_pago) * 100 : 0;
                return (
                  <div
                    key={tec.id}
                    className={`px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 hover:bg-white/5 transition-colors ${idx === 0 ? 'bg-yellow-400/5' : ''}`}
                  >
                    {/* Position badge */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border flex-shrink-0 ${
                      idx < 3 ? MEDAL_CLASSES[idx] : 'text-gray-500 border-white/10 bg-white/5'
                    }`}>
                      {idx < 3 ? MEDAL_EMOJIS[idx] : idx + 1}
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
                            className={`h-1.5 rounded-full transition-all ${idx === 0 ? 'bg-yellow-400' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500">{tec.servicos} serv. · média {fmt(tec.media_servico)}</span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0 text-right">
                      {!isTecnico && (
                        <div className="hidden sm:block">
                          <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Ganho</p>
                          <p className="text-sm font-bold text-emerald-400">{fmt(tec.total_ganho)}</p>
                        </div>
                      )}
                      <div className="hidden sm:block">
                        <p className="text-[9px] text-gray-600 uppercase font-bold tracking-wider">Pago</p>
                        <p className="text-sm font-semibold text-blue-400">{fmt(tec.total_pago)}</p>
                      </div>
                      {!isTecnico && (
                        <div>
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
    </div>
  );
}
