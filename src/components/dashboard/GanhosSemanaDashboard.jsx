import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { getStartOfWeek, getEndOfWeek, toLocalDate } from '@/lib/dateUtils';

export default function GanhosSemanaDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: dadosSemana = { totalGanho: 0, valorPago: 0, creditoPendente: 0, saldo_total: 0, saldo_anterior: 0 } } = useQuery({
    queryKey: ['minhasComissoesWeek', user?.email],
    queryFn: async () => {
      if (!user?.email) return { totalGanho: 0, valorPago: 0, creditoPendente: 0, saldo_total: 0, saldo_anterior: 0 };
      try {
        const lancamentos = await base44.entities.LancamentoFinanceiro.list();
        const pagamentos = await base44.entities.PagamentoTecnico.list();
        const inicioSemana = getStartOfWeek();
        const fimSemana = getEndOfWeek();

        // Comissões da semana atual
        const comissoesSemana = lancamentos.filter(c => {
          if (c.tecnico_id !== user.email || !c.data_geracao) return false;
          try { const d = toLocalDate(c.data_geracao); return d && d >= inicioSemana && d <= fimSemana; } catch { return false; }
        });
        const totalGanho = comissoesSemana.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);

        // Pagamentos na semana atual
        const pagamentosSemana = pagamentos.filter(p => {
          if (p.tecnico_id !== user.email || p.status !== 'Confirmado' || !p.created_date) return false;
          try { const d = toLocalDate(p.created_date); return d && d >= inicioSemana && d <= fimSemana; } catch { return false; }
        });
        const valorPago = pagamentosSemana.reduce((sum, p) => sum + (p.valor_pago || 0), 0);

        // Saldo acumulado de todas as semanas anteriores (desde SALDO_INICIO)
        const SALDO_INICIO = new Date('2026-04-13T00:00:00');
        let saldo_anterior = 0;
        if (inicioSemana > SALDO_INICIO) {
          const comissoesAnt = lancamentos
            .filter(l => {
              if (l.tecnico_id !== user.email || !l.data_geracao) return false;
              try { const d = toLocalDate(l.data_geracao); return d && d >= SALDO_INICIO && d < inicioSemana; } catch { return false; }
            })
            .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

          const pagamentosAnt = pagamentos
            .filter(p => {
              if (p.tecnico_id !== user.email || p.status !== 'Confirmado' || !p.created_date) return false;
              try { const d = toLocalDate(p.created_date); return d && d >= SALDO_INICIO && d < inicioSemana; } catch { return false; }
            })
            .reduce((sum, p) => sum + (p.valor_pago || 0), 0);

          saldo_anterior = comissoesAnt - pagamentosAnt;
        }

        // Saldo em tempo real: semanas anteriores + semana atual
        const saldo_total = saldo_anterior + totalGanho - valorPago;
        const creditoPendente = Math.max(0, saldo_total);

        return { totalGanho, valorPago, creditoPendente, saldo_total, saldo_anterior };
      } catch (error) {
        console.error('Erro ao calcular ganhos:', error);
        return { totalGanho: 0, valorPago: 0, creditoPendente: 0, saldo_total: 0, saldo_anterior: 0 };
      }
    },
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnMount: true,
  });

  if (!user) return null;

  const totalGanho = dadosSemana.totalGanho ?? 0;
  const valorPago = dadosSemana.valorPago ?? 0;
  // Fallback: se cache antigo não tiver saldo_total, recalcula inline
  const saldo_total = dadosSemana.saldo_total ?? (totalGanho - valorPago);
  const saldoPositivo = saldo_total > 0.01;
  const saldoNegativo = saldo_total < -0.01;

  return (
    <Card
      className="bg-gradient-to-br from-emerald-50 to-green-50 border-green-200 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => navigate('/MeuFinanceiro')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-gray-700">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Ganhos da Semana
          </CardTitle>
          <DollarSign className="w-5 h-5 text-green-600" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Total ganho na semana */}
          <div className="text-3xl font-bold text-green-700 tabular-nums">
            R$ {totalGanho.toFixed(2)}
          </div>

          {/* Linha ganho / pago */}
          <div className="space-y-1.5 text-xs border-t border-green-200 pt-2">
            <div className="flex justify-between text-gray-600">
              <span>Total ganho:</span>
              <span className="font-semibold text-green-700">R$ {totalGanho.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Valor pago:</span>
              <span className="font-semibold text-blue-600">R$ {valorPago.toFixed(2)}</span>
            </div>
          </div>

          {/* Saldo em aberto — destaque principal */}
          <div className={`rounded-xl p-3 border ${
            saldoPositivo
              ? 'bg-emerald-100 border-emerald-400'
              : saldoNegativo
              ? 'bg-red-50 border-red-400'
              : 'bg-gray-100 border-gray-200'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              {saldoPositivo
                ? <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                : saldoNegativo
                ? <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                : <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
              }
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                saldoPositivo ? 'text-emerald-700'
                : saldoNegativo ? 'text-red-700'
                : 'text-gray-500'
              }`}>Saldo em Aberto</span>
            </div>

            <div className={`text-2xl font-bold tabular-nums ${
              saldoPositivo ? 'text-emerald-700'
              : saldoNegativo ? 'text-red-700'
              : 'text-gray-500'
            }`}>
              {saldoPositivo ? '+' : ''}R$ {saldo_total.toFixed(2)}
            </div>

            <p className={`text-[11px] mt-1 font-medium ${
              saldoPositivo ? 'text-emerald-600'
              : saldoNegativo ? 'text-red-600'
              : 'text-gray-400'
            }`}>
              {saldoPositivo
                ? '✓ A empresa te deve esse valor'
                : saldoNegativo
                ? '⚠ Você recebeu a mais — será descontado'
                : '— Sem pendências financeiras'}
            </p>
          </div>

          <Button className="w-full bg-green-600 hover:bg-green-700" size="sm">
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
