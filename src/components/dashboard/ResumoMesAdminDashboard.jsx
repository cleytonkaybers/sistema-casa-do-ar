import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function ResumoMesAdminDashboard({ servicosConcluidos, receita, despesas, comissoes }) {
  const lucroLiquido = receita - despesas - comissoes;

  return (
    <Card className="bg-[#152236] border-white/5 shadow-sm hover:border-white/10 transition-all rounded-2xl flex-1 flex flex-col">
      <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5">
        <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Resumo do Mês
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden divide-y divide-white/5">
        
        <div className="flex items-center justify-between p-4 px-5 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-sm font-medium text-gray-400">Serviços concluídos</span>
          <span className="text-sm font-bold text-emerald-400">{servicosConcluidos}</span>
        </div>

        <div className="flex items-center justify-between p-4 px-5 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-sm font-medium text-gray-400">Receita</span>
          <span className="text-sm font-bold text-emerald-400">{formatCurrency(receita)}</span>
        </div>

        <div className="flex items-center justify-between p-4 px-5 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-sm font-medium text-gray-400">Despesas</span>
          <span className="text-sm font-bold text-red-400">{formatCurrency(despesas)}</span>
        </div>

        <div className="flex items-center justify-between p-4 px-5 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-sm font-medium text-gray-400">Comissões</span>
          <span className="text-sm font-bold text-amber-500">{formatCurrency(comissoes)}</span>
        </div>

        <div className="flex items-center justify-between p-4 px-5 bg-[#0d1826]/50">
          <span className="text-sm font-bold text-blue-400">Lucro Líquido</span>
          <span className={`text-base font-bold ${lucroLiquido < 0 ? 'text-red-400 bg-red-400/10' : 'text-blue-400 bg-blue-400/10'} px-3 py-1 rounded-full`}>
            {lucroLiquido < 0 ? '-' : ''}{formatCurrency(Math.abs(lucroLiquido))}
          </span>
        </div>

      </CardContent>
    </Card>
  );
}
