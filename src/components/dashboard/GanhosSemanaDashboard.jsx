import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp } from 'lucide-react';
import { getLocalDate, getStartOfWeek, getEndOfWeek, toLocalDate } from '@/lib/dateUtils';

export default function GanhosSemanaDashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
  }, []);

  const { data: dadosSemana = { totalGanho: 0, valorPago: 0, creditoPendente: 0 } } = useQuery({
    queryKey: ['minhasComissoesWeek', user?.email],
    queryFn: async () => {
      if (!user?.email) return { totalGanho: 0, valorPago: 0, creditoPendente: 0 };
      try {
        const todas = await base44.entities.LancamentoFinanceiro.list();
        const inicioSemana = getStartOfWeek();
        const fimSemana = getEndOfWeek();
        
        // Filtrar comissões do técnico da semana atual
        const comissoesSemana = todas.filter(c => {
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

        // Calcular valores
        const totalGanho = comissoesSemana.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);
        const valorPago = comissoesSemana
          .filter(c => c.status === 'pago')
          .reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);
        const creditoPendente = comissoesSemana
          .filter(c => c.status === 'pendente' || c.status === 'creditado')
          .reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);

        return { totalGanho, valorPago, creditoPendente };
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
            <div className="flex justify-between text-gray-600">
              <span>Crédito pendente:</span>
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