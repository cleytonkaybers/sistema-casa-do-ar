import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Calendar, Pencil, Trash2, MessageCircle, Navigation, Clock, DollarSign, Share2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function ServicoCard({ servico, onEdit, onDelete, onStatusChange, compact = false }) {
  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getWhatsAppLink = (phone) => {
    const cleaned = phone?.replace(/\D/g, '') || '';
    return `https://wa.me/55${cleaned}`;
  };

  const getGoogleMapsLink = () => {
    if (servico.latitude && servico.longitude) {
      return `https://www.google.com/maps?q=${servico.latitude},${servico.longitude}`;
    }
    if (servico.endereco) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(servico.endereco)}`;
    }
    return null;
  };

  const handleShare = async () => {
    const mapsLink = getGoogleMapsLink();
    const shareText = `📋 *${servico.cliente_nome}* - ${servico.tipo_servico}\n\n📞 Telefone: ${formatPhone(servico.telefone)}\n\n📍 Localização: ${servico.endereco || 'Não informado'}\n${mapsLink ? `🗺️ ${mapsLink}\n` : ''}\n${servico.dia_semana ? `📅 ${servico.dia_semana}` : ''}\n${servico.horario ? `🕐 ${servico.horario}` : ''}\n${servico.descricao ? `📝 ${servico.descricao}` : ''}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Serviço: ${servico.cliente_nome}`, text: shareText });
      } catch (error) {
        if (error.name !== 'AbortError') {
          navigator.clipboard.writeText(shareText);
          toast.success('Informações copiadas!');
        }
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Informações copiadas!');
    }
  };

  const mapsLink = getGoogleMapsLink();
  const getTipoColor = (tipo) => {
    if (tipo?.startsWith('Limpeza')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (tipo?.startsWith('Instalação')) {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    if (tipo?.includes('capacitor') || tipo?.includes('gás') || tipo?.includes('defeito')) {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-800 truncate">{servico.cliente_nome}</h4>
            <p className="text-xs text-gray-500 truncate">{servico.tipo_servico}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="h-8 w-8 text-gray-400 hover:text-blue-600 flex-shrink-0"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs">{formatPhone(servico.telefone)}</span>
          </div>
          
          {servico.horario && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs">{servico.horario}</span>
            </div>
          )}

          {servico.valor > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-xs">R$ {servico.valor.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <a
            href={getWhatsAppLink(servico.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-md transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(servico)}
            className="flex-1 h-8 text-xs text-gray-600 hover:text-blue-600 hover:border-blue-300"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(servico)}
            className="h-8 w-8 p-0 text-gray-600 hover:text-red-600 hover:border-red-300"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="group bg-white hover:shadow-xl transition-all duration-300 border-0 shadow-md">
      <CardContent className="p-0">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="text-white hover:bg-white/20 flex-shrink-0"
            >
              <Share2 className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{servico.cliente_nome}</h3>
              <Badge className={`${getTipoColor(servico.tipo_servico)} mt-1`}>
                {servico.tipo_servico}
              </Badge>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{formatPhone(servico.telefone)}</span>
            </div>
            <a
              href={getWhatsAppLink(servico.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
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
              <span className="text-sm line-clamp-2">{servico.endereco}</span>
            </div>
          )}

          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors font-semibold border border-blue-200"
            >
              <Navigation className="w-4 h-4" />
              <span className="text-sm">
                {servico.latitude && servico.longitude 
                  ? `📍 ${servico.latitude.toFixed(6)}, ${servico.longitude.toFixed(6)}`
                  : '📍 Ver no Google Maps'
                }
              </span>
            </a>
          )}

          <div className="flex flex-wrap gap-2">
            {servico.dia_semana && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                <Calendar className="w-4 h-4" />
                {servico.dia_semana}
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
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg line-clamp-2">
              {servico.descricao}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(servico)}
              className="flex-1 text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <Pencil className="w-4 h-4 mr-1.5" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(servico)}
              className="text-gray-600 hover:text-red-600 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}