import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTipoServicoCompact } from '@/utils';
import { 
  Calendar, 
  Wrench, 
  DollarSign, 
  Plus,
  FileText,
  Clock
} from 'lucide-react';

const statusColors = {
  'Agendado': 'bg-blue-100 text-blue-700 border-blue-200',
  'Em Andamento': 'bg-amber-100 text-amber-700 border-amber-200',
  'Concluído': 'bg-green-100 text-green-700 border-green-200',
  'Cancelado': 'bg-gray-100 text-gray-700 border-gray-200'
};

export default function HistoricoModal({ open, onClose, cliente, atendimentos, onNewAtendimento }) {
  const clienteAtendimentos = atendimentos?.filter(a => a.cliente_id === cliente?.id) || [];

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-800">
                Histórico de Atendimentos
              </DialogTitle>
              {cliente && (
                <p className="text-sm text-gray-500 mt-1">
                  Cliente: <span className="font-medium text-gray-700">{cliente.nome}</span>
                </p>
              )}
            </div>
            <Button
              onClick={onNewAtendimento}
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {clienteAtendimentos.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">Nenhum atendimento registrado</p>
              <Button
                onClick={onNewAtendimento}
                variant="outline"
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Registrar primeiro atendimento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {clienteAtendimentos
                .sort((a, b) => new Date(b.data_atendimento) - new Date(a.data_atendimento))
                .map((atendimento) => (
                  <div
                    key={atendimento.id}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Wrench className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-800">{formatTipoServicoCompact(atendimento.tipo_servico)}</h4>
                          <div className="flex items-center gap-1.5 text-sm text-gray-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(atendimento.data_atendimento), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </div>
                      </div>
                      <Badge className={`${statusColors[atendimento.status]} border`}>
                        {atendimento.status}
                      </Badge>
                    </div>

                    {atendimento.descricao && (
                      <p className="text-sm text-gray-600 mb-3">{atendimento.descricao}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        Criado em {format(new Date(atendimento.created_date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      {atendimento.valor && (
                        <div className="flex items-center gap-1.5 font-medium text-green-600">
                          <DollarSign className="w-4 h-4" />
                          {formatCurrency(atendimento.valor)}
                        </div>
                      )}
                    </div>

                    {atendimento.observacoes && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Obs:</span> {atendimento.observacoes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}