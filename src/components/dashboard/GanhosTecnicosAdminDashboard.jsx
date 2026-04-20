import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function GanhosTecnicosAdminDashboard({ tecnicos, totalGanhoSemana, totalPagoSemana, totalPendente }) {
  const sortedTecnicos = [...tecnicos].sort((a, b) => (b.saldo_total ?? b.credito_pendente) - (a.saldo_total ?? a.credito_pendente));

  const totalDevendo = tecnicos.reduce((s, t) => s + (t.saldo_total < 0 ? Math.abs(t.saldo_total) : 0), 0);

  return (
    <Card className="bg-[#152236] border-white/5 shadow-sm hover:border-white/10 transition-all rounded-2xl flex-1 flex flex-col">
      <CardHeader className="pb-3 px-4 sm:px-5 pt-4 sm:pt-5 border-b border-white/5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          Ganhos dos Técnicos
        </CardTitle>
        <Link to="/FinanceiroAdmin" className="text-xs text-blue-400 hover:text-blue-300 font-medium shrink-0">
          Ver Completo
        </Link>
      </CardHeader>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-4 divide-x divide-white/5 border-b border-white/5">
        <div className="flex flex-col items-center justify-center px-2 py-3 gap-0.5">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] uppercase font-bold tracking-wider text-gray-500">Semana</span>
          </div>
          <span className="text-sm font-bold text-emerald-400 tabular-nums">{fmt(totalGanhoSemana)}</span>
          <span className="text-[9px] text-gray-600">ganho total</span>
        </div>

        <div className="flex flex-col items-center justify-center px-2 py-3 gap-0.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Wallet className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] uppercase font-bold tracking-wider text-gray-500">Pago</span>
          </div>
          <span className="text-sm font-bold text-blue-400 tabular-nums">{fmt(totalPagoSemana)}</span>
          <span className="text-[9px] text-gray-600">esta semana</span>
        </div>

        <div className="flex flex-col items-center justify-center px-2 py-3 gap-0.5">
          <div className="flex items-center gap-1 mb-0.5">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span className="text-[9px] uppercase font-bold tracking-wider text-gray-500">A Pagar</span>
          </div>
          <span className="text-sm font-bold text-amber-400 tabular-nums">{fmt(totalPendente)}</span>
          <span className="text-[9px] text-gray-600">crédito pendente</span>
        </div>

        <div className="flex flex-col items-center justify-center px-2 py-3 gap-0.5">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingDown className="w-3 h-3 text-red-400" />
            <span className="text-[9px] uppercase font-bold tracking-wider text-gray-500">Débitos</span>
          </div>
          <span className="text-sm font-bold text-red-400 tabular-nums">{fmt(totalDevendo)}</span>
          <span className="text-[9px] text-gray-600">técnicos devem</span>
        </div>
      </div>

      {/* Lista por técnico */}
      <CardContent className="p-0 overflow-y-auto max-h-[300px]">
        {sortedTecnicos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">Nenhum dado financeiro disponível</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sortedTecnicos.map((tec) => {
              const saldo = tec.saldo_total ?? 0;
              const saldoPositivo = saldo > 0.01;
              const saldoNegativo = saldo < -0.01;
              return (
                <div
                  key={tec.id || tec.tecnico_id}
                  className={`px-4 sm:px-5 py-3 transition-colors ${
                    saldoPositivo ? 'bg-emerald-900/20 hover:bg-emerald-900/30'
                    : saldoNegativo ? 'bg-red-900/20 hover:bg-red-900/30'
                    : 'hover:bg-white/5'
                  }`}
                >
                  {/* Nome + saldo badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-200 truncate">{tec.tecnico_nome}</p>
                      <p className="text-[11px] text-gray-500 truncate">{tec.equipe_nome || 'Sem equipe'}</p>
                    </div>
                    {/* Saldo em aberto */}
                    <div className="ml-3 shrink-0 text-right">
                      <div className={`text-sm font-bold tabular-nums ${
                        saldoPositivo ? 'text-emerald-400'
                        : saldoNegativo ? 'text-red-400'
                        : 'text-gray-500'
                      }`}>
                        {saldoPositivo ? '+' : ''}{fmt(saldo)}
                      </div>
                      <div className={`text-[9px] font-semibold ${
                        saldoPositivo ? 'text-emerald-500'
                        : saldoNegativo ? 'text-red-500'
                        : 'text-gray-600'
                      }`}>
                        {saldoPositivo ? '▲ a receber' : saldoNegativo ? '▼ recebeu a mais' : '— zerado'}
                      </div>
                    </div>
                  </div>

                  {/* Bruto semana | Pago semana | A receber */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-gray-600">Bruto sem.</span>
                      <span className="text-xs font-semibold text-gray-300">{fmt(tec.total_ganho)}</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-gray-600">Pago sem.</span>
                      <span className="text-xs font-semibold text-blue-400">{fmt(tec.credito_pago)}</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-gray-600">Crédito pend.</span>
                      <span className={`text-xs font-bold ${tec.credito_pendente > 0.01 ? 'text-amber-400' : 'text-gray-500'}`}>
                        {fmt(tec.credito_pendente)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
