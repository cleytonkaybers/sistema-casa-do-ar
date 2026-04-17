import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp } from 'lucide-react';
import { getLocalDate, getStartOfWeek, getEndOfWeek, toLocalDate } from '@/lib/dateUtils';

export default function GanhosSemanaDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: dadosSemana = { totalGanho: 0, valorPago: 0, creditoPendente: 0, adiantamento_anterior: 0 } } = useQuery({
    queryKey: ['minhasComissoesWeek', user?.email],
    queryFn: async () => {
      if (!user?.email) return { totalGanho: 0, valorPago: 0, creditoPendente: 0 };
      try {
        const lancamentos = await base44.entities.LancamentoFinanceiro.list();
        const pagamentos = await base44.entities.PagamentoTecnico.list();
        const inicioSemana = getStartOfWeek();
        const fimSemana = getEndOfWeek();
        
        // Filtrar comissões do técnico da semana atual
        const comissoesSemana = lancamentos.filter(c => {
          if (c.tecnico_id !== user.email) return false;
          if (!c.data_geracao) return false;
          try {
            const dataGeracao = toLocalDate(c.data_geracao);
            if (!dataGeracao) return false;
            return dataGeracao >= inicioSemana && dataGeracao <= fimSemana;
          } catch {
            return false;
          }
        });

        // Calcular total de comissões ganhas na semana
        const totalGanho = comissoesSemana.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);

        // Calcular pagamentos feitos ao técnico na semana
        const pagamentosSemana = pagamentos.filter(p => {
          if (p.tecnico_id !== user.email) return false;
          if (p.status !== 'Confirmado') return false;
          if (!p.created_date) return false;
          try {
            const dataPagamento = toLocalDate(p.created_date);
            if (!dataPagamento) return false;
            return dataPagamento >= inicioSemana && dataPagamento <= fimSemana;
          } catch {
            return false;
          }
        });

        const valorPago = pagamentosSemana.reduce((sum, p) => sum + (p.valor_pago || 0), 0);

        // Adiantamento: rastreamento começa a partir da semana 2026-04-20
        const ADIANTAMENTO_INICIO = new Date('2026-04-20T00:00:00');
        const inicioPreviousSemana = new Date(inicioSemana);
        inicioPreviousSemana.setDate(inicioPreviousSemana.getDate() - 7);

        let adiantamento_anterior = 0;
        if (inicioPreviousSemana >= ADIANTAMENTO_INICIO) {
          const comissoesSemanaAnterior = lancamentos
            .filter(l => {
              if (l.tecnico_id !== user.email || !l.data_geracao) return false;
              try { const d = toLocalDate(l.data_geracao); return d >= inicioPreviousSemana && d < inicioSemana; } catch { return false; }
            })
            .reduce((sum, l) => sum + (l.valor_comissao_tecnico || 0), 0);

          const pagamentosSemanaAnterior = pagamentos
            .filter(p => {
              if (p.tecnico_id !== user.email || p.status !== 'Confirmado' || !p.created_date) return false;
              try { const d = toLocalDate(p.created_date); return d >= inicioPreviousSemana && d < inicioSemana; } catch { return false; }
            })
            .reduce((sum, p) => sum + (p.valor_pago || 0), 0);

          adiantamento_anterior = Math.max(0, pagamentosSemanaAnterior - comissoesSemanaAnterior);
        }
        const creditoPendente = Math.max(0, totalGanho - valorPago - adiantamento_anterior);

        return { totalGanho, valorPago, creditoPendente, adiantamento_anterior };
      } catch (error) {
        console.error('Erro ao calcular ganhos:', error);
        return { totalGanho: 0, valorPago: 0, creditoPendente: 0 };
      }
    },
    enabled: !!user?.email,
    staleTime: 30000 // Cache por 30 segundos
  });

  if (!user) return null;

  return (
    <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-green-200 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/MeuFinanceiro')}>
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
          {/* Valor principal */}
          <div className="text-3xl font-bold text-green-700 tabular-nums">
            R$ {dadosSemana.totalGanho.toFixed(2)}
          </div>

          {/* Detalhes */}
          <div className="space-y-1.5 text-xs border-t border-green-200 pt-2">
            <div className="flex justify-between text-gray-600">
              <span>Total ganho:</span>
              <span className="font-semibold text-green-700">R$ {dadosSemana.totalGanho.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Valor pago:</span>
              <span className="font-semibold text-blue-600">R$ {dadosSemana.valorPago.toFixed(2)}</span>
            </div>
            {dadosSemana.adiantamento_anterior > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Adiantamento anterior:</span>
                <span className="font-semibold text-orange-600">- R$ {dadosSemana.adiantamento_anterior.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>A receber:</span>
              <span className="font-semibold text-amber-600">R$ {dadosSemana.creditoPendente.toFixed(2)}</span>
            </div>
          </div>

          {/* Botão de ação */}
          <Button className="w-full mt-2 bg-green-600 hover:bg-green-700" size="sm">
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}