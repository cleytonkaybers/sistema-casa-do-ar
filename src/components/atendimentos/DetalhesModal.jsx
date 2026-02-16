import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  User,
  Wrench,
  DollarSign,
  Clock,
  FileText,
  MessageSquare,
  Tag
} from 'lucide-react';

const statusColors = {
  'Aberto': 'bg-gray-100 text-gray-700 border-gray-200',
  'Em Andamento': 'bg-blue-100 text-blue-700 border-blue-200',
  'Agendado': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Reagendado': 'bg-orange-100 text-orange-700 border-orange-200',
  'Concluído': 'bg-green-100 text-green-700 border-green-200'
};

export default function DetalhesModal({ open, onClose, atendimento }) {
  if (!atendimento) return null;

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Detalhes do Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-semibold text-lg">
              {atendimento.cliente_nome?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5" />
                Cliente
              </p>
              <p className="text-lg font-semibold text-gray-800">
                {atendimento.cliente_nome || 'Cliente não identificado'}
              </p>
            </div>
            <Badge className={atendimento.origem === 'servico' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-cyan-100 text-cyan-700 border-cyan-200'}>
              {atendimento.origem === 'servico' ? 'Serviço' : 'Atendimento'}
            </Badge>
          </div>

          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
                <Calendar className="w-4 h-4" />
                Data do Atendimento
              </p>
              <p className="font-medium text-gray-800">
                {format(new Date(atendimento.data_atendimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            {/* Horário */}
            {atendimento.horario && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
                  <Clock className="w-4 h-4" />
                  Horário
                </p>
                <p className="font-medium text-gray-800">{atendimento.horario}</p>
              </div>
            )}

            {/* Dia da Semana */}
            {atendimento.dia_semana && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
                  <Tag className="w-4 h-4" />
                  Dia da Semana
                </p>
                <p className="font-medium text-gray-800">{atendimento.dia_semana}</p>
              </div>
            )}

            {/* Valor */}
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
                <DollarSign className="w-4 h-4" />
                Valor
              </p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(atendimento.valor)}
              </p>
            </div>
          </div>

          {/* Tipo de Serviço */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
              <Wrench className="w-4 h-4" />
              Tipo de Serviço
            </p>
            <p className="font-medium text-gray-800">{atendimento.tipo_servico}</p>
          </div>

          {/* Status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
              Status Atual
            </p>
            <Badge className={`${statusColors[atendimento.status]} border text-base px-3 py-1`}>
              {atendimento.status}
            </Badge>
          </div>

          {/* Descrição */}
          {atendimento.descricao && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4" />
                Descrição
              </p>
              <p className="text-gray-700 whitespace-pre-wrap">{atendimento.descricao}</p>
            </div>
          )}

          {/* Observações */}
          {atendimento.observacoes && (
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-4 h-4" />
                Observações
              </p>
              <p className="text-gray-700 whitespace-pre-wrap">{atendimento.observacoes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}