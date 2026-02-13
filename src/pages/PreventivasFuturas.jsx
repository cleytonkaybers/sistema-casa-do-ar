import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, MapPin, Calendar, MessageCircle, Navigation, Search, Loader2, Clock, Wrench } from 'lucide-react';
import { format, differenceInDays, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PreventivasFuturasPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clientes = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list('-created_date'),
  });

  const { data: servicos = [], isLoading: loadingServicos } = useQuery({
    queryKey: ['servicos'],
    queryFn: () => base44.entities.Servico.list('-created_date'),
  });

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

  const getGoogleMapsLink = (item) => {
    if (item.latitude && item.longitude) {
      return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
    }
    if (item.endereco) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.endereco)}`;
    }
    return null;
  };

  const getManutencaoStatus = (proximaManutencao) => {
    if (!proximaManutencao) return null;
    const daysUntil = differenceInDays(new Date(proximaManutencao), new Date());
    
    if (daysUntil < 0) {
      return { 
        label: `Atrasada (${Math.abs(daysUntil)} dias)`, 
        color: 'bg-red-100 text-red-700 border-red-300',
        priority: 1
      };
    }
    if (daysUntil <= 30) {
      return { 
        label: `${daysUntil} dias`, 
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        priority: 2
      };
    }
    if (daysUntil <= 90) {
      return { 
        label: `${daysUntil} dias`, 
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        priority: 3
      };
    }
    return { 
      label: `${daysUntil} dias`, 
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      priority: 4
    };
  };

  // Preparar dados de clientes com manutenção programada
  const clientesComManutencao = clientes
    .map(cliente => {
      // Se não tem próxima manutenção mas tem última, calcula 6 meses
      let proximaManutencao = cliente.proxima_manutencao;
      if (!proximaManutencao && cliente.ultima_manutencao) {
        const dataUltima = new Date(cliente.ultima_manutencao);
        proximaManutencao = format(addMonths(dataUltima, 6), 'yyyy-MM-dd');
      }
      
      return {
        ...cliente,
        tipo: 'cliente',
        proximaManutencao,
        status: getManutencaoStatus(proximaManutencao)
      };
    })
    .filter(c => c.proximaManutencao && c.status);

  // Preparar dados de serviços
  const servicosAtivos = servicos
    .filter(s => s.ativo !== false)
    .map(servico => ({
      ...servico,
      tipo: 'servico',
      status: { 
        label: 'Serviço Ativo', 
        color: 'bg-green-100 text-green-700 border-green-300',
        priority: 3
      }
    }));

  // Combinar e filtrar
  const todosItens = [...clientesComManutencao, ...servicosAtivos]
    .filter(item => {
      const matchNome = item.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTelefone = item.telefone?.includes(searchTerm);
      return matchNome || matchTelefone;
    })
    .sort((a, b) => (a.status?.priority || 99) - (b.status?.priority || 99));

  const isLoading = loadingClientes || loadingServicos;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Preventivas Futuras</h1>
          <p className="text-gray-500 mt-1">Manutenções programadas e serviços ativos</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : todosItens.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-gray-500">
            {searchTerm 
              ? 'Nenhum resultado encontrado'
              : 'Nenhuma manutenção programada ou serviço ativo'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {todosItens.map((item) => {
            const isCliente = item.tipo === 'cliente';
            const mapsLink = getGoogleMapsLink(item);

            return (
              <Card key={`${item.tipo}-${item.id}`} className="bg-white hover:shadow-xl transition-all duration-300 border-0 shadow-md">
                <CardContent className="p-0">
                  <div className={`p-4 text-white ${isCliente ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">
                          {isCliente ? item.nome : item.cliente_nome}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {isCliente ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <Wrench className="w-4 h-4" />
                          )}
                          <span className="text-sm">
                            {isCliente ? 'Cliente' : item.tipo_servico}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{formatPhone(item.telefone)}</span>
                      </div>
                      <a
                        href={getWhatsAppLink(item.telefone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-full transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </a>
                    </div>

                    {item.endereco && (
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm line-clamp-2">{item.endereco}</span>
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
                        <span className="text-sm">Ver no Google Maps</span>
                      </a>
                    )}

                    {isCliente && item.proximaManutencao && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            Próxima: {format(new Date(item.proximaManutencao), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${item.status.color}`}>
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">{item.status.label}</span>
                        </div>
                      </div>
                    )}

                    {!isCliente && (
                      <div className="flex flex-wrap gap-2">
                        {item.dia_semana && (
                          <Badge variant="outline" className="bg-gray-50">
                            <Calendar className="w-3 h-3 mr-1" />
                            {item.dia_semana}
                          </Badge>
                        )}
                        {item.horario && (
                          <Badge variant="outline" className="bg-gray-50">
                            <Clock className="w-3 h-3 mr-1" />
                            {item.horario}
                          </Badge>
                        )}
                        <Badge className={item.status.color}>
                          {item.status.label}
                        </Badge>
                      </div>
                    )}

                    {item.observacoes && (
                      <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg line-clamp-2">
                        {item.observacoes}
                      </p>
                    )}

                    {!isCliente && item.descricao && (
                      <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg line-clamp-2">
                        {item.descricao}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}