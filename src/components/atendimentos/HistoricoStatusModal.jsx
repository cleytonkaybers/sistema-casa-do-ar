import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function HistoricoStatusModal({ open, onClose, servicoId }) {
  const { data: historico = [], isLoading } = useQuery({
    queryKey: ['alteracoes-status', servicoId],
    queryFn: () => base44.entities.AlteracaoStatus.filter({ servico_id: servicoId }, '-data_alteracao'),
    enabled: open && !!servicoId,
  });

  const { data: servico } = useQuery({
    queryKey: ['servico', servicoId],
    queryFn: async () => {
      const servicos = await base44.entities.Servico.filter({ id: servicoId });
      return servicos[0];
    },
    enabled: open && !!servicoId,
  });

  const statusColors = {
    'aberto': 'bg-gray-100 text-gray-700 border-gray-200',
    'andamento': 'bg-blue-100 text-blue-700 border-blue-200',
    'concluido': 'bg-green-100 text-green-700 border-green-200',
    'pausado': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'reagendado': 'bg-orange-100 text-orange-700 border-orange-200'
  };

  const statusLabels = {
    'aberto': 'Aberto',
    'andamento': 'Em Andamento',
    'concluido': 'Concluído',
    'pausado': 'Pausado',
    'reagendado': 'Reagendado'
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800">
            Histórico de Alterações de Status
          </DialogTitle>
          {servico && (
            <p className="text-sm text-gray-500 mt-1">
              Cliente: <span className="font-medium text-gray-700">{servico.cliente_nome}</span>
            </p>
          )}
        </DialogHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhuma alteração de status registrada
            </div>
          ) : (
            <div className="space-y-4">
              {historico.map((item, index) => (
                <div 
                  key={item.id} 
                  className="relative pl-8 pb-6 border-l-2 border-gray-200 last:pb-0"
                >
                  {/* Timeline dot */}
                  <div className="absolute -left-[9px] top-0 w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />

                  {/* Card */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${statusColors[item.status_anterior]} border text-xs`}>
                            {statusLabels[item.status_anterior] || item.status_anterior}
                          </Badge>
                          <span className="text-gray-400">→</span>
                          <Badge className={`${statusColors[item.status_novo]} border text-xs`}>
                            {statusLabels[item.status_novo] || item.status_novo}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{item.usuario}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(new Date(item.data_alteracao), "dd/MM/yyyy", { locale: ptBR })}
                        <Clock className="w-4 h-4 text-gray-400 ml-2" />
                        {format(new Date(item.data_alteracao), "HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Informações do serviço concluído */}
          {servico && servico.status === 'concluido' && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-3">Informações da Conclusão</h3>
              <div className="space-y-2 text-sm">
                {servico.observacoes_conclusao && (
                  <div>
                    <span className="font-medium text-gray-700">Observações:</span>
                    <p className="text-gray-600 mt-1">{servico.observacoes_conclusao}</p>
                  </div>
                )}
                {servico.valor && (
                  <div>
                    <span className="font-medium text-gray-700">Valor:</span>
                    <span className="text-gray-600 ml-2">R$ {servico.valor.toFixed(2)}</span>
                  </div>
                )}
                {servico.tipo_servico && (
                  <div>
                    <span className="font-medium text-gray-700">Tipo de Serviço:</span>
                    <span className="text-gray-600 ml-2">{servico.tipo_servico}</span>
                  </div>
                )}
                {servico.descricao && (
                  <div>
                    <span className="font-medium text-gray-700">Descrição:</span>
                    <p className="text-gray-600 mt-1">{servico.descricao}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}