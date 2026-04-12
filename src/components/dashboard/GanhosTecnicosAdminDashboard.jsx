import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function GanhosTecnicosAdminDashboard({ tecnicos }) {
  // Sort technicians so the ones with pending credit are on top
  const sortedTecnicos = [...tecnicos].sort((a, b) => b.credito_pendente - a.credito_pendente);

  return (
    <Card className="bg-[#152236] border-white/5 shadow-sm hover:border-white/10 transition-all rounded-2xl flex-1 flex flex-col">
      <CardHeader className="pb-3 px-5 pt-5 border-b border-white/5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-gray-200 tracking-wide flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          Desempenho da Semana dos Técnicos
        </CardTitle>
        <Link to="/FinanceiroAdmin" className="text-xs text-blue-400 hover:text-blue-300 font-medium">Ver Completo</Link>
      </CardHeader>
      <CardContent className="p-0 overflow-y-auto max-h-[300px]">
        {sortedTecnicos.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">Nenhum dado financeiro esta semana</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sortedTecnicos.map((tec) => (
              <div key={tec.id || tec.tecnico_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/5 transition-colors gap-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-gray-200">{tec.tecnico_nome}</span>
                  <span className="text-xs text-gray-500">{tec.equipe_nome || 'Sem equipe'}</span>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  <div className="flex flex-col min-w-[90px]">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Ganho Bruto</span>
                    <span className="text-sm font-bold text-gray-200">{formatCurrency(tec.total_ganho)}</span>
                  </div>
                  
                  <div className="flex flex-col min-w-[90px]">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Já Pago</span>
                    <span className="text-sm font-bold text-blue-400">{formatCurrency(tec.credito_pago)}</span>
                  </div>

                  <div className="flex flex-col min-w-[90px] items-end">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-0.5">Pendente</span>
                    <Badge variant="outline" className={`${tec.credito_pendente > 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                      {formatCurrency(tec.credito_pendente)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
