import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';
import { Phone, MapPin, Calendar, Pencil, Trash2, MessageCircle, Navigation, Clock, DollarSign, Share2, CreditCard, CheckCircle, Play, CalendarClock, Eye, AlertTriangle } from 'lucide-react';
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
  const [statusOpen, setStatusOpen] = useState(false);
  // Detecta tap intencional vs scroll: se o usuario mover o dedo enquanto
  // toca no botao, NAO abre o menu (ele estava tentando rolar a pagina).
  const tapStart = useRef({ x: 0, y: 0, time: 0, moved: false });
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
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
    if (tipo?.startsWith('Instalação')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (tipo?.includes('capacitor') || tipo?.includes('gás') || tipo?.includes('defeito')) {
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    }
    return 'bg-white/5 text-gray-300 border-white/10';
  };

  const getStatusConfig = (status) => {
    switch(status) {
      case 'concluido':
        return { label: 'Concluído', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle };
      case 'andamento':
        return { label: 'Em Andamento', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: Play };
      case 'agendado':
        return { label: 'Agendado', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Calendar };
      case 'reagendado':
        return { label: 'Reagendado', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30', icon: CalendarClock };
      default:
        return { label: 'Aberto', color: 'bg-white/5 text-gray-300 border-white/10', icon: Clock };
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
      <div className={`space-y-3 ${isAtrasadoGrave ? 'rounded-lg border-2 border-red-500/60 bg-red-500/10 p-1' : ''}`}>
        {isAtrasadoGrave && (
          <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-md mb-1 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            ATRASO DE {diasAtraso} {diasAtraso === 1 ? 'DIA' : 'DIAS'}
          </div>
        )}
      <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {servico.os_numero && (
              <span className="inline-block text-[10px] font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded mb-1">
                {servico.os_numero}
              </span>
            )}
            <h4 className="font-semibold text-gray-200 break-words">{servico.cliente_nome}</h4>
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
            className="h-8 w-8 text-gray-400 hover:text-gray-200 hover:bg-white/5 flex-shrink-0"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Phone className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs">{formatPhone(servico.telefone)}</span>
          </div>

          {servico.horario && (
            <div className={`flex items-center gap-2 text-sm ${servico.horario_alerta ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
              {servico.horario_alerta
                ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                : <Clock className="w-3.5 h-3.5 text-blue-400" />
              }
              <span className="text-xs">{servico.horario}</span>
              {servico.horario_alerta && <span className="text-xs bg-red-500/20 text-red-300 px-1 rounded">HORA MARCADA</span>}
            </div>
          )}

          {servico.descricao && (
            <div className="text-xs text-gray-400 bg-[#0b1420] px-2 py-1.5 rounded-md line-clamp-2 border border-white/5">
              {servico.descricao}
            </div>
          )}

          {servico.valor > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-xs">R$ {servico.valor.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-white/5">
          <button
            onClick={() => openWhatsApp(servico.telefone)}
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-opacity hover:opacity-80 bg-emerald-500/15 border border-emerald-500/30"
            title="WhatsApp"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowDetalhes(true)}
            className="flex items-center justify-center gap-1.5 flex-1 h-10 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-xs font-semibold rounded-lg transition-colors border border-purple-500/30"
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

        <div className="space-y-2">
          {onStatusChange && (
            <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  // Botao menor (h-9) e nao mais full-width — sobra mais area de
                  // scroll segura ao redor.
                  className="h-9 text-xs font-semibold bg-[#0f1a2b] border-white/10 text-gray-200 hover:bg-white/5 hover:text-gray-100 px-3"
                  style={{ touchAction: 'manipulation' }}
                  onPointerDown={(e) => {
                    // Bloqueia abertura padrao do Radix (que e em pointerdown);
                    // controla via state na onClick (so dispara apos tap valido).
                    e.preventDefault();
                    tapStart.current = { x: e.clientX, y: e.clientY, time: Date.now(), moved: false };
                  }}
                  onPointerMove={(e) => {
                    const { x, y } = tapStart.current;
                    if (Math.abs(e.clientX - x) > 8 || Math.abs(e.clientY - y) > 8) {
                      tapStart.current.moved = true;
                    }
                  }}
                  onClick={(e) => {
                    // So abre se foi tap "limpo" (sem movimento de scroll, < 400ms)
                    const { time, moved } = tapStart.current;
                    const dt = Date.now() - time;
                    if (moved || dt > 400) {
                      e.preventDefault();
                      return;
                    }
                    setStatusOpen(true);
                  }}
                >
                  <StatusIcon className="w-3.5 h-3.5 mr-1" />
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
          {(onEdit || onDelete) && (
            <div className="grid grid-cols-2 gap-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(servico)}
                  className="h-10 text-xs font-semibold bg-[#0f1a2b] border-white/10 text-blue-300 hover:bg-blue-500/15 hover:border-blue-500/40 hover:text-blue-200"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(servico)}
                  className="h-10 text-xs font-semibold bg-[#0f1a2b] border-white/10 text-red-300 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-200"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
          )}
        </div>
      <ServicoDetalhesModal open={showDetalhes} onClose={() => setShowDetalhes(false)} servico={servico} />
      </div>
    );
  }

  return (
    <Card className={`group hover:shadow-md transition-all duration-300 shadow-sm ${
      isAtrasadoGrave
        ? 'border-2 border-red-500/60 bg-red-500/5'
        : 'border border-white/5 bg-[#152236]'
    }`}>
      <CardContent className="p-0">
        {isAtrasadoGrave && (
          <div className="flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-4 py-1.5">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            ⚠ SERVIÇO EM ATRASO — {diasAtraso} {diasAtraso === 1 ? 'DIA' : 'DIAS'} — REQUER ATENÇÃO
          </div>
        )}
        <div className={`p-4 border-b border-white/5 ${isAtrasadoGrave ? 'bg-red-500/10' : 'bg-[#0f1a2b]'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {servico.os_numero && (
                <span className="inline-block text-xs font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded mb-1">
                  {servico.os_numero}
                </span>
              )}
              <h3 className="font-semibold text-lg text-gray-200">{servico.cliente_nome}</h3>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs">
                  {formatTipoServicoCompact(servico.tipo_servico) || '-'}
                </Badge>
                <Badge className={`${statusConfig.color} border text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {isAtrasado && !isAtrasadoGrave && (
                  <Badge className="bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-bold">
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
              className="text-gray-400 hover:text-gray-200 hover:bg-white/5 flex-shrink-0"
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-300">
              <Phone className="w-4 h-4 text-blue-400" />
              <span className="font-medium text-sm">{formatPhone(servico.telefone)}</span>
            </div>
            <button
              onClick={() => openWhatsApp(servico.telefone)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>

          {servico.cpf && (
            <div className="flex items-center gap-2 text-sm text-gray-300 bg-[#0b1420] px-3 py-2 rounded-lg border border-white/5">
              <CreditCard className="w-4 h-4 text-blue-400" />
              <span>CPF: {servico.cpf}</span>
            </div>
          )}

          {servico.endereco && (
            <div className="flex items-start gap-2 text-gray-300">
              <MapPin className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm line-clamp-2">{servico.endereco}</span>
            </div>
          )}

          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-semibold border border-white/10 hover:border-blue-500/40 text-gray-300 hover:text-blue-300 bg-[#0b1420]"
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
              <div className="flex items-center gap-1.5 text-sm text-gray-300 border border-white/10 px-3 py-1.5 rounded-lg bg-[#0b1420]">
                <Calendar className="w-4 h-4 text-blue-400" />
                {servico.dia_semana}
              </div>
            )}
            {servico.horario && (
              <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium ${
                servico.horario_alerta
                  ? 'text-red-300 border-red-500/30 bg-red-500/10'
                  : 'text-gray-300 border-white/10 bg-[#0b1420]'
              }`}>
                {servico.horario_alerta
                  ? <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
                  : <Clock className="w-4 h-4 text-blue-400" />
                }
                {servico.horario}
                {servico.horario_alerta && <span className="ml-1 text-xs font-bold uppercase">⚠ Hora Marcada</span>}
              </div>
            )}
            {servico.valor > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-semibold bg-emerald-500/10">
                <DollarSign className="w-4 h-4" />
                R$ {servico.valor.toFixed(2)}
              </div>
            )}
          </div>

          {servico.descricao && (
            <p className="text-sm text-gray-400 border border-white/5 p-3 rounded-lg line-clamp-2 bg-[#0b1420]">
              {servico.descricao}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="flex-1 bg-[#0f1a2b] border-white/10 text-gray-200 hover:bg-white/5 hover:text-gray-100">
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
              className="bg-[#0f1a2b] border-white/10 text-blue-300 hover:bg-blue-500/15 hover:border-blue-500/40 hover:text-blue-200"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(servico)}
              className="bg-[#0f1a2b] border-white/10 text-red-300 hover:bg-red-500/15 hover:border-red-500/40 hover:text-red-200"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}