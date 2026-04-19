import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { Phone, MapPin, Calendar, Pencil, Trash2, MessageCircle, Navigation, Clock, DollarSign, Share2, CreditCard, CheckCircle, Pause, Play, CalendarClock, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ServicoDetalhesModal from './ServicoDetalhesModal';
import TipoServicoDisplay from '@/components/TipoServicoDisplay';
import { formatTipoServicoCompact } from '@/utils';

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

  const openWhatsApp = (phone) => {
    const cleaned = phone?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/55${cleaned}`, '_blank');
  };

  const getGoogleMapsLink = () => {
    if (servico.google_maps_link) return servico.google_maps_link;
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
      const shareText = `📋 *${servico.cliente_nome}* - ${formatTipoServicoCompact(servico.tipo_servico)}\n\n📞 Telefone: ${formatPhone(servico.telefone)}\n\n📍 Localização: ${servico.endereco || 'Não informado'}\n${mapsLink ? `🗺️ ${mapsLink}\n` : ''}\n${servico.dia_semana ? `📅 ${servico.dia_semana}` : ''}\n${servico.horario ? `🕐 ${servico.horario}` : ''}\n${servico.descricao ? `📝 ${servico.descricao}` : ''}`;

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

  const today = startOfDay(new Date());
  const diasAtraso = servico.data_programada && servico.status !== 'concluido'
    ? differenceInDays(today, startOfDay(parseISO(servico.data_programada)))
    : 0;
  const isAtrasado = diasAtraso >= 1;
  const isAtrasadoGrave = diasAtraso >= 2;

  if (compact) {
    return (
      <div className={`space-y-3 ${isAtrasadoGrave ? 'rounded-lg border-2 border-red-400 bg-red-50 p-1' : ''}`}>
        {isAtrasadoGrave && (
          <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-md mb-1 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            ATRASO DE {diasAtraso} {diasAtraso === 1 ? 'DIA' : 'DIAS'}
          </div>
        )}
      <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {servico.os_numero && (
              <span className="inline-block text-[10px] font-bold text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded mb-1">
                {servico.os_numero}
              </span>
            )}
            <h4 className="font-semibold text-gray-800 break-words">{servico.cliente_nome}</h4>
            <TipoServicoDisplay value={servico.tipo_servico} className="mt-0.5 [&_span.text-sm]:text-xs" />
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
            <div className={`flex items-center gap-2 text-sm ${servico.horario_alerta ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              {servico.horario_alerta
                ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                : <Clock className="w-3.5 h-3.5 text-blue-400" />
              }
              <span className="text-xs">{servico.horario}</span>
              {servico.horario_alerta && <span className="text-xs bg-red-100 text-red-600 px-1 rounded">HORA MARCADA</span>}
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

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => openWhatsApp(servico.telefone)}
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-opacity hover:opacity-80 bg-green-50 border border-green-200"
            title="WhatsApp"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowDetalhes(true)}
            className="flex items-center justify-center gap-1.5 flex-1 h-10 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-semibold rounded-lg transition-colors"
            title="Ver detalhes"
          >
            <Eye className="w-4 h-4" />
            <span>Ver</span>
          </button>
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Navigation className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onStatusChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1 h-10 text-xs font-semibold">
                  <StatusIcon className="w-4 h-4 mr-1" />
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
              className="h-10 w-10 p-0 text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(servico)}
              className="h-10 w-10 p-0 text-gray-600 hover:text-red-600 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      <ServicoDetalhesModal open={showDetalhes} onClose={() => setShowDetalhes(false)} servico={servico} />
      </div>
    );
  }

  return (
    <Card className={`group hover:shadow-md transition-all duration-300 shadow-sm ${
      isAtrasadoGrave
        ? 'border-2 border-red-500 bg-red-50'
        : 'border border-gray-200 bg-white'
    }`}>
      <CardContent className="p-0">
        {isAtrasadoGrave && (
          <div className="flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-4 py-1.5">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            ⚠ SERVIÇO EM ATRASO — {diasAtraso} {diasAtraso === 1 ? 'DIA' : 'DIAS'} — REQUER ATENÇÃO
          </div>
        )}
        <div className="p-4 border-b border-gray-100" style={{background: isAtrasadoGrave ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' : 'linear-gradient(135deg, #eff6ff, #fefce8)'}}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {servico.os_numero && (
                <span className="inline-block text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded mb-1">
                  {servico.os_numero}
                </span>
              )}
              <h3 className="font-semibold text-lg text-gray-800">{servico.cliente_nome}</h3>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs">
                  {formatTipoServicoCompact(servico.tipo_servico) || '-'}
                </Badge>
                <Badge className={`${statusConfig.color} border text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {isAtrasado && !isAtrasadoGrave && (
                  <Badge className="bg-red-100 text-red-600 border border-red-300 text-xs font-bold">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Atrasado
                  </Badge>
                )}
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
            <button
              onClick={() => openWhatsApp(servico.telefone)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>

          {servico.cpf && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>CPF: {servico.cpf}</span>
            </div>
          )}

          {servico.endereco && (
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm line-clamp-2">{servico.endereco}</span>
            </div>
          )}

          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-semibold border border-gray-200 hover:border-blue-400 text-gray-600 hover:text-blue-600 bg-gray-50"
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
              <div className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg bg-gray-50">
                <Calendar className="w-4 h-4 text-blue-400" />
                {servico.dia_semana}
              </div>
            )}
            {servico.horario && (
              <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium ${
                servico.horario_alerta
                  ? 'text-red-600 border-red-300 bg-red-50'
                  : 'text-gray-600 border-gray-200 bg-gray-50'
              }`}>
                {servico.horario_alerta
                  ? <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                  : <Clock className="w-4 h-4 text-blue-400" />
                }
                {servico.horario}
                {servico.horario_alerta && <span className="ml-1 text-xs font-bold uppercase">⚠ Hora Marcada</span>}
              </div>
            )}
            {servico.valor > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-green-600 border border-green-200 px-3 py-1.5 rounded-lg font-semibold bg-green-50">
                <DollarSign className="w-4 h-4" />
                R$ {servico.valor.toFixed(2)}
              </div>
            )}
          </div>

          {servico.descricao && (
            <p className="text-sm text-gray-500 border border-gray-100 p-3 rounded-lg line-clamp-2 bg-gray-50">
              {servico.descricao}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1 text-gray-700 hover:bg-gray-50">
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
              className="text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(servico)}
              className="text-gray-600 hover:text-red-500 hover:border-red-300"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}