import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wrench, CheckCircle, Clock, Pause } from 'lucide-react';
import { formatTipoServicoCompact } from '@/utils';
import { parseHistoricoData } from '@/lib/dateUtils';

const statusIcons = {
  'aberto': Clock,
  'andamento': Wrench,
  'concluido': CheckCircle,
  'pausado': Pause,
  'Aberto': Clock,
  'Em Andamento': Wrench,
  'Concluído': CheckCircle,
  'Pausado': Pause
};

const statusCores = {
  'aberto': 'bg-white/5 text-gray-300 border-white/10',
  'andamento': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'concluido': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'pausado': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Aberto': 'bg-white/5 text-gray-300 border-white/10',
  'Em Andamento': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Concluído': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Pausado': 'bg-amber-500/15 text-amber-300 border-amber-500/30'
};

export default function ClientHistoryTimeline({ servicos, atendimentos }) {
  // Combinar e ordenar por data
  const historico = [
    ...servicos.map(s => ({
      id: `s-${s.id}`,
      tipo: 'servico',
      data: s.data_programada,
      titulo: formatTipoServicoCompact(s.tipo_servico),
      status: s.status,
      valor: s.valor,
      descricao: s.descricao
    })),
    ...atendimentos.map(a => ({
      id: `a-${a.id}`,
      tipo: 'atendimento',
      data: a.data_atendimento,
      titulo: formatTipoServicoCompact(a.tipo_servico),
      status: a.status,
      valor: a.valor,
      descricao: a.descricao
    }))
  ].sort((a, b) => (parseHistoricoData(b.data)?.getTime() || 0) - (parseHistoricoData(a.data)?.getTime() || 0));

  if (historico.length === 0) {
    return (
      <Card className="bg-[#152236] border border-white/5 shadow-md">
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Nenhum histórico de serviços ou atendimentos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#152236] border border-white/5 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg text-gray-200">📋 Histórico de Serviços e Atendimentos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {historico.map((item, index) => {
            const Icon = statusIcons[item.status] || Clock;
            const concluido = item.status === 'concluido' || item.status === 'Concluído';
            return (
              <div key={item.id} className="flex gap-4">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                    concluido ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-blue-500/20 border-blue-500/30'
                  }`}>
                    <Icon className={`w-5 h-5 ${concluido ? 'text-emerald-300' : 'text-blue-300'}`} />
                  </div>
                  {index !== historico.length - 1 && (
                    <div className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent mt-2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="bg-[#0f1a2b] border border-white/5 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-200">{item.titulo}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {(() => { const d = parseHistoricoData(item.data); return d ? format(d, 'dd/MM/yyyy', { locale: ptBR }) : '—'; })()}
                        </p>
                      </div>
                      <Badge className={`${statusCores[item.status]} border text-xs`}>
                        {item.status}
                      </Badge>
                    </div>

                    {item.descricao && (
                      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{item.descricao}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {item.tipo === 'servico' ? '🔧 Serviço' : '📝 Atendimento'}
                      </span>
                      {item.valor && (
                        <span className="font-semibold text-emerald-400">
                          R$ {item.valor.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}