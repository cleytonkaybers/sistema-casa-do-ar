import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  MapPin, 
  Calendar,
  Pencil,
  Trash2,
  MessageCircle,
  Navigation,
  Snowflake,
  Clock,
  ClipboardList
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClienteCard({ cliente, onEdit, onDelete, onViewHistory }) {
  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const getWhatsAppLink = (phone) => {
    const cleaned = phone?.replace(/\D/g, '') || '';
    return `https://wa.me/55${cleaned}`;
  };

  const getGoogleMapsLink = () => {
    if (cliente.latitude && cliente.longitude) {
      return `https://www.google.com/maps?q=${cliente.latitude},${cliente.longitude}`;
    }
    if (cliente.endereco) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.endereco)}`;
    }
    return null;
  };

  const getMaintenanceStatus = () => {
    if (!cliente.proxima_manutencao) return null;
    const daysUntil = differenceInDays(new Date(cliente.proxima_manutencao), new Date());
    
    if (daysUntil < 0) {
      return { label: 'Manutenção Atrasada', color: 'bg-red-100 text-red-700 border-red-200' };
    }
    if (daysUntil <= 30) {
      return { label: `Manutenção em ${daysUntil} dias`, color: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    return null;
  };

  const maintenanceStatus = getMaintenanceStatus();
  const mapsLink = getGoogleMapsLink();

  return (
    <Card className="group bg-white hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden">
      <CardContent className="p-0">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{cliente.nome}</h3>
              {cliente.tipo_equipamento && (
                <div className="flex items-center gap-1.5 mt-1 text-blue-100">
                  <Snowflake className="w-3.5 h-3.5" />
                  <span className="text-sm">{cliente.tipo_equipamento}</span>
                </div>
              )}
            </div>
            <Badge 
              variant="secondary" 
              className={`
                ${cliente.status === 'Ativo' ? 'bg-white/20 text-white' : ''}
                ${cliente.status === 'Inativo' ? 'bg-gray-500/50 text-white' : ''}
                ${cliente.status === 'Pendente' ? 'bg-amber-400/50 text-white' : ''}
              `}
            >
              {cliente.status || 'Ativo'}
            </Badge>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-4 space-y-4">
          {/* Telefone com WhatsApp */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{formatPhone(cliente.telefone)}</span>
            </div>
            <a
              href={getWhatsAppLink(cliente.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          </div>

          {/* Endereço */}
          {cliente.endereco && (
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 text-gray-600 flex-1">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm line-clamp-2">{cliente.endereco}</span>
              </div>
              {mapsLink && (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors flex-shrink-0"
                  title="Abrir no Google Maps"
                >
                  <Navigation className="w-4 h-4" />
                </a>
              )}
            </div>
          )}

          {/* Cidade e Bairro */}
          {(cliente.cidade || cliente.bairro) && (
            <div className="text-sm text-gray-500">
              {cliente.bairro && <span>{cliente.bairro}</span>}
              {cliente.bairro && cliente.cidade && <span> • </span>}
              {cliente.cidade && <span>{cliente.cidade}</span>}
            </div>
          )}

          {/* Última manutenção */}
          {cliente.ultima_manutencao && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>Última manutenção: {format(new Date(cliente.ultima_manutencao), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          )}

          {/* Alerta de manutenção */}
          {maintenanceStatus && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${maintenanceStatus.color}`}>
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{maintenanceStatus.label}</span>
            </div>
          )}

          {/* Observações */}
          {cliente.observacoes && (
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg line-clamp-2">
              {cliente.observacoes}
            </p>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewHistory(cliente)}
              className="flex-1 text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <ClipboardList className="w-4 h-4 mr-1.5" />
              Histórico
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(cliente)}
              className="text-gray-600 hover:text-blue-600 hover:border-blue-300"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(cliente)}
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