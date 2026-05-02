import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { startOfWeek, endOfWeek, subWeeks, format, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toLocalDate } from '@/lib/dateUtils';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

export default function Historico4SemanasDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['historico4semanas', user?.email],
    queryFn: async () => {
      if (!user?.email) return { semanas: [], saldoTotal: 0 };
      const [lancamentos, pagamentos] = await Promise.all([
        base44.entities.LancamentoFinanceiro.list(),
        base44.entities.PagamentoTecnico.list(),
      ]);

      const meusLancamentos = lancamentos.filter(l => l.tecnico_id === user.email);
      const meusPagamentos = pagamentos.filter(p => p.tecnico_id === user.email && p.status === 'Confirmado');

      // Marco zero do saldo: alinhado com GanhosSemanaDashboard.
      // Antes desta data, comissoes e pagamentos sao ignorados no calculo do saldo.
      const SALDO_INICIO = new Date('2026-04-13T00:00:00');

      const hoje = new Date();
      // Ultimas 4 semanas (atual + 3 anteriores)
      const semanas = Array.from({ length: 4 }, (_, i) => {
        const ref = subWeeks(hoje, i);
        const inicio = startOfWeek(ref, { weekStartsOn: 1 });
        const fim = endOfWeek(ref, { weekStartsOn: 1 });
        const range = { start: inicio, end: fim };

        const produzido = meusLancamentos
          .filter(l => {
            if (!l.data_geracao) return false;
            try {
              const d = toLocalDate(l.data_geracao);
              return d && isWithinInterval(d, range);
            } catch { return false; }
          })
          .reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);

        const recebido = meusPagamentos
          .filter(p => {
            const ref = p.data_pagamento || p.created_date;
            if (!ref) return false;
            try {
              const d = ref.includes && ref.includes('T') ? toLocalDate(ref) : new Date(ref);
              return d && isWithinInterval(d, range);
            } catch { return false; }
          })
          .reduce((s, p) => s + (p.valor_pago || 0), 0);

        const pct = produzido > 0 ? Math.min(100, Math.round((recebido / produzido) * 100)) : (recebido > 0 ? 100 : 0);

        return {
          label: i === 0 ? 'Esta semana' : `${i} sem atrás`,
          inicio,
          fim,
          produzido,
          recebido,
          pct,
        };
      });

      // Saldo total = soma de TUDO desde SALDO_INICIO (comissoes - pagamentos).
      // Mesma logica de GanhosSemanaDashboard para garantir consistencia entre
      // os 2 cards do Dashboard e a pagina MeuFinanceiro.
      const totalComissoes = meusLancamentos
        .filter(l => {
          if (!l.data_geracao) return false;
          try { const d = toLocalDate(l.data_geracao); return d && d >= SALDO_INICIO; } catch { return false; }
        })
        .reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);
      const totalPagamentos = meusPagamentos
        .filter(p => {
          const ref = p.data_pagamento || p.created_date;
          if (!ref) return false;
          try {
            const d = ref.includes && ref.includes('T') ? toLocalDate(ref) : new Date(ref);
            return d && d >= SALDO_INICIO;
          } catch { return false; }
        })
        .reduce((s, p) => s + (p.valor_pago || 0), 0);
      // Positivo = empresa deve ao tecnico; negativo = tecnico recebeu a mais.
      const saldoTotal = totalComissoes - totalPagamentos;

      return { semanas, saldoTotal };
    },
    enabled: !!user?.email,
    staleTime: 60_000,
  });

  if (!user) return null;

  const semanas = data?.semanas || [];
  const saldoTotal = data?.saldoTotal || 0;
  const aReceber = saldoTotal > 0.01;
  const deve = saldoTotal < -0.01;

  return (
    <Card
      className="bg-[#152236] border border-white/5 shadow-sm rounded-2xl hover:border-white/10 transition-all cursor-pointer"
      onClick={() => navigate('/MeuFinanceiro')}
    >
      <CardHeader className="pb-3 px-4 sm:px-5 pt-4 sm:pt-5 border-b border-white/5">
        <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Histórico — últimas 4 semanas
          </span>
          <span className="text-[10px] text-blue-400 font-medium normal-case tracking-normal">Ver detalhes →</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-2">
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-gray-500 text-sm">Carregando...</div>
        ) : (
          <>
            {semanas.map((s, idx) => {
              const isAtual = idx === 0;
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-2.5 ${isAtual ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/[0.02] border border-white/5'}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${isAtual ? 'text-blue-400' : 'text-gray-500'}`}>
                        {s.label}
                      </span>
                      <span className="text-[10px] text-gray-500 truncate">
                        {format(s.inicio, "dd/MM", { locale: ptBR })} – {format(s.fim, "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold tabular-nums ${
                      s.pct >= 100 ? 'text-emerald-400' : s.pct >= 50 ? 'text-amber-400' : s.pct > 0 ? 'text-orange-400' : 'text-gray-500'
                    }`}>
                      {s.pct}%
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.pct >= 100 ? 'bg-emerald-500' : s.pct >= 50 ? 'bg-amber-500' : s.pct > 0 ? 'bg-orange-500' : 'bg-gray-600'
                      }`}
                      style={{ width: `${Math.max(s.pct, s.produzido > 0 ? 3 : 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">Feito:</span>
                      <span className="font-semibold text-gray-200">{fmt(s.produzido)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">Recebido:</span>
                      <span className="font-semibold text-emerald-400">{fmt(s.recebido)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Rodape: saldo total */}
            <div className={`mt-2 rounded-xl p-3 flex items-center justify-between border ${
              aReceber ? 'bg-emerald-500/10 border-emerald-500/30'
              : deve ? 'bg-red-500/10 border-red-500/30'
              : 'bg-white/[0.02] border-white/5'
            }`}>
              <div className="flex items-center gap-2">
                {aReceber && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                {deve && <TrendingDown className="w-4 h-4 text-red-400" />}
                <span className={`text-xs font-semibold ${aReceber ? 'text-emerald-300' : deve ? 'text-red-300' : 'text-gray-400'}`}>
                  {aReceber ? 'Você tem a receber' : deve ? 'Você deve' : 'Saldo zerado'}
                </span>
              </div>
              <span className={`text-base font-bold tabular-nums ${aReceber ? 'text-emerald-400' : deve ? 'text-red-400' : 'text-gray-300'}`}>
                {aReceber ? '+' : ''}{fmt(saldoTotal)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
