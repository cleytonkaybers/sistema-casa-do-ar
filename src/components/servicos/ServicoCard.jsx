import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, Calendar, Pencil, Trash2, MessageCircle, Navigation, Clock, DollarSign, Share2, CreditCard, CheckCircle, Pause, Play, CalendarClock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ServicoDetalhesModal from './ServicoDetalhesModal';

export default function ServicoCard({ servico, onEdit, onDelete, onStatusChange, onShare, compact = false, equipes = [] }) {
  const [showDetalhes, setShowDetalhes] = useState(false);
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

  const handleShare = () => {
    if (onShare) {
      // Usar o modal de compartilhamento se disponível
      onShare(servico);
    } else {
      // Fallback para compartilhamento nativo
      const mapsLink = getGoogleMapsLink();
      const shareText = `📋 *${servico.cliente_nome}* - ${servico.tipo_servico}\n\n📞 Telefone: ${formatPhone(servico.telefone)}\n\n📍 Localização: ${servico.endereco || 'Não informado'}\n${mapsLink ? `🗺️ ${mapsLink}\n` : ''}\n${servico.dia_semana ? `📅 ${servico.dia_semana}` : ''}\n${servico.horario ? `🕐 ${servico.horario}` : ''}\n${servico.descricao ? `📝 ${servico.descricao}` : ''}`;

      if (navigator.share) {
        navigator.share({ title: `Serviço: ${servico.cliente_nome}`, text: shareText }).catch(error => {
          if (error.name !== 'AbortError') {
            navigator.clipboard.writeText(shareText);
            toast.success('Informações copiadas!');
          }
        });
      } else {
        navigator.clipboard.writeText(shareText);
        toast.success('Informações copiadas!');
      }
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

  const getStatusConfig = (status) => {
    switch(status) {
      case 'concluido':
        return { label: 'Concluído', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle };
      case 'andamento':
        return { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Play };
      case 'agendado':
        return { label: 'Agendado', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Calendar };
      case 'reagendado':
        return { label: 'Reagendado', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: CalendarClock };
      default:
        return { label: 'Aberto', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Clock };
    }
  };

  const statusConfig = getStatusConfig(servico.status || 'aberto');
  const StatusIcon = statusConfig.icon;

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-800 break-words">{servico.cliente_nome}</h4>
            <p className="text-xs text-gray-500 mt-0.5">{servico.tipo_servico}</p>
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Badge className={`${statusConfig.color} text-xs border`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              {servico.equipe_nome && (() => {
                const equipe = equipes.find(e => e.id === servico.equipe_id);
                const cor = equipe?.cor || '#a855f7';
                return (
                  <Badge
                    className="text-xs border font-semibold"
                    style={{
                      backgroundColor: cor + '22',
                      color: cor,
                      borderColor: cor + '55',
                    }}
                  >
                    {servico.equipe_nome}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="h-8 w-8 text-gray-400 hover:text-gray-700 flex-shrink-0"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs">{formatPhone(servico.telefone)}</span>
          </div>
          
          {servico.horario && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs">{servico.horario}</span>
            </div>
          )}

          {servico.descricao && (
            <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1.5 rounded-md line-clamp-2 border border-gray-100">
              {servico.descricao}
            </div>
          )}

          {servico.valor > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-xs">R$ {servico.valor.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-1.5 pt-2 border-t border-gray-100">
          <a
            href={getWhatsAppLink(servico.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-7 h-7 rounded-md transition-opacity hover:opacity-80"
            title="WhatsApp"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6" />
          </a>
          <button
            onClick={() => setShowDetalhes(true)}
            className="flex items-center justify-center gap-1 px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium rounded-md transition-colors"
            title="Ver detalhes"
          >
            <Eye className="w-3 h-3" />
            <span>Ver</span>
          </button>
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md transition-colors"
            >
              <Navigation className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onStatusChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                  <StatusIcon className="w-3 h-3 mr-1" />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'aberto')}>
                  <Clock className="w-3 h-3 mr-2" />
                  Aberto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'andamento')}>
                  <Play className="w-3 h-3 mr-2" />
                  Em Andamento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'agendado')}>
                  <Calendar className="w-3 h-3 mr-2" />
                  Agendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'concluido')}>
                  <CheckCircle className="w-3 h-3 mr-2" />
                  Concluído
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(servico)}
              className="h-8 w-8 p-0 text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <Pencil className="w-3 h-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(servico)}
              className="h-8 w-8 p-0 text-gray-600 hover:text-red-600 hover:border-red-300"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      <ServicoDetalhesModal open={showDetalhes} onClose={() => setShowDetalhes(false)} servico={servico} />
      </div>
    );
  }

  return (
    <Card className="group hover:shadow-md transition-all duration-300 border border-gray-200 shadow-sm bg-white">
      <CardContent className="p-0">
        <div className="p-4 border-b border-gray-100" style={{background: 'linear-gradient(135deg, #eff6ff, #fefce8)'}}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-800">{servico.cliente_nome}</h3>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs">
                  {servico.tipo_servico}
                </Badge>
                <Badge className={`${statusConfig.color} border text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex-shrink-0"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
              <Phone className="w-4 h-4 text-blue-400" />
              <span className="font-medium text-sm">{formatPhone(servico.telefone)}</span>
            </div>
            <a
              href={getWhatsAppLink(servico.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>

          {servico.cpf && (
            <div className="flex items-center gap-2 text-sm text-blue-200 bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-800/40">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>CPF: {servico.cpf}</span>
            </div>
          )}

          {servico.endereco && (
            <div className="flex items-start gap-2 text-blue-200">
              <MapPin className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm line-clamp-2">{servico.endereco}</span>
            </div>
          )}

          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-semibold border border-blue-700/50 hover:border-yellow-600/50 text-blue-200 hover:text-yellow-400"
              style={{backgroundColor: 'rgba(30,64,175,0.2)'}}
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
              <div className="flex items-center gap-1.5 text-sm text-blue-200 border border-blue-800/40 px-3 py-1.5 rounded-lg" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
                <Calendar className="w-4 h-4 text-blue-400" />
                {servico.dia_semana}
              </div>
            )}
            {servico.horario && (
              <div className="flex items-center gap-1.5 text-sm text-blue-200 border border-blue-800/40 px-3 py-1.5 rounded-lg" style={{backgroundColor: 'rgba(30,64,175,0.15)'}}>
                <Clock className="w-4 h-4 text-blue-400" />
                {servico.horario}
              </div>
            )}
            {servico.valor > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-green-300 border border-green-800/40 px-3 py-1.5 rounded-lg font-semibold" style={{backgroundColor: 'rgba(16,185,129,0.1)'}}>
                <DollarSign className="w-4 h-4" />
                R$ {servico.valor.toFixed(2)}
              </div>
            )}
          </div>

          {servico.descricao && (
            <p className="text-sm text-blue-300/70 border border-blue-800/40 p-3 rounded-lg line-clamp-2" style={{backgroundColor: 'rgba(30,64,175,0.1)'}}>
              {servico.descricao}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-blue-800/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1 border-blue-700/50 text-blue-200 hover:text-white hover:bg-blue-800/40">
                  <StatusIcon className="w-4 h-4 mr-1.5" />
                  {statusConfig.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'aberto')}>
                  <Clock className="w-4 h-4 mr-2" />
                  Aberto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'andamento')}>
                  <Play className="w-4 h-4 mr-2" />
                  Em Andamento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'agendado')}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Agendar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(servico, 'concluido')}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Concluído
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(servico)}
              className="border-blue-700/50 text-blue-300 hover:text-yellow-400 hover:border-yellow-600/50"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(servico)}
              className="border-blue-700/50 text-blue-300 hover:text-red-400 hover:border-red-600/50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}