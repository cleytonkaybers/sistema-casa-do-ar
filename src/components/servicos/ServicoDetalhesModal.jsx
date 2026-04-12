import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Calendar, MessageCircle, Navigation, Clock, DollarSign, CreditCard, CheckCircle, Play, CalendarClock, FileText } from 'lucide-react';

const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

const getStatusConfig = (status) => {
  switch(status) {
    case 'concluido': return { label: 'Concluído', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle };
    case 'andamento': return { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Play };
    case 'agendado': return { label: 'Agendado', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Calendar };
    case 'reagendado': return { label: 'Reagendado', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: CalendarClock };
    default: return { label: 'Aberto', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
  }
};

export default function ServicoDetalhesModal({ open, onClose, servico }) {
  if (!servico) return null;

  const statusConfig = getStatusConfig(servico.status || 'aberto');
  const StatusIcon = statusConfig.icon;

  const whatsappLink = `https://wa.me/55${servico.telefone?.replace(/\D/g, '') || ''}`;
  const mapsLink = servico.google_maps_link || (servico.latitude && servico.longitude
    ? `https://www.google.com/maps?q=${servico.latitude},${servico.longitude}`
    : servico.endereco
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(servico.endereco)}`
    : null);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-800">Detalhes do Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 text-white">
            <h3 className="font-bold text-xl">{servico.cliente_nome}</h3>
            <p className="text-white/80 text-sm mt-1">{servico.tipo_servico}</p>
            <div className="mt-2">
              <Badge className={`${statusConfig.color} border`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
          </div>

          {/* Detalhes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="font-medium">{formatPhone(servico.telefone)}</span>
              </div>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            </div>

            {servico.cpf && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span>CPF: {servico.cpf}</span>
              </div>
            )}

            {servico.endereco && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{servico.endereco}</span>
              </div>
            )}

            {mapsLink && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors font-semibold border border-blue-200 w-full"
              >
                <Navigation className="w-4 h-4" />
                <span className="text-sm">📍 Ver no Google Maps</span>
              </a>
            )}

            <div className="flex flex-wrap gap-2">
              {servico.dia_semana && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                  <Calendar className="w-4 h-4" />
                  {servico.dia_semana}
                </div>
              )}
              {servico.data_programada && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                  <Calendar className="w-4 h-4" />
                  {servico.data_programada}
                </div>
              )}
              {servico.horario && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                  <Clock className="w-4 h-4" />
                  {servico.horario}
                </div>
              )}
              {servico.valor > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg font-semibold">
                  <DollarSign className="w-4 h-4" />
                  R$ {servico.valor.toFixed(2)}
                </div>
              )}
            </div>

            {servico.descricao && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  Descrição
                </div>
                <p className="text-sm text-gray-700">{servico.descricao}</p>
              </div>
            )}

            {servico.observacoes_conclusao && (
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="flex items-center gap-1.5 text-xs text-green-600 mb-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Observações de Conclusão
                </div>
                <p className="text-sm text-green-800">{servico.observacoes_conclusao}</p>
              </div>
            )}

            {servico.usuario_atualizacao_status && (
              <div className="text-xs text-gray-400 text-right">
                Última atualização por: {servico.usuario_atualizacao_status}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}