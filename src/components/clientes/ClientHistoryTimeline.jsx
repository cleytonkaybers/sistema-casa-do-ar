import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wrench, CheckCircle, Clock, Pause } from 'lucide-react';
import { formatTipoServicoCompact } from '@/utils';

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
  'aberto': 'bg-gray-100 text-gray-700',
  'andamento': 'bg-blue-100 text-blue-700',
  'concluido': 'bg-green-100 text-green-700',
  'pausado': 'bg-yellow-100 text-yellow-700',
  'Aberto': 'bg-gray-100 text-gray-700',
  'Em Andamento': 'bg-blue-100 text-blue-700',
  'Concluído': 'bg-green-100 text-green-700',
  'Pausado': 'bg-yellow-100 text-yellow-700'
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
  ].sort((a, b) => new Date(b.data) - new Date(a.data));

  if (historico.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-md">
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Nenhum histórico de serviços ou atendimentos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">📋 Histórico de Serviços e Atendimentos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {historico.map((item, index) => {
            const Icon = statusIcons[item.status] || Clock;
            return (
              <div key={item.id} className="flex gap-4">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    item.status === 'concluido' || item.status === 'Concluído'
                      ? 'bg-green-100'
                      : 'bg-blue-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      item.status === 'concluido' || item.status === 'Concluído'
                        ? 'text-green-600'
                        : 'text-blue-600'
                    }`} />
                  </div>
                  {index !== historico.length - 1 && (
                    <div className="w-1 h-8 bg-gradient-to-b from-blue-200 to-transparent mt-2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-800">{item.titulo}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge className={`${statusCores[item.status]} border text-xs`}>
                        {item.status}
                      </Badge>
                    </div>

                    {item.descricao && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.descricao}</p>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {item.tipo === 'servico' ? '🔧 Serviço' : '📝 Atendimento'}
                      </span>
                      {item.valor && (
                        <span className="font-semibold text-green-600">
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