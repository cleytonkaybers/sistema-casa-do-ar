import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function ResumoMesAdminDashboard({ servicosConcluidos, faturadoMes, faturadoSemana, recebidoMes, recebidoSemana, comissoes }) {
  const lucroLiquido = faturadoMes - comissoes;

  return (
    <Card className="bg-[#152236] border-white/5 shadow-sm hover:border-white/10 transition-all rounded-2xl flex-1 flex flex-col">
      <CardHeader className="pb-3 px-4 sm:px-5 pt-4 sm:pt-5 border-b border-white/5">
        <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Resumo do Mês
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0 overflow-hidden divide-y divide-white/5">
        {/* Serviços concluídos */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-xs sm:text-sm font-medium text-gray-400">Serviços concluídos</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-400">{servicosConcluidos}</span>
        </div>

        {/* Receita (faturado bruto do mês) */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-xs sm:text-sm font-medium text-gray-400">Receita (Faturado)</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-400">{formatCurrency(faturadoMes)}</span>
        </div>

        {/* Pago a Técnicos */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-xs sm:text-sm font-medium text-gray-400">Pago a Técnicos</span>
          <span className="text-xs sm:text-sm font-bold text-amber-500">{formatCurrency(comissoes)}</span>
        </div>

        {/* Lucro líquido */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-[#0d1826]/50">
          <span className="text-sm font-bold text-blue-400">Lucro Líquido</span>
          <span className={`text-sm sm:text-base font-bold px-2 sm:px-3 py-1 rounded-full ${
            lucroLiquido < 0
              ? 'text-red-400 bg-red-400/10'
              : 'text-blue-400 bg-blue-400/10'
          }`}>
            {lucroLiquido < 0 ? '-' : ''}{formatCurrency(Math.abs(lucroLiquido))}
          </span>
        </div>

        {/* Separador de seção */}
        <div className="px-4 sm:px-5 py-2 bg-[#0d1826]/30">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Faturado</span>
        </div>

        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-xs sm:text-sm font-medium text-gray-400">Esta semana</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-400">{formatCurrency(faturadoSemana)}</span>
        </div>

        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-xs sm:text-sm font-medium text-gray-400">Este mês</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-400">{formatCurrency(faturadoMes)}</span>
        </div>

        {/* Separador de seção */}
        <div className="px-4 sm:px-5 py-2 bg-[#0d1826]/30">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Recebido</span>
        </div>

        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-xs sm:text-sm font-medium text-gray-400">Esta semana</span>
          <span className="text-xs sm:text-sm font-bold text-sky-400">{formatCurrency(recebidoSemana)}</span>
        </div>

        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-xs sm:text-sm font-medium text-gray-400">Este mês</span>
          <span className="text-xs sm:text-sm font-bold text-sky-400">{formatCurrency(recebidoMes)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
