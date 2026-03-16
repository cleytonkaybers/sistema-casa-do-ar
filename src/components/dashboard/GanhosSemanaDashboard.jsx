import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DollarSign, TrendingUp } from 'lucide-react';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function GanhosSemanaDashboard() {
  const [user, setUser] = useState(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [ganhosDetalhes, setGanhosDetalhes] = useState({ pendente: 0, pago: 0, total: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => setUser(u));
  }, []);

  const { data: minhasComissoes = [] } = useQuery({
    queryKey: ['minhasComissoesWeek', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const todas = await base44.entities.LancamentoFinanceiro.list();
      return todas.filter(c => c.tecnico_id === user.email);
    },
    enabled: !!user?.email
  });

  const { data: meusPagamentos = [] } = useQuery({
    queryKey: ['pagamentosSemana', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const todos = await base44.entities.PagamentoTecnico.list();
      return todos.filter(p => p.tecnico_id === user.email && p.status === 'Confirmado');
    },
    enabled: !!user?.email
  });

  // Calcular ganhos da semana (segunda 00:00 até domingo 23:59)
  useEffect(() => {
    const hoje = new Date();
    const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 }); // 1 = Segunda-feira
    const fimSemana = endOfWeek(hoje, { weekStartsOn: 1 });

    const comissoesSemana = minhasComissoes.filter(c => {
      if (!c.data_geracao) return false;
      try {
        const dataReferencia = new Date(c.data_geracao);
        const dentroDaSemana = dataReferencia >= inicioSemana && dataReferencia <= fimSemana;
        return c.status === 'pendente' && dentroDaSemana;
      } catch (e) {
        return false;
      }
    });

    // Filtrar pagamentos da semana atual
    const pagamentosSemana = meusPagamentos.filter(p => {
      if (!p.data_pagamento) return false;
      try {
        const dataPagamento = new Date(p.data_pagamento);
        return dataPagamento >= inicioSemana && dataPagamento <= fimSemana;
      } catch (e) {
        return false;
      }
    });

    const pendente = comissoesSemana.reduce((sum, c) => sum + (c.valor_comissao_tecnico || 0), 0);
    const pago = pagamentosSemana.reduce((sum, p) => sum + (p.valor_pago || 0), 0);
    const total = pendente + pago;

    setGanhosDetalhes({ pendente, pago, total, pagamentosSemana: pagamentosSemana.length });

    // Animar contador
    let current = 0;
    const increment = total / 30; // 30 frames para 800ms
    const timer = setInterval(() => {
      current += increment;
      if (current >= total) {
        setDisplayValue(total);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, 27); // ~800ms total

    return () => clearInterval(timer);
  }, [minhasComissoes, meusPagamentos]);

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
          {/* Valor principal animado */}
          <div className="text-4xl font-bold text-green-700 tabular-nums">
            R$ {displayValue.toFixed(2)}
          </div>

          {/* Subtítulo com breakdown */}
          <div className="space-y-1 text-sm border-t border-green-200 pt-2">
            <div className="flex justify-between text-gray-600">
              <span>Pendente:</span>
              <span className="font-semibold text-amber-600">R$ {ganhosDetalhes.pendente?.toFixed(2) || '0.00'}</span>
            </div>
            {ganhosDetalhes.pago > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Pago (semana):</span>
                <span className="font-semibold text-green-600">R$ {ganhosDetalhes.pago?.toFixed(2) || '0.00'}</span>
              </div>
            )}
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