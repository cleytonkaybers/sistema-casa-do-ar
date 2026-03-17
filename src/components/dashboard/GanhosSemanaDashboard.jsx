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
  const [totalSemana, setTotalSemana] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
  }, []);

  const { data: minhasComissoes = [] } = useQuery({
    queryKey: ['minhasComissoesWeek', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      try {
        const todas = await base44.entities.LancamentoFinanceiro.list();
        const inicioSemana = getStartOfWeek();
        const fimSemana = getEndOfWeek();
        
        // Filtrar comissões pendentes do técnico da semana atual
        const comissoesSemana = todas.filter(c => {
          if (c.tecnico_id !== user.email || c.status !== 'pendente') return false;
          if (!c.data_geracao) return false;
          try {
            const dataGeracao = toLocalDate(c.data_geracao);
            if (!dataGeracao) return false;
            return dataGeracao >= inicioSemana && dataGeracao <= fimSemana;
          } catch {
            return false;
          }
        });

        // Calcular total diretamente
        const total = comissoesSemana.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);
        return total;
      } catch (error) {
        console.error('Erro ao calcular ganhos:', error);
        return 0;
      }
    },
    enabled: !!user?.email,
    staleTime: 30000 // Cache por 30 segundos
  });

  // Atualizar totalSemana apenas quando os dados mudarem
  useEffect(() => {
    if (typeof minhasComissoes === 'number') {
      setTotalSemana(minhasComissoes);
    }
  }, [minhasComissoes]);

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
          <div className="text-4xl font-bold text-green-700 tabular-nums">
            R$ {totalSemana.toFixed(2)}
          </div>

          {/* Subtítulo */}
          <div className="space-y-1 text-sm border-t border-green-200 pt-2">
            <div className="flex justify-between text-gray-600">
              <span>Ganhos da semana (segunda a domingo):</span>
              <span className="font-semibold text-green-600">R$ {totalSemana.toFixed(2)}</span>
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