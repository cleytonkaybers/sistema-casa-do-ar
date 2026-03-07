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
  Tag,
  Phone,
  MapPin,
  CreditCard,
  Users,
  History,
  ArrowRight
} from 'lucide-react';


function InfoRow({ icon: Icon, label, value, className = '' }) {
  if (!value) return null;
  return (
    <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
      <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </p>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  );
}

export default function DetalhesModal({ open, onClose, atendimento }) {
  if (!atendimento) return null;

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    try {
      return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return date;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Detalhes do Serviço</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente Header */}
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
            <div className="flex flex-col gap-1 items-end">
              <Badge className={`${statusColors[atendimento.status]} border`}>
                {atendimento.status}
              </Badge>
              <Badge className={atendimento.origem === 'servico' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-cyan-100 text-cyan-700 border-cyan-200'}>
                {atendimento.origem === 'servico' ? 'Serviço' : 'Atendimento'}
              </Badge>
            </div>
          </div>

          {/* Dados de Contato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoRow icon={Phone} label="Telefone" value={atendimento.telefone} />
            <InfoRow icon={CreditCard} label="CPF" value={atendimento.cpf} />
          </div>

          {/* Endereço / Localização */}
          {atendimento.endereco && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
                <MapPin className="w-4 h-4" />
                Endereço
              </p>
              <p className="font-medium text-gray-800">{atendimento.endereco}</p>
              {atendimento.latitude && atendimento.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${atendimento.latitude},${atendimento.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                >
                  Ver no mapa →
                </a>
              )}
            </div>
          )}

          {/* Data, Horário, Dia da Semana */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
                <Calendar className="w-4 h-4" />
                Data
              </p>
              <p className="font-medium text-gray-800">
                {formatDate(atendimento.data_atendimento)}
              </p>
            </div>
            <InfoRow icon={Clock} label="Horário" value={atendimento.horario} />
            <InfoRow icon={Tag} label="Dia da Semana" value={atendimento.dia_semana} />
          </div>

          {/* Tipo de Serviço */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
              <Wrench className="w-4 h-4" />
              Tipo de Serviço
            </p>
            <p className="font-medium text-gray-800">{atendimento.tipo_servico}</p>
          </div>

          {/* Valor */}
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
              <DollarSign className="w-4 h-4" />
              Valor
            </p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(atendimento.valor)}
            </p>
          </div>

          {/* Equipe */}
          {atendimento.equipe_nome && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
                <Users className="w-4 h-4" />
                Equipe Responsável
              </p>
              <p className="font-medium text-gray-800">{atendimento.equipe_nome}</p>
            </div>
          )}

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

          {/* Observações de conclusão */}
          {atendimento.observacoes_conclusao && (
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-4 h-4" />
                Observações da Conclusão
              </p>
              <p className="text-gray-700 whitespace-pre-wrap">{atendimento.observacoes_conclusao}</p>
            </div>
          )}

          {/* Usuário que concluiu */}
          {atendimento.usuario_conclusao && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-1">
                <User className="w-4 h-4" />
                Concluído por
              </p>
              <p className="font-medium text-gray-800">{atendimento.usuario_conclusao}</p>
              {atendimento.data_conclusao && (
                <p className="text-xs text-gray-400 mt-1">
                  em {format(new Date(atendimento.data_conclusao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </div>
          )}

          {/* Histórico de Status */}
          {(() => {
            if (!atendimento.detalhes) return null;
            let detalhes;
            try { detalhes = typeof atendimento.detalhes === 'string' ? JSON.parse(atendimento.detalhes) : atendimento.detalhes; }
            catch { return null; }
            const historico = detalhes?.historico_status;
            if (!historico?.length) return null;

            const statusLabels = {
              aberto: 'Aberto', andamento: 'Em Andamento', concluido: 'Concluído',
              agendado: 'Agendado', reagendado: 'Reagendado'
            };
            const statusColors = {
              aberto: 'bg-gray-100 text-gray-700',
              andamento: 'bg-blue-100 text-blue-700',
              concluido: 'bg-green-100 text-green-700',
              agendado: 'bg-yellow-100 text-yellow-700',
              reagendado: 'bg-orange-100 text-orange-700'
            };

            return (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mb-3">
                  <History className="w-4 h-4" />
                  Histórico de Alterações de Status
                </p>
                <div className="space-y-2">
                  {historico.map((h, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-sm bg-white border border-gray-100 rounded-lg p-3">
                      <Badge className={`${statusColors[h.status_anterior] || 'bg-gray-100 text-gray-700'} text-xs border-0`}>
                        {statusLabels[h.status_anterior] || h.status_anterior}
                      </Badge>
                      <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <Badge className={`${statusColors[h.status_novo] || 'bg-gray-100 text-gray-700'} text-xs border-0`}>
                        {statusLabels[h.status_novo] || h.status_novo}
                      </Badge>
                      <span className="text-gray-400 text-xs ml-auto">
                        {h.usuario} · {h.data_alteracao ? format(new Date(h.data_alteracao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}