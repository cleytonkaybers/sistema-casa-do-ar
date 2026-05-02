import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { startOfWeek, endOfWeek, subWeeks, format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

// Mesmo parseDateSafe usado em MeuFinanceiro: parseISO trata corretamente
// strings tanto "yyyy-MM-dd" (sem fuso) quanto ISO completo, evitando shift
// de timezone que fazia pagamentos cairem na semana errada.
function parseDateSafe(str) {
  if (!str) return null;
  try {
    const d = parseISO(str);
    return isValid(d) ? d : null;
  } catch { return null; }
}

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

      const hoje = new Date();
      // Ultimas 4 semanas (atual + 3 anteriores)
      const semanas = Array.from({ length: 4 }, (_, i) => {
        const ref = subWeeks(hoje, i);
        const inicio = startOfWeek(ref, { weekStartsOn: 1 });
        const fim = endOfWeek(ref, { weekStartsOn: 1 });
        // Compara como string yyyy-MM-dd para evitar problemas de fuso —
        // mesma logica de MeuFinanceiro.
        const inicioStr = format(inicio, 'yyyy-MM-dd');
        const fimStr = format(fim, 'yyyy-MM-dd');

        const produzido = meusLancamentos
          .filter(l => {
            const d = parseDateSafe(l.data_geracao);
            if (!d) return false;
            const ds = format(d, 'yyyy-MM-dd');
            return ds >= inicioStr && ds <= fimStr;
          })
          .reduce((s, l) => s + (l.valor_comissao_tecnico || 0), 0);

        const recebido = meusPagamentos
          .filter(p => {
            const d = parseDateSafe(p.data_pagamento) || parseDateSafe(p.created_date);
            if (!d) return false;
            const ds = format(d, 'yyyy-MM-dd');
            return ds >= inicioStr && ds <= fimStr;
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

      return { semanas };
    },
    enabled: !!user?.email,
    staleTime: 60_000,
  });

  if (!user) return null;

  const semanas = data?.semanas || [];

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

          </>
        )}
      </CardContent>
    </Card>
  );
}
